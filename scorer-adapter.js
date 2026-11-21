(function (root, factory) {
  const api = factory(root.AssessmentModel, root.AssessmentScorer);
  if (typeof module !== 'undefined' && module.exports) module.exports = factory(require('./assessment-model.js'), require('./scoring.js'));
  root.LegacyScorerAdapter = api;
})(typeof window !== 'undefined' ? window : globalThis, function (AssessmentModel, AssessmentScorer) {
  function evaluate(transcript, options = {}) {
    const legacy = AssessmentScorer.scoreConversation(transcript);
    const competency = AssessmentModel.competencyResult({
      competency: options.competency || 'rapport', status: 'ASSESSED', score: legacy.score,
      reasoning: legacy.recommendedImprovement, evidence: legacy.supportingEvidence.map((quote, index) => ({ id: `legacy-${index + 1}`, quote, explanation: 'Evidence returned by the existing heuristic scorer.', source: 'legacy-heuristic' })),
      strengths: legacy.strengths, weaknesses: legacy.weaknesses, recommendations: [legacy.recommendedImprovement], confidence: null,
      evidenceSufficiency: legacy.supportingEvidence.length ? 'PARTIAL' : 'INSUFFICIENT'
    });
    return AssessmentModel.assessmentSession({ candidateId: options.candidateId || null, scenario: options.scenario || null, transcript, rubricVersion: options.rubricVersion || 'legacy-heuristic-v1', competencyResults: [competency], overallSkillScore: legacy.score, criticalFlags: options.criticalFlags || [], humanReviewRequired: Boolean(options.humanReviewRequired) });
  }
  return { evaluate };
});
