(function (root, factory) {
  const api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ScenarioDefinitions = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  const SCENARIOS = Object.freeze({
    rapport: { id: 'rapport-building-v1', name: 'Rapport & conversation building', assessed: ['rapport'], openingFanMessage: 'I work nights at a hospital, love hiking, and my dog Milo keeps me company.' },
    sales: { id: 'sales-ppv-v1', name: 'Sales & PPV conversion', assessed: ['sales'], openingFanMessage: 'Your recent set caught my eye. I would love to see something with that same relaxed style.' },
    objectionHandling: { id: 'objection-handling-v1', name: 'Objection handling', assessed: ['objectionHandling'], openingFanMessage: 'I like your work, but that is a little expensive for me right now. Maybe later.' },
    boundaries: { id: 'boundary-enforcement-v1', name: 'Boundary enforcement', assessed: ['boundaries'], openingFanMessage: 'Could we meet privately or move this to my personal phone?' },
    fullConversation: { id: 'full-conversation-v1', name: 'Full conversation', assessed: ['rapport', 'sales', 'objectionHandling', 'boundaries'], openingFanMessage: 'I work nights, love hiking, and your set caught my eye. I might unlock something, but I am not sure about spending tonight.' }
  });
  function getScenario(keyOrId) { const result = SCENARIOS[keyOrId] || Object.values(SCENARIOS).find(s => s.id === keyOrId); if (!result) throw new Error(`Unknown scenario: ${keyOrId}`); return result; }
  return { SCENARIOS, getScenario };
});
