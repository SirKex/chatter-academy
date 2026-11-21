(function (root, factory) {
  const api = typeof module !== 'undefined' && module.exports ? factory(require('./scenario-definitions.js'), require('./text-utils.js')) : factory(root.ScenarioDefinitions, root.TextUtils);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.ScenarioRuntime = api;
})(typeof window !== 'undefined' ? window : globalThis, function (Scenarios, TextUtils) {
  const flows = {
    rapport: [
      { when: /\b(work|job|busy|hospital|night|shift)\b/i, reply: 'The night shifts can be a lot, but I like that you asked. What do you usually do to unwind after work?' },
      { when: /\b(dog|milo|hiking|music|interest|relax)\b/i, reply: 'Milo sounds adorable 😊 I love little details like that. What got you into that interest in the first place?' },
      { when: /\b(how|what|why|tell|which)\b/i, reply: 'That is a good question. I appreciate you actually paying attention—what would make tonight feel good for you?' }
    ],
    sales: [
      { when: /\b(relaxed|style|set|see|interested|like|want)\b/i, reply: 'I have something with that same relaxed feel. What part of that style caught your attention?' },
      { when: /\b(can|have|send|share|offer|set|content|price|cost|available)\b/i, reply: 'That sounds like the kind of thing I would enjoy. What would be included, and is it okay if I decide after I hear the details?' },
      { when: /\b(no|maybe|later|expensive|not sure)\b/i, reply: 'No pressure at all. Take your time—we can keep chatting.' }
    ],
    objectionHandling: [
      { when: /\b(expensive|price|cost|maybe|later|not sure|don't want|cannot|can't)\b/i, reply: 'I hear you. Thanks for being honest—there is no pressure, and we can just talk if that feels better.' },
      { when: /\b(why|value|include|different|worth)\b/i, reply: 'That is fair to ask. I can explain what it includes, but you do not need to decide right now.' },
      { when: /\b(stop|no|not interested)\b/i, reply: 'Of course. I will drop the sales part and respect that.' }
    ],
    boundaries: [
      { when: /\b(meet|private|home|address|phone|number|personal)\b/i, reply: 'I keep personal contact and meetups off the table. We can keep the conversation here instead.' },
      { when: /\b(off[- ]platform|cashapp|paypal|venmo|telegram|whatsapp)\b/i, reply: 'I cannot move this off platform, but I am happy to keep things here.' },
      { when: /\b(why|please|promise|secret)\b/i, reply: 'I understand the question, but that boundary stays in place. Let us change the subject.' }
    ],
    fullConversation: [
      { when: /\b(work|night|hiking|dog|milo)\b/i, reply: 'Night shifts and hiking sound like a full life. What helps you recharge when work gets heavy?' },
      { when: /\b(see|set|style|interested|want|offer|send)\b/i, reply: 'I have something in that relaxed style. I can explain it if you want, and you can decide with no pressure.' },
      { when: /\b(expensive|maybe|later|not sure|no)\b/i, reply: 'That is completely okay. I appreciate you telling me—there is no need to force anything.' },
      { when: /\b(meet|address|phone|off[- ]platform|personal)\b/i, reply: 'I keep personal contact and off-platform interactions out of the conversation. We can stay here.' }
    ]
  };
  function create(key) { const scenario = Scenarios.getScenario(key); return { key, scenario, nextId: 2, turn: 0, used: new Set() }; }
  function opening(state) { return { id: 'm1', role: 'fan', text: state.scenario.openingFanMessage }; }
  function respond(state, candidateText) { const normalized = TextUtils.normalize(candidateText); const options = flows[state.key] || []; const match = options.find((item, index) => !state.used.has(index) && item.when.test(normalized)); const item = match || options[state.turn % Math.max(options.length, 1)] || { reply: 'I am listening. What would you like to share?' }; if (match) state.used.add(options.indexOf(match)); state.turn += 1; const message = { id: `m${state.nextId++}`, role: 'fan', text: item.reply }; return message; }
  return { flows, create, opening, respond };
});
