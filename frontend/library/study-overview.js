(() => {
  function read(key) {
    try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
  }
  function guestLibrary() {
    return read('polymath_edtech_state_v2') || read('polymath_state_profile_default') || read('polymath_edtech_state_v1') || {};
  }
  function guestWorkspace() {
    return read('pm_learning_workspace_v1') || {sqlPractice: read('pm_sql_practice_v1')};
  }
  function workshopCount() {
    const completed = read('polymath-university-sql-completed');
    return Array.isArray(completed) ? new Set(completed.filter(id => typeof id === 'string')).size : 0;
  }
  function accountNote() {
    const a = window.PolymathAccount;
    return a?.user ? (a.sync || 'Progresul se salvează în cont.') : 'Progres salvat în acest browser. Conectează-te pentru a continua și pe alt dispozitiv.';
  }
  function awards(course) {
    const ids = new Set();
    for (const [id, record] of Object.entries(SqlProgress.clean(course.sqlPractice).records)) {
      if (record.rewarded) ids.add(id);
    }
    if (LanguagePractice.summary(course.languagePractice).xp) ids.add('fr-market');
    return ids;
  }
  // Foundation SQL and market conversation awards are worth 20 XP each. Old guest stores can contain overlapping snapshots.
  function guestXp(library, workspace) {
    const libraryAwards = awards(library);
    const workshopAwards = awards(workspace);
    const libraryOnly = Math.max(0, (Number(library.xp) || 0) - libraryAwards.size * 20,
      (Number(workspace.xp) || 0) - workshopAwards.size * 20);
    return libraryOnly + new Set([...libraryAwards, ...workshopAwards]).size * 20;
  }
  const visitKey = owner => 'polymath_last_study:' + (owner || 'guest');
  function validVisit(visit) {
    return typeof visit?.title === 'string' && visit.title.length > 0 && typeof visit.href === 'string' &&
      /^(?:\/biblioteca\.html#invata\?lesson=|\/#(?:lectie|limba|limbi)\?|\/sql-university\.html\?)/.test(visit.href);
  }
  let pending;
  function record(title, href, owner) {
    pending = {title, href};
    if (owner !== undefined) return flush(owner);
    const account = window.PolymathAccount;
    if (account?.checked && !account.loading && !account.authenticating) flush(account.user?.id || null);
  }
  function flush(owner) {
    if (!validVisit(pending)) return;
    try { localStorage.setItem(visitKey(owner), JSON.stringify(pending)); } catch {}
    pending = null;
  }
  window.addEventListener('polymath:account', () => {
    const account = window.PolymathAccount;
    if (account?.checked && !account.loading && !account.authenticating) flush(account.user?.id || null);
  });
  let domains;
  function domainIndex() {
    return domains ||= fetch('/domain-index.json').then(response => {
      if (!response.ok) throw new Error('Index indisponibil');
      return response.json();
    }).catch(error => { domains = null; throw error; });
  }
  window.StudyOverview = {guestXp, guestLibrary, guestWorkspace, workshopCount, accountNote, domainIndex, record,
    leave: () => { pending = null; },
    last(owner) { const visit = read(visitKey(owner)); return validVisit(visit) ? visit : null; }
  };
})();
