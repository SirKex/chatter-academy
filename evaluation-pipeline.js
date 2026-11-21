(function (root, factory) {
  const api = typeof module !== 'undefined' && module.exports ? factory(require('./text-utils.js')) : factory(root.TextUtils);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.EvaluationPipeline = api;
})(typeof window !== 'undefined' ? window : globalThis, function (TextUtils) {
  const norm = TextUtils.normalize;
  const MINOR_RE = /\b(?:i(?:'m| am)\s+(?:only\s+)?(?:1[0-7]|fourteen|fifteen|sixteen|seventeen)|(?:1[0-7]|fourteen|fifteen|sixteen|seventeen)\s*(?:years? old|yo)|under\s+18|in\s+(?:9th|10th|11th|12th|ninth|tenth|eleventh|twelfth)\s+grade|(?:freshman|sophomore|junior|senior)(?:\s+in\s+(?:high school|school))?|still in high school)\b/i;
  const MEET_RE = /\b(?:meet(?:\s+up)?|come\s+(?:over|by|to\s+my\s+place)|visit\s+me|your\s+place|my\s+place|in\s+person)\b/i;
  const POSITIVE_SALES_RE = /\b(?:(?:i\s+(?:d|would)|would)\s+love\s+to\s+see|want\s+to\s+see|interested\s+in|can\s+i\s+(?:buy|unlock)|how\s+much|what\s+(?:does|do)\s+it\s+include|i\s+might\s+unlock|thinking\s+about\s+(?:buying|unlocking)|ready\s+to\s+buy|send\s+me\s+(?:the|a)|show\s+me\s+(?:the|a)|purchase|spend\s+on|love\s+that\s+set)\b/i;
  const NEGATIVE_RE = /\b(?:not\s+interested|don't\s+want|do\s+not\s+want|stop|no\s+thanks|maybe\s+later|too\s+expensive|can't\s+afford|cannot\s+afford|not\s+buying|no\s+money)\b/i;
  const OFFER_RE = /\b(?:unlock|ppv|custom\s+(?:video|content|set)|(?:i|we)\s+(?:can|have)\s+(?:send|offer|make|put\s+together|show)|(?:would|do)\s+you\s+like\s+(?:to\s+)?(?:see|unlock|buy)|(?:here's|here\s+is)\s+(?:what|the)|(?:available|offer)\s+(?:for|if)|take\s+a\s+look|i\s+can\s+send)\b/i;
  function identifyContext(transcript) {
    const fan = transcript.filter(m => m.role === 'fan').map(m => ({ id: m.id, text: m.text }));
    const all = fan.map(m => norm(m.text)).join(' ');
    const opportunityMessages = fan.filter(m => POSITIVE_SALES_RE.test(norm(m.text)) && !NEGATIVE_RE.test(norm(m.text)));
    const objections = fan.filter(m => /\b(expensive|maybe later|not sure|don't want|can't|cannot|not interested|stop|no thanks)\b/i.test(norm(m.text)));
    const boundaryMessages = fan.filter(m => /\b(meet|visit|address|phone|private|personal|off[- ]platform|secret|whatsapp|telegram)\b/i.test(norm(m.text)));
    return { salesOpportunity: opportunityMessages.length > 0, opportunityMessageIds: opportunityMessages.map(m => m.id), objection: objections.length > 0, boundaryChallenge: boundaryMessages.length > 0, evidence: fan.map(m => ({ kind: 'CONTEXT', transcriptMessageIds: [m.id], quote: m.text, explanation: 'Fan/context message establishes an assessment opportunity.', source: 'context-stage' })) };
  }
  function classifyCandidateActions(transcript, context) {
    let precedingOpportunity = false;
    return transcript.map(m => {
      if (m.role === 'fan') { const n = norm(m.text); if (NEGATIVE_RE.test(n)) precedingOpportunity = false; else if (POSITIVE_SALES_RE.test(n)) precedingOpportunity = true; return null; }
      if (m.role !== 'candidate') return null;
      const text = norm(m.text), actions = [];
      const salesBehavior = OFFER_RE.test(text) && !/\b(?:not|don't|do not|never|can't|cannot)\s+(?:sell|offer|send|unlock|buy)\b/i.test(text);
      const respectful = /\b(no pressure|take your time|i understand|no worries|thanks for telling me|we can stop|totally up to you|whenever you're ready)\b/i.test(text);
      const pressure = /\b(you need to|prove you care|pay now|last chance|you owe|if you really cared|don't make me|don't miss out)\b/i.test(text);
      const refusal = /\b(cannot|can't|won't|will not|keep it here|not appropriate|stop this|we should end|not available|i don't meet|i do not meet)\b/i.test(text);
      const meetupAgreement = /\b(?:sure|yes|okay|ok|i'm down|im down|let's|we can|i will|come over|happy to)\b.{0,55}\b(?:meet|meetup|come by|your place|my place|home|in person)\b/i.test(text);
      const contactRequest = /\b(?:text me|call me|dm me|message me|send me|give me|what's|what is|share)\b.{0,25}\b(?:number|phone|address|contact|telegram|whatsapp|snap)\b/i.test(text);
      const offPlatform = /\b(?:cash ?app|paypal|venmo|bank transfer|crypto|telegram|whatsapp|off[- ]platform|outside (?:the )?platform)\b/i.test(text) && !/\b(?:can't|cannot|won't|will not|don't|do not|refuse|keep it here|not using)\b/i.test(text);
      const secrecy = /\b(?:don't tell|keep (?:this|it) secret|between us|no one can know|quiet about this)\b/i.test(text);
      if (salesBehavior) actions.push('SALES_BEHAVIOR'); if (respectful) actions.push('RESPECTFUL_RESPONSE'); if (pressure) actions.push('PRESSURE'); if (refusal) actions.push('BOUNDARY_REFUSAL'); if (meetupAgreement) actions.push('MEETUP_LANGUAGE'); if (contactRequest) actions.push('PERSONAL_CONTACT_REQUEST'); if (offPlatform) actions.push('OFF_PLATFORM'); if (secrecy) actions.push('SECRECY');
      const offer = salesBehavior && precedingOpportunity;
      const result = { messageId: m.id, actions, opportunityResponse: offer, isOffer: salesBehavior, hasValueFraming: offer && /\b(?:because|includes|fit|matches|for you|you get|take a look|something similar|what you receive|personalized|custom|good fit)\b/i.test(text), hasAutonomy: /\b(?:no pressure|take your time|up to you|whenever you're ready|if you want|if you'd like)\b/i.test(text), hasPressure: pressure, hasRefusal: refusal, hasMeetupAgreement: meetupAgreement, hasContactRequest: contactRequest, hasOffPlatform: offPlatform, hasSecrecy: secrecy };
      return result;
    }).filter(Boolean);
  }
  function validateEvidence(result, transcript) {
    const candidates = new Map(transcript.filter(m => m.role === 'candidate' && m.id).map(m => [m.id, m.text]));
    result.competencyResults.forEach(competency => {
      competency.evidence = competency.evidence.filter(item => item.kind === 'CANDIDATE_BEHAVIOR' && item.transcriptMessageIds.length > 0 && item.transcriptMessageIds.every(id => candidates.has(id)) && item.transcriptMessageIds.some(id => candidates.get(id).includes(item.quote)));
      if (competency.status === 'ASSESSED' && competency.evidence.length === 0) { competency.status = 'INSUFFICIENT_EVIDENCE'; competency.score = null; competency.band = null; competency.evidenceSufficiency = 'INSUFFICIENT'; }
    });
    return result;
  }
  function run(transcript) { const context = identifyContext(transcript); return { context, candidateActions: classifyCandidateActions(transcript, context) }; }
  return { identifyContext, classifyCandidateActions, validateEvidence, run, patterns: { MINOR_RE: MINOR_RE.source, MEET_RE: MEET_RE.source } };
});
