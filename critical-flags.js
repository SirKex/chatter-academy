(function (root, factory) {
  const api = typeof module !== 'undefined' && module.exports ? factory(require('./assessment-model.js'), require('./text-utils.js')) : factory(root.AssessmentModel, root.TextUtils);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.CriticalFlagEngine = api;
})(typeof window !== 'undefined' ? window : globalThis, function (Model, TextUtils) {
  const norm = TextUtils.normalize;
  const flag = (category, severity, message, explanation, policyLayer = 'ethical_conduct') => Model.criticalFlag({ category, severity, evidence: [{ id: message.id, transcriptMessageIds: [message.id], quote: message.text, explanation, source: 'heuristic-flag-detector' }], explanation, confidence: null, humanReviewRequired: true, policyLayer });
  function detectReviewTriggers(transcript) {
    const triggers = [];
    transcript.filter(m => m.role === 'fan').forEach(fan => {
      const text = norm(fan.text);
      const minor = /\b(?:i(?:'m|\s+m|\s+am)\s+(?:only\s+)?(?:1[0-7]|fourteen|fifteen|sixteen|seventeen)|(?:1[0-7]|fourteen|fifteen|sixteen|seventeen)\s*(?:years? old|yo)|under\s+18|in\s+(?:9th|10th|11th|12th|ninth|tenth|eleventh|twelfth)\s+grade|(?:freshman|sophomore|junior|senior)(?:\s+in\s+(?:high school|school))?|still in high school|middle school|\bteen(?:ager)?\b|my age is (?:1[0-7]|fourteen|fifteen|sixteen|seventeen))\b/i.test(text);
      const meetup = /\b(?:meet(?:\s+up)?|come\s+(?:over|by|to\s+my\s+place|to\s+your\s+(?:home|house))|visit\s+me|your\s+(?:place|house|home)|my\s+(?:place|house)|in\s+person)\b/i.test(text);
      if (!minor && !meetup) return;
      const fanIndex = transcript.indexOf(fan);
      const nextFanIndex = transcript.findIndex((m, i) => i > fanIndex && m.role === 'fan');
      const nextCandidate = transcript.find((m, i) => m.role === 'candidate' && i > fanIndex && (nextFanIndex === -1 || i < nextFanIndex));
      const evidence = [{ id: fan.id, transcriptMessageIds: [fan.id], quote: fan.text, explanation: minor ? 'Fan disclosure may require human review.' : 'Fan request may require human review.', source: 'fan-context', kind: 'REVIEW_CONTEXT' }];
      if (nextCandidate) evidence.push({ id: nextCandidate.id, transcriptMessageIds: [fan.id, nextCandidate.id], quote: nextCandidate.text, explanation: 'Candidate response following the triggering fan context.', source: 'candidate-response', kind: 'REVIEW_CONTEXT' });
      triggers.push({ id: `review-${fan.id}-${minor ? 'age' : 'meetup'}`, category: minor ? 'age_disclosure_review' : 'meetup_request_review', severity: 'REVIEW', explanation: minor ? 'Potential age-related disclosure detected. Supervisor review required; no automated conclusion is made.' : 'Meetup-related request detected. Supervisor review required; no automated conclusion is made.', humanReviewRequired: true, evidence, triggerMessageId: fan.id, relatedCandidateMessageId: nextCandidate?.id || null });
    });
    return triggers;
  }
  function detect(transcript, creatorProfile = {}) {
    const out = [];
    transcript.filter(m => m.role === 'candidate').forEach(message => {
      const text = norm(message.text);
      const protective = /\b(?:cannot|can't|will not|won't|stop|end this|keep you safe|not appropriate|stay safe|no meet|we should not|don't share|do not share|don't use|do not use|not using|not accepting|not taking)\b/i.test(text);
      if (/\b(?:my address is|i live at\s+\d|\d{1,5}\s+[a-z0-9 .'-]+\s+(?:street|st|road|rd|avenue|ave|drive|dr|close))\b/i.test(text)) out.push(flag('personal_identifying_information', 'HIGH', message, 'Candidate message may disclose a physical address.', 'privacy'));
      if (/\b(?:my phone number is|call me at|text me at)\b|\+?\d[\d .()-]{8,}/i.test(text)) out.push(flag('personal_identifying_information', 'HIGH', message, 'Candidate message may disclose a personal phone number.', 'privacy'));
      if (!protective && /\b(?:paypal|cashapp|cash app|venmo|bank transfer|crypto|send payment outside|off[- ]platform)\b/i.test(text)) out.push(flag('off_platform_transaction', 'HIGH', message, 'Candidate message may suggest an off-platform transaction.', 'platform_compliance'));
      if (/\b(?:you need to|prove you care|if you really cared|you owe me|pay now|last chance)\b/i.test(text)) out.push(flag('coercion_or_manipulation', 'HIGH', message, 'Candidate message uses obligation, guilt, or pressure language.', 'ethical_conduct'));
      if (/\b(?:don't tell anyone|keep this secret|no one can know|between us only)\b/i.test(text)) out.push(flag('secrecy_pressure', 'HIGH', message, 'Candidate message uses secrecy language.', 'ethical_conduct'));
      if (/\b(?:i promise (?:we(?:'ll| will) be together|i(?:'ll| will) visit you|i(?:'ll| will) marry you)|we will be together|i(?:'ll| will) visit you|i(?:'ll| will) marry you|you are my only one|you're my only one)\b/i.test(text)) out.push(flag('deceptive_or_false_promise', 'MEDIUM', message, 'Candidate message contains a potentially deceptive promise or exclusivity claim.', 'ethical_conduct'));
      const restrictions = (creatorProfile.prohibitedInteractions || []).filter(Boolean).map(norm);
      const normalizedCandidate = ` ${norm(text)} `;
      if (restrictions.some(term => term.length >= 3 && normalizedCandidate.includes(` ${term} `))) out.push(flag('creator_boundary_violation', 'HIGH', message, 'Candidate message may conflict with a configured creator restriction.', 'creator_boundary'));
    });
    return out;
  }
  return { detect, detectReviewTriggers };
});
