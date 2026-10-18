// Patient-scoped demo capture. No microphone, audio recording or speech service.
const NoteCapture = (() => {
  const words = {
    en: { discard: 'Discard', reasonLabel: 'Reason captured', demoLabel: 'Simulated dictation', add: 'Add note', mic: 'Dictate note', back: 'Back to patient', note: 'Patient note', prompt: 'What should the next clinician know about this patient, and why?', hint: 'A detail, a decision, or something the chart alone might miss.', placeholder: 'Start with what matters. Tell the next clinician what led you to it…', start: 'Start dictation', stop: 'Stop dictation', save: 'Keep note', listening: 'Demo dictation · no audio', ready: 'Enter to keep · Shift+Enter for a new line', failed: 'Couldn’t complete that step. Your note is still here. Please try again.', saved: 'Kept in the patient record', another: 'Add note', source: 'Your note', saving: 'Adding note…', boundary: 'Synthetic patient · de-identified themes contribute to ward knowledge', examples: ['A change from baseline', 'Making the handover useful', 'Understanding the patient'], examplesText: ['Please ask the daughter about any change in confusion, because she knows the patient’s usual routine and noticed the change before it came up in conversation. The important detail is the change from their own baseline.', 'Please check whether the patient understood the follow-up plan, because they nodded during the conversation but later asked when they should come back. I would ask them to describe the plan in their own words.', 'Ask what made taking the previous medication difficult, because the patient described missing doses when the schedule clashed with their shifts. That context matters when discussing a plan they can follow.'] },
    fi: { discard: 'Hylkää', reasonLabel: 'Poimittu perustelu', demoLabel: 'Esittelysanelu', add: 'Lisää merkintä', mic: 'Sanele merkintä', back: 'Takaisin potilaaseen', note: 'Potilasmerkintä', prompt: 'Mitä seuraavan ammattilaisen tulisi tietää tästä potilaasta, ja miksi?', hint: 'Havainto, päätös tai asia, jota kertomus ei yksin kerro.', placeholder: 'Kerro, mikä on tärkeää ja miten päädyit siihen…', start: 'Aloita sanelu', stop: 'Lopeta sanelu', save: 'Säilytä merkintä', listening: 'Esittelysanelu · ei ääntä', ready: 'Enter tallentaa · Shift+Enter lisää rivin', failed: 'Toiminto epäonnistui. Merkintäsi on tallessa tässä näkymässä. Yritä uudelleen.', saved: 'Merkintä lisätty tälle potilaalle', another: 'Lisää uusi merkintä', source: 'Merkintäsi', saving: 'Lisätään merkintää…', boundary: 'Synteettinen potilas · tunnisteettomat teemat täydentävät osaston tietoa', examples: ['Muutos tavanomaisesta', 'Hyödyllinen hoidon siirto', 'Potilaan ymmärtäminen'], examplesText: ['Kysy tyttäreltä sekavuuden muutoksesta, koska hän tuntee potilaan tavallisen arjen ja huomasi muutoksen ensimmäisenä.', 'Tarkista, ymmärsikö potilas jatkosuunnitelman, koska hän nyökkäsi keskustelun aikana mutta kysyi myöhemmin, milloin pitäisi palata.', 'Kysy, mikä vaikeutti aiemman lääkkeen ottamista, koska potilas kertoi annosten jääneen väliin työvuorojen vuoksi.'] },
    sv: { discard: 'Kasta', reasonLabel: 'Fångad motivering', demoLabel: 'Simulerad diktering', add: 'Lägg till anteckning', mic: 'Diktera anteckning', back: 'Tillbaka till patienten', note: 'Patientanteckning', prompt: 'Vad bör nästa kliniker veta om den här patienten, och varför?', hint: 'En observation, ett beslut eller något journalen ensam inte berättar.', placeholder: 'Berätta vad som är viktigt och vad som ledde dig dit…', start: 'Börja diktera', stop: 'Sluta diktera', save: 'Behåll anteckningen', listening: 'Demodiktering · inget ljud', ready: 'Enter sparar · Shift+Enter ger en ny rad', failed: 'Det gick inte att slutföra. Din anteckning finns kvar. Försök igen.', saved: 'Anteckningen har lagts till för patienten', another: 'Lägg till en ny anteckning', source: 'Din anteckning', saving: 'Lägger till anteckning…', boundary: 'Syntetisk patient · avidentifierade teman bidrar till avdelningens kunskap', examples: ['En förändring från det vanliga', 'En användbar överlämning', 'Att förstå patienten'], examplesText: ['Fråga dottern om förändrad förvirring, eftersom hon känner patientens vanliga rutiner och märkte förändringen först.', 'Kontrollera att patienten förstod uppföljningsplanen, eftersom patienten nickade under samtalet men senare frågade när nästa besök skulle ske.', 'Fråga vad som gjorde det svårt att ta den tidigare medicinen, eftersom patienten berättade om missade doser när schemat krockade med arbetspassen.'] }
  };
  const tr = key => (words[LANG] || words.en)[key];
  const micIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5.5 10.5v1a6.5 6.5 0 0 0 13 0v-1M12 18v3m-3 0h6"/></svg>';
  const checkIcon = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';
  const drafts = new Map();
  let state = null, dialog = null, timer = null, demoIndex = 0;
  const el = id => dialog.querySelector('#' + id);
  const entry = () => `<div class="note-entry"><button class="chip" data-narrate>${tr('add')}</button><button class="di" data-note-mic aria-label="${tr('mic')}">${micIcon}</button></div>`;

  function open(dictate = false) {
    if (!PT || dialog?.open) return;
    stopPlay();
    const age = new Date(META.last).getFullYear() - +PT.birth_year;
    state = { patient: PT.id, ward: F.ward, org: F.org, author: SESSION.name,
      text: drafts.get(PT.id) || '', saved: false, busy: false, simulating: false, pending: [], facts: [],
      label: `${PT.sex === 'M' ? t('Man') : t('Woman')}, ${age} · ${PT.id}` };
    if (DOCK) openDock(DOCK);
    if (!dialog) {
      dialog = document.createElement('dialog');
      dialog.className = 'note-capture';
      dialog.setAttribute('aria-labelledby', 'note-title');
      document.body.append(dialog);
      dialog.addEventListener('cancel', e => { e.preventDefault(); close(); });
      dialog.addEventListener('click', event => {
        const b = event.target.closest('[data-note-action]');
        if (!b || b.disabled) return;
        switch (b.dataset.noteAction) {
          case 'back': close(); break;
          case 'mic': toggleSimulation(); break;
          case 'prompt': el('note-text')?.focus(); break;
          case 'save': save(); break;
          case 'discard':
            stopSimulation(); state.text = ''; state.pending = []; drafts.delete(state.patient);
            render(); el('note-text').focus(); break;
          case 'another':
            state.text = ''; state.pending = []; state.saved = false; state.facts = [];
            render(); el('note-text').focus(); break;
        }
      });
      dialog.addEventListener('input', e => {
        if (e.target.id !== 'note-text') return;
        state.text = e.target.value; state.pending = []; remember(); updateControls();
      });
      dialog.addEventListener('keydown', e => {
        if (e.key !== 'Enter' || e.shiftKey || e.isComposing || state.saved) return;
        if (e.target.id === 'note-text') { e.preventDefault(); save(); }
      });
    }
    render(); dialog.showModal(); document.body.classList.add('note-capturing');
    if (dictate) toggleSimulation(); else el('note-text').focus();
  }
  function remember() { if (state && !state.saved) drafts.set(state.patient, state.text); }
  function close() {
    if (state.busy) return;
    stopSimulation(); remember(); dialog.close(); document.body.classList.remove('note-capturing');
    if (PT?.id === state.patient && VIEW === 'doctor' && DOCK !== 'record') openDock('record');
    document.querySelector('[data-dock="record"]')?.focus();
  }
  function highlightedText() {
    let at = 0, html = '';
    for (const fact of state.facts) {
      if (!fact.reasoning) continue;
      const start = state.text.indexOf(fact.text, at);
      const offset = fact.text.indexOf(fact.reasoning);
      if (start < 0 || offset < 0) continue;
      const reasonStart = start + offset, end = reasonStart + fact.reasoning.length;
      html += esc(state.text.slice(at, reasonStart)) + `<mark class="note-reason">${esc(state.text.slice(reasonStart, end))}</mark>`;
      at = end;
    }
    return html + esc(state.text.slice(at));
  }
  function render() {
    dialog.innerHTML = `<div class="note-frame">
      <header class="note-top"><button data-note-action="back" class="back-link note-back">${tr('back')}</button><div class="note-patient"><span>${esc(state.label)}</span><small>${esc(state.ward)} · ${tr('boundary')}</small></div></header>
      <main class="note-main"><p class="note-eyebrow" id="note-title">${tr('note')}</p>
        <button class="note-prompt" data-note-action="prompt">${tr('prompt')}</button><p class="note-hint">${tr('hint')}</p>
        ${state.saved ? `<div class="note-captured" tabindex="-1" id="note-captured">${highlightedText()}</div><p class="note-kept">${checkIcon}<span>${tr('saved')}</span></p>${state.facts.some(f => f.reasoning) ? `<p class="note-reason-key"><i aria-hidden="true"></i>${tr('reasonLabel')}</p>` : ''}` :
          `<label class="note-sr" for="note-text">${tr('source')}</label><textarea id="note-text" placeholder="${tr('placeholder')}" spellcheck="true" maxlength="20000">${esc(state.text)}</textarea>
           <div class="note-wave" id="note-wave" hidden role="img" aria-label="${tr('demoLabel')}">${Array.from({length: 19}, (_, i) => `<i style="--bar:${8 + (i * 11 % 25)}px;--delay:${-(i % 7) * .13}s"></i>`).join('')}</div>`}
      </main>
      <footer class="note-footer"><p id="note-status" class="note-status" role="status">${state.saved ? '' : tr('ready')}</p>
        <div class="note-actions">${state.saved ? `<button class="chip" data-note-action="another">${tr('another')}</button>` :
          `<button class="note-microphone" id="note-mic" data-note-action="mic" aria-label="${tr('start')}" aria-pressed="false">${micIcon}<span id="note-mic-label">${tr('start')}</span></button>
           <button class="back-link note-discard" id="note-discard" data-note-action="discard">${tr('discard')}</button>
           <button class="chip note-keep" id="note-keep" data-note-action="save" aria-label="${tr('save')}" title="${tr('save')} (Enter)">${checkIcon}</button>`}</div>
      </footer></div>`;
    updateControls();
  }
  function message(text) { el('note-status').textContent = text; }
  function updateControls() {
    dialog.querySelectorAll('button').forEach(b => { b.disabled = state.busy; });
    if (state.saved) { dialog.querySelector('[data-note-action="prompt"]').disabled = true; return; }
    el('note-keep').disabled = state.busy || !state.text.trim();
    el('note-discard').hidden = !state.text.trim();
    el('note-text').readOnly = state.simulating || state.busy;
    el('note-wave').hidden = !state.simulating;
    el('note-mic').setAttribute('aria-pressed', String(state.simulating));
    el('note-mic').setAttribute('aria-label', tr(state.simulating ? 'stop' : 'start'));
    el('note-mic-label').textContent = tr(state.simulating ? 'stop' : 'start');
  }
  function stopSimulation() {
    clearInterval(timer); timer = null;
    if (state) state.simulating = false;
    if (dialog?.open && !state.saved) updateControls();
  }
  function toggleSimulation() {
    if (state.busy || state.saved) return;
    if (state.simulating) { stopSimulation(); message(tr('ready')); el('note-text').focus(); return; }
    if (!state.pending.length) {
      const examples = tr('examplesText');
      state.pending = examples[demoIndex++ % examples.length].split(/\s+/);
      if (state.text.trim()) state.text = state.text.trimEnd() + '\n\n';
    }
    state.simulating = true; updateControls(); message(tr('listening')); el('note-text').focus();
    // All words and waveform frames are generated locally, without any media API.
    const current = state;
    const tick = () => {
      if (state !== current || !dialog.open || !state.simulating) return;
      const next = state.pending.splice(0, 2).join(' ');
      state.text += (state.text && !/\s$/.test(state.text) ? ' ' : '') + next;
      el('note-text').value = state.text; remember(); updateControls();
      if (!state.pending.length) { stopSimulation(); message(tr('ready')); el('note-text').focus(); }
    };
    timer = setInterval(tick, 180); tick();
  }
  async function request(step) {
    return api('/api/app/narrate/' + step, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patient: state.patient, ward: state.ward, org: state.org, author: state.author, text: state.text, lang: LANG, share: true }) });
  }
  async function save() {
    if (state.busy || state.saved || !state.text.trim()) return;
    stopSimulation(); state.busy = true; updateControls(); message(tr('saving'));
    try {
      const parsed = await request('parse'); state.facts = parsed.facts;
      await request('commit');
    } catch { state.busy = false; updateControls(); message(tr('failed')); return; }
    // Saving is one action. Extraction runs behind it, never on a separate review screen.
    drafts.delete(state.patient); state.saved = true; state.busy = false; render();
    el('note-captured').focus();
    if (PT?.id === state.patient) { try { await loadRecord(); renderDock(); } catch { /* Refresh on returning. */ } }
  }
  document.addEventListener('click', e => { if (e.target.closest('[data-note-mic]')) open(true); });
  window.addEventListener('beforeunload', e => {
    if (state?.simulating) stopSimulation();
    if ([...drafts.values()].some(text => text.trim())) { e.preventDefault(); e.returnValue = ''; }
  });
  return { open, entry };
})();
