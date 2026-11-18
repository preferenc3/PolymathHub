(() => {
  // Each entry has a question, its answer, two alternatives and an explanation.
  const questions = {
    "SQL": [
      "Un magazin vrea să vadă inclusiv clienții cu zero comenzi. Cum legi clienții de comenzi?",
      "Pornești de la clienți și folosești LEFT JOIN.", "Folosești INNER JOIN.", "Grupezi doar tabelul comenzilor.",
      "LEFT JOIN păstrează fiecare rând din tabelul clienților. Pentru un client fără comenzi, coloanele din partea dreaptă primesc NULL."
    ],
    "Java": [
      "Două obiecte String construite separat conțin textul «Ana». Cum compari conținutul lor?",
      "a.equals(b)", "a == b", "a.length() == b.length()",
      "String.equals compară caracterele. Operatorul == compară referințele, iar două texte diferite pot avea aceeași lungime."
    ],
    "JavaScript": [
      "Ce valoare are n după instrucțiunile const a = [1, 2]; const n = a.push(3);?",
      "3", "[1, 2, 3]", "2", "push adaugă elementul la sfârșitul tabloului și întoarce noua lungime."
    ],
    "TypeScript & React": [
      "Un contor React trebuie incrementat pornind de la ultima valoare din coada de actualizări. Ce scrii?",
      "setCount(previous => previous + 1)", "count = count + 1", "setCount(() => 1)",
      "React transmite funcției de actualizare valoarea precedentă, inclusiv când procesează mai multe actualizări împreună."
    ],
    "C & C++": [
      "Pentru int a[] = {4, 7, 9}, ce valoare obții din a[1]?",
      "7", "4", "9", "Indicii încep de la zero. a[0] este 4, a[1] este 7, iar a[2] este 9."
    ],
    "Rust & Sisteme Moderne": [
      "O funcție Rust trebuie să citească un String fără să-i preia proprietatea. Ce tip de parametru acceptă și un fragment de text?",
      "&str", "String", "&mut String", "O referință &str împrumută textul pentru citire și poate reprezenta inclusiv o porțiune dintr-un String."
    ],
    "Go & Sisteme Distribuite": [
      "Ce se întâmplă când o gorutină trimite pe un canal fără buffer și încă nu există niciun receptor pregătit?",
      "Trimiterea așteaptă un receptor.", "Valoarea este abandonată.", "Canalul creează automat un buffer.",
      "Pe un canal fără buffer, transmiterea sincronizează gorutina care trimite cu cea care primește."
    ],
    "C#": [
      "Ce valoare are rezultat după string? nume = null; var rezultat = nume ?? \"Anonim\";?",
      "Textul Anonim", "null", "Un șir gol", "Operatorul ?? folosește expresia din dreapta când operandul din stânga este null."
    ],
    "Python": [
      "Ce obții din [2, 4, 6, 8][1:3] în Python?",
      "[4, 6]", "[4, 6, 8]", "[2, 4, 6]", "Secțiunea începe la indicele 1 și se oprește înainte de indicele 3."
    ],
    "DevOps & Sisteme Linux": [
      "Un proces Linux scrie erori în stderr. Ce redirecționare le salvează separat într-un fișier?",
      "2> erori.log", "> erori.log", "< erori.log", "Descriptorul 2 corespunde fluxului standard de erori. Descriptorul 1 corespunde ieșirii standard."
    ],
    "Algoritmi & Structuri de Date": [
      "Într-o coadă FIFO introduci A, B și C, în această ordine. Ce element extragi primul?",
      "A", "B", "C", "Într-o coadă FIFO, primul element introdus este primul extras."
    ],
    "Securitate Cibernetică & Web": [
      "De ce se generează o sare aleatoare pentru fiecare parolă înainte de calcularea hashului?",
      "Pentru ca parolele identice să poată avea hashuri diferite.", "Pentru a putea decripta parola la autentificare.", "Pentru a elimina nevoia unui algoritm de hash pentru parole.",
      "Sarea individuală diferențiază rezultatele pentru aceeași parolă. Ea se stochează împreună cu hashul."
    ],
    "Inteligență Artificială & ML": [
      "Un model are rezultate excelente pe exemplele de antrenare și slabe pe exemple noi din aceeași distribuție. Ce sugerează acest lucru?",
      "Supraînvățare", "O evaluare perfectă", "Lipsa oricărei relații în datele de antrenare",
      "Diferența sugerează că modelul a învățat particularități ale setului de antrenare care se generalizează slab."
    ],
    "Resurse & Proiecte Open-Source": [
      "Ce fișier cauți înaintea primei contribuții ca să afli cum preferă proiectul să primească modificările?",
      "CONTRIBUTING.md", ".gitignore", "package-lock.json", "Ghidul de contribuție descrie de obicei pașii de dezvoltare, testare și trimitere pentru revizuire."
    ],
    "Engleză (A1–A2)": [
      "Completează propoziția «My sister ___ to school every morning.»",
      "goes", "go", "going", "La prezentul simplu, subiectul my sister este la persoana a treia singular. Forma lui go este goes."
    ],
    "Engleză (B1–B2)": [
      "Completează «If I had more free time, I ___ a new language.»",
      "would learn", "will learn", "had learned", "Condiționalul al doilea exprimă o situație imaginară în prezent, cu if + trecut simplu și would + verb."
    ],
    "Engleză (C1–C2)": [
      "Care formulare păstrează sensul expresiei «The findings should be taken with a grain of salt»?",
      "The findings deserve cautious interpretation.", "The findings are beyond dispute.", "The findings must be discarded entirely.",
      "Expresia recomandă o doză de scepticism. Rezultatele pot fi totuși relevante."
    ],
    "Engleză: Familie & Hobby": [
      "Fratele mamei tale vine în vizită. Cum îl prezinți în engleză?",
      "This is my uncle.", "This is my nephew.", "This is my cousin.", "Uncle înseamnă unchi. Nephew înseamnă nepot de frate sau de soră, iar cousin înseamnă văr sau verișoară."
    ],
    "Limba Franceză": [
      "Ești la brutărie și ceri politicos o baghetă. Ce spui?",
      "Je voudrais une baguette, s’il vous plaît.", "Je suis une baguette, merci.", "J’habite à la boulangerie.",
      "Je voudrais înseamnă «aș dori». Formula s’il vous plaît face cererea politicoasă."
    ],
    "Limba Spaniolă": [
      "Cum întrebi în spaniolă unde se află gara?",
      "¿Dónde está la estación?", "¿Cuándo sale el tren?", "¿Cuánto cuesta el billete?",
      "Dónde cere locul, cuándo cere momentul, iar cuánto cuesta cere prețul."
    ]
  };

  function shuffle(items) {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  function buildTest(track, lessons, getQuiz) {
    const items = [];
    if (questions[track]) {
      const [question, answer, alt1, alt2, explanation] = questions[track];
      const options = shuffle([answer, alt1, alt2]);
      items.push({question, options, correctIndex: options.indexOf(answer), explanation});
    }
    const seen = new Set(items.map(item => item.question));
    for (const lesson of shuffle(lessons.filter(item => item.track === track))) {
      const quiz = getQuiz(lesson);
      if (!quiz.question || !quiz.explanation || quiz.correctIndex < 0 || quiz.options.length < 2 || seen.has(quiz.question)) continue;
      seen.add(quiz.question);
      items.push({...quiz, lesson});
      if (items.length === 5) break;
    }
    return shuffle(items);
  }

  function element(tag, value) {
    const node = document.createElement(tag);
    if (value !== undefined) node.textContent = value;
    return node;
  }

  function button(label, className = "test-primary") {
    const control = element("button", label);
    control.type = "button";
    control.className = className;
    return control;
  }

  function showResult(host, items, answers, track, start, choose) {
    const score = items.filter((item, index) => item.correctIndex === answers[index]).length;
    const summary = element("header");
    summary.className = "test-summary";
    const title = element("h3", score + " din " + items.length + " răspunsuri corecte");
    title.tabIndex = -1;
    const actions = element("div");
    actions.className = "test-actions";
    const replay = button("Încearcă un test nou");
    const back = button("Alege alt domeniu", "test-secondary");
    replay.onclick = () => start(track);
    back.onclick = () => choose(track.name);
    actions.append(replay, back);
    summary.append(element("p", track.name), title, actions);

    const review = element("ol");
    review.className = "test-results";
    items.forEach((item, index) => {
      const correct = answers[index] === item.correctIndex;
      const row = element("li");
      const status = element("strong", correct ? "Corect" : "De repetat");
      status.className = correct ? "test-correct" : "test-incorrect";
      row.append(status, element("h4", item.question),
        element("p", "Ai ales: " + item.options[answers[index]]));
      if (!correct) row.append(element("p", "Răspuns corect: " + item.options[item.correctIndex]));
      row.append(element("p", item.explanation));
      if (item.lesson) {
        const link = element("a", "Reia lecția · " + item.lesson.title);
        link.href = "#invata?" + new URLSearchParams({lesson: item.lesson.id});
        row.append(link);
      }
      review.append(row);
    });
    host.replaceChildren(summary, review);
    title.focus();
  }

  function showAttempt(host, items, track, start, choose) {
    const answers = new Array(items.length);
    function showQuestion(index) {
      const item = items[index];
      const toolbar = element("header");
      toolbar.className = "test-toolbar";
      const leave = button("Ieși din test", "test-secondary");
      leave.onclick = () => {
        if (!answers.some(answer => answer !== undefined) || window.confirm("Ieși din test? Răspunsurile acestei încercări se vor pierde.")) {
          choose(track.name);
        }
      };
      toolbar.append(element("strong", track.name), leave);

      const progress = element("progress");
      progress.max = items.length;
      progress.value = index + 1;
      progress.setAttribute("aria-label", "Întrebarea curentă");
      const position = element("p", "Întrebarea " + (index + 1) + " din " + items.length);
      position.className = "test-position";

      const form = element("form");
      const group = element("fieldset");
      group.append(element("legend", item.question));
      item.options.forEach((option, choice) => {
        const label = element("label");
        const input = element("input");
        input.type = "radio";
        input.name = "answer";
        input.value = choice;
        input.required = true;
        input.checked = answers[index] === choice;
        input.onchange = () => { answers[index] = choice; };
        label.append(input, element("span", option));
        group.append(label);
      });

      const actions = element("div");
      actions.className = "test-actions";
      if (index > 0) {
        const previous = button("Întrebarea anterioară", "test-secondary");
        previous.onclick = () => showQuestion(index - 1);
        actions.append(previous);
      }
      const last = index + 1 === items.length;
      const next = button(last ? "Vezi rezultatul" : "Întrebarea următoare");
      next.type = "submit";
      actions.append(next);
      form.append(group, actions);
      form.onsubmit = event => {
        event.preventDefault();
        if (last) showResult(host, items, answers, track, start, choose);
        else showQuestion(index + 1);
      };
      host.replaceChildren(toolbar, position, progress, form);
      position.tabIndex = -1;
      position.focus();
    }
    showQuestion(0);
  }

  function render(tracks, lessons, getQuiz, loadContent) {
    const root = document.getElementById("curriculum-test");
    const host = element("div");
    host.className = "test-screen";
    root.replaceChildren(host);

    async function start(track) {
      const status = element("p", "Pregătim întrebările pentru " + track.name + "…");
      status.setAttribute("role", "status");
      status.tabIndex = -1;
      host.replaceChildren(status);
      status.focus();
      try {
        const domainLessons = lessons.filter(lesson => lesson.track === track.name);
        if (domainLessons.some(lesson => lesson.contentUrl)) await loadContent(domainLessons);
        if (!host.isConnected || root.closest(".hidden")) return;
        const items = buildTest(track.name, lessons, getQuiz);
        showAttempt(host, items, track, start, choose);
      } catch {
        if (!host.isConnected || root.closest(".hidden")) return;
        status.textContent = "Întrebările nu s-au putut încărca.";
        const retry = button("Reîncearcă");
        const back = button("Înapoi la domenii", "test-secondary");
        retry.onclick = () => start(track);
        back.onclick = () => choose(track.name);
        host.append(retry, back);
      }
    }

    function choose(focusTrack) {
      const intro = element("p", "Alege un domeniu pentru un test de cinci întrebări. La final vezi ce ai răspuns corect și ce merită repetat.");
      intro.className = "test-intro";
      host.replaceChildren(intro);
      for (const [heading, division] of [
        ["Informatică și programare", "Informatică și Programare"],
        ["Limbi străine", "Limbi Străine & Comunicare"]
      ]) {
        const section = element("section");
        section.className = "test-domains";
        section.append(element("h3", heading));
        const grid = element("ul");
        for (const track of tracks.filter(item => item.division === division)) {
          const cell = element("li");
          const control = button(track.name, "test-domain");
          control.setAttribute("aria-label", "Începe testul de " + track.name);
          const icon = element("img");
          icon.alt = "";
          icon.src = "/assets/icons/caret-right.svg";
          control.append(icon);
          control.onclick = () => start(track);
          cell.append(control);
          grid.append(cell);
        }
        section.append(grid);
        host.append(section);
      }
      if (focusTrack) {
        [...host.querySelectorAll("button")].find(control => control.textContent === focusTrack)?.focus();
      }
    }

    choose();
  }

  window.CurriculumTests = {render};
})();
