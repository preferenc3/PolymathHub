(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const P = window.SqlProgress, L = window.LanguagePractice;
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const icon = (name, size = 'icon') => `<img class="${size}" src="assets/icons/${name}.svg" alt="" aria-hidden="true">`;
  const key = user => 'pm_learning_workspace_v1' + (user ? ':' + user : '');
  function stored(name) { try { return JSON.parse(localStorage.getItem(name) || 'null'); } catch { return null; } }
  function cleanWorkspace(raw, user = null) {
    const sql = P.clean(raw?.sqlPractice), french = L.clean(raw?.languagePractice);
    const priorXp = Math.max(0, (Number(raw?.xp) || 0) - P.summary(sql).xp - L.summary(french).xp);
    return {
      previous: raw || {}, priorXp, sql, french,
      catalogMistake:raw?.catalogMistake || null,
      area: raw?.activeTrack === 'Franceză' ? 'fr' : 'sql',
      stage: ['teorie','exemple','practica'].includes(raw?.activeDualPane) ? raw.activeDualPane : 'teorie'
    };
  }
  let owner = null, state = cleanWorkspace(stored(key(null)) || {sqlPractice:stored('pm_sql_practice_v1')}), course = null;
  let generation = 0, filter = 'pending', drafts = new Map(), toastTimer;
  let languageDraft = null, disposeGuide, marketAudio;
  function stopLanguageMedia() {
    disposeGuide?.();
    disposeGuide = null;
    marketAudio?.pause();
    marketAudio = null;
  }
  window.addEventListener('pagehide', stopLanguageMedia);
  window.addEventListener('pageshow', event => { if (event.persisted) render(); });
  const dialogue = [
    {fr:"Bonjour ! Je voudrais acheter des pommes, s’il vous plaît.",ro:'Bună ziua! Aș dori să cumpăr niște mere, vă rog.'},
    {fr:'Bien sûr ! Combien en voulez-vous ?',ro:'Desigur! Câte doriți?'},
    {fr:"Un kilo, s’il vous plaît. C’est combien ?",ro:'Un kilogram, vă rog. Cât costă?'},
    {fr:'Deux euros cinquante.',ro:'Doi euro și cincizeci de cenți.'}
  ];
  window.PolymathSqlCourse = true;
  function totals() {
    const sql = P.summary(state.sql), fr = L.summary(state.french);
    return {...sql, xp:state.priorXp + sql.xp + fr.xp, toReview:sql.toReview + fr.toReview, resolved:sql.resolved + fr.resolved, french:fr};
  }
  function snapshot() {
    return {...state.previous, sqlPractice:P.clean(state.sql), languagePractice:L.clean(state.french), catalogMistake:state.catalogMistake,
      activeTrack:state.area === 'fr' ? 'Franceză' : 'SQL', activeDualPane:state.stage,
      xp:totals().xp, completedLessons:[...new Set([...(state.previous.completedLessons || []), ...(course?.lessons || []).filter(l=>l.exercises.every(id=>state.sql.records[id]?.passed)).map(l=>l.id),...(state.french.completed?['fr-market']:[])])]};
  }
  function toast(message) {
    $('sql-toast').textContent = message; $('sql-toast').hidden = false;
    clearTimeout(toastTimer); toastTimer = setTimeout(()=>$('sql-toast').hidden = true, 4500);
  }
  function persist() {
    try { localStorage.setItem(key(owner), JSON.stringify(snapshot())); }
    catch { toast('Stocarea locală nu este disponibilă. Conectează-te pentru sincronizare.'); }
    window.dispatchEvent(new Event('polymath:progress'));
    updateStatus();
  }
  window.PolymathApp = {
    snapshot:()=>({state:snapshot()}),
    setTheme(theme) { state.previous = {...state.previous, theme}; persist(); },
    replaceProgress(raw, user) {
      generation++; owner = user; state = cleanWorkspace(raw, user); drafts.clear(); languageDraft = null;
      try { localStorage.setItem(key(owner), JSON.stringify(snapshot())); } catch {}
      render();
    },
    guestProgress:()=>stored(key(null)) || {sqlPractice:P.clean(stored('pm_sql_practice_v1'))},
    accountProgress:user=>stored(key(user)) || {sqlPractice:P.clean(stored('pm_sql_practice_v1:'+user))}, toast
  };
  let vocabulary = stored('polymath_vocabulary_v1') || {saved:[],learned:[],cache:[]};
  window.PolymathStudio = {
    vocabularySnapshot:()=>structuredClone(vocabulary),
    replaceVocabulary:value=>{ vocabulary = value || {saved:[],learned:[],cache:[]}; }
  };
  function accountNote() {
    const a = window.PolymathAccount;
    return a?.user ? (a.sync || 'Progresul se salvează în cont.') : 'Progres salvat în acest browser. Conectează-te pentru a continua și pe alt dispozitiv.';
  }
  function updateStatus() {
    for (const item of document.querySelectorAll('[data-review-count]')) item.textContent = totals().toReview;
    for (const item of document.querySelectorAll('[data-save-status]')) item.textContent = accountNote();
    for (const item of document.querySelectorAll('[data-sql-lesson]')) {
      const lesson = course?.lessons.find(l=>l.id===item.dataset.sqlLesson);
      if(!lesson)continue;
      const done = lesson.exercises.every(id=>state.sql.records[id]?.passed);
      item.classList.toggle('done',done);
      item.querySelector('.step-dot').innerHTML=done?icon('check','icon-small'):String(course.lessons.indexOf(lesson)+1);
    }
    for (const item of document.querySelectorAll('[data-lesson-count]')) {
      const lesson = [...(course?.lessons||[]),course?.project].find(l=>l?.id===item.dataset.lessonCount);
      if(lesson)item.textContent=lesson.exercises.filter(id=>state.sql.records[id]?.passed).length+'/'+lesson.exercises.length+' exerciții rezolvate în această lecție';
    }

  }
  window.addEventListener('polymath:account', updateStatus);
  window.addEventListener('storage', event => {
    if (['', '#acasa', '#progres'].includes(location.hash) &&
        ['polymath_edtech_state_v2', 'polymath_last_study:' + (owner || 'guest'), 'polymath-university-sql-completed'].includes(event.key)) render();
  });
  const sqlLink = (id, stage = 'practica', variant = 0) => '#lectie?' + new URLSearchParams({ex:id, etapa:stage, ...(variant===1?{date:'1'}:{})});
  const frLink = (stage = 'practica') => '#limba?etapa=' + stage;
  const exercise = id => course.exercises.find(item=>item.id === id);
  const lessonFor = ex => course.lessons.find(l=>l.id === ex.lesson) || course.project;
  function dataTable(columns, rows, caption, emphasized = []) {
    return `<div class="table-scroll"><table class="data-table">${caption?`<caption>${esc(caption)}</caption>`:''}<thead><tr>${columns.map((c,i)=>`<th scope="col"${emphasized.includes(i)?' class="emphasis"':''}>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map(row=>`<tr>${row.map((value,i)=>`<td${emphasized.includes(i)?' class="emphasis"':''}>${value===null?'<span class="null">NULL</span>':esc(value)}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${columns.length}">Niciun rând.</td></tr>`}</tbody></table></div>`;
  }
  const saveNote = () => `<p class="save-note" data-save-status>${esc(accountNote())}</p>`;
  function overviewXp() {
    return owner ? totals().xp : StudyOverview.guestXp(StudyOverview.guestLibrary(), snapshot());
  }
  function workshopCount() {
    const completed = stored('polymath-university-sql-completed');
    return Array.isArray(completed) ? new Set(completed.filter(id => typeof id === 'string')).size : 0;
  }
  function homeActivity() {
    const {toReview} = totals();
    const labCount = workshopCount();
    const xp = overviewXp();
    return `<aside class="home-activity" aria-label="Activitatea ta">
      <details>
        <summary>Activitatea ta</summary>
        <ul class="activity-list">
          <li><a href="/sql-university.html"><span>Rezolvate în atelier</span><span>${labCount}</span></a></li>
          <li><a href="#greseli"><span>De repetat la cursuri</span><span>${toReview}</span></a></li>
          <li><a href="#progres"><span>Puncte din cursuri</span><span>${xp} XP</span></a></li>
        </ul>
      </details>
    </aside>`;
  }
  function homePractice() {
    const activities = [
      ['SQL · Laborator', 'Filtrează după salariu', 'Afișează angajații care câștigă peste 12 000 $.', '/sql-university.html?ex=5-14', 'salary-filter'],
      ['Engleză · Vocabular', 'Numește patru animale', 'Citește cuvintele și verifică ce îți amintești.', '/biblioteca.html#invata?lesson=path-en-animals&pane=practice', 'animal-vocabulary'],
      ['Algoritmi · Complexitate', 'Estimează complexitatea unui algoritm', 'Explorează notația Big-O și tehnica celor doi pointeri.', '/biblioteca.html#invata?lesson=dsa-1-ex1', 'algorithms'],
    ];
    return `<section class="home-practice" aria-labelledby="home-practice-title">
      <h2 id="home-practice-title">Exersează acum</h2>
      <ul class="home-practice-list">
        ${activities.map(([topic, title, prompt, href, art]) => `<li><a href="${href}">
          <img class="practice-photo" src="/assets/editorial/${art}-small.webp" width="144" height="112" alt="" loading="lazy">
          <span class="home-practice-topic">${topic}</span>
          <strong>${title}</strong>
          <span class="home-practice-prompt">${prompt}</span>
          ${icon('arrow-right','home-practice-arrow')}
        </a></li>`).join('')}
      </ul>
    </section>`;
  }
  window.addEventListener('polymath:catalog-mistake', event => {
    state.catalogMistake = event.detail;
    persist();
  });

  function latestMistake() {
    const attempts = Object.entries(state.sql.records).filter(([,r])=>r.lastMistakeAt).map(([id,r])=>({
      at:r.lastMistakeAt, area:'Bazele SQL', title:exercise(id)?.title || id, answer:r.lastMistakeQuery,
      feedback:r.lastMistakeFeedback, href:sqlLink(id,'practica',r.lastMistakeVariant)
    }));
    const fr = state.french;
    if (fr.lastMistakeAt) {
      const result = L.check(fr.lastMistakeAnswers), index = result.correct.indexOf(false);
      if (index >= 0) attempts.push({at:fr.lastMistakeAt, area:'Franceză', title:['Je voudrais … des oranges.','… en voulez-vous ?', 'C’est … ?'][index], answer:result.answers[index] || '(răspuns necompletat)', feedback:result.feedback[index], href:frLink()});
    }
    const workshop = stored('polymath-workshop-mistake:' + (owner || 'guest'));
    if (workshop?.id) attempts.push({...workshop, area:'Atelier SQL · acest browser', href:'/sql-university.html?ex='+encodeURIComponent(workshop.id)});
    if (state.catalogMistake?.id) attempts.push({...state.catalogMistake, area:'Catalog', href:'#material?id='+encodeURIComponent(state.catalogMistake.id)+'&intrebare='+encodeURIComponent(state.catalogMistake.questionId || '')});
    const recent = attempts.filter(a=>Number.isFinite(Date.parse(a.at))).sort((a,b)=>Date.parse(b.at)-Date.parse(a.at))[0];
    if (!recent) return "";
    return `<section class="home-recall"><p class="section-label">Ultima greșeală · ${esc(recent.area)}</p><h2>${esc(recent.title)}</h2><pre class="mistake-query">${esc(recent.answer)}</pre><p>${esc(recent.feedback)}</p><a class="text-button" href="${esc(recent.href)}">Reia exercițiul ${icon('arrow-right','icon-small')}</a></section>`;
  }

  const featuredLessons = [
    {domain: 'HTML', title: 'Construiește prima pagină web', lesson: 'path-html-document', detail: 'Descoperă ce apare pe fila browserului și ce se vede pe pagină.', art: 'computing'},
    {domain: 'Franceză', title: 'Présente-toi · Spune cum te numești', lesson: 'path-fr-introduce', detail: 'Citește un dialog scurt și încearcă să te prezinți în franceză.', art: 'languages'},
    {domain: 'Python', title: 'Afișează un mesaj cu print', lesson: 'path-python-print', detail: 'Scrie o instrucțiune care afișează text pe ecran.', art: 'python-print'},
    {domain: 'SQL', title: 'Prima interogare cu SELECT', lesson: 'path-sql-select', detail: 'Alege ce date vrei să citești și din ce tabel provin.', art: 'database'},
    {domain: 'Spaniolă', title: 'Numără până la zece', lesson: 'path-es-numbers', detail: 'Asociază fiecare cifră cu un cuvânt și scrie un număr în spaniolă.', art: 'counting'},
    {domain: 'C++', title: 'Ce face linia #include?', lesson: 'path-cpp-include', detail: 'Vezi de unde vine std::cout și scrie prima directivă.', art: 'cpp-include'},
    {domain: 'Go', title: 'De unde pornește un program Go?', lesson: 'path-go-main', detail: 'Leagă pachetul main de funcția care pornește programul.', art: 'go-start'},
    {domain: 'Engleză', title: 'Cum le spui animalelor în engleză?', lesson: 'path-en-animals', detail: 'Pornește de la patru animale și folosește un cuvânt într-o propoziție.', art: 'animals'},
    {domain: 'Java', title: 'Găsește începutul programului', lesson: 'path-java-main', detail: 'Descoperă legătura dintre o clasă și metoda main.', art: 'java-main'},
    {domain: 'Rust', title: 'Prima funcție main', lesson: 'path-rust-main', detail: 'Scrie punctul de intrare al unui program Rust.', art: 'rust-main'},
  ];

  function dailyFeature(today = new Date()) {
    // Use the learner's calendar date; UTC arithmetic avoids daylight-saving gaps.
    const day = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()) / 86400000;
    const pick = featuredLessons[day % featuredLessons.length];
    return `<section aria-labelledby="daily-title" class="daily-feature">
      <div class="feature-story">
        <p class="feature-kicker"><span>Domeniul zilei</span><b aria-hidden="true">/</b>${esc(pick.domain)}</p>
        <h1 id="daily-title">${esc(pick.title)}</h1>
        <p class="feature-description">${esc(pick.detail)}</p>
        <a class="feature-action" href="/biblioteca.html#invata?lesson=${pick.lesson}">Deschide lecția <span aria-hidden="true">→</span></a>
      </div>
      <img class="feature-art" src="/assets/editorial/${pick.art}.webp" width="960" height="640" alt="" fetchpriority="high">
    </section>`;
  }

  function resumeCourse() {
    const sql = P.summary(state.sql), fr = L.summary(state.french);
    const current = exercise(P.resume(state.sql));
    const lesson = lessonFor(current), french = state.area === 'fr';
    const progress = french ? fr.correct / 3 : sql.completed / 15;
    const started = Object.keys(state.sql.records).length > 0 || state.french.attempts > 0;
    if (!started) return '';
    const finished = french ? state.french.passed : sql.completed === sql.total;
    const nextLesson = current.id !== state.sql.activeExerciseId;
    let destination = french ? frLink(state.stage) : sqlLink(current.id, nextLesson ? 'teorie' : state.stage, state.sql.records[current.id]?.variant || 0);
    let action = nextLesson && !french ? 'Următorul pas' : 'Continuă';
    let note = french ? 'Înțelege dialogul, apoi completează cele trei replici.' : 'O explicație, un exemplu și două exerciții pentru fiecare idee.';
    if (finished) {
      if (totals().toReview) { destination = '#greseli'; action = 'Repetă greșelile'; note = 'Ai încheiat activitatea. Revino la răspunsurile care mai au nevoie de atenție.'; }
      else if (french && sql.completed < sql.total) { destination = sqlLink(current.id, 'teorie'); action = 'Continuă cu SQL'; note = 'Lecția de franceză este încheiată. Următorul pas: traseul SQL.'; }
      else if (!french && !state.french.completed) { destination = frLink('teorie'); action = 'Încearcă franceza'; note = 'Ai rezolvat toate cele 15 cerințe SQL. Descoperă acum o altă formă de practică.'; }
      else { destination = french ? frLink('exemple') : sqlLink('p1','practica',1); action = french ? 'Repetă conversația' : 'Reia pe alte date'; note = 'Ai încheiat traseul. Repetarea consolidează ce ai învățat, fără XP suplimentar.'; }
    }
    return `<section class="home-continuation" aria-label="Reia cursul">
      <div><span class="meta">${french?'Franceză':'Bazele SQL'} · ${Math.round(progress * 100)}% parcurs</span>
      <h2>${esc(french?'Au marché — La piață':lesson.title)}</h2><p>${esc(note)}</p></div>
      <a class="text-button" href="${destination}">${action} ${icon('arrow-right','icon-small')}</a></section>`;
  }

  function home() {
    const last = StudyOverview.last(owner);
    const resume = last ? `<section class="home-continuation"><div><p class="section-label">Ultima lecție</p><h2>${esc(last.title)}</h2></div>
      <a class="primary" href="${esc(last.href)}">Continuă lecția ${icon('arrow-right','icon-small')}</a></section>` : resumeCourse();
    return `<div class="home">${resume}${dailyFeature()}
      <div class="study-directory">
      <section class="home-explore" aria-labelledby="home-explore-title">
        <h2 id="home-explore-title">Ce vrei să exersezi?</h2>
        <div class="home-destinations">${window.PolymathExplore.links()}</div>
      </section>
      ${homePractice()}
      </div>
      ${latestMistake()}
      <section class="word-row" aria-label="Expresia de azi"><h2 class="section-label">O expresie de luat cu tine</h2><span class="word-expression" lang="fr">s’il vous plaît</span><span class="translation">vă rog</span><a class="text-button" href="${frLink('exemple')}">Ascultă și exersează ${icon('arrow-right','icon-small')}</a></section>
      ${homeActivity()}${saveNote()}
    </div>`;
  }
  function courseRow(lesson, index) {
    const done = lesson.exercises.filter(id=>state.sql.records[id]?.passed).length;
    const ex = lesson.exercises.find(id=>!state.sql.records[id]?.passed) || lesson.exercises[0];
    return `<a class="course-row" href="${sqlLink(ex,'teorie')}"><span class="row-number">${String(index+1).padStart(2,'0')}</span><span class="row-copy"><h3>${esc(lesson.title)}</h3><p>${esc(lesson.description)}</p></span><span class="row-status">${done}/2 rezolvate</span>${icon('arrow-right')}</a>`;
  }
  function catalog(domain) {
    const showSQL = domain !== 'limbi', showFR = !['programare', 'sql'].includes(domain);
    return `<div class="catalog"><p class="section-label">Alege următorul pas</p><h1>Cursurile tale</h1><a class="secondary" href="/biblioteca.html#exploreaza">Deschide catalogul complet</a><p class="page-intro">Începe cu o idee, înțelege-o și pune-o în practică. Poți reveni oricând.</p>
      ${showSQL?`<section><div class="catalog-heading">${icon('code')}<h2>SQL</h2></div><h3>Bazele SQL</h3>${course.lessons.map(courseRow).join('')}<div class="project-intro"><h2>Un magazin. Trei rapoarte.</h2><p class="page-intro">Proiectul final leagă filtrarea, relațiile dintre tabele și totalurile.</p><a class="secondary" href="#proiect">Deschide proiectul · ${P.summary(state.sql).projectDone}/3 ${icon('arrow-right','icon-small')}</a></div></section>`:''}
      ${showSQL?`<section><div class="catalog-heading">${icon('code')}<h2>Laboratoare</h2></div><a class="course-row" href="/sql-university.html"><span class="row-copy"><h3>Laboratoarele 4 și 5</h3><p>Deschide tabelele și rezolvă exercițiile în terminalul SQLite.</p></span>${icon('arrow-right')}</a></section>`:''}
      ${showFR?`<section><div class="catalog-heading">${icon('translate')}<h2>Franceză, în context</h2></div><a class="course-row" href="${frLink('teorie')}"><span class="row-number">01</span><span class="row-copy"><h3>Au marché — La piață</h3><p>O conversație, pronunție și trei propoziții de completat.</p></span><span class="row-status">${L.summary(state.french).correct}/3 corecte</span>${icon('arrow-right')}</a></section>`:''}<div data-catalog-view="list" data-domain="${esc(domain)}"></div>${saveNote()}</div>`;
  }
  function project() {
    const summary = P.summary(state.sql);
    return `<div class="catalog"><p class="section-label">Proiect practic · SQL</p><h1>Analizează comenzile unui magazin.</h1><p class="page-intro">Pregătește trei rapoarte: comenzile relevante, clienții și totalurile lor. Folosește SELECT, WHERE, JOIN și GROUP BY din <a href="#cursuri?domeniu=programare">cele șase lecții</a>.</p><p>Fiecare cerință este verificată pe datele afișate și pe cazuri suplimentare. Poți folosi „Alte date” pentru a verifica dacă soluția ta se generalizează.</p><p class="project-status" role="status">${summary.projectDone}/3 cerințe îndeplinite${summary.projectDone===3?' · Proiect încheiat. Îl poți relua fără XP suplimentar.':''}</p>${course.project.exercises.map((id,index)=>{const ex=exercise(id);return `<a class="course-row" href="${sqlLink(id)}"><span class="row-number">${index+1}</span><span class="row-copy"><h3>${esc(ex.title.replace(/^\d\.\s*/,''))}</h3><p>${esc(ex.prompt)}</p></span><span class="row-status">${state.sql.records[id]?.passed?'Rezolvat · Reia':'Începe'}</span>${icon('arrow-right')}</a>`;}).join('')}${saveNote()}</div>`;
  }
  function review() {
    const sqlRows = Object.entries(state.sql.records).filter(([,r])=>filter==='pending'?r.needsReview:r.hadMistake&&!r.needsReview&&r.passed);
    const fr = state.french;
    const includeFR = filter==='pending'?fr.needsReview:fr.hadMistake&&!fr.needsReview&&fr.passed;
    const items = sqlRows.map(([id,r])=>`<article class="review-item"><div class="review-meta"><span>SQL · ${r.needsReview?'De repetat':'Rezolvat ulterior'}</span><span>${r.attempts} încercări</span></div><h2>${esc(exercise(id)?.title||id)}</h2><p class="section-label">${r.lastMistakeAt?'Încercarea de corectat':'Ultima încercare salvată'}</p><pre class="review-query">${esc(r.lastMistakeAt?r.lastMistakeQuery:r.lastQuery)||'—'}</pre><p class="last-feedback">${esc(r.lastMistakeAt?r.lastMistakeFeedback:r.lastFeedback)}</p>${!r.needsReview?`<details class="review-solution"><summary>Vezi rezolvarea ta corectă</summary><pre class="review-query">${esc(r.lastQuery)}</pre><p>Ai corectat acest exercițiu. Îl poți repeta pe alte date, fără XP suplimentar.</p></details>`:''}<div class="actions"><a class="primary" href="${sqlLink(id,'practica',r.variant)}">${r.needsReview?'Reia încercarea':'Repetă exercițiul'}</a><a class="text-button" href="${sqlLink(id,'practica',1-r.variant)}">Încearcă alte date ${icon('arrow-right','icon-small')}</a></div></article>`);
    if(includeFR){
      const mistake=L.check(fr.lastMistakeAnswers);
      items.push(`<article class="review-item"><div class="review-meta"><span>Franceză · ${fr.needsReview?'De repetat':'Rezolvat ulterior'}</span><span>${fr.attempts} încercări</span></div><h2>Au marché — Completează conversația</h2>${fr.lastMistakeAt?mistake.correct.map((correct,i)=>correct?'':`<div class="review-language-answer"><p><strong>Propoziția ${i+1}:</strong> <span lang="fr">${esc(mistake.answers[i]||'—')}</span></p><p class="last-feedback">${esc(mistake.feedback[i])}</p></div>`).join(''):`<p class="last-feedback">${L.summary(fr).correct}/3 răspunsuri corecte. Verifică folosirea lui acheter și combien.</p>`}${!fr.needsReview?'<p>Ai corectat toate cele trei răspunsuri. Repetarea păstrează progresul și nu acordă XP suplimentar.</p>':''}<a class="primary" href="${frLink()}">${fr.needsReview?'Reia conversația':'Repetă conversația'}</a></article>`);
    }
    const count=totals();
    return `<div class="review-page"><p class="section-label">Înveți și din încercări</p><h1>Greșelile mele</h1><p class="page-intro">Revino la o idee care nu a fost clară. Încercarea greșită și explicația rămân aici și după ce o corectezi.</p><div class="review-toolbar" role="group" aria-label="Filtrare greșeli"><button data-filter="pending" aria-pressed="${filter==='pending'}">De repetat · ${count.toReview}</button><button data-filter="resolved" aria-pressed="${filter==='resolved'}">Rezolvate ulterior · ${count.resolved}</button></div>${items.length?items.join(''):`<div class="empty"><h2>${filter==='pending'?'Nimic de repetat acum.':'Încă nu ai exerciții rezolvate ulterior.'}</h2><p>Exercițiile reluate își vor găsi locul aici, pe măsură ce înveți.</p><a class="primary" href="#cursuri">Înapoi la cursuri ${icon('arrow-right','icon-small')}</a></div>`}${saveNote()}</div>`;
  }
  function progressView() {
    const t=totals();
    const points = (owner ? state.previous : StudyOverview.guestLibrary()).masteryPoints || {};
    const mastered = Object.values(points).filter(value => value > 0).length;
    return `<div class="progress-page"><h1>Progresul meu</h1>
      <div class="progress-summary">
        <div><strong>${overviewXp()}</strong><span>XP în total</span></div>
        <div><strong>${mastered}</strong><span>Lecții rezolvate în bibliotecă</span></div>
        <div><strong>${t.completed}/${t.total}</strong><span>Exerciții la Bazele SQL</span></div>
        <div><strong>${t.french.correct}/3</strong><span>Replici la piață · Franceză</span></div>
      </div>
      ${mastered ? '<section aria-labelledby="domain-summary-title"><h2 id="domain-summary-title">Lecții rezolvate pe domenii</h2><ul class="domain-summary" data-domain-summary></ul></section>' : ''}
      <p><a href="/sql-university.html">Laboratoare SQL</a> · ${workshopCount()} exerciții rezolvate pe acest dispozitiv</p>
      <a class="secondary" href="#greseli">Greșelile mele · ${t.toReview} de repetat ${icon('arrow-right','icon-small')}</a>
      <div class="catalog-heading"><h2>Traseul SQL</h2></div>${course.lessons.map(courseRow).join('')}${saveNote()}</div>`;
  }
  async function showDomainSummary(list) {
    const points = (owner ? state.previous : StudyOverview.guestLibrary()).masteryPoints || {};
    try {
      const index = await StudyOverview.domainIndex();
      for (const [name, ids] of Object.entries(index)) {
        const solved = ids.filter(id => points[id] > 0).length;
        if (!solved) continue;
        const item = document.createElement('li');
        const link = document.createElement('a');
        link.href = '/biblioteca.html#exploreaza?' + new URLSearchParams({track:name});
        link.textContent = name;
        item.append(link, ' · ' + solved + ' / ' + ids.length);
        list.append(item);
      }
    } catch { list.innerHTML = '<li>Detaliile pe domenii sunt temporar indisponibile.</li>'; }
  }
  function rail(area, ex, stage) {
    if(area==='fr') {
      const steps=[['teorie','Înțelege expresiile'],['exemple','Ascultă conversația'],['practica','Completează și verifică']];
      return `<a class="rail-back" href="#cursuri?domeniu=limbi">${icon('arrow-left','icon-small')} Cursuri</a><h2 class="rail-title">Limba franceză</h2><p class="rail-caption">Au marché · La piață</p><ol class="step-list">${steps.map(([id,label],index)=>`<li class="${(id==='practica'&&state.french.completed)||index<steps.findIndex(s=>s[0]===stage)?'done':''}"><a href="${frLink(id)}" ${stage===id?'aria-current="step"':''}><span class="step-dot">${index+1}</span><span class="step-label">${label}</span></a></li>`).join('')}</ol>${railBottom(false)}`;
    }
    const active = lessonFor(ex);
    return `<a class="rail-back" href="#cursuri?domeniu=programare">${icon('arrow-left','icon-small')} Cursuri</a><h2 class="rail-title">SQL de la zero</h2><p class="rail-caption">6 lecții · un proiect practic</p><ol class="step-list">${course.lessons.map((lesson,index)=>{const done=lesson.exercises.every(id=>state.sql.records[id]?.passed);return `<li data-sql-lesson="${lesson.id}" class="${done?'done':''}"><a href="${sqlLink(lesson.exercises[0],'teorie')}" ${active.id===lesson.id?'aria-current="step"':''} ><span class="step-dot">${done?icon('check','icon-small'):index+1}</span><span class="step-label">${esc(lesson.title)}</span></a></li>`;}).join('')}</ol>${railBottom(true)}`;
  }
  function railBottom(sql) {
    return `<div class="rail-bottom"><a href="#greseli">${icon('book-open','icon-small')} Greșelile mele <span class="count" data-review-count>${totals().toReview}</span></a>${sql?`<a href="#proiect">${icon('code','icon-small')} Proiect final · ${P.summary(state.sql).projectDone}/3</a>`:''}<a href="#progres">Progresul meu ${icon('arrow-right','icon-small')}</a></div>`;
  }
  function stageTabs(ex, stage, variant) {
    return `<nav class="stage-tabs" aria-label="Etapele lecției"><a href="${sqlLink(ex.id,'teorie',variant)}" ${stage==='teorie'?'aria-current="page"':''}>Teorie și exemplu</a><a href="${sqlLink(ex.id,'practica',variant)}" ${stage==='practica'?'aria-current="page"':''}>Practică</a></nav>`;
  }
  function relevantTables(id) {
    if(['s1-all','s1-columns','s6-cities'].includes(id))return ['customers'];
    if(['s2-select','s2-alias','s3-stock','s4-price','s4-limit'].includes(id))return ['products'];
    if(['s3-orders','s6-status','p1'].includes(id))return ['orders'];
    return ['customers','orders'];
  }
  function theoryVisual(lesson, variant) {
    const data=course.datasets[variant];
    if(lesson.id==='l5')return `<div class="relationship">${dataTable(['id','name'],data.customers.slice(0,3).map(r=>r.slice(0,2)),'customers')}${icon('arrow-right')}${dataTable(['id','customer_id','total'],data.orders.slice(0,3).map(r=>r.slice(0,3)),'orders')}</div><p class="relation-note">customers.id = orders.customer_id</p><p class="tip">Aceeași valoare a cheii leagă clientul de comenzile lui. Numele clientului poate apărea pe mai multe rânduri.</p>`;
    if(lesson.id==='l2')return dataTable(course.tables.products.columns,data.products.slice(0,3),'products · observă coloanele name și stock',[1,4]);
    if(lesson.id==='l3')return dataTable(['name','price','stock'],data.products.slice(0,4).map(r=>[r[1],r[3],r[4]]),'products · ce produse îndeplinesc condiția?');
    if(lesson.id==='l4')return dataTable(['id','name','stock'],data.products.map(r=>[r[0],r[1],r[4]]),'products · înainte de sortare');
    if(lesson.id==='l6') {
      const groups=new Map();for(const row of data.orders)groups.set(row[1],(groups.get(row[1])||0)+1);
      return dataTable(['customer_id','comenzi'],[...groups],'Un rând pentru fiecare grup');
    }
    return dataTable(course.tables.customers.columns,data.customers.slice(0,4),'customers · un rând pentru fiecare client');
  }
  function sqlTheory(ex, variant) {
    const lesson=lessonFor(ex);
    if(!lesson.theory)return sqlPractice(ex,variant);
    const result=lesson.exampleResults?.[variant];
    return `<article class="reader">${stageTabs(ex,'teorie',variant)}<h1>${esc(lesson.title)}</h1><div class="body-copy">${lesson.theory.map(p=>`<p>${esc(p)}</p>`).join('')}</div>${theoryVisual(lesson,variant)}<h2 class="example-label">Un exemplu de interogare</h2><pre class="code-example">${esc(lesson.example)}</pre>${result?dataTable(result.columns,result.rows,'Rezultatul exemplului · setul '+(variant+1)):''}${lesson.exampleExplanation?`<p class="body-copy">${esc(lesson.exampleExplanation)}</p>`:''}${lesson.commonMistake?`<aside class="tip"><strong>De reținut.</strong> ${esc(lesson.commonMistake)}</aside>`:''}<div class="reader-next"><a class="primary" href="${sqlLink(ex.id,'practica',variant)}">Continuă la practică ${icon('arrow-right','icon-small')}</a></div><p class="lesson-progress">Lecția ${course.lessons.indexOf(lesson)+1} din 6</p></article>`;
  }
  function datasetBlock(name, variant, expanded = false) {
    const rows=course.datasets[variant][name], preview=expanded?rows:rows.slice(0,2);
    return `<h2>${name}</h2>${dataTable(course.tables[name].columns,preview,'')}<div class="table-details"><span>${preview.length}/${rows.length} rânduri</span>${rows.length>2?`<button type="button" data-expand-table="${name}" data-expanded="${expanded}">${expanded?'Arată mai puține':'Arată toate ('+rows.length+')'}</button>`:''}</div>`;
  }
  function sqlPractice(ex, variant) {
    const lesson=lessonFor(ex), tables=relevantTables(ex.id), record=state.sql.records[ex.id];
    const draft=drafts.get(ex.id+':'+variant)??record?.lastQuery??'';
    const index=lesson.exercises.indexOf(ex.id)+1;
    return `<section class="practice"><div class="practice-toolbar">${lesson.theory?stageTabs(ex,'practica',variant):''}<nav class="exercise-switcher" aria-label="Exercițiile lecției">${lesson.exercises.map((id,i)=>`<a href="${sqlLink(id,'practica',variant)}" ${id===ex.id?'aria-current="step"':''}>${state.sql.records[id]?.passed?'Rezolvat · ':''}${ex.lesson==='project'?'Cerința':'Exercițiul'} ${i+1}</a>`).join('')}</nav></div>
      <div class="task-sheet"><div class="task-top"><span class="exercise-label">${ex.lesson==='project'?'Cerința':'Exercițiul'} ${index} din ${lesson.exercises.length}</span><span id="task-status" class="task-status">${record?.passed?'Rezolvat · poți repeta':'20 XP la prima rezolvare'}</span></div><h1 class="task-prompt">${esc(ex.prompt)}</h1><div class="dataset-grid ${tables.length===1?'one-table':''}">${tables.map(name=>`<section data-dataset="${name}">${datasetBlock(name,variant)}</section>`).join('')}</div><p class="schema-note">${tables.length>1?'Relație: orders.customer_id → customers.id. ':''}Setul ${variant+1}. ${ex.ordered?'Respectă ordinea rândurilor cerută.':'Ordinea rândurilor este liberă.'} Ordinea coloanelor contează.</p></div>
      <div class="editor-frame"><div class="editor-caption"><label for="sql-editor">Interogarea ta SQL</label><small>SQLite · Ctrl/⌘ + Enter pentru execuție</small></div><div class="editor-body"><pre id="line-numbers" class="line-numbers" aria-hidden="true">1</pre><textarea id="sql-editor" wrap="off" spellcheck="false" autocapitalize="off" autocomplete="off" maxlength="2000" placeholder="Scrie interogarea aici…">${esc(draft)}</textarea></div></div>
      <div class="editor-actions"><button class="primary" id="run-sql">${icon('play','icon-small')} Execută</button><button class="text-button" id="hint-button">${icon('lightbulb','icon-small')} Indiciu</button><button class="text-button" id="clear-sql">${icon('arrow-counter-clockwise','icon-small')} Resetează</button><button class="text-button alternate" id="alternate-data">Alte date</button></div>
      <div id="sql-feedback" role="status" aria-live="polite"></div><div id="hint-content" class="hint-content" hidden><ol id="hint-list"></ol></div><div id="sql-result" class="result-area"><div class="result-empty">Rezultatele vor apărea aici după execuție.</div></div>
      <div class="workspace-foot"><span class="save-status" data-save-status>${esc(accountNote())}</span><div id="next-exercise" hidden></div></div><p class="lesson-progress" data-lesson-count="${lesson.id}">${lesson.exercises.filter(id=>state.sql.records[id]?.passed).length}/${lesson.exercises.length} exerciții rezolvate în această lecție</p></section>`;
  }
  function conversation() {
    return `<div class="conversation">${dialogue.map((line,i)=>`<div class="conversation-line"><button class="icon-button" data-speak="${i}" aria-label="Ascultă replica ${i+1} în franceză">${icon('speaker-high')}</button><p lang="fr"><small class="speaker-label" lang="ro">${i%2?'Vânzătorul':'Clientul'}</small>${esc(line.fr)}<small class="dialogue-ro" id="dialogue-translation-${i}" lang="ro" hidden>${esc(line.ro)}</small></p></div>`).join('')}<button class="text-button conversation-translate" id="translate-dialogue" aria-expanded="false" aria-controls="${dialogue.map((_,i)=>'dialogue-translation-'+i).join(' ')}">Arată traducerea în română</button><p class="save-note" id="pronunciation-status" role="status" aria-live="polite"></p></div>`;
  }
  function languageView(stage) {
    const tabs=`<nav class="stage-tabs" aria-label="Etapele lecției de franceză">${[['teorie','Înțelege'],['exemple','Ascultă'],['practica','Exersează']].map(([id,label])=>`<a href="${frLink(id)}" ${stage===id?'aria-current="page"':''}>${label}</a>`).join('')}</nav>`;
    if(stage==='teorie')return `<article class="reader">${tabs}<h1>O conversație la piață.</h1><div class="body-copy"><p>La finalul lecției vei putea cere politicos fructe, înțelege o întrebare despre cantitate și întreba prețul.</p><h2>Spune ce dorești</h2><p><strong lang="fr">Je voudrais…</strong> înseamnă „Aș dori…”. Când urmează un verb, îl folosim la infinitiv: <em lang="fr">je voudrais acheter</em> — aș dori să cumpăr. Poți spune și <em lang="fr">je voudrais un kilo de pommes</em> — aș dori un kilogram de mere.</p></div><div class="translation-card"><p lang="fr">Je voudrais acheter des pommes, s’il vous plaît.</p><p class="muted">Aș dori să cumpăr niște mere, vă rog.</p></div><div class="body-copy"><h2>Deosebește cantitatea de preț</h2><p><strong lang="fr">Combien en voulez-vous ?</strong> — „Câte doriți?” Aici vorbim despre mere; <em lang="fr">en</em> ține locul lucrului deja menționat. Răspunsul <em lang="fr">un kilo</em> arată cantitatea.</p><p><strong lang="fr">C’est combien ?</strong> — „Cât costă?” Aici întrebi prețul. <em lang="fr">Deux euros cinquante</em> înseamnă 2,50 euro.</p></div><p class="tip"><span lang="fr">S’il vous plaît</span> înseamnă „vă rog”. Folosește forma cu <em lang="fr">vous</em> când vorbești politicos cu cineva pe care nu îl cunoști.</p><div class="reader-next"><a class="primary" href="${frLink('exemple')}">Ascultă conversația ${icon('arrow-right','icon-small')}</a></div></article>`;
    if(stage==='exemple')return `<article class="reader">${tabs}<h1>Ascultă și urmărește sensul.</h1><p class="body-copy">Apasă difuzorul de lângă fiecare replică. Dacă ai nevoie, deschide traducerea și observă cum se folosesc expresiile.</p>${conversation()}<div class="word-chips"><span class="word-chip">acheter = a cumpăra</span><span class="word-chip">combien = cât / câte</span><span class="word-chip">s’il vous plaît = vă rog</span></div><div class="reader-next"><a class="primary" href="${frLink()}">Continuă la practică ${icon('arrow-right','icon-small')}</a></div><p class="save-note">Pronunția folosește vocile disponibile în browserul și sistemul tău.</p></article>`;
    const answers=languageDraft??state.french.answers;
    const practice=L.practiceStatus(state.french,languageDraft);
    return `<section class="practice language-sheet">${tabs}<div class="task-sheet">${conversation()}<div class="word-chips"><span class="word-chip">acheter = a cumpăra</span><span class="word-chip">combien = cât / câte</span><span class="word-chip">s’il vous plaît = vă rog</span></div><form id="language-form" class="language-questions"><p class="section-label">Pune expresiile în context</p><h1>Completează propozițiile</h1>${[
      ['Je voudrais','des oranges.','Aș dori să cumpăr niște portocale.'],['','en voulez-vous ?','Câte doriți?'],["C’est",'?','Cât costă?']
    ].map(([before,after,meaning],i)=>`<div class="cloze-row"><label class="cloze-sentence"><span class="cloze-number">${i+1}.</span><span lang="fr">${esc(before)}</span><input class="cloze-input" name="answer-${i}" aria-label="Propoziția ${i+1}: ${esc(before)} … ${esc(after)} — ${esc(meaning)}" lang="fr" maxlength="100" autocomplete="off" autocapitalize="off" spellcheck="false" value="${esc(answers[i])}"><span lang="fr">${esc(after)}</span></label><p class="cloze-meaning muted">${esc(meaning)}</p><p class="answer-feedback" id="answer-feedback-${i}" hidden></p></div>`).join('')}<div class="language-meta"><div class="actions"><button class="primary" type="submit">Verifică</button><button class="text-button" type="button" id="language-hint">Indiciu</button><button class="text-button" type="button" id="language-reset">Repetă fără răspunsuri</button></div><div class="language-meter"><div class="progress-track" role="progressbar" aria-label="Răspunsuri corecte" aria-valuemin="0" aria-valuemax="3" aria-valuenow="${practice.correct}" id="language-meter"><span style="width:${practice.correct/3*100}%"></span></div><span id="language-count">${practice.verified?practice.correct+'/3 răspunsuri corecte':'Răspunsuri neverificate'}</span></div></div><div id="language-feedback" role="status" aria-live="polite"></div><div id="language-hints" class="hint-content" hidden></div></form></div>${saveNote()}</section>`;
  }
  function configureShell(view, ex, stage) {
    const learning=view==='lectie'||view==='limba';
    document.body.dataset.learning=String(learning);
    $('learning-rail').hidden=!learning; $('outline-button').hidden=!learning;
    $('header-context').innerHTML=learning ? (view==='limba'?`<span>Franceză · Au marché</span>${icon('caret-right')}<strong>${stage==='practica'?'Vocabular și completare':stage==='exemple'?'Ascultă conversația':'Înțelege expresiile'}</strong>`:`<span>SQL de la zero</span>${icon('caret-right')}<strong>${esc(lessonFor(ex).title)}</strong>`) : '';
    for(const link of $('global-nav').querySelectorAll('a'))link.toggleAttribute('aria-current',false);
    const active=$('global-nav').querySelector(`[href="#${['traseu','lectie','limba','proiect'].includes(view)?'cursuri':view}"]`);if(active)active.setAttribute('aria-current','page');
    if(learning){$('learning-rail').innerHTML=rail(view==='limba'?'fr':'sql',ex,stage);$('mobile-outline').innerHTML=$('learning-rail').innerHTML;}
  }
  function render() {
    generation++; stopLanguageMedia(); if(!course)return;
    let [view,search='']=location.hash.slice(1).split('?');const params=new URLSearchParams(search);
    if (['exploreaza', 'invata', 'laborator', 'vocabular', 'realizari', 'teste'].includes(view)) {
      location.replace('/biblioteca.html' + location.hash);
      return;
    }
    if(view==='traseu'){view='cursuri';params.set('domeniu','programare');}
    if(!['acasa','cursuri','lectie','limba','limbi','proiect','greseli','progres','material'].includes(view))view='acasa';
    const ex=exercise(params.get('ex'))||exercise(P.resume(state.sql));
    let stage=['teorie','exemple','practica'].includes(params.get('etapa'))?params.get('etapa'):'practica';
    if(view==='lectie'&&(stage==='exemple'||!lessonFor(ex).theory))stage='practica';
    const variant=params.get('date')==='1'?1:0;
    StudyOverview.leave();
    if (view === 'lectie') StudyOverview.record(lessonFor(ex).title, '/' + sqlLink(ex.id,stage,variant));
    if (view === 'limba') StudyOverview.record('Au marché · La piață', '/' + frLink(stage));
    configureShell(view,ex,stage);
    const host=$('main-content');
    if(view==='lectie') {
      state.sql.activeExerciseId=ex.id;state.area='sql';state.stage=stage;
      host.innerHTML=stage==='teorie'?sqlTheory(ex,variant):sqlPractice(ex,variant);
      if(stage==='practica')wireSQL(ex,variant);persist();
    } else if(view==='limbi') {
      const visit = generation;
      if (!document.querySelector('link[href="language-guide.css"]')) {
        const sheet = document.createElement('link');
        sheet.rel = 'stylesheet'; sheet.href = 'language-guide.css'; document.head.append(sheet);
      }
      host.innerHTML = '<p class="catalog" role="status">Se deschid conversațiile…</p>';
      import('./language-guide.js').then(({mount}) => {
        if (visit !== generation) return;
        const saved = state.previous.conversations || {};
        disposeGuide = mount(host, params, saved, (id, stage) => {
          if (visit !== generation || window.PolymathAccount?.authenticating || window.PolymathAccount?.loading) {
            toast('Așteaptă verificarea contului și încearcă din nou.'); return false;
          }
          saved[id] = stage; state.previous.conversations = saved; persist(); return true;
        });
      }).catch(() => {
        if (visit !== generation) return;
        host.innerHTML = '<div class="catalog"><p>Conversațiile nu s-au încărcat.</p><button type="button" class="secondary">Reîncearcă</button></div>';
        host.querySelector('button').onclick = render;
      });
    } else if(view==='limba') {
      state.area='fr';state.stage=stage;host.innerHTML=languageView(stage);wireLanguage(stage);persist();
    } else {
      host.innerHTML=view==='material'?`<div class="catalog" data-catalog-view="entry" data-id="${esc(params.get('id'))}" data-focus-question="${esc(params.get('intrebare'))}"></div>`:view==='cursuri'?catalog(params.get('domeniu')):view==='proiect'?project():view==='greseli'?review():view==='progres'?progressView():home();
    }
    const summary = host.querySelector('[data-domain-summary]');
    if (summary) showDomainSummary(summary);
    host.querySelectorAll('[data-catalog-view]').forEach(window.PolymathCatalog.renderView);
    host.querySelectorAll('[data-filter]').forEach(button=>button.addEventListener('click',()=>{filter=button.dataset.filter;render();host.querySelector(`[data-filter="${filter}"]`)?.focus();}));
    updateStatus();document.title=(view==='limbi'?'Conversații ghidate':view==='lectie'?lessonFor(ex).title:view==='limba'?'Au marché · Franceză':view==='greseli'?'Greșelile mele':view==='cursuri'?'Cursuri':'Jurnalul tău de studiu')+' · PolymathHub';
  }
  function wireSQL(ex,variant) {
    const editor=$('sql-editor'),button=$('run-sql'),feedback=$('sql-feedback');let hints=0,hasExecuted=false;
    document.querySelector('.dataset-grid').addEventListener('click',event=>{const button=event.target.closest('[data-expand-table]');if(!button)return;const name=button.dataset.expandTable;const host=button.closest('[data-dataset]');host.innerHTML=datasetBlock(name,variant,button.dataset.expanded!=='true');host.querySelector('button')?.focus();});
    const numbers=()=>$('line-numbers').textContent=Array.from({length:Math.max(4,editor.value.split('\n').length)},(_,i)=>i+1).join('\n');numbers();
    editor.addEventListener('scroll',()=>{$('line-numbers').scrollTop=editor.scrollTop;});
    editor.addEventListener('input',()=>{drafts.set(ex.id+':'+variant,editor.value);generation++;button.disabled=false;feedback.replaceChildren();feedback.className='';$('next-exercise').hidden=true;$('sql-result').innerHTML='<div class="result-empty">'+(hasExecuted?'Execută din nou pentru a verifica modificările.':'Rezultatele vor apărea aici după execuție.')+'</div>';numbers();});
    editor.addEventListener('keydown',event=>{if(event.key==='Enter'&&(event.ctrlKey||event.metaKey)){event.preventDefault();run();}});
    $('clear-sql').addEventListener('click',()=>{editor.value='';editor.dispatchEvent(new Event('input'));editor.focus();});
    $('alternate-data').addEventListener('click',()=>{drafts.set(ex.id+':'+(1-variant),editor.value);location.hash=sqlLink(ex.id,'practica',1-variant);});
    $('hint-button').addEventListener('click',()=>{if(hints===3)return;$('hint-content').hidden=false;const item=document.createElement('li');item.textContent=ex.hints[hints++];$('hint-list').append(item);$('hint-button').innerHTML=icon('lightbulb','icon-small')+' Indiciu · '+hints+'/3';$('hint-button').disabled=hints===3;});
    async function run() {
      if(button.disabled)return;
      if(window.PolymathAccount?.loading||window.PolymathAccount?.authenticating){toast('Așteaptă conectarea contului, apoi încearcă din nou.');return;}
      const query=editor.value.trim();if(!query){feedback.className='feedback error';feedback.textContent='Scrie întâi o interogare SQL.';editor.focus();return;}
      const token=++generation,user=owner;button.disabled=true;feedback.className='feedback';feedback.textContent='Se execută interogarea și se verifică rezultatul…';$('next-exercise').hidden=true;
      try {
        const response=await fetch('/api/sql-lab',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({exerciseId:ex.id,query,variant}),signal:AbortSignal.timeout(10000)});
        if(!response.ok&&response.status!==400)throw new Error();const result=await response.json();if(token!==generation||owner!==user)return;
        if(typeof result.correct!=='boolean'&&typeof result.error!=='string')throw new Error();
        hasExecuted=true;const before=P.summary(state.sql).xp;state.sql=P.attempt(state.sql,ex.id,query,result,variant);persist();
        const heading=result.correct?'Rezolvare corectă. '+(P.summary(state.sql).xp>before?'+20 XP':'XP a fost deja acordat.'):response.status===400?'Interogarea nu a putut fi executată.':result.errorCode==='check-data'?'Corect pe aceste date. Mai verifică regula.':'Interogarea rulează, dar rezultatul trebuie ajustat.';
        feedback.className='feedback '+(result.correct?'success':'error');feedback.innerHTML=`<p><strong>${esc(heading)}</strong></p><p>${esc(result.correct?ex.explanation:result.error)}</p>`;
        if(!result.correct){const link=document.createElement('a');link.href='#greseli';link.textContent='Salvat în Greșelile mele';feedback.append(link);}
        $('sql-result').innerHTML=Array.isArray(result.rows)?`<p class="result-title">Rezultatul interogării tale · ${result.rows.length} rânduri</p>${dataTable(result.columns,result.rows,'')}`:'<div class="result-empty">Corectează interogarea și execută din nou.</div>';
        if(result.correct){$('task-status').textContent='Rezolvat · poți repeta';const next=P.ids[P.ids.indexOf(ex.id)+1];$('next-exercise').innerHTML=next?`<a class="primary" href="${sqlLink(next,lessonFor(exercise(next)).id===lessonFor(ex).id?'practica':'teorie')}">Continuă ${icon('arrow-right','icon-small')}</a>`:'<a class="primary" href="#progres">Vezi progresul</a>';$('next-exercise').hidden=false;}
      } catch {
        if(token!==generation||owner!==user)return;feedback.className='feedback error';feedback.textContent='Laboratorul nu a putut verifica răspunsul. Reîncearcă; problema de conexiune nu este salvată ca greșeală.';
      } finally {if(token===generation&&owner===user)button.disabled=false;}
    }
    button.addEventListener('click',run);
  }
  function speak(index) {
    if (!dialogue[index]) return;
    marketAudio?.pause();
    const player = new Audio('/assets/audio/fr-' + (index + 4) + '.mp3');
    marketAudio = player;
    const status = $('pronunciation-status');
    player.onended = () => { if (status?.isConnected) status.textContent = 'Replică redată. O poți asculta din nou.'; };
    player.play().then(() => {
      if (player === marketAudio && status?.isConnected) status.textContent = 'Se redă replica ' + (index + 1) + '.';
    }).catch(() => {
      if (player === marketAudio && status?.isConnected) status.textContent = 'Fișierul audio este indisponibil. Poți folosi replica scrisă și traducerea.';
    });
  }
  function wireLanguage(stage) {
    document.querySelectorAll('[data-speak]').forEach(button => button.addEventListener('click', () => speak(Number(button.dataset.speak))));
    const translate=$('translate-dialogue');
    if(translate)translate.addEventListener('click',()=>{const expanded=translate.getAttribute('aria-expanded')!=='true';translate.setAttribute('aria-expanded',String(expanded));translate.textContent=expanded?'Ascunde traducerea':'Arată traducerea în română';for(const line of document.querySelectorAll('.dialogue-ro'))line.hidden=!expanded;});
    if(stage!=='practica')return;
    const form=$('language-form'),inputs=[...form.querySelectorAll('input')];let hints=0;
    function drawAnswers() {
      const result=L.check(state.french.answers);
      for(let i=0;i<3;i++){inputs[i].classList.toggle('correct',result.correct[i]);inputs[i].classList.toggle('incorrect',!result.correct[i]);inputs[i].setAttribute('aria-invalid',String(!result.correct[i]));inputs[i].setAttribute('aria-describedby','answer-feedback-'+i);const message=$('answer-feedback-'+i);message.hidden=false;message.className='answer-feedback'+(result.correct[i]?'':' incorrect');message.textContent=result.feedback[i];}
      $('language-count').textContent=result.correct.filter(Boolean).length+'/3 răspunsuri corecte';$('language-meter').setAttribute('aria-valuenow',String(result.correct.filter(Boolean).length));$('language-meter').firstElementChild.style.width=result.correct.filter(Boolean).length/3*100+'%';
    }
    if(L.practiceStatus(state.french,languageDraft).verified)drawAnswers();
    for(const input of inputs)input.addEventListener('input',()=>{languageDraft=inputs.map(i=>i.value);input.classList.remove('correct','incorrect');input.removeAttribute('aria-invalid');const i=inputs.indexOf(input);$('answer-feedback-'+i).hidden=true;$('language-feedback').replaceChildren();$('language-feedback').className='';const practice=L.practiceStatus(state.french,languageDraft);$('language-count').textContent=practice.verified?practice.correct+'/3 răspunsuri corecte':'Răspunsuri modificate · apasă Verifică';$('language-meter').setAttribute('aria-valuenow',String(practice.correct));$('language-meter').firstElementChild.style.width=practice.correct/3*100+'%';});
    form.addEventListener('submit',event=>{
      event.preventDefault();if(window.PolymathAccount?.loading||window.PolymathAccount?.authenticating){toast('Așteaptă conectarea contului.');return;}
      const before=L.summary(state.french).xp;state.french=L.attempt(state.french,inputs.map(i=>i.value));languageDraft=[...state.french.answers];persist();drawAnswers();
      const feedback=$('language-feedback');feedback.className='feedback '+(state.french.passed?'success':'error');feedback.textContent=state.french.passed?(L.summary(state.french).xp>before?'Conversație completată corect. +20 XP.':'Conversație completată corect. XP a fost deja acordat.'):'Încercarea este salvată în Greșelile mele. Citește explicațiile și mai încearcă.';
    });
    $('language-hint').addEventListener('click',()=>{const hintsText=['După je voudrais folosești verbul la infinitiv. Caută în dialog verbul „a cumpăra”.','Întrebarea despre cantitate începe cu combien.','Pentru a întreba prețul, spui C’est combien ?'];if(hints===3)return;$('language-hints').hidden=false;const p=document.createElement('p');p.textContent=hintsText[hints++];$('language-hints').append(p);$('language-hint').textContent='Indiciu · '+hints+'/3';$('language-hint').disabled=hints===3;});
    $('language-reset').addEventListener('click',()=>{
      languageDraft=['','',''];
      for(const [i,input] of inputs.entries()){input.value='';input.classList.remove('correct','incorrect');input.removeAttribute('aria-invalid');input.removeAttribute('aria-describedby');$('answer-feedback-'+i).hidden=true;}
      hints=0;$('language-hints').hidden=true;$('language-hints').replaceChildren();$('language-hint').textContent='Indiciu';$('language-hint').disabled=false;
      $('language-count').textContent='0/3 verificate în această repetare';$('language-meter').setAttribute('aria-valuenow','0');$('language-meter').firstElementChild.style.width='0%';
      $('language-feedback').className='feedback';$('language-feedback').textContent='Câmpurile sunt pregătite pentru repetare. Progresul salvat și XP rămân păstrate.';inputs[0].focus();
    });
  }
  $('outline-button').addEventListener('click',()=>$('course-dialog').showModal());
  document.addEventListener('click',event=>{if(event.target.closest('[data-close-dialog]'))event.target.closest('dialog').close();if(event.target.closest('dialog a[href^="#"]'))event.target.closest('dialog').close();});
  document.querySelector('.skip-link').addEventListener('click',event=>{event.preventDefault();$('main-content').focus();$('main-content').scrollIntoView();});
  window.addEventListener('hashchange',()=>{generation++;if('speechSynthesis' in window)window.speechSynthesis.cancel();render();$('main-content').focus({preventScroll:true});window.scrollTo(0,0);});
  async function load() {
    try {const response=await fetch('/api/sql-lab',{signal:AbortSignal.timeout(12000)});if(!response.ok)throw new Error();course=await response.json();if(course.lessons?.length!==6||course.exercises?.length!==15)throw new Error();render();}
    catch {$('main-content').innerHTML='<div class="empty"><h1>Spațiul de studiu nu s-a putut încărca.</h1><p>Verifică conexiunea și încearcă din nou.</p><button class="primary" id="reload-course">Reîncearcă</button></div>';$('reload-course').addEventListener('click',load);}
  }
  const embeddedCourse = $('sql-course-data');
  if (embeddedCourse) {
    course = JSON.parse(embeddedCourse.textContent);
    render();
  } else {
    load();
  }
})();
