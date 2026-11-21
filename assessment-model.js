(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.AssessmentModel = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const SCORE_BANDS = Object.freeze([
    { id: 'weak', label: 'Weak', min: 0, max: 39 },
    { id: 'developing', label: 'Developing', min: 40, max: 59 },
    { id: 'competent', label: 'Competent', min: 60, max: 74 },
    { id: 'strong', label: 'Strong', min: 75, max: 89 },
    { id: 'excellent', label: 'Excellent', min: 90, max: 100 }
  ]);
  const PROVISIONAL_BAND_NOTICE = 'Provisional and unvalidated; not predictive of hiring performance.';
  const EVIDENCE_SUFFICIENCY = Object.freeze(['INSUFFICIENT', 'PARTIAL', 'SUFFICIENT', 'STRONG']);
  const COMPETENCY_STATUS = Object.freeze(['ASSESSED', 'INSUFFICIENT_EVIDENCE', 'NOT_ASSESSED']);
  const FLAG_SEVERITIES = Object.freeze(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

  function scoreBand(score) {
    if (score === null || score === undefined) return null;
    if (!Number.isFinite(score) || score < 0 || score > 100) throw new Error('Score must be between 0 and 100.');
    return SCORE_BANDS.find((band) => score >= band.min && score <= band.max);
  }

  function evidence(input = {}) {
    return {
      id: input.id || null,
      transcriptMessageIds: Array.isArray(input.transcriptMessageIds) ? input.transcriptMessageIds : [],
      quote: input.quote || '',
      explanation: input.explanation || '',
      source: input.source || 'heuristic',
      kind: input.kind || 'CANDIDATE_BEHAVIOR'
    };
  }

  function competencyResult(input = {}) {
    const status = input.status || 'NOT_ASSESSED';
    if (!COMPETENCY_STATUS.includes(status)) throw new Error(`Unsupported competency status: ${status}`);
    const score = status === 'ASSESSED' ? input.score : null;
    if (score !== null && (!Number.isFinite(score) || score < 0 || score > 100)) throw new Error('Competency score must be between 0 and 100.');
    return {
      competency: input.competency || 'unknown',
      status,
      score,
      band: status === 'ASSESSED' ? scoreBand(score) : null,
      reasoning: input.reasoning || '',
      evidence: (input.evidence || []).map(evidence),
      strengths: input.strengths || [],
      weaknesses: input.weaknesses || [],
      recommendations: input.recommendations || [],
      confidence: input.confidence ?? null,
      evidenceSufficiency: input.evidenceSufficiency || 'INSUFFICIENT'
    };
  }

  function criticalFlag(input = {}) {
    if (!FLAG_SEVERITIES.includes(input.severity)) throw new Error(`Unsupported flag severity: ${input.severity}`);
    return {
      id: input.id || null,
      category: input.category || 'unspecified',
      severity: input.severity,
      evidence: (input.evidence || []).map(evidence),
      explanation: input.explanation || '',
      confidence: input.confidence ?? null,
      humanReviewRequired: input.humanReviewRequired !== false,
      policyLayer: input.policyLayer || 'unclassified'
    };
  }

  function assessmentSession(input = {}) {
    const skillScore = input.overallSkillScore ?? null;
    if (skillScore !== null && (!Number.isFinite(skillScore) || skillScore < 0 || skillScore > 100)) throw new Error('Overall skill score must be between 0 and 100.');
    return {
      id: input.id || null,
      candidateId: input.candidateId || null,
      scenario: input.scenario || null,
      creatorProfile: input.creatorProfile || null,
      rubricVersion: input.rubricVersion || null,
      policyVersion: input.policyVersion || null,
      transcript: input.transcript || [],
      competencyResults: input.competencyResults || [],
      complianceFindings: input.complianceFindings || [],
      criticalFlags: input.criticalFlags || [],
      overallSkillScore: skillScore,
      overallSkillBand: scoreBand(skillScore),
      scoreBandNotice: PROVISIONAL_BAND_NOTICE,
      evidenceSufficiency: input.evidenceSufficiency || 'INSUFFICIENT',
      humanReviewRequired: Boolean(input.humanReviewRequired),
      createdAt: input.createdAt || null,
      updatedAt: input.updatedAt || null
    };
  }

  return { SCORE_BANDS, PROVISIONAL_BAND_NOTICE, EVIDENCE_SUFFICIENCY, COMPETENCY_STATUS, FLAG_SEVERITIES, scoreBand, evidence, competencyResult, criticalFlag, assessmentSession };
});
