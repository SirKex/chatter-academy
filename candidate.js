(function () {
  const stage = document.getElementById("candidate-stage");
  const params = new URLSearchParams(location.search);
  const invite = params.get("token") || "";

  const config = window.CHATTER_SUPABASE || {};
  const backendReady = Boolean(
    config.url && config.anonKey && config.submitFunction
  );

  let candidate = { name: "", email: "" };
  let state;
  let transcript = [];
  let turn = 0;
  let scenarioKey = "fullConversation";
  let submitted = false;

  const esc = (s) => {
    const d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  };

  const scenarios = [
    "rapport",
    "sales",
    "objectionHandling",
    "boundaries",
    "fullConversation",
  ];

  const scenarioNames = {
    rapport: "Rapport & conversation building",
    sales: "Sales & PPV conversion",
    objectionHandling: "Objection handling",
    boundaries: "Boundary enforcement",
    fullConversation: "Full conversation",
  };

  function renderIntro() {
    stage.innerHTML = `
      <p class="candidate-kicker">CANDIDATE ASSESSMENT</p>
      <h1>Welcome to Chatter Academy</h1>

      <p>
        This assessment is designed to understand your conversation skills,
        judgment, rapport-building, sales awareness, and ability to maintain
        appropriate boundaries.
      </p>

      <p>
        <b>Estimated time:</b> 15–25 minutes.
        Please respond naturally. Your answers will be reviewed by a recruiter.
      </p>

      ${
        !backendReady
          ? `<div class="candidate-alert">
              <b>Preview mode:</b> This assessment is not connected to secure
              submission storage yet.
            </div>`
          : ""
      }

      <form class="candidate-form" id="intro-form">
        <label>
          Full name
          <input name="name" required autocomplete="name" maxlength="100">
        </label>

        <label>
          Email address
          <input name="email" type="email" required autocomplete="email" maxlength="160">
        </label>

        <label>
          Assessment scenario
          <select name="scenario">
            ${scenarios
              .map(
                (s) =>
                  `<option value="${s}">${scenarioNames[s]}</option>`
              )
              .join("")}
          </select>
        </label>

        <label class="candidate-consent">
          <input type="checkbox" required>
          <span>
            I understand this is a recruitment assessment and that my responses
            may be reviewed by the recruiting team.
          </span>
        </label>

        <button class="ca-button">Start assessment</button>
      </form>
    `;

    if (params.get("name")) {
      document.querySelector('[name="name"]').value = params.get("name");
    }

    if (params.get("email")) {
      document.querySelector('[name="email"]').value = params.get("email");
    }

    document.getElementById("intro-form").onsubmit = (e) => {
      e.preventDefault();

      const f = new FormData(e.target);

      candidate.name = f.get("name").trim();
      candidate.email = f.get("email").trim().toLowerCase();
      scenarioKey = f.get("scenario");

      start();
    };
  }

  function start() {
    state = ScenarioRuntime.create(scenarioKey);
    transcript = [ScenarioRuntime.opening(state)];
    turn = 0;
    renderChat();
  }

  function renderChat() {
    stage.innerHTML = `
      <p class="candidate-kicker">ASSESSMENT IN PROGRESS</p>
      <h1>Conversation simulation</h1>

      <p>
        Respond as the chatter. Focus on natural conversation, listening,
        judgment, and context.
      </p>

      <span class="candidate-scenario-chip">
        ${scenarioNames[scenarioKey]}
      </span>

      <div class="candidate-progress">
        <div style="width:${Math.min((turn / 8) * 100, 100)}%"></div>
      </div>

      <div class="candidate-chat">
        <div class="candidate-chat-head">
          <span class="bubble-avatar">L</span>
          <div>
            <b>Luna</b>
            <small>Simulation partner</small>
          </div>
        </div>

        <div class="candidate-messages" id="msgs"></div>

        <form class="candidate-composer" id="reply-form">
          <input
            id="reply"
            maxlength="2000"
            placeholder="Write your response…"
            required
            autocomplete="off"
          >
          <button class="ca-button" type="submit">Send</button>
        </form>
      </div>

      <p>
        <small>
          Turn ${turn + 1}. We recommend at least 8 responses.
          You can finish when ready.
        </small>
      </p>

      <button class="ca-button secondary" id="finish">
        Finish & submit assessment
      </button>
    `;

    const msgs = document.getElementById("msgs");
    transcript.forEach((m) => append(m));

    document.getElementById("reply-form").onsubmit = (e) => {
      e.preventDefault();

      const input = document.getElementById("reply");
      const text = input.value.trim();

      if (!text) return;

      const candidateMessage = {
        id: `m${state.nextId++}`,
        role: "candidate",
        text,
      };

      transcript.push(candidateMessage);
      append(candidateMessage);
      input.value = "";

      const response = ScenarioRuntime.respond(state, text);

      turn++;
      transcript.push(response);

      setTimeout(() => append(response), 220);

      const progress = document.querySelector(
        ".candidate-progress div"
      );

      if (progress) {
        progress.style.width = Math.min((turn / 8) * 100, 100) + "%";
      }
    };

    document.getElementById("finish").onclick = finish;
  }

  function append(m) {
    const msgs = document.getElementById("msgs");
    if (!msgs) return;

    const el = document.createElement("div");
    el.className = "ca-msg " + (m.role === "candidate" ? "candidate" : "fan");
    el.textContent = m.text;

    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
  }

  async function finish() {
    if (submitted) return;

    if (turn < 3 && !confirm("You have completed fewer than 3 replies. Submit anyway?")) {
      return;
    }

    submitted = true;

    const finishButton = document.getElementById("finish");

    if (finishButton) {
      finishButton.disabled = true;
      finishButton.textContent = "Submitting...";
    }

    const result = CompetencyEngine.evaluate(transcript, {
      scenario: state.key,
    });

    const payload = {
      token: invite,
      candidate_name: candidate.name,
      candidate_email: candidate.email,
      scenario_id: scenarioKey,
      responses: transcript,
      score: result.overallSkillScore,
      competency_breakdown: result.competencyResults,
      flags: result.criticalFlags || [],
      review_required: Boolean(
        result.reviewTriggers && result.reviewTriggers.length > 0
      ),
    };

    if (backendReady && invite) {
      try {
        const endpoint =
          config.url.replace(/\/$/, "") +
          "/functions/v1/" +
          config.submitFunction;

        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            apikey: config.anonKey,
            Authorization: "Bearer " + config.anonKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || "Submission failed");
        }

        showSuccess(true);
      } catch (err) {
        submitted = false;

        if (finishButton) {
          finishButton.disabled = false;
          finishButton.textContent = "Finish & submit assessment";
        }

        alert(
          "Submission could not be saved. Please retry or contact the recruiter."
        );

        console.error("Submission error:", err);
      }
    } else {
      submitted = false;

      alert(
        "This assessment requires a valid invitation link. Please contact your recruiter."
      );

      if (finishButton) {
        finishButton.disabled = false;
        finishButton.textContent = "Finish & submit assessment";
      }
    }
  }

  function showSuccess(saved) {
    stage.innerHTML = `
      <div class="candidate-success">
        <p class="candidate-kicker">SUBMISSION COMPLETE</p>

        <h1>Thank you, ${esc(candidate.name)}.</h1>

        <p>
          ${
            saved
              ? "Your assessment has been successfully submitted."
              : "Your assessment has not been submitted."
          }
        </p>

        <p>You may now close this page.</p>
      </div>
    `;
  }

  renderIntro();
})();
