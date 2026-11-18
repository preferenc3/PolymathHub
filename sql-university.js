(() => {
  const $ = id => document.getElementById(id);
  const drafts = new Map();
  const attempts = new Set();
  const tablesByExercise = new Map();
  const storageKey = 'polymath-university-sql-completed';
  const completed = new Set();
  try {
    const stored = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(stored)) stored.forEach(id => completed.add(id));
  } catch {}

  const consoleExercise = {id: '5-console', title: 'Consolă liberă',
    prompt: 'Experimentează pe o copie a bazei Companie. Pentru mai mulți pași, scrie comenzile împreună și rulează scriptul complet.'};
  const testIds = ['4-8.1', '5-18', '5-36', '5-59', '5-71'];
  const testResults = new Map();
  let mode = 'exercises';
  let lastExercise = '4-1';
  let catalog = [];
  let active;
  let revision = 0;
  const input = $('terminal-input');
  const lab = $('lab-select');
  const exercise = $('exercise-select');

  function node(tag, text = '') {
    const element = document.createElement(tag);
    element.textContent = text;
    return element;
  }

  async function request(university, exerciseId, query) {
    const response = await fetch('/api/sql-lab', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({university, exerciseId, query}),
      signal: AbortSignal.timeout(15000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Laboratorul nu răspunde. Încearcă din nou.');
    return data;
  }

  function exercisesInLab() {
    if (mode === 'test') return testIds.map(id => catalog.find(item => item.id === id));
    return catalog.filter(item => item.id.startsWith(lab.value + '-'));
  }

  function optionLabel(item) {
    if (mode === 'console') return item.title;
    if (mode === 'test') return 'Lab ' + item.id[0] + ' · ' + item.id.slice(2) + '. ' + item.title;
    return item.id.slice(2) + '. ' + item.title + (completed.has(item.id) ? ' ✓' : '');
  }

  function drawOptions() {
    const groups = new Map();
    exercise.replaceChildren();
    for (const item of exercisesInLab()) {
      if (!groups.has(item.group)) {
        const group = node('optgroup');
        group.label = item.group;
        groups.set(item.group, group);
        exercise.append(group);
      }
      groups.get(item.group).append(new Option(optionLabel(item), item.id));
    }
  }

  function showExercise(id, focus = false) {
    active = mode === 'console' ? consoleExercise : catalog.find(item => item.id === id);
    if (mode === 'exercises') lastExercise = id;
    revision++;
    exercise.value = id;
    const url = new URL(location.href);
    url.searchParams.set('ex', id);
    if (mode === 'exercises') url.searchParams.delete('mod');
    else url.searchParams.set('mod', mode);
    history.replaceState(null, '', url);
    $('exercise-title').textContent = optionLabel(active).replace(/ ✓$/, '');
    $('exercise-prompt').textContent = active.prompt;
    $('tables-context').textContent = active.id.startsWith('4-')
      ? 'Consultă structura și datele disponibile pentru acest exercițiu.'
      : 'Consultă structura și rândurile tabelelor din baza Companie.';
    input.value = drafts.get(mode + ':' + id) || '';
    input.placeholder = active.choice ? 'Scrie DA sau NU…' : 'Scrie comanda SQL aici…';
    $('terminal-panel').hidden = false;
    $('university-tables').hidden = true;
    $('university-hint').hidden = true;
    $('university-hint').textContent = active.hint;
    $('show-hint').setAttribute('aria-expanded', 'false');
    $('university-solution').hidden = true;
    $('show-solution').hidden = mode !== 'exercises' || !attempts.has(id);
    $('show-hint').hidden = mode !== 'exercises';
    $('check-answer').hidden = mode === 'console';
    $('run-command').hidden = !!active.choice;
    $('run-command').disabled = false;
    $('reset-terminal').hidden = mode === 'test';
    $('show-solution').setAttribute('aria-expanded', 'false');
    $('show-solution').disabled = false;
    $('university-results').replaceChildren();
    feedback(mode === 'test' ? testScore() : mode === 'exercises' && completed.has(id) ? 'Exercițiu rezolvat anterior.' : '');
    $('check-answer').disabled = false;
    const list = exercisesInLab();
    document.querySelector('.lab-pagination').hidden = mode === 'console';
    $('previous-exercise').disabled = list[0].id === id;
    $('next-university-exercise').disabled = list.at(-1).id === id;
    if (focus) $('exercise-title').focus();
  }

  function feedback(message, type = '') {
    const status = $('university-feedback');
    status.textContent = message;
    status.className = type ? 'feedback ' + type : '';
  }

  function pagedTable(columns, rows, label) {
    const container = node('div');
    const scroll = node('div');
    scroll.className = 'table-scroll';
    scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-label', label);
    const table = node('table');
    table.className = 'data-table';
    const header = table.createTHead().insertRow();
    for (const name of columns) {
      const th = node('th', name);
      th.scope = 'col';
      header.append(th);
    }
    const body = table.createTBody();
    const count = node('span');
    count.setAttribute('aria-live', 'polite');
    const previous = node('button', '←');
    const next = node('button', '→');
    previous.setAttribute('aria-label', 'Pagina anterioară din ' + label);
    next.setAttribute('aria-label', 'Pagina următoare din ' + label);
    const controls = node('div');
    controls.className = 'table-details';
    controls.append(previous, count, next);
    scroll.append(table);
    container.append(scroll);
    if (rows.length > 25) container.append(controls);

    let offset = 0;
    function draw() {
      body.replaceChildren();
      for (const row of rows.slice(offset, offset + 25)) {
        const tr = body.insertRow();
        for (const value of row) {
          const cell = tr.insertCell();
          cell.textContent = value === null ? 'NULL' : String(value);
          cell.classList.toggle('null', value === null);
        }
      }
      if (!rows.length) {
        const cell = body.insertRow().insertCell();
        cell.colSpan = columns.length;
        cell.textContent = 'Niciun rând.';
      }
      count.textContent = `${offset + 1}–${Math.min(offset + 25, rows.length)} din ${rows.length}`;
      previous.disabled = offset === 0;
      next.disabled = offset + 25 >= rows.length;
    }
    previous.onclick = () => { offset -= 25; draw(); if (previous.disabled) next.focus(); };
    next.onclick = () => { offset += 25; draw(); if (next.disabled) previous.focus(); };
    draw();
    return container;
  }

  function drawTableDetails(data) {
    const details = $('table-details');
    details.replaceChildren(
      node('h3', 'Structură'),
      pagedTable(['Coloană', 'Tip', 'NOT NULL', 'Implicit', 'Poziție în cheia primară'],
        data.columns.map(([name, type, required, defaultValue, primary]) =>
          [name, type, required ? 'Da' : '—', defaultValue ?? '—', primary || '—']), 'Structură ' + data.name)
    );
    if (data.relations.length) {
      details.append(node('p', data.relations.map(([column, table, target]) =>
        `${data.name}.${column} → ${table}.${target}`).join(' · ')));
    }
    details.append(node('h3', 'Date · ' + data.rows.length + ' rânduri'),
      pagedTable(data.columns.map(column => column[0]), data.rows, 'Date ' + data.name));
  }

  $('show-tables').onclick = async () => {
    const id = active.id;
    $('terminal-panel').hidden = true;
    $('university-tables').hidden = false;
    $('table-browser').hidden = true;
    $('back-to-terminal').focus();
    const status = $('tables-status');
    status.textContent = 'Se încarcă tabelele…';
    try {
      const data = tablesByExercise.get(id) || await request('tables', id);
      tablesByExercise.set(id, data);
      if (active.id !== id || $('university-tables').hidden) return;
      status.textContent = data.schema.length ? 'Schema Companie: ' + data.schema.join(', ') + '.' : '';
      const select = $('table-select');
      select.replaceChildren(...data.tables.map(table => new Option(table.name, table.name)));
      select.onchange = () => drawTableDetails(data.tables[select.selectedIndex]);
      select.onchange();
      $('table-browser').hidden = false;
    } catch {
      if (active.id === id) status.textContent = 'Tabelele nu s-au putut încărca. Revino la terminal și deschide-le din nou.';
    }
  };

  $('back-to-terminal').onclick = () => {
    $('university-tables').hidden = true;
    $('terminal-panel').hidden = false;
    input.focus();
  };

  input.addEventListener('input', () => {
    drafts.set(mode + ':' + active.id, input.value);
    revision++;
    $('check-answer').disabled = false;
    $('run-command').disabled = false;
    $('show-solution').disabled = false;
    feedback('');
    $('university-results').replaceChildren();
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      $('terminal-form').requestSubmit($(active.choice ? 'check-answer' : 'run-command'));
    }
  });

  $('show-hint').onclick = () => {
    const hint = $('university-hint');
    hint.hidden = !hint.hidden;
    $('show-hint').setAttribute('aria-expanded', String(!hint.hidden));
  };

  $('terminal-form').onsubmit = async event => {
    event.preventDefault();
    const query = input.value.trim();
    const action = event.submitter?.id === 'run-command' ? 'run' : 'check';
    if ($('check-answer').disabled || $('run-command').disabled) return;
    if (!query) {
      feedback('Scrie întâi răspunsul în terminal.', 'error');
      input.focus();
      return;
    }
    const token = ++revision;
    const id = active.id;
    $('check-answer').disabled = true;
    $('run-command').disabled = true;
    $('show-solution').disabled = false;
    $('university-results').replaceChildren();
    feedback(action === 'run' ? 'Se execută comenzile…' : 'Se verifică răspunsul…');
    try {
      const result = await request(action, id, query);
      if (token !== revision) return;
      if (action === 'run') {
        feedback(result.message);
      } else if (mode === 'test') {
        testResults.set(id, result.correct);
        feedback(result.message + ' ' + testScore(), result.correct ? 'success' : 'error');
      } else {
        attempts.add(id);
        $('show-solution').hidden = false;
        feedback(result.message, result.correct ? 'success' : 'error');
        if (result.correct) {
          completed.add(id);
          exercise.selectedOptions[0].textContent = optionLabel(active);
          try { localStorage.setItem(storageKey, JSON.stringify([...completed])); } catch {}
        }
      }
      for (const [index, item] of result.results.entries()) {
        const caption = `Rezultat ${index + 1} · ${item.count} rânduri`;
        $('university-results').append(node('h3', caption), pagedTable(item.columns, item.rows, caption));
      }
    } catch (error) {
      if (token === revision) feedback(error.message || 'Verificarea a eșuat. Încearcă din nou.', 'error');
    } finally {
      if (token === revision) {
        $('check-answer').disabled = false;
        $('run-command').disabled = false;
      }
    }
  };

  $('show-solution').onclick = async () => {
    const solution = $('university-solution');
    if (!solution.hidden) {
      solution.hidden = true;
      $('show-solution').setAttribute('aria-expanded', 'false');
      return;
    }
    const id = active.id;
    const token = revision;
    $('show-solution').disabled = true;
    try {
      const data = await request('solution', id);
      if (token !== revision) return;
      solution.textContent = data.solution;
      solution.hidden = false;
      $('show-solution').setAttribute('aria-expanded', 'true');
    } catch {
      if (token === revision) feedback('Soluția nu s-a putut încărca.', 'error');
    } finally {
      if (token === revision) $('show-solution').disabled = false;
    }
  };

  function testScore() {
    const score = [...testResults.values()].filter(Boolean).length;
    return `Simulare · ${testResults.size}/${testIds.length} verificate · ${score} corecte`;
  }

  function changeMode(next, requested) {
    mode = next;
    document.querySelector('.lab-controls').hidden = mode === 'console';
    lab.closest('label').hidden = mode === 'test';
    for (const name of ['exercises', 'console', 'test']) {
      $('mode-' + name).setAttribute('aria-pressed', String(name === mode));
    }
    if (mode === 'console') {
      showExercise(consoleExercise.id);
    } else {
      const id = mode === 'test' ? (testIds.includes(requested) ? requested : testIds[0]) : lastExercise;
      lab.value = id[0];
      drawOptions();
      showExercise(id);
    }
  }

  for (const name of ['exercises', 'console', 'test']) {
    $('mode-' + name).onclick = () => { if (catalog.length) changeMode(name); };
  }

  $('reset-terminal').onclick = () => {
    input.value = '';
    input.dispatchEvent(new Event('input'));
    $('university-solution').hidden = true;
    $('show-solution').setAttribute('aria-expanded', 'false');
    input.focus();
  };

  lab.onchange = () => { drawOptions(); showExercise(exercise.value); };
  exercise.onchange = () => showExercise(exercise.value);
  function move(direction) {
    const list = exercisesInLab();
    const target = list[list.indexOf(active) + direction];
    if (target) showExercise(target.id, true);
  }
  $('previous-exercise').onclick = () => move(-1);
  $('next-university-exercise').onclick = () => move(1);

  async function load() {
    const status = $('lab-status');
    $('retry-catalog').hidden = true;
    status.textContent = 'Se încarcă exercițiile…';
    try {
      ({exercises: catalog} = await request('catalog'));
      const params = new URL(location.href).searchParams;
      const requested = params.get('ex');
      const requestedMode = params.get('mod');
      lastExercise = catalog.some(item => item.id === requested) ? requested : catalog[0].id;
      changeMode(['console', 'test'].includes(requestedMode) ? requestedMode : 'exercises', requested);
      lab.disabled = false;
      exercise.disabled = false;
      $('exercise-workspace').hidden = false;
      status.hidden = true;
    } catch {
      status.textContent = 'Exercițiile nu s-au putut încărca.';
      $('retry-catalog').hidden = false;
    }
  }
  $('retry-catalog').onclick = load;
  load();
})();
