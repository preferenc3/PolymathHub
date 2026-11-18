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

  const taskList = $('lab-task-list');

  function updateTaskSelection(id) {
    const current = taskList.querySelector('[aria-current]');
    const next = taskList.querySelector(`[data-lab-task="${CSS.escape(id)}"]`);
    if (current !== next) current?.removeAttribute('aria-current');
    if (!next) return;
    next.setAttribute('aria-current', 'step');
    const bounds = taskList.getBoundingClientRect();
    const row = next.getBoundingClientRect();
    if (row.top < bounds.top || row.bottom > bounds.bottom) {
      taskList.scrollTop += row.top - bounds.top;
    }
  }

  function drawOptions() {
    const groups = new Map();
    exercise.replaceChildren();
    taskList.replaceChildren();
    for (const item of exercisesInLab()) {
      if (!groups.has(item.group)) {
        const options = node('optgroup');
        options.label = item.group;
        exercise.append(options);
        const heading = node('h2', item.group);
        const list = node('ul');
        taskList.append(heading, list);
        groups.set(item.group, {options, list});
      }
      const {options, list} = groups.get(item.group);
      const label = optionLabel(item);
      options.append(new Option(label, item.id));
      const row = node('li');
      const button = node('button', label);
      button.type = 'button';
      button.dataset.labTask = item.id;
      row.append(button);
      list.append(row);
    }
  }

  taskList.addEventListener('click', event => {
    const button = event.target.closest('[data-lab-task]');
    if (button) showExercise(button.dataset.labTask, true);
  });

  function showExercise(id, focus = false) {
    active = mode === 'console' ? consoleExercise : catalog.find(item => item.id === id);
    if (mode === 'exercises') lastExercise = id;
    revision++;
    exercise.value = id;
    updateTaskSelection(id);
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

  function pagedTable(columns, rows, label, title, description) {
    const container = node('section');
    container.className = 'sql-table-card';
    const heading = node('header');
    heading.className = 'sql-table-heading';
    heading.append(node('h3', title), node('span', description));
    const numeric = columns.map((_, index) => rows.some(row => typeof row[index] === 'number') &&
      rows.every(row => row[index] === null || typeof row[index] === 'number'));
    const scroll = node('div');
    scroll.className = 'table-scroll';
    scroll.tabIndex = 0;
    scroll.setAttribute('role', 'region');
    scroll.setAttribute('aria-label', label);
    const table = node('table');
    table.className = 'data-table';
    const header = table.createTHead().insertRow();
    columns.forEach((name, index) => {
      const th = node('th', name);
      th.scope = 'col';
      th.classList.toggle('number-cell', numeric[index]);
      header.append(th);
    });
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
    container.append(heading, scroll);
    if (rows.length > 25) container.append(controls);

    let offset = 0;
    function draw() {
      body.replaceChildren();
      for (const row of rows.slice(offset, offset + 25)) {
        const tr = body.insertRow();
        row.forEach((value, index) => {
          const cell = tr.insertCell();
          cell.classList.toggle('number-cell', numeric[index]);
          if (value === null) {
            const badge = node('span', 'NULL');
            badge.className = 'null';
            cell.append(badge);
          } else {
            cell.textContent = String(value);
          }
        });
      }
      if (!rows.length) {
        const cell = body.insertRow().insertCell();
        cell.colSpan = columns.length;
        cell.className = 'no-rows';
        cell.textContent = 'Niciun rând.';
      }
      count.textContent = `${offset + 1}–${Math.min(offset + 25, rows.length)} din ${rows.length}`;
      scroll.scrollTop = 0;
      previous.disabled = offset === 0;
      next.disabled = offset + 25 >= rows.length;
    }
    previous.onclick = () => { offset -= 25; draw(); if (previous.disabled) next.focus(); };
    next.onclick = () => { offset += 25; draw(); if (next.disabled) previous.focus(); };
    draw();
    return container;
  }

  function drawTableDetails(data) {
    const structure = pagedTable(['Coloană', 'Tip', 'NOT NULL', 'Implicit', 'Poziție în cheia primară'],
      data.columns.map(([name, type, required, defaultValue, primary]) =>
        [name, type, required ? 'Da' : '—', defaultValue ?? '—', primary || '—']),
      'Structură ' + data.name, 'Structură', data.columns.length + ' coloane');
    if (data.relations.length) {
      const relations = node('div');
      relations.className = 'sql-relations';
      relations.append(node('strong', 'Chei străine'));
      for (const [column, table, target] of data.relations) {
        relations.append(node('code', `${data.name}.${column} → ${table}.${target}`));
      }
      structure.append(relations);
    }
    const records = pagedTable(data.columns.map(column => column[0]), data.rows,
      'Date ' + data.name, 'Date', rowCount(data.rows.length));
    $('table-details').replaceChildren(...(data.rows.length ? [records, structure] : [structure, records]));
  }

  function rowCount(count) {
    if (count === 1) return '1 rând';
    const needsPreposition = count >= 20 && (count % 100 === 0 || count % 100 >= 20);
    return count + (needsPreposition ? ' de rânduri' : ' rânduri');
  }

  $('show-tables').onclick = async () => {
    const id = active.id;
    $('terminal-panel').hidden = true;
    $('university-tables').hidden = false;
    $('table-browser').hidden = true;
    $('back-to-terminal').focus({preventScroll: true});
    $('university-tables').scrollIntoView({block: 'start'});
    const status = $('tables-status');
    status.textContent = 'Se încarcă tabelele…';
    try {
      const data = tablesByExercise.get(id) || await request('tables', id);
      tablesByExercise.set(id, data);
      if (active.id !== id || $('university-tables').hidden) return;
      status.textContent = '';
      $('schema-tables').replaceChildren(...data.schema.map(name => node('li', name)));
      $('schema-index').hidden = data.schema.length === 0;
      $('schema-index').open = false;
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
          const label = optionLabel(active);
          exercise.selectedOptions[0].textContent = label;
          taskList.querySelector('[aria-current]').textContent = label;
          try { localStorage.setItem(storageKey, JSON.stringify([...completed])); } catch {}
        }
      }
      for (const [index, item] of result.results.entries()) {
        const title = result.results.length === 1 ? 'Rezultat' : 'Rezultat ' + (index + 1);
        $('university-results').append(pagedTable(item.columns, item.rows, title, title, rowCount(item.count)));
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
    document.body.dataset.labMode = mode;
    document.querySelector('.lab-controls').hidden = mode === 'console';
    lab.closest('label').hidden = mode === 'test';
    for (const name of ['exercises', 'console']) {
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

  for (const name of ['exercises', 'console']) {
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
  function refreshCompletion() {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
      if (!Array.isArray(saved)) return;
      completed.clear();
      saved.forEach(id => completed.add(id));
      if (active && mode === 'exercises') {
        drawOptions();
        exercise.value = active.id;
        updateTaskSelection(active.id);
      }
    } catch { /* Storage may be unavailable. */ }
  }
  window.addEventListener('storage', event => { if (event.key === storageKey) refreshCompletion(); });
  window.addEventListener('pageshow', event => { if (event.persisted) refreshCompletion(); });
  load();
})();
