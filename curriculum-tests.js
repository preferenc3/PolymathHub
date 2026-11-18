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

  function showAttempt(host, items) {
    const form = element("form");
    const result = element("h3");
    result.tabIndex = -1;
    const fields = items.map((item, index) => {
      const group = element("fieldset");
      group.append(element("legend", (index + 1) + ". " + item.question));
      item.options.forEach((option, choice) => {
        const label = element("label");
        const input = element("input");
        input.type = "radio";
        input.name = "question-" + index;
        input.value = choice;
        input.required = true;
        label.append(input, element("span", option));
        group.append(label);
      });
      form.append(group);
      return group;
    });
    const submit = element("button", "Verifică testul");
    submit.type = "submit";
    form.append(submit);
    host.replaceChildren(result, form);
    form.addEventListener("submit", event => {
      event.preventDefault();
      let score = 0;
      fields.forEach((group, index) => {
        const item = items[index];
        const selected = Number(group.querySelector(":checked").value);
        const correct = selected === item.correctIndex;
        score += Number(correct);
        group.disabled = true;
        const review = element("div");
        review.className = "test-review";
        review.append(element("strong", correct ? "Corect." : "Răspuns corect: " + item.options[item.correctIndex]));
        if (item.explanation) review.append(element("p", item.explanation));
        if (item.lesson) {
          const link = element("a", "Reia lecția · " + item.lesson.title);
          link.href = "#invata?" + new URLSearchParams({lesson: item.lesson.id});
          review.append(link);
        }
        group.append(review);
      });
      submit.remove();
      result.textContent = "Rezultat: " + score + " / " + items.length;
      result.focus();
    }, {once: true});
  }

  function render(tracks, lessons, getQuiz, activeTrack) {
    const root = document.getElementById("curriculum-test");
    const controls = element("div");
    controls.className = "test-controls";
    const label = element("label", "Alege domeniul");
    const select = element("select");
    tracks.forEach(track => select.add(new Option(track.name, track.name)));
    select.value = activeTrack;
    if (select.selectedIndex < 0) select.selectedIndex = 0;
    label.append(select);
    const start = element("button", "Începe testul");
    start.type = "button";
    const host = element("div");
    controls.append(label, start);
    root.replaceChildren(controls, host);
    select.addEventListener("change", () => {
      host.replaceChildren();
      start.textContent = "Începe testul";
    });
    start.addEventListener("click", () => {
      const items = buildTest(select.value, lessons, getQuiz);
      if (!items.length) return;
      showAttempt(host, items);
      start.textContent = "Test nou";
      host.querySelector("input")?.focus();
    });
  }

  window.CurriculumTests = {render};
})();
