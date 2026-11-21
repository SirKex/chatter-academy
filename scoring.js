(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AssessmentScorer = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const WEIGHTS = { personalization: 25, conversation: 20, listening: 20, emotionalIntelligence: 15, flow: 10, curiosity: 10 };
  const clamp = (n, min = 0, max = 100) => Math.max(min, Math.min(max, n));
  const normalize = (s) => s.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = (s) => new Set(normalize(s).split(' ').filter(Boolean));
  const overlap = (a, b) => { const aa = words(a), bb = words(b); return [...aa].filter(w => w.length > 3 && bb.has(w)).length; };
  const questionKey = (s) => normalize(s).replace(/^(and|but|so|well)\s+/, '').replace(/\b(what|how|where|when|why|do|are|is|did|have|can|would|could)\b/g, 'q').replace(/\b(you|your|u)\b/g, 'person').replace(/\s+/g, ' ').trim();
  const evidence = (items, reason) => items.length ? `${reason}: “${items[0]}”` : '';
  function scoreConversation(transcript) {
    const fan = transcript.filter(m => m.role === 'fan').map(m => m.text), candidate = transcript.filter(m => m.role === 'candidate').map(m => m.text), joined = candidate.join(' '), lower = normalize(joined);
    const genericQuestions = candidate.filter(t => t.includes('?') && /\b(how are you|what do you do|where are you from|how was your day)\b/i.test(t));
    const allQuestions = candidate.filter(t => t.includes('?')), questionKeys = allQuestions.map(questionKey), repeatedQuestions = questionKeys.length - new Set(questionKeys).size;
    const fanFacts = fan.flatMap(t => normalize(t).split(' ').filter(w => w.length > 4)), factUses = fanFacts.filter(f => lower.includes(f));
    const sells = candidate.filter(t => /\b(ppv|unlock|buy|tip|custom|content|send (you|me)|price|menu)\b/i.test(t)), pressure = candidate.filter(t => /\b(you need to|don't miss|last chance|prove you care|if you really|pay now|why haven't you|you owe)\b/i.test(t));
    const intimacy = candidate.filter(t => /\b(i love you|miss you already|you're mine|soulmate|always be here|only one)\b/i.test(t)), promises = candidate.filter(t => /\b(i promise|guarantee|never leave|we will be together|i'll make you)\b/i.test(t));
    const boundaries = candidate.filter(t => /\b(no|not comfortable|don't want|stop|boundary|too fast)\b/i.test(t)), respectsBoundary = boundaries.length && candidate.some(t => /\b(no worries|of course|respect|that's okay|take your time|we can slow)\b/i.test(t));
    const earlySell = sells.length && candidate.slice(0, 2).some(t => sells.includes(t)), naturalSell = sells.length && candidate.length >= 3 && !earlySell && !pressure.length;
    const personalized = candidate.filter(t => fan.some(f => overlap(t, f) >= 2)), empathetic = candidate.filter(t => /\b(that sounds|i'm sorry|congratulations|exciting|proud|understand|must be|glad|rough|happy for)\b/i.test(t)), openQuestions = allQuestions.filter(t => t.split(' ').length >= 6 && !genericQuestions.includes(t));
    const repetitive = candidate.length >= 3 && new Set(candidate.map(normalize)).size < candidate.length, ignoredInfo = fan.length > 0 && candidate.length >= 2 && factUses.length === 0;
    const dimensions = {
      personalization: clamp(40 + personalized.length * 20 + Math.min(20, factUses.length * 5) - (ignoredInfo ? 20 : 0)),
      conversation: clamp(45 + openQuestions.length * 12 + (candidate.length >= 3 ? 10 : 0) - genericQuestions.length * 10 - repeatedQuestions * 15),
      listening: clamp(35 + factUses.length * 12 + personalized.length * 15 - (ignoredInfo ? 25 : 0) - genericQuestions.length * 5),
      emotionalIntelligence: clamp(45 + empathetic.length * 18 + (respectsBoundary ? 20 : 0) - intimacy.length * 15 - promises.length * 20),
      flow: clamp(55 + (candidate.length >= 2 ? 12 : 0) - (repetitive ? 22 : 0) - (earlySell ? 25 : 0) - pressure.length * 20),
      curiosity: clamp(35 + openQuestions.length * 15 + (personalized.length ? 15 : 0) - genericQuestions.length * 8)
    };
    let weighted = Object.entries(WEIGHTS).reduce((sum, [key, weight]) => sum + dimensions[key] * weight / 100, 0); const penalties = [];
    const addPenalty = (label, points, items) => { if (items.length) { weighted -= points; penalties.push({ label, points, evidence: items.slice(0, 2) }); } };
    addPenalty('Repeated generic questions', Math.min(15, genericQuestions.length * 5 + repeatedQuestions * 5), genericQuestions.concat(repeatedQuestions ? allQuestions : [])); addPenalty('Ignored information shared by the fan', 14, ignoredInfo ? [fan[0]] : []); addPenalty('Repetitive responses', 10, repetitive ? candidate : []); addPenalty('Premature PPV selling', 16, earlySell ? sells : []); addPenalty('Aggressive sales pressure', 22, pressure); addPenalty('Poorly timed sales transition', 8, earlySell ? sells : []); addPenalty('Fake emotional intimacy', 12, intimacy); addPenalty('Unrealistic promises', 15, promises); addPenalty('Boundary failure', 20, boundaries.length && !respectsBoundary ? boundaries : []);
    if (naturalSell) weighted += 4;
    const score = Math.round(clamp(weighted)), strengths = [], weaknesses = penalties.map(p => p.label), supporting = [];
    if (personalized.length || factUses.length) strengths.push('Uses details the fan actually shared'); if (openQuestions.length) strengths.push('Invites a fuller answer with specific questions'); if (empathetic.length) strengths.push('Acknowledges the fan’s emotional context'); if (naturalSell) strengths.push('Introduces monetization after conversation has developed'); if (!strengths.length) strengths.push('No strong contextual strengths detected yet'); if (!weaknesses.length) weaknesses.push('No major heuristic penalties detected');
    if (personalized.length) supporting.push(evidence(personalized, 'Personalization')); if (factUses.length) supporting.push(evidence(candidate, 'Context carried forward')); if (genericQuestions.length) supporting.push(evidence(genericQuestions, 'Generic questioning')); if (sells.length) supporting.push(evidence(sells, naturalSell ? 'Timed sales transition' : 'Sales signal')); if (pressure.length) supporting.push(evidence(pressure, 'Pressure signal')); if (ignoredInfo) supporting.push(`Fan context not reflected after: “${fan[0]}”`);
    const recommended = score >= 80 ? 'Maintain the specific callbacks and keep monetization tied to an earned conversational moment.' : weaknesses[0] === 'Ignored information shared by the fan' ? 'Reference one concrete detail from the fan before asking the next question.' : weaknesses[0] === 'Premature PPV selling' ? 'Delay the offer until the fan has shared context and shown reciprocal engagement.' : 'Replace generic questions with a specific follow-up based on the fan’s last answer.';
    return { score, dimensions, penalties, strengths, weaknesses, supportingEvidence: supporting.filter(Boolean), recommendedImprovement: recommended, weights: WEIGHTS };
  }
  return { scoreConversation, WEIGHTS };
});
