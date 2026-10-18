// The same profile destination is available from the header and the sidebar.
const Profile = (() => {
  const copy = {
    en: { title: 'Profile & settings', tab: 'Your profile', profile: 'Profile', ward: 'Your ward', role: 'Role', email: 'Email', preferences: 'Ward & preferences', window: 'Weeks to show', doctorHint: 'The recent comparison in your antibiotic view. The 12-month reference stays visible.', hygieneHint: 'The period shown when you open Ward overview.', saved: 'Preferences saved', all: 'All wards', admin: 'Admin', recent: 'Last {n} weeks', short: '{n} wk', account: 'Account' },
    fi: { title: 'Profiili ja asetukset', tab: 'Oma profiili', profile: 'Profiili', ward: 'Oma osasto', role: 'Rooli', email: 'Sähköposti', preferences: 'Osasto ja oletukset', window: 'Näytettävät viikot', doctorHint: 'Antibioottinäkymän tuore vertailujakso. 12 kuukauden vertailu säilyy näkyvissä.', hygieneHint: 'Osastokatsauksen avautuessa näytettävä jakso.', saved: 'Asetukset tallennettu', all: 'Kaikki osastot', admin: 'Ylläpitäjä', recent: 'Viimeiset {n} viikkoa', short: '{n} vk', account: 'Tili' },
    sv: { title: 'Profil och inställningar', tab: 'Din profil', profile: 'Profil', ward: 'Din avdelning', role: 'Roll', email: 'E-post', preferences: 'Avdelning och standardval', window: 'Veckor att visa', doctorHint: 'Den aktuella jämförelsen i antibiotikavyn. Referensen på 12 månader visas fortfarande.', hygieneHint: 'Perioden som visas när du öppnar avdelningsöversikten.', saved: 'Inställningarna har sparats', all: 'Alla avdelningar', admin: 'Administratör', recent: 'Senaste {n} veckorna', short: '{n} v', account: 'Konto' }
  };
  const text = key => (copy[LANG] || copy.en)[key];
  const role = () => SESSION.role === 'admin' ? text('admin') : t(SESSION.role);
  const initials = () => SESSION.role === 'doctor' ? 'D' : SESSION.role === 'hygiene' ? 'H' : 'A';
  const ward = () => SESSION.role === 'hygiene' ? HYG.home : SESSION.ward || F.ward;
  const wardLabel = () => SESSION.role === 'admin' ? role() : ward() ? wardName(ward()) : text('all');
  const weeks = () => SESSION.role === 'doctor' ? F.windowWeeks : HYG.windowWeeks;
  const recentLabel = (n, short = false) => text(short ? 'short' : 'recent').replace('{n}', n);

  function restore(session) {
    const preferences = store.get('rl-profile-' + session.email, {});
    if (typeof preferences.ward === 'string') session.ward = preferences.ward;
    if (session.role === 'doctor' && [2, 4, 8, 12].includes(preferences.weeks)) F.windowWeeks = preferences.weeks;
    if (session.role === 'hygiene') {
      if (typeof preferences.ward === 'string') HYG.home = preferences.ward;
      if ([2, 4, 8, 12].includes(preferences.weeks)) HYG.windowWeeks = preferences.weeks;
    }
    return session;
  }
  function renderHeader() {
    $('who').innerHTML = `<i class="av" aria-hidden="true">${initials()}</i><span class="profile-header-name">${esc(SESSION.name)}<small>${esc(wardLabel())}</small></span>`;
    $('who').setAttribute('aria-label', `${text('profile')}: ${SESSION.name}, ${wardLabel()}`);
    $('who').setAttribute('aria-current', VIEW === 'settings' && SETTAB === 'profile' ? 'page' : 'false');
    $('who').title = text('title');
  }
  function sidebar() {
    return `<button class="ri profile-nav" data-profile aria-label="${text('profile')}" title="${text('title')}" aria-current="${VIEW === 'settings' ? 'page' : 'false'}"><i class="av" aria-hidden="true">${initials()}</i><span>${text('profile')}<small>${esc(wardLabel())}</small></span></button>`;
  }
  function open() {
    SETTAB = 'profile'; store.set('rl-settab', SETTAB); stopPlay();
    if (matchMedia('(max-width: 960px)').matches) setRail(false);
    go('settings');
    const title = $('page').querySelector('h1'); title.tabIndex = -1; title.focus();
  }
  function html() {
    const clinical = SESSION.role !== 'admin';
    return `<section class="profile-body" aria-label="${text('tab')}">
      <div class="profile-identity"><i class="av" aria-hidden="true">${initials()}</i><div><h2>${esc(SESSION.name)}</h2><p>${role()}</p></div></div>
      <dl class="profile-details"><div><dt>${text('email')}</dt><dd>${esc(SESSION.email)}</dd></div><div><dt>${text('role')}</dt><dd>${role()}</dd></div></dl>
      ${clinical ? `<section class="profile-preferences" aria-labelledby="profile-preferences-title"><h2 id="profile-preferences-title">${text('preferences')}</h2>
        <div class="profile-field"><label for="profile-ward">${text('ward')}</label><select id="profile-ward">${SESSION.role === 'hygiene' ? `<option value="">${text('all')}</option>` : ''}${META.wards.map(w => `<option value="${w.code}" ${ward() === w.code ? 'selected' : ''}>${esc(wardName(w.code))} · ${w.code}</option>`).join('')}</select></div>
        <fieldset class="profile-field"><legend>${text('window')}</legend><div class="chips">${[2, 4, 8, 12].map(n => `<button class="chip ${weeks() === n ? 'on' : ''}" data-profile-weeks="${n}" aria-pressed="${weeks() === n}">${t('weeks', {n})}</button>`).join('')}</div><p class="profile-help">${text(SESSION.role === 'doctor' ? 'doctorHint' : 'hygieneHint')}</p></fieldset>
        ${SESSION.role === 'hygiene' ? `<fieldset class="profile-field"><legend>${t('hygTypes')}</legend><div class="chips">${['ESBL', 'MRSA', 'VRE', 'CPE'].map(kind => `<button class="chip ${HYG.types.includes(kind) ? 'on' : ''}" data-hyg="types" data-v="${kind}" aria-pressed="${HYG.types.includes(kind)}">${kind}</button>`).join('')}</div></fieldset>` : ''}
        <p class="profile-saved" id="profile-saved" role="status"></p></section>` : ''}
      <div class="profile-account"><span>${text('account')}</span><button class="chip" id="profile-signout">${t('signOut')}</button></div>
    </section>`;
  }
  function persist(focus) {
    SESSION.ward = ward() || '';
    store.set('rl-profile-' + SESSION.email, { ward: SESSION.ward, weeks: weeks() });
    store.set('rl-session', SESSION); renderNav(); renderSettings();
    $('profile-saved').textContent = text('saved');
    $('page').querySelector(focus)?.focus();
  }
  function bind() {
    const select = $('profile-ward');
    if (select) select.onchange = () => {
      SESSION.ward = select.value;
      if (SESSION.role === 'doctor') {
        F.ward = select.value; F.wardSet = true; F.patient = ''; F.org = ''; F.plan = '';
        PT = null; REC = []; AB = null; PLIST = []; ++pickSeq; ++loadSeq; saveF();
      } else {
        HYG.home = select.value; WS.ward = select.value || null; WS.win = null; WS.preview = null; WS.fp = null;
        store.set('rl-hyg', HYG);
      }
      persist('#profile-ward');
    };
    $('page').querySelectorAll('[data-profile-weeks]').forEach(b => b.onclick = () => {
      const n = Number(b.dataset.profileWeeks);
      if (SESSION.role === 'doctor') { F.windowWeeks = n; saveF(); }
      else { HYG.windowWeeks = n; WS.win = null; WS.preview = null; store.set('rl-hyg', HYG); }
      persist(`[data-profile-weeks="${n}"]`);
    });
    $('profile-signout').onclick = () => {
      stopPlay(); store.set('rl-session', null); store.set('rl-view', null); location.assign(window.MindlineStatic.base);
    };
  }
  return { text, restore, renderHeader, sidebar, open, html, bind, recentLabel };
})();
