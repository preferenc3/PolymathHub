import {languages, scenes} from './language-lessons.js';

const steps = ['Vocabular', 'Gramatică', 'Ascultare', 'Vorbire'];
const link = (lang, scene) => '#limbi' + (lang ? '?limba=' + lang + (scene ? '&lectie=' + scene : '') : '');
const normalized = text => text.normalize('NFC').toLocaleLowerCase().replace(/[’‘]/g, "'").trim();
const library = track => '/biblioteca.html#exploreaza?' + new URLSearchParams({track});
const shuffled = values => {
  const items = [...values];
  for (let index = items.length - 1; index > 0; index--) {
    const next = Math.floor(Math.random() * (index + 1));
    [items[index], items[next]] = [items[next], items[index]];
  }
  return items;
};

export function mount(host, params, saved, save) {
  const code = params.get('limba');
  const lang = Object.hasOwn(languages, code) ? languages[code] : null;
  const number = Number(params.get('lectie'));
  const lesson = lang?.lessons[number - 1];
  let stage = 0;
  let disposeStep = () => {};
  function breadcrumb() {
    return '<a class="guide-back" href="' + (lesson ? link(code) : lang ? link() : '#acasa') + '">← ' + (lesson ? lang.name : lang ? 'Limbi străine' : 'Acasă') + '</a>';
  }
  function sceneLink(name, i) {
    const progress = saved[code + '-' + (i + 1)] || 0;
    return '<a class="guide-menu-item" href="' + link(code, i + 1) + '"><strong>' + name + '</strong><span>' + (progress === 4 ? 'Încheiată · repetă' : progress ? 'Continuă · ' + progress + '/4' : '4 activități') + ' →</span></a>';
  }
  function overview() {
    host.innerHTML = '<section class="guide">' + breadcrumb() + '<h1>' + (lang ? lang.name : 'Limbi străine') + '</h1><p class="guide-intro">' + (lang ? 'Conversații de început · A1' : 'Alege limba în care vrei să porți prima conversație.') + '</p><div class="guide-menu">' + (lang ? scenes.map(sceneLink).join('') : Object.entries(languages).map(([key, entry]) => '<a class="guide-menu-item" href="' + link(key) + '"><strong>' + entry.name + '</strong><span>3 conversații →</span></a>').join('')) + '</div><a class="guide-library" href="' + (lang ? library(lang.track) : '/biblioteca.html#exploreaza?division=languages') + '">Vezi toate ' + (lang ? 'temele de ' + lang.name.toLowerCase() : 'domeniile de limbi') + ' →</a></section>';
  }
  const id = code + '-' + number;
  function draw(focus = false) {
    disposeStep();
    disposeStep = () => {};
    if (stage === 4) {
      host.innerHTML = '<section class="guide">' + breadcrumb() + '<p class="guide-intro">' + lang.name + ' · A1</p><h1 tabindex="-1">Ai încheiat conversația.</h1><div class="guide-sheet"><p>Ai exersat sensul cuvintelor, forma corectă și ascultarea. Ultimul pas a fost o autoevaluare orală.</p><p lang="' + code + '" class="guide-phrase">' + lesson.phrase + '</p><p>' + lesson.translation + '</p></div><div class="actions"><a class="primary" href="' + (number < scenes.length ? link(code, number + 1) : link(code)) + '">' + (number < scenes.length ? 'Continuă cu „' + scenes[number] + '”' : 'Înapoi la conversații') + '</a><button type="button" id="guide-repeat" class="secondary">Repetă lecția</button></div></section>';
      host.querySelector('#guide-repeat').onclick = () => { stage = 0; draw(true); };
      if (focus) host.querySelector('h1').focus();
      return;
    }
    const audio = '<audio preload="none" src="/assets/audio/' + id + '.mp3" id="guide-audio"></audio><div class="guide-audio-actions"><button type="button" class="secondary" data-play="1">Ascultă modelul</button><button type="button" class="secondary" data-play="0.8">Mai lent</button></div><p class="guide-status" role="status" id="guide-audio-status"></p>';
    let prompt, activity;
    if (stage === 0 || stage === 2) {
      const vocab = stage === 0;
      prompt = vocab ? 'Ce înseamnă „' + lesson.word + '”?' : lesson.question;
      const choices = vocab ? [lesson.meaning, ...lesson.distractors] : lesson.choices;
      activity = (vocab ? '' : audio + '<details><summary>Citește transcrierea</summary><p lang="' + code + '">' + lesson.phrase + '</p></details>') + '<div class="guide-choices">' + shuffled(choices).map(value => '<button type="button" class="guide-choice">' + value + '</button>').join('') + '</div>';
    } else if (stage === 1) {
      prompt = 'Completează replica';
      activity = '<p class="guide-phrase" lang="' + code + '">' + lesson.grammar + '</p><form><label for="guide-answer">Cuvântul sau expresia lipsă</label><input id="guide-answer" lang="' + code + '" required maxlength="70" autocomplete="off" autocapitalize="off" spellcheck="false"><button class="primary">Verifică</button></form>';
    } else {
      prompt = 'Spune replica cu voce tare';
      activity = '<p class="guide-phrase" lang="' + code + '">' + lesson.phrase + '</p><p>' + lesson.translation + '</p>' + audio + '<p>' + lesson.cue + '</p><p class="guide-note">Poți compara vocea ta cu modelul. Înregistrarea rămâne aici până părăsești pasul. Tu evaluezi ritmul și accentul.</p><div class="guide-audio-actions"><button type="button" class="secondary" id="guide-record">Înregistrează-mi vocea</button><button type="button" class="secondary" id="guide-stop" hidden>Oprește înregistrarea</button></div><p id="guide-record-status" role="status"></p><audio id="guide-review" controls hidden aria-label="Ascultă înregistrarea ta"></audio><button type="button" id="guide-self" class="guide-choice">Am repetat replica</button>';
    }
    host.innerHTML = '<section class="guide">' + breadcrumb() + '<p class="guide-intro">' + lang.name + ' · ' + scenes[number - 1] + '</p><div class="guide-tracker"><span>Pasul ' + (stage + 1) + ' din 4 · ' + steps[stage] + '</span><progress max="4" value="' + stage + '" aria-label="Pași încheiați"></progress></div><div class="guide-sheet"><h1 tabindex="-1">' + prompt + '</h1>' + activity + '<p class="guide-feedback" role="status"></p><button class="primary" id="guide-next" hidden>' + (stage === 3 ? 'Încheie conversația' : 'Pasul următor') + '</button></div></section>';
    const feedback = host.querySelector('.guide-feedback'), next = host.querySelector('#guide-next');
    function check(correct, message) {
      feedback.dataset.result = correct ? 'ok' : 'retry';
      feedback.textContent = message;
      next.hidden = !correct;
    }
    host.querySelectorAll('.guide-choices button').forEach(button => { button.onclick = () => {
      const answer = stage === 0 ? lesson.meaning : lesson.choices[0];
      const correct = button.textContent === answer;
      check(correct, correct ? (stage === 0 ? 'Corect. „' + lesson.word + '” înseamnă „' + lesson.meaning + '”.' : 'Ai înțeles replica. ' + lesson.translation) : (stage === 0 ? 'Mai încearcă. În replică, cuvântul are sensul „' + lesson.meaning + '”.' : 'Ascultă încă o dată sau deschide transcrierea.'));
      host.querySelectorAll('.guide-choices button').forEach(option => option.removeAttribute('data-result'));
      button.dataset.result = correct ? 'ok' : 'retry';
    }; });
    const form = host.querySelector('form');
    if (form) {
      const input = form.querySelector('input');
      input.oninput = () => { next.hidden = true; feedback.textContent = ''; };
      form.onsubmit = event => {
        event.preventDefault();
        const correct = normalized(input.value) === normalized(lesson.answer);
        check(correct, (correct ? 'Corect. ' : 'Mai încearcă. ') + lesson.rule);
      };
    }
    const self = host.querySelector('#guide-self');
    if (self) self.onclick = () => check(true, 'Repetare încheiată. Poți reasculta modelul înainte să termini.');
    if (stage >= 2) disposeStep = wireAudio(host);
    next.onclick = () => {
      if (!save(id, Math.max(saved[id] || 0, stage + 1))) return;
      stage++; draw(true);
    };
    if (focus) host.querySelector('h1').focus({preventScroll:true});
  }
  if (lesson) {
    window.StudyOverview.record(lang.name + ' · ' + lesson.phrase, '/' + link(code, number));
    stage = saved[id] || 0;
    draw();
  } else overview();
  return () => disposeStep();
}

// The recording stays in memory. A late permission grant after navigation must release its tracks.
function wireAudio(host) {
  const model = host.querySelector('#guide-audio');
  const audioStatus = host.querySelector('#guide-audio-status');
  const record = host.querySelector('#guide-record'), stop = host.querySelector('#guide-stop');
  const review = host.querySelector('#guide-review'), status = host.querySelector('#guide-record-status');
  let active = true, recorder, stream, lease = '', timeout;
  const playButtons = [...host.querySelectorAll('[data-play]')];
  for (const play of playButtons) play.onclick = async () => {
    review?.pause();
    model.playbackRate = Number(play.dataset.play);
    model.currentTime = 0;
    try { await model.play(); if (active) audioStatus.textContent = 'Se redă modelul.'; }
    catch { if (active) audioStatus.textContent = 'Fișierul audio nu s-a putut reda. Poți citi replica și continua.'; }
  };
  model.onended = () => { audioStatus.textContent = 'Poți reasculta modelul.'; };
  function release() {
    clearTimeout(timeout);
    stream?.getTracks().forEach(track => track.stop());
    stream = null;
  }
  if (record && navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined') {
    record.onclick = async () => {
      record.disabled = true;
      model.pause(); review.pause();
      status.textContent = 'Se așteaptă accesul la microfon…';
      try {
        stream = await navigator.mediaDevices.getUserMedia({audio:true});
        if (!active) { release(); return; }
        recorder = new MediaRecorder(stream);
        const parts = [];
        recorder.ondataavailable = event => { if (event.data.size) parts.push(event.data); };
        recorder.onstop = () => {
          release();
          if (!active) return;
          record.disabled = false; record.hidden = false; stop.hidden = true;
          playButtons.forEach(button => button.disabled = false);
          if (!parts.length) { status.textContent = 'Nu s-a captat sunet. Poți încerca din nou.'; return; }
          if (lease) URL.revokeObjectURL(lease);
          lease = URL.createObjectURL(new Blob(parts, {type:recorder.mimeType}));
          review.src = lease; review.hidden = false;
          record.textContent = 'Înregistrează din nou';
          status.textContent = 'Ascultă vocea ta, apoi compară cu modelul.';
        };
        recorder.start(); record.hidden = true; stop.hidden = false;
        playButtons.forEach(button => button.disabled = true);
        status.textContent = 'Înregistrare în curs · maximum 15 secunde.'; stop.focus();
        timeout = setTimeout(() => { if (recorder?.state === 'recording') recorder.stop(); }, 15000);
      } catch {
        release();
        if (active) { record.hidden = false; record.disabled = false; stop.hidden = true; status.textContent = 'Microfon indisponibil. Poți repeta cu voce tare și continua fără înregistrare.'; }
      }
    };
    stop.onclick = () => { if (recorder?.state === 'recording') recorder.stop(); };
    review.onplay = () => model.pause();
  } else if (record) {
    record.hidden = true; status.textContent = 'Acest browser permite exersarea cu voce tare fără înregistrare.';
  }
  return () => {
    active = false; model.pause(); review?.pause();
    if (recorder?.state === 'recording') recorder.stop();
    release();
    if (lease) URL.revokeObjectURL(lease);
  };
}
