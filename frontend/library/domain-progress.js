(() => {
  const button = document.getElementById('domain-meter');
  const dialog = document.createElement('dialog');
  dialog.id = 'domain-meter-dialog';
  dialog.setAttribute('aria-labelledby', 'domain-meter-title');
  dialog.innerHTML = `
    <button type="button" class="meter-close" aria-label="Închide">×</button>
    <h2 id="domain-meter-title" tabindex="-1" autofocus>Progres pe domenii</h2>
    <strong data-count></strong><p data-level></p>
    <p>Finalizezi un domeniu când rezolvi corect fiecare lecție și promovezi testul cu toate răspunsurile corecte.</p>
    <a href="/biblioteca.html#teste">Teste pe domenii →</a>
    <section class="meter-activity" aria-labelledby="meter-activity-title">
      <h3 id="meter-activity-title">Activitatea ta</h3>
      <ul>
        <li><a href="/sql-university.html">Rezolvate în atelier <strong data-workshop></strong></a></li>
        <li><a href="/#greseli">De repetat la cursuri <strong data-review></strong></a></li>
        <li><a href="/#progres">Puncte din cursuri <strong data-xp></strong></a></li>
      </ul>
      <p class="meter-save-status"></p>
    </section>`;
  document.body.append(dialog);
  button.setAttribute('aria-controls', dialog.id);
  button.onclick = () => { dialog.showModal(); refresh(); };
  dialog.querySelector('button').onclick = () => dialog.close();
  dialog.addEventListener('click', event => {
    if (event.target.closest('a')) { dialog.close(); return; }
    const r = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close();
  });

  let index, request;
  function loadIndex() {
    if (request) return;
    request = window.StudyOverview.domainIndex().then(result => { index = result; refresh(); }).catch(() => {
      dialog.querySelector('[data-level]').textContent = 'Progresul nu s-a putut încărca. Redeschide indicatorul pentru a reîncerca.';
    }).finally(() => { request = null; });
  }
  function render(count, fraction, detail) {
    button.firstElementChild.textContent = count ? String(count) : '-';
    button.style.setProperty('--meter-height', (fraction * 100) + '%');
    const total = 'Domenii finalizate: ' + count;
    const label = 'Progres pe domenii. ' + total + '. ' + detail;
    button.setAttribute('aria-label', label);
    button.title = label;
    dialog.querySelector('[data-count]').textContent = total;
    dialog.querySelector('[data-level]').textContent = detail;
  }
  function renderActivity(library, workspace, account) {
    const pending = account?.loading || account?.authenticating;
    dialog.querySelector('[data-workshop]').textContent = StudyOverview.workshopCount();
    dialog.querySelector('[data-review]').textContent = pending ? '…' :
      SqlProgress.summary(workspace.sqlPractice).toReview + LanguagePractice.summary(workspace.languagePractice).toReview;
    const xp = pending ? null : account?.user ? workspace.xp || 0 : StudyOverview.guestXp(library, workspace);
    dialog.querySelector('[data-xp]').textContent = xp === null ? '…' : xp + ' XP';
    dialog.querySelector('.meter-save-status').textContent = pending ? 'Se încarcă progresul.' : StudyOverview.accountNote();
  }
  function refresh() {
    const app = window.PolymathApp;
    if (!app) return;
    const account = window.PolymathAccount;
    const snapshot = app.snapshot();
    const library = snapshot.lessons || account?.user ? snapshot.state : StudyOverview.guestLibrary();
    if (dialog.open) {
      const workspace = snapshot.lessons && !account?.user ? StudyOverview.guestWorkspace() : snapshot.state;
      renderActivity(library, workspace, account);
    }
    if (account?.loading || account?.authenticating) {
      render(0, 0, 'Se încarcă progresul.');
      return;
    }
    const progress = library.masteryPoints ? library : snapshot.state;
    const points = progress.masteryPoints || {};
    if (!Object.values(points).some(value => value > 0)) {
      render(0, 0, 'Încă nu ai lecții rezolvate corect.');
      return;
    }
    if (!index && snapshot.lessons?.length) {
      index = Object.create(null);
      for (const lesson of snapshot.lessons) (index[lesson.track] ||= []).push(lesson.id);
    }
    if (!index) {
      render(0, 0, 'Se încarcă progresul.');
      loadIndex();
      return;
    }
    const passed = new Set(progress.passedDomainTests || []);
    let completed = 0, leader;
    for (const [name, ids] of Object.entries(index)) {
      const solved = ids.reduce((sum, id) => sum + Number(points[id] > 0), 0);
      if (solved === ids.length && passed.has(name)) { completed++; continue; }
      const fraction = solved / ids.length;
      if (!leader || fraction > leader.fraction) leader = {name, solved, total: ids.length, fraction};
    }
    if (!leader) render(completed, 1, 'Ai finalizat toate domeniile.');
    else render(completed, leader.fraction, 'Următorul domeniu: ' + leader.name + ' · ' + leader.solved + ' din ' + leader.total + ' lecții corecte. ' + (passed.has(leader.name) ? 'Test promovat.' : 'Test de promovat.'));
  }
  for (const event of ['polymath:progress', 'polymath:account', 'pageshow', 'storage']) window.addEventListener(event, refresh);
  refresh();
})();
