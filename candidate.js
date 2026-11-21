(function () {
  const stage = document.getElementById('candidate-stage');
  const $ = (selector) => document.querySelector(selector);

  const params = new URLSearchParams(location.search);
  const invite = params.get('token') || '';
  const config = window.CHATTER_SUPABASE || {};

  const backendReady = Boolean(
    config.url &&
    config.anonKey &&
    config.submitFunction &&
    config.chatFunction
  );

  let candidate = { name: '', email: '' };
  let state = null;
  let transcript = [];
  let turn = 0;
  let scenarioKey = 'fullConversation';
  let submitted = false;
  let busy = false;

  const REQUEST_TIMEOUT = 35000;
  const SUBMIT_TIMEOUT = 30000;

  const esc = (s) => {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  };

  const scenarioNames = {
    rapport: 'Rapport & conversation building',
    sales: 'Sales & PPV conversion',
    objectionHandling: 'Objection handling',
    boundaries: 'Boundary enforcement',
    fullConversation: 'Full conversation'
  };

  const scenarioAliases = {
    rapport_building: 'rapport',
    sales_conversion: 'sales',
    objection_handling: 'objectionHandling',
    boundary_enforcement: 'boundaries',
    full_conversation: 'fullConversation'
  };

  function normalizeScenario(value) {
    return scenarioAliases[value] ||
      (scenarioNames[value] ? value : 'fullConversation');
  }

  const scenarios = [
    'rapport',
    'sales',
    'objectionHandling',
    'boundaries',
    'fullConversation'
  ];

  function renderIntro() {
    stage.innerHTML = `
      <p class="candidate-kicker">CANDIDATE ASSESSMENT</p>

      <h1>Welcome to Chatter Academy</h1>

      <p>
        This assessment explores your conversation skills,
        judgment, rapport-building, sales awareness,
        and ability to maintain appropriate boundaries.
      </p>

      <p>
        <b>Estimated time:</b> 15–25 minutes.
        Please respond naturally. Your answers will be reviewed
        by the recruiting team.
      </p>

      ${
        !backendReady
          ? `
            <div class="candidate-alert">
              <b>Connection error:</b>
              The assessment is not configured to connect to Scar
              or secure submission storage. Contact your recruiter.
            </div>
          `
          : ''
      }

      <form class="candidate-form" id="intro-form">

        <label>
          Full name
          <input
            name="name"
            required
            autocomplete="name"
            maxlength="100"
          >
        </label>

        <label>
          Email address
          <input
            name="email"
            type="email"
            required
            autocomplete="email"
            maxlength="160"
          >
        </label>

        <label>
          Assessment scenario
          <select name="scenario">
            ${scenarios.map(
              s => `<option value="${s}">${scenarioNames[s]}</option>`
            ).join('')}
          </select>
        </label>

        <label class="candidate-consent">
          <input type="checkbox" required>

          <span>
            I understand this is a recruitment assessment and
            my responses may be reviewed by the recruiting team.
          </span>
        </label>

        <button
          class="ca-button"
          ${!backendReady || !invite ? 'disabled' : ''}
        >
          Start assessment
        </button>

      </form>
    `;

    if (params.get('name')) {
      const nameInput = document.querySelector('[name="name"]');
      if (nameInput) nameInput.value = params.get('name');
    }

    if (params.get('email')) {
      const emailInput = document.querySelector('[name="email"]');
      if (emailInput) emailInput.value = params.get('email');
    }

    const preScenario = params.get('scenario');

    if (preScenario) {
      const scenarioInput = document.querySelector('[name="scenario"]');

      if (scenarioInput) {
        scenarioInput.value = normalizeScenario(preScenario);
      }
    }

    $('#intro-form').onsubmit = (e) => {
      e.preventDefault();

      const f = new FormData(e.target);

      candidate.name = f.get('name').trim();
      candidate.email = f.get('email').trim().toLowerCase();

      scenarioKey = normalizeScenario(f.get('scenario'));

      start();
    };
  }

  function start() {
    state = ScenarioRuntime.create(scenarioKey);

    transcript = [
      ScenarioRuntime.opening(state)
    ];

    turn = 0;

    renderChat();
  }

  function renderChat() {
    stage.innerHTML = `
      <p class="candidate-kicker">ASSESSMENT IN PROGRESS</p>

      <h1>Conversation simulation</h1>

      <p>
        Respond as the chatter. Focus on natural conversation,
        listening, judgment, and context.
      </p>

      <span class="candidate-scenario-chip">
        ${scenarioNames[scenarioKey]}
      </span>

      <div class="candidate-progress">
        <div style="width:${Math.min(turn / 8 * 100, 100)}%"></div>
      </div>

      <div class="candidate-chat">

        <div class="candidate-chat-head">
          <span class="bubble-avatar">S</span>

          <div>
            <b>Scar</b>
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

          <button class="ca-button" type="submit">
            Send
          </button>

        </form>

        <div
          id="scar-status"
          role="status"
          style="padding:8px;color:#666"
        ></div>

      </div>

      <p>
        <small>
          Turn ${turn + 1}.
          We recommend at least 8 responses.
          You can finish when ready.
        </small>
      </p>

      <button
        class="ca-button secondary"
        id="finish"
        ${busy ? 'disabled' : ''}
      >
        Finish & submit assessment
      </button>
    `;

    transcript.forEach(append);

    $('#reply-form').onsubmit = async (e) => {
      e.preventDefault();
      await sendReply();
    };

    $('#finish').onclick = finish;
  }

  function append(m) {
    const msgs = $('#msgs');

    if (!msgs) return;

    const el = document.createElement('div');

    el.className =
      'ca-msg ' +
      (m.role === 'candidate' ? 'candidate' : 'fan');

    el.textContent = m.text;

    msgs.appendChild(el);

    msgs.scrollTop = msgs.scrollHeight;
  }

  function createTimeoutSignal(timeoutMs) {
    const controller = new AbortController();

    const timeout = setTimeout(() => {
      controller.abort();
    }, timeoutMs);

    return {
      controller,
      clear: () => clearTimeout(timeout)
    };
  }

  async function scarReply(candidateText) {
    const endpoint =
      `${config.url.replace(/\/$/, '')}/functions/v1/${config.chatFunction}`;

    const timeout = createTimeoutSignal(REQUEST_TIMEOUT);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',

        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
          'Content-Type': 'application/json'
        },

        body: JSON.stringify({
          token: invite,
          scenario: scenarioKey,
          transcript: transcript.slice(-18),
          candidate_text: candidateText,
          turn
        }),

        signal: timeout.controller.signal
      });

      const raw = await response.text();

      let data = {};

      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(
          'Scar returned an unreadable response from the server.'
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
          `Scar response failed (${response.status})`
        );
      }

      if (!data.reply || typeof data.reply !== 'string') {
        throw new Error(
          'Scar returned an empty response.'
        );
      }

      return data.reply.trim();

    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(
          'Scar took too long to respond. Please try again.'
        );
      }

      if (
        err instanceof TypeError &&
        err.message.toLowerCase().includes('fetch')
      ) {
        throw new Error(
          'Connection problem. Please check your internet and try again.'
        );
      }

      throw err;

    } finally {
      timeout.clear();
    }
  }

  async function sendReply() {
    if (busy || submitted) return;

    const input = $('#reply');
    const text = input.value.trim();

    if (!text) return;

    busy = true;

    const send = $('#reply-form button');
    const finishButton = $('#finish');
    const status = $('#scar-status');

    send.disabled = true;
    send.textContent = 'Sending…';

    finishButton.disabled = true;

    status.textContent = 'Scar is replying…';

    const candidateMessage = {
      id: `m${state.nextId++}`,
      role: 'candidate',
      text
    };

    transcript.push(candidateMessage);

    append(candidateMessage);

    input.value = '';

    try {
      const replyText = await scarReply(text);

      const response = {
        id: `m${state.nextId++}`,
        role: 'fan',
        text: replyText
      };

      transcript.push(response);

      turn++;

      append(response);

      status.textContent = '';

      const progress = document.querySelector(
        '.candidate-progress div'
      );

      if (progress) {
        progress.style.width =
          Math.min(turn / 8 * 100, 100) + '%';
      }

    } catch (err) {
      // Remove failed candidate response from assessment transcript.
      transcript.pop();

      // Remove the visible failed candidate bubble.
      const msgs = $('#msgs');

      if (msgs && msgs.lastElementChild) {
        msgs.removeChild(msgs.lastElementChild);
      }

      // Restore the message so it can be retried.
      input.value = text;

      status.textContent =
        `Scar couldn't reply: ${err.message} Your message was not counted. Please try again.`;

      console.error('Scar response error:', err);

    } finally {
      busy = false;

      send.disabled = false;
      send.textContent = 'Send';

      finishButton.disabled = false;

      input.focus();
    }
  }

  async function finish() {
    if (submitted || busy) return;

    if (
      turn < 3 &&
      !confirm(
        'You have completed fewer than 3 replies. Submit anyway?'
      )
    ) {
      return;
    }

    submitted = true;

    const button = $('#finish');

    button.disabled = true;
    button.textContent = 'Submitting…';

    const result = CompetencyEngine.evaluate(
      transcript,
      {
        scenario: state.key
      }
    );

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
        result.reviewTriggers &&
        result.reviewTriggers.length > 0
      )
    };

    const timeout = createTimeoutSignal(SUBMIT_TIMEOUT);

    try {
      const endpoint =
        `${config.url.replace(/\/$/, '')}/functions/v1/${config.submitFunction}`;

      const response = await fetch(endpoint, {
        method: 'POST',

        headers: {
          apikey: config.anonKey,
          Authorization: `Bearer ${config.anonKey}`,
          'Content-Type': 'application/json'
        },

        body: JSON.stringify(payload),

        signal: timeout.controller.signal
      });

      const raw = await response.text();

      let data = {};

      try {
        data = raw ? JSON.parse(raw) : {};
      } catch {
        throw new Error(
          'The server returned an unreadable submission response.'
        );
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
          `Submission failed (${response.status})`
        );
      }

      showSuccess(true);

    } catch (err) {
      submitted = false;

      button.disabled = false;
      button.textContent = 'Finish & submit assessment';

      let message = err.message;

      if (err.name === 'AbortError') {
        message =
          'Submission timed out. Please check your connection and retry.';
      }

      alert(
        `Submission could not be saved.\n\n${message}\n\nPlease retry or contact your recruiter.`
      );

      console.error('Submission error:', err);

    } finally {
      timeout.clear();
    }
  }

  function showSuccess(saved) {
    stage.innerHTML = `
      <div class="candidate-success">

        <p class="candidate-kicker">
          SUBMISSION COMPLETE
        </p>

        <h1>
          Thank you, ${esc(candidate.name)}.
        </h1>

        <p>
          ${
            saved
              ? 'Your assessment has been successfully submitted.'
              : 'Your assessment has not been submitted.'
          }
        </p>

        <p>
          You may now close this page.
        </p>

      </div>
    `;
  }

  if (!invite) {
    stage.innerHTML = `
      <div class="candidate-alert">
        <b>Invalid invitation.</b>
        Please use the invitation link provided by your recruiter.
      </div>
    `;

    return;
  }

  renderIntro();

})();
