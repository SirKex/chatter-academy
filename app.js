(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const config = window.CHATTER_SUPABASE || {};
  const toast = (message) => {
    const el = $('#toast'); if (!el) return;
    el.textContent = message; el.classList.add('show');
    setTimeout(() => el.classList.remove('show'), 2600);
  };

  function showAuthGate(message) {
    document.body.style.visibility = 'visible';
    const gate = $('#auth-gate');
    $('#auth-gate-message').textContent = message;
    gate.style.display = 'flex';
  }

  async function initializeAuth() {
    if (!window.supabase || !config.url || !config.anonKey) {
      showAuthGate('Supabase configuration did not load. Check supabase-config.js.');
      return false;
    }
    window.dashboardAuth = window.supabase.createClient(config.url, config.anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'chatter-academy-auth' }
    });
    const { data, error } = await window.dashboardAuth.auth.getSession();
    if (error || !data?.session) {
      showAuthGate(error?.message || 'No active recruiter session. Please sign in.');
      return false;
    }
    document.body.style.visibility = 'visible';
    window.dashboardAuth.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_OUT') window.location.replace('recruiter-login.html');
    });
    return true;
  }

  const scenarioLabels = {
    rapport: 'Rapport building', sales: 'Sales & PPV conversion',
    objectionHandling: 'Objection handling', boundaries: 'Boundary enforcement',
    fullConversation: 'Full conversation'
  };
  const inviteScenarioMap = {
    rapport_building: 'rapport', sales_conversion: 'sales', objection_handling: 'objectionHandling',
    boundaries: 'boundaries', fullConversation: 'fullConversation'
  };
  const candidateRows = $('#candidate-rows');
  function renderCandidates() {
    if (candidateRows) candidateRows.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:24px;color:#777">Live candidate submissions will appear here after database review integration is completed.</td></tr>';
  }
  function showView(name) {
    $$('.view').forEach(v => v.classList.remove('active-view'));
    const target = $(`#view-${name}`); if (target) target.classList.add('active-view');
    $$('.nav-item[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === name));
    const title = $('#page-title'); if (title) title.textContent = name[0].toUpperCase() + name.slice(1);
    if (name === 'candidates') renderCandidates();
  }
  $$('.nav-item[data-view]').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.view)));
  $$('[data-view-target]').forEach(btn => btn.addEventListener('click', () => showView(btn.dataset.viewTarget)));

  const modal = $('#invite-modal'), form = $('#invite-form'), submit = $('#invite-submit'), status = $('#invite-status'), linkField = $('#invite-result-link'), copyButton = $('#invite-copy');
  function openInviteModal() {
    modal.style.display = 'flex'; status.className = ''; status.textContent = '';
    linkField.style.display = 'none'; linkField.value = ''; copyButton.style.display = 'none';
    submit.disabled = false; submit.textContent = 'Create invitation';
    $('#invite-name').focus();
  }
  function closeInviteModal() { modal.style.display = 'none'; }
  function showInviteStatus(message, type) { status.textContent = message; status.className = type; }
  $('#new-assessment')?.addEventListener('click', openInviteModal);
  $('#invite-button')?.addEventListener('click', openInviteModal);
  $('#invite-cancel')?.addEventListener('click', closeInviteModal);
  modal?.addEventListener('click', e => { if (e.target === modal) closeInviteModal(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && modal?.style.display === 'flex') closeInviteModal(); });
  copyButton?.addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(linkField.value); copyButton.textContent = 'Copied!'; }
    catch { linkField.focus(); linkField.select(); document.execCommand('copy'); copyButton.textContent = 'Copy attempted'; }
    setTimeout(() => copyButton.textContent = 'Copy invitation link', 1800);
  });

  form?.addEventListener('submit', async e => {
    e.preventDefault(); submit.disabled = true; submit.textContent = 'Creating...';
    status.className = ''; status.textContent = ''; linkField.style.display = 'none'; copyButton.style.display = 'none';
    try {
      const { data: sessionData, error: sessionError } = await window.dashboardAuth.auth.getSession();
      if (sessionError) throw sessionError;
      const accessToken = sessionData?.session?.access_token;
      if (!accessToken) throw new Error('Recruiter session expired. Please sign in again.');
      const response = await fetch(`${config.url.replace(/\/$/, '')}/functions/v1/create-invite`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', apikey: config.anonKey, Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ name: $('#invite-name').value.trim(), email: $('#invite-email').value.trim(), scenarioId: $('#invite-scenario').value })
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.success || !result.candidateUrl) throw new Error(result.error || `Invite creation failed (${response.status}).`);
      showInviteStatus('Invitation created. Copy the link and send it to the candidate.', 'success');
      linkField.value = result.candidateUrl; linkField.style.display = 'block'; copyButton.style.display = 'inline-block';
      try { await navigator.clipboard.writeText(result.candidateUrl); copyButton.textContent = 'Copied!'; } catch {}
      form.reset(); submit.textContent = 'Create another';
    } catch (err) {
      showInviteStatus(err.message || 'Could not create invitation.', 'error');
    } finally { submit.disabled = false; if (submit.textContent === 'Creating...') submit.textContent = 'Create invitation'; }
  });

  $('#logout-button')?.addEventListener('click', async e => {
    const button = e.currentTarget; button.disabled = true; button.textContent = 'Signing out...';
    try { await window.dashboardAuth.auth.signOut(); } finally { window.location.replace('recruiter-login.html'); }
  });

  // Simulator preview: this is local scoring practice, not a candidate invitation.
  let scenarioState, transcript = [], turn = 0;
  const focus = $('#focus-select');
  if (focus) focus.innerHTML = '<option value="rapport">Rapport &amp; conversation building</option><option value="sales">Sales &amp; PPV conversion</option><option value="objectionHandling">Objection handling</option><option value="boundaries">Boundary enforcement</option><option value="fullConversation">Full conversation</option>';
  function escapeHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
  function addMessage(text, isCandidate, id) {
    const row = document.createElement('div'); row.className = `message-row ${isCandidate ? 'user-row-message' : 'creator-row'}`; row.dataset.messageId = id || '';
    row.innerHTML = isCandidate ? `<div><div class="bubble user-bubble">${escapeHtml(text)}</div><time>Turn ${turn}</time></div>` : `<span class="avatar creator">S</span><div><div class="bubble creator-bubble">${escapeHtml(text)}</div><time>Turn ${turn}</time></div>`;
    $('#messages').appendChild(row); $('#messages').scrollTop = $('#messages').scrollHeight;
  }
  function renderScore(result) {
    if (!result) return;
    const assessed = (result.competencyResults || []).filter(r => r.status === 'ASSESSED');
    const evidence = assessed.flatMap(r => [`${r.competency}: ${r.score}/100 (${r.band?.label || 'provisional'})`, ...(r.evidence || []).map(e => `Evidence: ${e.quote}`)]);
    const strengths = assessed.flatMap(r => r.strengths || []), weaknesses = assessed.flatMap(r => r.weaknesses || []);
    const flags = (result.criticalFlags || []).map(f => `Flag: ${f.category} · ${f.explanation}`);
    const review = (result.reviewTriggers || []).map(t => `${t.category.replaceAll('_',' ')} · ${t.explanation}`);
    $('#live-score').textContent = result.overallSkillScore == null ? '—' : `${result.overallSkillScore}%`;
    $('#score-reason').textContent = result.overallSkillScore == null ? 'Insufficient evidence.' : `${result.overallSkillScore}/100 · ${result.overallSkillBand.label} (provisional)`;
    $('#score-evidence').innerHTML = [...evidence, ...flags].map(x => `<li>${escapeHtml(x)}</li>`).join('') || '<li>No evidence yet.</li>';
    $('#review-triggers').innerHTML = review.map(x => `<li>${escapeHtml(x)}</li>`).join('') || '<li>No review triggers detected.</li>';
    $('#score-strengths').textContent = strengths.join(' · ') || '—'; $('#score-weaknesses').textContent = weaknesses.join(' · ') || '—';
  }
  function resetScenario(key = focus?.value || 'rapport', announce = true) {
    if (!window.ScenarioRuntime) return;
    scenarioState = ScenarioRuntime.create(key); transcript = [ScenarioRuntime.opening(scenarioState)]; turn = 0;
    $('#messages').innerHTML = ''; addMessage(transcript[0].text, false, transcript[0].id);
    $('.scenario-pill').textContent = scenarioLabels[key] || key;
    $('#live-score').textContent = '—'; $('#score-reason').textContent = `${scenarioLabels[key]} · New practice session`;
    $('#score-evidence').innerHTML = '<li>Evidence appears after candidate behavior is observed.</li>'; $('#score-strengths').textContent = '—'; $('#score-weaknesses').textContent = '—';
    if (announce) toast(`${scenarioLabels[key]} practice started`);
  }
  if (focus) { resetScenario('rapport', false); focus.addEventListener('change', e => resetScenario(e.target.value)); }
  $('#reset-chat')?.addEventListener('click', () => resetScenario(focus.value));
  $('#chat-form')?.addEventListener('submit', e => {
    e.preventDefault(); const input = $('#chat-input'), text = input.value.trim(); if (!text) return;
    const cm = { id: `m${scenarioState.nextId++}`, role: 'candidate', text }; transcript.push(cm); addMessage(text, true, cm.id); input.value = '';
    $('#typing').style.visibility = 'visible';
    setTimeout(() => { const response = ScenarioRuntime.respond(scenarioState, text); turn++; $('#typing').style.visibility = 'hidden'; addMessage(response.text, false, response.id); transcript.push(response); renderScore(CompetencyEngine.evaluate(transcript, { scenario: scenarioState.key })); }, 350);
  });

  initializeAuth().catch(err => showAuthGate(err.message || 'Authentication error.'));
})();
