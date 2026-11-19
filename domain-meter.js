(() => {
  const button = document.getElementById('domain-meter');
  const dialog = document.createElement('dialog');
  dialog.id = 'domain-meter-dialog';
  dialog.setAttribute('aria-labelledby', 'domain-meter-title');
  dialog.innerHTML = '<button type="button" class="meter-close" aria-label="Închide">×</button><h2 id="domain-meter-title" tabindex="-1" autofocus>Progres pe domenii</h2><strong data-count></strong><p data-level></p><p>Finalizezi un domeniu când rezolvi corect fiecare lecție și promovezi testul cu toate răspunsurile corecte.</p><a href="/biblioteca.html#teste">Teste pe domenii →</a>';
  document.body.append(dialog);
  button.setAttribute('aria-controls', dialog.id);
  button.onclick = () => { refresh(); dialog.showModal(); };
  dialog.querySelector('button').onclick = () => dialog.close();
  dialog.querySelector('a').onclick = () => dialog.close();
  dialog.addEventListener('click', event => {
    const r = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom)) dialog.close();
  });

  let index, request;
  function loadIndex() {
    if (request) return;
    request = fetch('/domain-index.json').then(response => {
      if (!response.ok) throw new Error();
      return response.json();
    }).then(result => { index = result; refresh(); }).catch(() => {
      dialog.querySelector('[data-level]').textContent = 'Progresul nu s-a putut încărca. Redeschide indicatorul pentru a reîncerca.';
    }).finally(() => { request = null; });
  }
  function render(count, fraction, detail) {
    button.firstElementChild.textContent = count ? String(count) : '-';
    button.style.setProperty('--meter-height', (fraction * 100) + '%');
    const total = 'Domenii finalizate: ' + count;
    button.setAttribute('aria-label', total + '. ' + detail);
    button.title = total + '. ' + detail;
    dialog.querySelector('[data-count]').textContent = total;
    dialog.querySelector('[data-level]').textContent = detail;
  }
  function refresh() {
    const app = window.PolymathApp;
    if (!app) return;
    const account = window.PolymathAccount;
    if (account?.loading || account?.authenticating) {
      render(0, 0, 'Se încarcă progresul.');
      return;
    }
    const snapshot = app.snapshot();
    let progress = snapshot.state;
    if (!snapshot.lessons && !account?.user) {
      // Guest coursework and the SQL workspace have distinct storage keys.
      try { progress = JSON.parse(localStorage.getItem('polymath_edtech_state_v2')) || progress; } catch {}
    }
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
