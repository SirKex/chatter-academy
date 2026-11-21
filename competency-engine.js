(function (root, factory) {
  const api = typeof module !== 'undefined' && module.exports ? factory(require('./assessment-model.js'), require('./scenario-definitions.js'), require('./critical-flags.js'), require('./text-utils.js'), require('./evaluation-pipeline.js')) : factory(root.AssessmentModel, root.ScenarioDefinitions, root.CriticalFlagEngine, root.TextUtils, root.EvaluationPipeline);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CompetencyEngine = api;
})(typeof window !== 'undefined' ? window : globalThis, function (Model, Scenarios, CriticalFlagEngine, TextUtils, EvaluationPipeline) {
  const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, n));
  const COMPETENCY_WEIGHTS = Object.freeze({ rapport: 0.40, sales: 0.25, objectionHandling: 0.20, boundaries: 0.15 });
  const norm = TextUtils.normalize;
  const contains = (text, re) => re.test(text);
  const candidateMessages = transcript => transcript.filter(m => m.role === 'candidate');
  const fanMessages = transcript => transcript.filter(m => m.role === 'fan');
  const evidence = (message, explanation, owner) => ({ id: message.id || null, transcriptMessageIds: message.id ? [message.id] : [], quote: message.text, explanation, source: owner, kind: 'CANDIDATE_BEHAVIOR' });
  const uniqueEvidence = ev => [...new Map(ev.map(item => [`${item.id || ''}|${item.quote}`, item])).values()];
  const base = (competency, score, reasoning, ev, strengths, weaknesses, recommendations, confidence, sufficiency) => { const distinct = uniqueEvidence(ev); if (!distinct.length) return Model.competencyResult({ competency, status: 'INSUFFICIENT_EVIDENCE', reasoning, evidence: [], strengths: [], weaknesses: ['Insufficient meaningful evidence in transcript'], recommendations, confidence: null, evidenceSufficiency: 'INSUFFICIENT' }); return Model.competencyResult({ competency, status: 'ASSESSED', score: Math.round(clamp(score)), reasoning, evidence: distinct, strengths, weaknesses, recommendations, confidence: null, evidenceSufficiency: sufficiency }); };
  const notAssessed = competency => Model.competencyResult({ competency, status: 'NOT_ASSESSED' });
  function languageQuality(candidates) {
    const pidgin = candidates.filter(m => contains(m.text, /\b(wetin|dey|abi|na so|una|una dey|i wan|no vex|abeg|make i|go dey|sha|sabi| oga|how far)\b/i));
    const broken = candidates.filter(m => contains(m.text, /\b(me go|is you|yesterday night|discuss about|advices|informations|more better|she don't|he don't|i no|we was|they was)\b/i));
    const awkward = candidates.filter(m => contains(m.text, /\b(myself i|kindly revert|do the needful|what is your good name|i am hearing you|send me your own|open your camera)\b/i));
    const acceptable = candidates.filter(m => contains(m.text, /\b(gonna|wanna|gotta|kinda|lemme|yeah|yep|nah|y'all|that's|it's|you're|we're|I'm|I've|ain't|pretty cool|cool|chill|no worries|my bad|got it)\b/i));
    const total = candidates.length || 1;
    const score = clamp(82 + Math.min(8, acceptable.length * 2) - (pidgin.length / total) * 70 - (broken.length / total) * 60 - (awkward.length / total) * 35);
    const ev = [...pidgin.slice(0, 2).map(m => evidence(m, 'Contains a provisional regional or nonstandard-language marker requiring contextual review.', 'rapport.languageQuality')), ...broken.slice(0, 2).map(m => evidence(m, 'Contains a material grammar or phrasing error that may sound unnatural to an American audience.', 'rapport.languageQuality')), ...awkward.slice(0, 2).map(m => evidence(m, 'Contains phrasing that may sound noticeably unnatural in American conversation.', 'rapport.languageQuality')), ...acceptable.slice(0, 2).map(m => evidence(m, 'Uses an acceptable conversational form such as a contraction or colloquial expression.', 'rapport.languageQuality'))];
    const weaknesses = []; if (pidgin.length) weaknesses.push('Possible regional or nonstandard language marker requires contextual review'); if (broken.length) weaknesses.push('Material grammar errors affect naturalness'); if (awkward.length) weaknesses.push('Some phrasing may sound unnatural to an American audience');
    return base('rapport.languageQuality', score, 'Evaluates communication naturalness separately from formal writing style.', ev, acceptable.length ? ['Uses natural conversational forms'] : [], weaknesses, weaknesses.length ? ['Use proper English or natural American conversational English consistently.'] : ['Maintain the current natural conversational register.'], ev.length ? 0.78 : 0.45, ev.length ? 'PARTIAL' : 'INSUFFICIENT');
  }

  function rapport(transcript) {
    const candidates = candidateMessages(transcript), fans = fanMessages(transcript), text = candidates.map(m => m.text).join(' '), lower = norm(text);
    const fanWords = fans.flatMap(m => norm(m.text).split(' ').filter(w => w.length > 4));
    const callbacks = candidates.filter(m => fanWords.some(w => norm(m.text).includes(w)));
    const meaningful = candidates.filter(m => callbacks.includes(m) && contains(m.text, /\b(that sounds|i understand|proud|glad|sorry|exciting|must be|after|because|helps|switch off|demanding|hard|great that)\b/i));
    const generic = candidates.filter(m => contains(m.text, /\b(how are you|what do you do|where are you from|how was your day)\b/i));
    const open = candidates.filter(m => m.text.includes('?') && m.text.split(' ').length >= 6);
    const empathy = candidates.filter(m => contains(m.text, /\b(that sounds|i'm sorry|congratulations|exciting|proud|understand|must be|glad|rough|happy for)\b/i));
    const repeated = generic.length > 1 && new Set(generic.map(m => norm(m.text))).size < generic.length;
    const personalization = clamp(38 + callbacks.length * 18 + meaningful.length * 12 - (generic.length * 3));
    const listening = clamp(38 + meaningful.length * 18 + callbacks.length * 8 - generic.length * 12);
    const conversation = clamp(42 + open.length * 13 + (candidates.length >= 3 ? 10 : 0) - generic.length * 8 - (repeated ? 12 : 0));
    const emotional = clamp(45 + empathy.length * 18);
    const curiosity = clamp(38 + open.length * 15 + meaningful.length * 8 - generic.length * 7);
    const flow = clamp(55 + (candidates.length >= 2 ? 12 : 0) - (repeated ? 18 : 0));
    const make = (name, score, ev, strengths, weaknesses, recommendation) => base(`rapport.${name}`, score, recommendation, ev, strengths, weaknesses, [recommendation], ev.length ? 0.72 : 0.35, ev.length >= 2 ? 'SUFFICIENT' : ev.length ? 'PARTIAL' : 'INSUFFICIENT');
    return [
      make('personalization', personalization, callbacks.slice(0, 3).map(m => evidence(m, 'Tailors the reply using fan context.', 'rapport.personalization')), callbacks.length ? ['Uses details supplied by the fan'] : [], generic.length ? ['Some questions remain generic'] : [], 'Tailor the next reply to one concrete fan detail.'),
      make('activeListening', listening, meaningful.slice(0, 3).map(m => evidence(m, 'Recognizes and responds to information rather than only asking a new question.', 'rapport.activeListening')), meaningful.length ? ['Builds on information already shared'] : [], generic.length ? ['Repeated generic questioning weakens listening evidence'] : [], 'Reflect the meaning of the fan’s last answer before asking another question.'),
      make('conversationBuilding', conversation, open.slice(0, 3).map(m => evidence(m, 'Uses an open question to invite a substantive response.', 'rapport.conversationBuilding')), open.length ? ['Creates openings for the fan to elaborate'] : [], repeated ? ['Question pattern becomes repetitive'] : [], 'Use specific follow-up questions instead of a question sequence.'),
      make('emotionalIntelligence', emotional, empathy.slice(0, 3).map(m => evidence(m, 'Acknowledges the fan’s emotional context.', 'rapport.emotionalIntelligence')), empathy.length ? ['Acknowledges emotional context'] : [], [], 'Name the emotional context before moving the conversation forward.'),
      make('curiosity', curiosity, open.slice(0, 3).map(m => evidence(m, 'Shows curiosity through an answerable, open-ended prompt.', 'rapport.curiosity')), open.length ? ['Shows curiosity beyond surface-level prompts'] : [], generic.length ? ['Curiosity is expressed through generic prompts'] : [], 'Ask a question grounded in what the fan just shared.')
    ];
  }

  function sales(transcript, stages) {
    const candidates = candidateMessages(transcript), fans = fanMessages(transcript), actionRecords = stages?.candidateActions || [];
    const validOffers = actionRecords.filter(a => a.opportunityResponse && a.isOffer);
    const sells = candidates.filter(m => validOffers.some(a => a.messageId === m.id));
    const offerRecords = validOffers;
    const pressure = offerRecords.filter(a => a.hasPressure);
    const valueRecords = offerRecords.filter(a => a.hasValueFraming);
    const autonomyRecords = offerRecords.filter(a => a.hasAutonomy && !a.hasPressure);
    const opportunityFan = fans.filter(f => stages?.context?.opportunityMessageIds?.includes(f.id));
    const context = sells.filter(m => opportunityFan.some(f => TextUtils.overlap(m.text, f.text) >= 1));
    const uniqueOffers = [...new Map(sells.map(m => [norm(m.text), m])).values()];
    const repeatedOffers = sells.length - uniqueOffers.length;
    const fallbackEvidence = candidates.slice(-1).map(m => evidence(m, 'No valid sales offer was observed after the fan expressed interest.', 'sales.behavior-missing'));
    const evFor = (items, label, owner) => items.length ? items.slice(0, 2).map(m => evidence(m, label, owner)) : fallbackEvidence;
    if (!stages?.context?.salesOpportunity) return ['opportunityRecognition','salesTiming','offerRelevance','valueFraming','conversion','nonPressureSelling'].map(name => ({ ...notAssessed(`sales.${name}`), status: 'INSUFFICIENT_EVIDENCE', weaknesses: ['No genuine positive sales opportunity was observed'], evidenceSufficiency: 'INSUFFICIENT' }));
    const recognitionScore = sells.length ? clamp(48 + Math.min(20, uniqueOffers.length * 12) + (context.length ? 12 : 0) - repeatedOffers * 12) : 25;
    const timingScore = sells.length ? clamp(65 + (context.length ? 15 : 0) - pressure.length * 30 - repeatedOffers * 10) : 25;
    const relevanceScore = sells.length ? clamp(45 + context.length * 20 + valueRecords.length * 8) : 25;
    const valueScore = sells.length ? clamp(35 + valueRecords.length * 25) : 25;
    const conversionScore = sells.length ? clamp(45 + uniqueOffers.length * 12 + (context.length ? 10 : 0) - repeatedOffers * 12) : 25;
    const nonPressureScore = sells.length ? clamp(65 + autonomyRecords.length * 10 - pressure.length * 35 - repeatedOffers * 8) : 25;
    const make = (name, score, ev, strengths, weaknesses, recommendation) => base(`sales.${name}`, score, recommendation, ev.length ? ev : fallbackEvidence, strengths, weaknesses, [recommendation], 0.62, sells.length ? 'PARTIAL' : 'INSUFFICIENT');
    const missing = !sells.length;
    return [
      make('opportunityRecognition', recognitionScore, evFor(sells, 'Responds to a genuine preceding sales opportunity.', 'sales.opportunityRecognition'), sells.length ? ['Recognizes a genuine preceding interest signal'] : [], missing ? ['No offer or next step observed after interest'] : [], 'Respond to a clear interest signal with a relevant, optional next step.'),
      make('salesTiming', timingScore, evFor(sells, 'Offer is made after a fan interest signal.', 'sales.salesTiming'), sells.length ? ['Offer follows a genuine interest signal'] : [], missing ? ['No sales transition observed'] : pressure.length ? ['Detected pressure language'] : [], 'Keep timing tied to the fan’s actual interest, not message count.'),
      make('offerRelevance', relevanceScore, evFor(context, 'Connects the offer to the fan’s stated interest.', 'sales.offerRelevance'), context.length ? ['Connects offer to fan context'] : [], sells.length && !context.length ? ['Offer relevance is unclear'] : missing ? ['No relevant offer observed'] : [], 'Explain why the offer matches the fan’s interest.'),
      make('valueFraming', valueScore, evFor(sells.filter(m => valueRecords.some(a => a.messageId === m.id)), 'Frames the value or contents of the offer.', 'sales.valueFraming'), valueRecords.length ? ['Explains value or fit'] : [], missing || !valueRecords.length ? ['Value framing not observed'] : [], 'Describe what is included and why it fits without exaggeration.'),
      make('conversion', conversionScore, evFor(sells, 'Makes a clear optional offer or next step.', 'sales.conversion'), sells.length ? ['Makes a clear offer'] : [], missing ? ['No conversion attempt observed'] : repeatedOffers ? ['Repeated offers do not add credit'] : [], 'Make one clear, optional next step.'),
      make('nonPressureSelling', nonPressureScore, evFor(sells, 'Offer is assessed for autonomy and pressure.', 'sales.nonPressureSelling'), autonomyRecords.length ? ['Uses optional language'] : [], pressure.length ? ['Pressure language detected'] : missing ? ['No offer observed to assess pressure'] : ['Optionality could be clearer'], 'Keep the offer optional and accept hesitation immediately.')
    ];
  }

  function objectionHandling(transcript) {
    const candidates = candidateMessages(transcript), fans = fanMessages(transcript), objections = fans.filter(m => contains(m.text, /\b(no|not comfortable|can't|cannot|too expensive|not interested|stop|don't want|do not want|maybe later)\b/i));
    if (!objections.length) return ['understanding','response','rapportPreservation','stopSelling'].map(name => ({ ...notAssessed(`objectionHandling.${name}`), status: 'INSUFFICIENT_EVIDENCE', weaknesses: ['No objection occurred in transcript'], evidenceSufficiency: 'INSUFFICIENT' }));
    const lastObjectionIndex = Math.max(...objections.map(o => transcript.indexOf(o)));
    const postObjectionCandidates = candidates.filter(m => transcript.indexOf(m) > lastObjectionIndex);
    const replies = postObjectionCandidates.filter(m => contains(m.text, /\b(no worries|of course|understand|that's okay|take your time|we can stop|respect|all good|thanks for telling me)\b/i));
    const pressure = postObjectionCandidates.filter(m => contains(m.text, /\b(you need to|don't miss|last chance|prove you care|if you really|pay now|you owe)\b/i));
    const noResponseEvidence = candidates.length && !postObjectionCandidates.length ? [evidence(candidates[candidates.length-1], 'No candidate response was observed after the fan objection.', 'objectionHandling.noResponse')] : [];
    const neutralResponseEvidence = postObjectionCandidates.length && !replies.length ? [evidence(postObjectionCandidates[0], 'Candidate response observed, but no clear acknowledgment marker was detected.', 'objectionHandling.response')] : [];
    const replyEvidence = replies.length ? replies.slice(0, 2).map(m => evidence(m, 'Acknowledges the objection or hesitation.', 'objectionHandling.response')) : noResponseEvidence.concat(neutralResponseEvidence);
    const make = (name, score, ev, strengths, weaknesses, recommendation) => base(`objectionHandling.${name}`, score, recommendation, ev, strengths, weaknesses, [recommendation], ev.length ? 0.74 : 0.3, ev.length >= 2 ? 'SUFFICIENT' : ev.length ? 'PARTIAL' : 'INSUFFICIENT');
    return [
      make('understanding', clamp(42 + replies.length * 18 - pressure.length * 15), replyEvidence, replies.length ? ['Acknowledges hesitation'] : [], pressure.length ? ['Pressure suggests the objection was not understood'] : [], 'Acknowledge the specific objection before responding.'),
      make('response', clamp(44 + replies.length * 20 - pressure.length * 18), replyEvidence, replies.length ? ['Offers a de-escalating response'] : [], pressure.length ? ['Response escalates rather than resolves'] : [], 'Respond to the concern without arguing against it.'),
      make('rapportPreservation', clamp(48 + replies.length * 16 - pressure.length * 25), replyEvidence, replies.length ? ['Keeps rapport while accepting hesitation'] : [], pressure.length ? ['Pressure damages rapport'] : [], 'Preserve warmth without using intimacy as leverage.'),
      make('stopSelling', clamp(65 + replies.length * 12 - pressure.length * 40), (pressure.length ? pressure : replies).slice(0, 2).map(m => evidence(m, pressure.includes(m) ? 'Continues pressure after an objection.' : 'Acknowledges the objection and does not continue selling.', 'objectionHandling.stopSelling')).concat(noResponseEvidence), pressure.length === 0 && replies.length ? ['Stops or de-escalates after the objection'] : [], pressure.length ? ['Continues selling after an objection'] : [], 'Stop selling when the fan declines or asks to stop.')
    ];
  }

  function boundaries(transcript) {
    const candidates = candidateMessages(transcript), fans = fanMessages(transcript), requests = fans.filter(m => contains(m.text, /\b(meet|visit|address|phone number|private details|someone else|without consent|secret)\b/i));
    if (!requests.length) return ['recognition','creatorRestrictions','appropriateRefusal','safeRedirection','judgment'].map(name => ({ ...notAssessed(`boundaries.${name}`), status: 'INSUFFICIENT_EVIDENCE', weaknesses: ['No boundary challenge occurred in transcript'], evidenceSufficiency: 'INSUFFICIENT' }));
    const lastRequestIndex = Math.max(...requests.map(m => transcript.indexOf(m)));
    const postRequestCandidates = candidates.filter(m => transcript.indexOf(m) > lastRequestIndex);
    const refusals = postRequestCandidates.filter(m => contains(m.text, /\b(can't|cannot|not available|don't do|not comfortable|respect|no meet|keep it here|i can't share|won't|will not)\b/i));
    const redirections = postRequestCandidates.filter(m => contains(m.text, /\b(instead|we can talk about|try|another option|here's what i can|happy to talk)\b/i));
    const pressure = postRequestCandidates.filter(m => contains(m.text, /\b(you need to|if you really|prove you care|pay now|you owe|don't tell anyone)\b/i));
    const noResponseEvidence = candidates.length && !postRequestCandidates.length ? [evidence(candidates[candidates.length-1], 'No candidate response was observed after the boundary request.', 'boundaries.noResponse')] : [];
    const responseEvidence = refusals.length ? refusals.slice(0,2).map(m=>evidence(m, 'Candidate response addresses the boundary request.', 'boundaries.response')) : postRequestCandidates.length ? [evidence(postRequestCandidates[0], 'Candidate response observed, but no clear refusal marker was detected.', 'boundaries.response')] : noResponseEvidence;
    const fallbackResponseEvidence = responseEvidence.length ? responseEvidence : noResponseEvidence;
    const make = (name, score, ev, strengths, weaknesses, recommendation) => base(`boundaries.${name}`, score, recommendation, ev, strengths, weaknesses, [recommendation], ev.length ? 0.7 : 0.3, ev.length >= 2 ? 'SUFFICIENT' : ev.length ? 'PARTIAL' : 'INSUFFICIENT');
    return [
      make('recognition', clamp(45 + (requests.length && refusals.length ? 25 : 0) - (requests.length && !refusals.length ? 20 : 0)), responseEvidence, requests.length ? ['Engages with a boundary-relevant request'] : [], requests.length && !refusals.length ? ['No recognition response detected'] : [], 'Identify the restriction clearly before continuing.'),
      make('creatorRestrictions', clamp(45 + refusals.length * 18), responseEvidence, refusals.length ? ['Acknowledges a restriction'] : [], [], 'Make creator-specific limits explicit and consistent.'),
      make('appropriateRefusal', clamp(42 + refusals.length * 22 - pressure.length * 25), responseEvidence, refusals.length ? ['Uses a clear refusal or limit'] : [], pressure.length ? ['Pressure conflicts with appropriate refusal'] : [], 'Refuse directly without shaming the fan.'),
      make('safeRedirection', clamp(40 + redirections.length * 22), redirections.length ? redirections.slice(0,2).map(m => evidence(m, 'Offers a safer alternative or topic.', 'boundaries.safeRedirection')) : fallbackResponseEvidence, redirections.length ? ['Provides a safer alternative'] : [], requests.length && !redirections.length ? ['No safe redirection evidenced'] : [], 'Redirect toward an allowed interaction when possible.'),
      make('judgment', clamp(52 + refusals.length * 15 - pressure.length * 30), refusals.concat(redirections).slice(0, 3).map(m => evidence(m, 'Shows judgment in handling a boundary-relevant moment.', 'boundaries.judgment')).concat(noResponseEvidence), refusals.length || redirections.length ? ['Shows contextual judgment'] : [], pressure.length ? ['Judgment is weakened by pressure or secrecy language'] : [], 'Prioritize safety and creator limits over conversion.')
    ];
  }

  function recompute(result) {
    const assessed = result.competencyResults.filter(r => r.status === 'ASSESSED');
    result.competencyScores = Object.fromEntries(Object.keys(COMPETENCY_WEIGHTS).map(group => { const members = assessed.filter(r => r.competency.startsWith(`${group}.`)); return [group, members.length ? members.reduce((sum, r) => sum + r.score, 0) / members.length : null]; }));
    const groups = result.scenario.assessed.filter(group => result.competencyScores[group] !== null), total = groups.reduce((sum, group) => sum + COMPETENCY_WEIGHTS[group], 0);
    result.overallSkillScore = groups.length ? Math.round(groups.reduce((sum, group) => sum + result.competencyScores[group] * COMPETENCY_WEIGHTS[group], 0) / total) : null;
    result.overallSkillBand = Model.scoreBand(result.overallSkillScore); return result;
  }
  function evaluate(transcript, options = {}) {
    const scenario = typeof options.scenario === 'object' ? options.scenario : Scenarios.getScenario(options.scenario || 'rapport');
    const ids = transcript.map((message, index) => ({ ...message, id: message.id || `m${index + 1}` }));
    const stages = EvaluationPipeline.run(ids), evaluators = { rapport, sales, objectionHandling, boundaries }, results = [];
    Object.entries(evaluators).forEach(([key, evaluator]) => {
      if (scenario.assessed.includes(key)) results.push(...evaluator(ids, stages));
      else results.push(notAssessed(key));
    });
    const assessed = results.filter(r => r.status === 'ASSESSED');
    const groupScores = Object.fromEntries(Object.keys(COMPETENCY_WEIGHTS).map(group => { const members = assessed.filter(r => r.competency.startsWith(`${group}.`)); return [group, members.length ? members.reduce((sum, r) => sum + r.score, 0) / members.length : null]; }));
    const applicableGroups = scenario.assessed.filter(group => groupScores[group] !== null), weightTotal = applicableGroups.reduce((sum, group) => sum + COMPETENCY_WEIGHTS[group], 0);
    const weighted = applicableGroups.length ? applicableGroups.reduce((sum, group) => sum + groupScores[group] * COMPETENCY_WEIGHTS[group], 0) / weightTotal : null;
    const result = { scenario, competencyResults: results, competencyScores: groupScores, competencyWeights: COMPETENCY_WEIGHTS, languageObservations: languageQuality(candidateMessages(ids)), criticalFlags: CriticalFlagEngine.detect(ids, options.creatorProfile || {}), reviewTriggers: CriticalFlagEngine.detectReviewTriggers(ids), overallSkillScore: weighted === null ? null : Math.round(weighted), overallSkillBand: Model.scoreBand(weighted === null ? null : Math.round(weighted)), scoreBandNotice: Model.PROVISIONAL_BAND_NOTICE, messageIds: ids.map(m => m.id), context: stages.context, candidateActions: stages.candidateActions };
    return recompute(EvaluationPipeline.validateEvidence(result, ids));
  }
  return { rapport, sales, objectionHandling, boundaries, evaluate };
});
