const FOUNDATION_CURRICULUM = (() => {
  const escape = text => String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  function table(title, columns, rows) {
    const cells = (tag, values) => values.map(value => `<${tag}${tag === "th" ? ' scope="col"' : ""}>${escape(value)}</${tag}>`).join("");
    return `<div class="lesson-data"><table><caption>${escape(title)}</caption><thead><tr>${cells("th", columns)}</tr></thead><tbody>
      ${rows.map(row => "<tr>" + cells("td", row) + "</tr>").join("")}</tbody></table></div>`;
  }
  function lesson(track, unit, order, id, title, content) {
    return {id, track, unit, order, title, level: "1. Începător", xp: 15, ...content};
  }
  function syntax(track, unit, order, id, title, concept, line, example, prompt, answer, pattern, hint) {
    return lesson(track, unit, order, id, title, {
      theory: `<p>${concept}</p>${line ? "<pre><code>" + escape(line) + "</code></pre>" : ""}`,
      example, prompt, acceptedAnswers: [answer], officialSolution: answer,
      regexPattern: "^" + pattern + "$", caseSensitive: true, hint, explanation: hint
    });
  }

  const sqlTrack = "SQL", sqlUnit = "Primele interogări";
  const inventory = table("echipamente", ["id", "tip", "producator", "model", "stoc", "pret"], [
    [1, "Calculator", "Lenovo", "ThinkCentre", 8, 3150.50],
    [2, "Imprimantă", "HP", "LaserJet", 5, 2450],
    [3, "Calculator", "Dell", "OptiPlex", 3, 2850.75],
    [4, "Monitor", "AOC", "Q27", 0, 1199.90]
  ]);
  const sql = (unit, order, id, title, concept, line, examples, prompt, solution, hint, data = inventory) => lesson(sqlTrack, unit, order, id, title, {
    theory: `<p>${concept}</p><pre><code>${escape(line)}</code></pre>${data}`,
    example: examples, prompt, officialSolution: solution, acceptedAnswers: [solution], hint, explanation: hint,
    practiceData: data, courseSql: true
  });
  const firstQueries = [
    sql(sqlUnit, 1, "path-sql-select", "SELECT și FROM",
      "<code>SELECT</code> spune ce vrei să citești. <code>*</code> înseamnă toate coloanele. <code>FROM</code> spune din ce tabel le citești. Interogarea de mai jos citește toate coloanele și toate rândurile tabelului.",
      "SELECT * FROM echipamente;", "SELECT * FROM echipamente;\n\n-- Numai modelele\nSELECT model FROM echipamente;\n\n-- Două coloane\nSELECT model, pret FROM echipamente;",
      "Afișează toate coloanele și toate rândurile din echipamente.", "SELECT * FROM echipamente;",
      "Scrie * după SELECT și numele tabelului după FROM."),
    sql(sqlUnit, 2, "path-sql-columns", "Alegi coloanele de care ai nevoie",
      "Înlocuiește <code>*</code> cu numele coloanelor, separate prin virgulă. Rezultatul respectă ordinea coloanelor cerută după SELECT.",
      "SELECT producator, model FROM echipamente;", "SELECT pret FROM echipamente;\nSELECT tip, stoc FROM echipamente;",
      "Afișează modelul și prețul, în această ordine, pentru fiecare echipament.",
      "SELECT model, pret FROM echipamente;", "Separă model și pret cu o virgulă."),
    sql(sqlUnit, 3, "path-sql-where", "Filtrezi rândurile cu WHERE",
      "<code>WHERE</code> păstrează rândurile pentru care condiția este adevărată. Scrie textele între apostrofuri. Numerele se scriu direct.",
      "SELECT model FROM echipamente WHERE stoc > 0;", "SELECT model FROM echipamente WHERE tip = 'Imprimantă';\nSELECT model, pret FROM echipamente WHERE pret < 3000;",
      "Afișează doar coloana model pentru echipamentele cu stoc cel puțin 5.",
      "SELECT model FROM echipamente WHERE stoc >= 5;", "Cel puțin înseamnă că 5 este inclus. Folosește >=."),
    sql(sqlUnit, 4, "path-sql-sum", "Calculezi cu SUM și ROUND",
      "<code>SUM</code> adună valorile din mai multe rânduri. <code>stoc * pret</code> calculează valoarea fiecărei linii, iar <code>ROUND(..., 2)</code> o rotunjește la două zecimale.",
      "SELECT SUM(stoc) FROM echipamente;", "SELECT SUM(stoc + 1) FROM echipamente;\nSELECT model, ROUND(pret * 1.19, 2) FROM echipamente;",
      "Returnează o singură valoare: suma tuturor produselor stoc × pret, rotunjită la două zecimale.",
      "SELECT ROUND(SUM(stoc * pret), 2) FROM echipamente;", "Adună produsele stoc * pret în SUM, apoi aplică ROUND rezultatului.")
  ];
  const writes = [
    sql("Modifici datele", 5, "path-sql-insert", "Adaugi un rând cu INSERT",
      "<code>INSERT INTO</code> adaugă un rând. Lista de după numele tabelului indică ce coloane completezi. Valorile trebuie puse în aceeași ordine.",
      "INSERT INTO echipamente (id, tip, producator, model, stoc, pret)\nVALUES (10, 'Monitor', 'LG', '24MP', 2, 820);",
      "-- Exemplu de înregistrare a unui alt monitor\nINSERT INTO echipamente (id, tip, producator, model, stoc, pret)\nVALUES (12, 'Monitor', 'ASUS', 'VA24', 4, 730);",
      "Adaugă ID-ul 11, tipul Imprimantă, producătorul Canon, modelul PIXMA, stoc 3 și preț 950.",
      "INSERT INTO echipamente (id, tip, producator, model, stoc, pret) VALUES (11, 'Imprimantă', 'Canon', 'PIXMA', 3, 950);",
      "Textul se pune între apostrofuri. ID-ul, stocul și prețul sunt numere."),
    sql("Modifici datele", 6, "path-sql-update", "Schimbi o valoare cu UPDATE",
      "<code>UPDATE</code> modifică rânduri existente. <code>SET</code> stabilește noua valoare. <code>WHERE</code> selectează rândurile care vor fi modificate.",
      "UPDATE echipamente SET stoc = stoc + 2 WHERE id = 3;",
      "UPDATE echipamente SET pret = 1150 WHERE id = 4;\nUPDATE echipamente SET stoc = stoc - 1 WHERE id = 1;",
      "Mărește cu 2 stocul echipamentului cu ID-ul 2. Celelalte rânduri trebuie păstrate.",
      "UPDATE echipamente SET stoc = stoc + 2 WHERE id = 2;", "Adună la valoarea existentă și filtrează după ID.")
  ];
  const relatedTables = inventory + table("birouri", ["id", "nume"],
    [[1, "Secretariat"], [2, "Proiectare"], [3, "Suport"]]) +
    table("comenzi_it", ["id", "birou_id", "echipament_id", "cantitate", "instalare"],
      [[101, 1, 1, 2, 80], [102, 3, 4, 1, 30]]);
  const reports = [
    sql("Raportul unei comenzi", 7, "path-sql-join", "Legi două tabele cu JOIN",
      "Coloana <code>echipament_id</code> din comandă reține ID-ul produsului. <code>ON</code> stabilește perechile de rânduri. Literele <code>c</code> și <code>e</code> sunt nume scurte pentru tabele.",
      "SELECT c.id, e.model FROM comenzi_it c\nJOIN echipamente e ON e.id = c.echipament_id;",
      "SELECT c.id, b.nume FROM comenzi_it c\nJOIN birouri b ON b.id = c.birou_id;",
      "Pentru fiecare comandă, afișează mai întâi modelul echipamentului și apoi cantitatea comandată.",
      "SELECT e.model, c.cantitate FROM comenzi_it c JOIN echipamente e ON e.id = c.echipament_id;",
      "Leagă echipamente.id de comenzi_it.echipament_id. Alege model și cantitate, în ordinea cerută.", relatedTables),
    sql("Raportul unei comenzi", 8, "path-sql-concat", "Unești texte cu ||",
      "În SQLite operatorul <code>||</code> lipește două valori text. Dacă vrei să le separi prin spațiu, adaugă <code>' '</code> între ele.",
      "SELECT producator || ' ' || model FROM echipamente;",
      "SELECT tip || ': ' || model AS descriere FROM echipamente;\nSELECT model || ' / ' || producator AS eticheta FROM echipamente;",
      "Pentru fiecare echipament, afișează tipul și modelul într-o singură coloană, separate prin « - ».",
      "SELECT tip || ' - ' || model FROM echipamente;",
      "Folosește tip, apoi separatorul ca text, apoi model."),
    sql("Raportul unei comenzi", 9, "path-sql-order-total", "Calculezi costul unei comenzi",
      "Înmulțește cantitatea cu prețul unitar plus instalarea. Parantezele păstrează ordinea dorită. Aplică rotunjirea la sfârșit.",
      "ROUND(cantitate * (pret + instalare), 2)",
      "SELECT c.id, ROUND(c.cantitate * (e.pret + c.instalare), 2) AS fara_tva\nFROM comenzi_it c JOIN echipamente e ON e.id = c.echipament_id;",
      "Pentru comanda 101, afișează o singură valoare: costul cu instalare și TVA de 19%, rotunjit la două zecimale.",
      "SELECT ROUND(c.cantitate * (e.pret + c.instalare) * 1.19, 2) FROM comenzi_it c JOIN echipamente e ON e.id = c.echipament_id WHERE c.id = 101;",
      "După înmulțirea cu cantitatea, aplică TVA cu * 1.19 și apoi ROUND(..., 2).", relatedTables)
  ];
  const assetProject = sql("Proiect final · inventar IT", 1100, "path-sql-it-project", "Pregătești o comandă de echipamente IT",
    "<code>JOIN</code> leagă o linie de comandă de produs și de biroul destinatar. Într-un singur script poți să înregistrezi comanda, să actualizezi stocul și să calculezi costul ei.",
    "SELECT e.producator || ' ' || e.model AS echipament\nFROM echipamente AS e;",
    "-- Raport pentru o comandă existentă\nSELECT b.nume, e.producator || ' ' || e.model AS echipament,\n       ROUND(c.cantitate * e.pret, 2) AS valoare\nFROM comenzi_it c\nJOIN echipamente e ON e.id = c.echipament_id\nJOIN birouri b ON b.id = c.birou_id\nWHERE c.id = 101;",
    "Într-un singur script: (1) adaugă comanda 103 pentru biroul 2, imprimanta cu ID 2, cantitate 2 și cost de instalare 125 per unitate. (2) Scade stocul imprimantei cu cantitatea comandată. (3) Afișează pentru comanda 103, în ordine: numele biroului, producătorul și modelul concatenate cu spațiu, stocul rămas, totalul cu TVA de 19% (prețul plus instalarea, înmulțite cu cantitatea), rotunjit la două zecimale.",
    "INSERT INTO comenzi_it (id, birou_id, echipament_id, cantitate, instalare) VALUES (103, 2, 2, 2, 125);\nUPDATE echipamente SET stoc = stoc - 2 WHERE id = 2;\nSELECT b.nume, e.producator || ' ' || e.model, e.stoc, ROUND(c.cantitate * (e.pret + c.instalare) * 1.19, 2) FROM comenzi_it c JOIN birouri b ON b.id = c.birou_id JOIN echipamente e ON e.id = c.echipament_id WHERE c.id = 103;",
    "Leagă cele trei tabele prin ID-uri. Ordinea contează: întâi scrierea comenzii, apoi schimbarea stocului, apoi raportul filtrat la ID 103.",
    relatedTables);
  assetProject.level = "5. Proiect";
  assetProject.xp = 55;

  const cpp = "C & C++", cppUnit = "Primul program C++";
  const program = "#include <iostream>\nusing namespace std;\nint main() {\n    return 0;\n}";
  const cppStart = [
    syntax(cpp, cppUnit, 1, "path-cpp-include", "Incluzi o bibliotecă",
      "<code>#include</code> se citește înainte de compilare. Directiva cere preprocesorului să includă un antet. <code>&lt;iostream&gt;</code> pune la dispoziție declarațiile pentru fluxuri ca <code>std::cin</code> și <code>std::cout</code>.</p><p>Folosești <code>&lt;…&gt;</code> de obicei pentru antetele standard, iar <code>\"util.h\"</code> pentru un antet din proiect. În configurările uzuale, cu ghilimele se caută întâi în folderul fișierului sursă.</p><p><strong>Greșeală frecventă.</strong> Punctul și virgula după directivă. Aici rândul se termină imediat după <code>&gt;</code>.",
      "#include <iostream>", "#include <iostream>  // cin, cout\n#include <iomanip>   // setprecision, setw\n#include <cmath>     // sqrt, round\n#include <cstdio>    // printf în C++\n// <stdio.h> este antetul C corespondent\n// #include \"util.h\"  // antet propriu",
      "Scrie o singură directivă care include antetul iostream.", "#include <iostream>", "#\\s*include\\s*<iostream>", "Începe cu #include și încadrează iostream între < și >."),
    syntax(cpp, cppUnit, 2, "path-cpp-main", "Structura minimă: main",
      "Funcția <code>main</code> este punctul de pornire. <code>int</code> indică tipul codului de ieșire. Parantezele goale arată că acest program nu folosește parametri, iar între acolade vei scrie instrucțiunile.</p><p>Directiva <code>using namespace std;</code> îți permite să folosești în exemple <code>cout</code> în loc de <code>std::cout</code>. Un <code>main</code> gol poate fi compilat și se termină fără să afișeze text.</p><p><strong>Greșeală frecventă.</strong> Limbajul distinge majusculele. Scrie <code>main</code>, cu literă mică, și păstrează ambele acolade.",
      "int main() {}", "#include <iostream>\nusing namespace std;\nint main() {\n}\n\n// Doar funcția de pornire, într-un program fără intrare și ieșire\n// int main() {}",
      "Scrie în ordine directiva iostream, using namespace std; și int main cu corp gol.", "#include <iostream>\nusing namespace std;\nint main() {}",
      "#\\s*include\\s*<iostream>\\s*using\\s+namespace\\s+std\\s*;\\s*int\\s+main\\s*\\(\\s*\\)\\s*\\{\\s*\\}", "După using namespace std pune punct și virgulă. Corpul lui main este { }."),
    syntax(cpp, cppUnit, 3, "path-cpp-return", "Închei programul cu return 0",
      "<code>return</code> încheie execuția funcției. În <code>main</code>, <code>return 0;</code> îi transmite mediului care a pornit programul un cod de succes. Numărul 0 este un cod de ieșire, deci poate fi citit de terminal fără să apară pe ecran.</p><p>Dacă ajungi la ultima acoladă din <code>main</code> fără <code>return</code>, C++ tratează acest caz special ca pe <code>return 0;</code>.</p><p><strong>Greșeală frecventă.</strong> Dacă lași <code>return 0</code> fără <code>;</code>, instrucțiunea e incompletă.",
      "return 0;", program, "Scrie instrucțiunea care anunță încheierea cu succes.", "return 0;",
      "return\\s+0\\s*;", "Returnează numărul întreg 0 și termină instrucțiunea cu ;."),
    syntax(cpp, cppUnit, 4, "path-cpp-variable", "Declari o variabilă întreagă",
      "Pornește cu tipul <code>int</code>, care păstrează numere întregi, apoi alege numele. În <code>int elevi = 24;</code> semnul <code>=</code> dă valoarea inițială. Mai târziu poți folosi direct numele <code>elevi</code> în calcule.</p><p>Inițializarea cu acolade este o altă formă. <code>int elevi{24};</code> păstrează aceeași valoare și respinge o inițializare precum <code>int elevi{3.5};</code>.</p><p><strong>Greșeală frecventă.</strong> <code>24 = elevi;</code> pune numărul în locul în care trebuie să fie numele variabilei.",
      "int varsta = 18;", "int elevi = 24;\nint randuri{6};\ndouble pret = 49.90;", "Declară o variabilă int numită puncte și inițializeaz-o cu 10.", "int puncte = 10;",
      "int\\s+puncte\\s*(?:=\\s*10|\\{\\s*10\\s*\\})\\s*;", "După tip și nume, scrie = 10; sau {10};."),
    syntax(cpp, cppUnit, 5, "path-cpp-hello", "Afișezi Hello, world!",
      "<code>std::cout</code> este fluxul standard de ieșire. După el scrii <code>&lt;&lt;</code>, apoi valoarea trimisă spre ieșire. Scrie textul între ghilimele duble. Poți înlănțui încă un <code>&lt;&lt;</code> pentru a trece la rândul următor cu <code>\"\\n\"</code>.</p><p>Dacă ai pus deja <code>using namespace std;</code>, poți folosi forma scurtă <code>cout</code>.</p><p><strong>Greșeală frecventă.</strong> La afișare folosești <code>&lt;&lt;</code>. Dacă omiți ghilimelele, numele din mesaj sunt tratate ca identificatori.",
      'cout << "Salut";', '#include <iostream>\nint main() {\n    std::cout << "Salut!" << "\\n";\n    return 0;\n}',
      'Presupune că main conține deja using namespace std. Scrie o singură instrucțiune cout care afișează Hello, world! Încadrarea pe rând nou este opțională.',
      'cout << "Hello, world!";', String.raw`(?:std::)?cout\s*<<\s*"Hello, world!"(?:\s*<<\s*(?:'\\n'|"\\n"|(?:std::)?endl))?\s*;`, "Textul apare între ghilimele după <<."),
    syntax(cpp, cppUnit, 6, "path-cpp-functions", "Scrii și apelezi o funcție",
      "În <code>int dublu(int n)</code>, primul <code>int</code> este tipul rezultatului. <code>dublu</code> este numele funcției, iar <code>int n</code> este parametrul prin care primește un număr. La apelul <code>dublu(5)</code>, parametrul <code>n</code> primește 5.</p><p>Corpul calculează <code>n * 2</code>. Instrucțiunea <code>return</code> înapoiază rezultatul și apelul poate fi folosit într-o atribuire.</p><p><strong>Greșeală frecventă.</strong> În C++, <code>n ^ 2</code> înseamnă XOR pe biți. Pentru pătrat scrie <code>n * n</code>.",
      "int dublu(int n) { return n * 2; }", "int dublu(int n) { return n * 2; }\nint main() {\n    int rezultat = dublu(5); // 10\n    return 0;\n}",
      "Scrie funcția int patrat(int n), care returnează pătratul lui n.", "int patrat(int n) { return n * n; }",
      "int\\s+patrat\\s*\\(\\s*int\\s+n\\s*\\)\\s*\\{\\s*return\\s+n\\s*\\*\\s*n\\s*;\\s*\\}", "Returnează n * n din corpul funcției.")
  ];

  const cppResults = [
    "Directivele doar includ antete. Dacă le pui deasupra unui main gol, nu se afișează nimic.",
    "Programul se termină imediat, fără text afișat.",
    "Programul se termină cu codul 0. Nu afișează text.",
    "Cele trei variabile păstrează, în ordine, 24, 6 și 49.90. Declarațiile singure nu afișează valori.",
    "Pe ecran apare Salut!, urmat de un rând nou.",
    "După apel, rezultat are valoarea 10. Exemplul nu trimite text la ieșire."
  ];
  cppStart.forEach((item, index) => { item.exampleNote = cppResults[index]; });

  const cppMemory = "Referințe și pointeri";
  const cppAdvanced = [
    syntax(cpp, cppMemory, 1001, "path-cpp-reference", "O referință cu &",
      "<code>int&amp; r = x;</code> îi dă lui <code>x</code> un al doilea nume. Dacă atribui prin <code>r</code>, valoarea lui <code>x</code> se schimbă.",
      "int& r = x;", "void dubleaza(int& x) { x *= 2; }\nint main() {\n    int n = 5;\n    dubleaza(n); // n devine 10\n}",
      "Având int x deja declarat, scrie o declarație pentru referința r către x.", "int& r = x;",
      "int\\s*&\\s*r\\s*=\\s*x\\s*;", "& face parte din tipul referinței."),
    syntax(cpp, cppMemory, 1002, "path-cpp-pointer", "Adresa și dereferențierea",
      "<code>int* p</code> declară un pointer. <code>&amp;x</code> ia adresa variabilei <code>x</code>. <code>*p</code> accesează obiectul de la acea adresă. Folosește pointerul doar cât timp obiectul există.",
      "int* p = &x;", "int x = 7;\nint* p = &x;\n*p = 12; // x devine 12",
      "Având int x deja declarat, scrie declarația pointerului p inițializat cu adresa lui x.", "int* p = &x;",
      "int\\s*\\*\\s*p\\s*=\\s*&\\s*x\\s*;", "* în declarație marchează pointerul, iar & înaintea lui x ia adresa."),
    syntax(cpp, cppMemory, 1003, "path-cpp-pointer-ref", "Citești int*& fără să ghicești",
      "<code>int*&amp;</code> este o referință la un pointer către int. Este utilă când o funcție are nevoie să schimbe adresa reținută de pointerul apelantului.",
      "void muta(int*& p, int& tinta) { p = &tinta; }",
      "void muta(int*& p, int& tinta) { p = &tinta; }\nint main() {\n    int a = 1, b = 2;\n    int* p = &a;\n    muta(p, b); // acum p indică spre b\n}",
      "Declară o referință r la pointerul p, care are tipul int*. Scrie doar declarația.", "int*& r = p;",
      "int\\s*\\*\\s*&\\s*r\\s*=\\s*p\\s*;", "Citește tipul de la dreapta spre stânga: referință la pointer către int."),
    syntax(cpp, cppMemory, 1004, "path-cpp-clean", "Gestionezi durata de viață cu unique_ptr",
      "Un <code>std::unique_ptr</code> deține un obiect și îl eliberează automat când iese din domeniul său. Poți elibera obiectul mai devreme cu <code>reset()</code>. După apel, pointerul inteligent devine gol.",
      "p.reset();", "#include <memory>\nint main() {\n    auto p = std::make_unique<int>(42);\n    if (p) p.reset();\n}",
      "Având un std::unique_ptr numit p, eliberează obiectul folosind metoda potrivită.", "p.reset();",
      "p\\s*\\.\\s*reset\\s*\\(\\s*\\)\\s*;", "Apelează reset pe p, fără argumente.")
  ];
  const graphics = "Grafică și timp";
  const frame2d = '#include <raylib.h>\nint main() {\n    InitWindow(640, 360, "Primul cerc");\n    SetTargetFPS(60);\n    while (!WindowShouldClose()) {\n        BeginDrawing();\n        ClearBackground(RAYWHITE);\n        DrawCircle(320, 180, 25, BLUE);\n        EndDrawing();\n    }\n    CloseWindow();\n}';
  const timer3d = '#include <raylib.h>\nint main() {\n    InitWindow(640, 360, "Cub cu cronometru");\n    SetTargetFPS(60);\n    Camera3D camera{{5, 4, 5}, {0, 0, 0}, {0, 1, 0}, 45, CAMERA_PERSPECTIVE};\n    float timp = 0;\n    while (!WindowShouldClose()) {\n        timp += GetFrameTime();\n        BeginDrawing();\n        ClearBackground(RAYWHITE);\n        BeginMode3D(camera);\n        DrawCube({0, 0.5f, 0}, 1, 1, 1, timp < 3 ? BLUE : RED);\n        DrawGrid(10, 1.0f);\n        EndMode3D();\n        DrawText(TextFormat("%.1f s", timp), 20, 20, 22, DARKGRAY);\n        EndDrawing();\n    }\n    CloseWindow();\n}';
  const cppGraphics = [
    syntax(cpp, graphics, 1020, "path-cpp-graphics-2d", "Desenezi într-o fereastră 2D",
      'În raylib desenezi între <code>BeginDrawing()</code> și <code>EndDrawing()</code>. <code>DrawCircle</code> primește coordonatele centrului în pixeli, raza și culoarea. Exemplul se compilează într-un proiect C++ cu raylib instalat. <a href="https://www.raylib.com/cheatsheet/cheatsheet.html">Referința raylib</a>.',
      "DrawCircle(320, 180, 25, BLUE);", frame2d,
      "În interiorul cadrului, trasează un cerc roșu cu centrul (150, 80) și raza 20. Scrie doar apelul.", "DrawCircle(150, 80, 20, RED);",
      "DrawCircle\\s*\\(\\s*150\\s*,\\s*80\\s*,\\s*20(?:\\.0f?)?\\s*,\\s*RED\\s*\\)\\s*;", "Ordinea este x, y, rază, culoare."),
    syntax(cpp, graphics, 1021, "path-cpp-frame-time", "Un cronometru independent de FPS",
      "<code>GetFrameTime()</code> întoarce intervalul dintre cadre în secunde. Îl aduni la un contor ca să măsori timpul. Înmulțește viteza în pixeli pe secundă cu intervalul pentru a actualiza poziția unui obiect.",
      "timp += GetFrameTime();", "float timp = 0;\nfloat x = 20;\n// La fiecare cadru\nfloat dt = GetFrameTime();\ntimp += dt;\nx += 120 * dt; // 120 pixeli pe secundă",
      "Variabila timp există deja. Adaugă la ea durata ultimului cadru, într-o singură instrucțiune.", "timp += GetFrameTime();",
      "timp\\s*\\+=\\s*GetFrameTime\\s*\\(\\s*\\)\\s*;", "Adaugă durata cu +=, chiar dacă rata de cadre se schimbă."),
    syntax(cpp, graphics, 1022, "path-cpp-graphics-3d", "Proiect: cub 3D cu cronometru",
      "Camera transformă poziții 3D în imagine. Desenează cubul în modul 3D, apoi scrie timpul pe ecran după ce închizi modul 3D. În exemplu, la trei secunde cubul își schimbă culoarea.",
      "timp < 3 ? BLUE : RED", timer3d,
      "Modifică pragul la 5 secunde. Scrie expresia care alege BLUE înainte de prag și RED începând cu pragul.", "timp < 5 ? BLUE : RED",
      "timp\\s*<\\s*5(?:\\.0f?)?\\s*\\?\\s*BLUE\\s*:\\s*RED\\s*;?", "Păstrează ordinea condiție ? culoare înainte : culoare după.")
  ];
  for (const entry of [...cppAdvanced, ...cppGraphics]) {
    entry.level = entry.order > 1010 ? "5. Proiect" : "3. Intermediar";
    entry.xp = 30;
  }

  const html = "HTML", htmlUnit = "Prima pagină HTML";
  const htmlStart = [
    syntax(html, htmlUnit, 1, "path-html-document", "Structura unui document HTML",
      'Pune <code>&lt;!DOCTYPE html&gt;</code> la începutul fișierului. Declarația spune browserului să interpreteze pagina în modul standard. Elementul <code>&lt;html lang="ro"&gt;</code> încadrează documentul și indică limba conținutului.</p><p>În <code>&lt;head&gt;</code> pui informații despre document. <code>&lt;title&gt;</code> denumește fila browserului. În <code>&lt;body&gt;</code> scrii conținutul vizibil al paginii.</p><p><strong>Greșeală frecventă.</strong> Textul pe care vrei să-l citească vizitatorul merge în <code>body</code>. Scrie explicit etichetele de închidere în primele tale documente, ca să vezi unde se termină fiecare secțiune.',
      "<!DOCTYPE html>", '<!DOCTYPE html>\n<html lang="ro">\n<head>\n  <meta charset="utf-8">\n  <title>Acasă</title>\n</head>\n<body>\n  Salut!\n</body>\n</html>',
      "Scrie numai declarația care se pune la început ca documentul să fie interpretat în modul standard.",
      "<!DOCTYPE html>", String.raw`<![Dd][Oo][Cc][Tt][Yy][Pp][Ee]\s+[Hh][Tt][Mm][Ll]\s*>`,
      "Începe cu <! și scrie DOCTYPE html înainte de >."),
    syntax(html, htmlUnit, 2, "path-html-heading", "Titlu principal și paragraf",
      'În <code>body</code>, folosește <code>&lt;h1&gt;</code> pentru titlul principal. Acesta descrie subiectul paginii și ajută cititoarele de ecran să navigheze după titluri. <code>&lt;title&gt;</code> rămâne numele filei.</p><p>Scrie textul obișnuit în <code>&lt;p&gt;</code>. Afișarea implicită a browserului separă vizual paragrafele.</p><p><strong>Greșeală frecventă.</strong> Alegerea titlurilor după dimensiunea textului. Folosește nivelul care corespunde structurii conținutului.',
      "<h1>Jurnal de călătorie</h1>", "<h1>Jurnal de călătorie</h1>\n<p>Astăzi am vizitat muzeul.</p>",
      "Scrie numai titlul de nivel 1 cu textul exact Biblioteca mea.", "<h1>Biblioteca mea</h1>",
      String.raw`<[Hh]1\s*>\s*Biblioteca mea\s*</[Hh]1\s*>`, "Scrie textul între <h1> și </h1>."),
    syntax(html, htmlUnit, 3, "path-html-link", "Legături cu a și href",
      'Elementul <code>&lt;a&gt;</code> creează o legătură. În eticheta de deschidere pui atributul <code>href</code> cu destinația. Textul dintre etichete este partea pe care o citește și o activează vizitatorul.</p><p>O cale relativă precum <code>contact.html</code> indică un fișier aflat în același folder cu pagina. Ea trebuie să corespundă numelui fișierului.</p><p><strong>Greșeală frecventă.</strong> Un link fără text are o destinație, dar nu arată utilizatorului unde duce.',
      '<a href="contact.html">Contactează-ne</a>', '<a href="contact.html">Contactează-ne</a>',
      "Scrie un singur link către catalog.html, cu textul afișat exact Catalog.", '<a href="catalog.html">Catalog</a>',
      String.raw`<[Aa]\s+[Hh][Rr][Ee][Ff]\s*=\s*(?:"catalog\.html"|'catalog\.html'|catalog\.html)\s*>\s*Catalog\s*</[Aa]\s*>`,
      "Pune adresa în href și textul Catalog între etichete."),
    syntax(html, htmlUnit, 4, "path-html-image", "Imagini cu src și alt",
      '<code>&lt;img&gt;</code> inserează o imagine. Este un element gol, fără etichetă de închidere. Atributul <code>src</code> indică fișierul. Pentru <code>pisica.jpg</code>, pune fotografia în același folder cu documentul.</p><p><code>alt</code> transmite conținutul unei imagini informative. Cititoarele de ecran îl pot citi, iar browserul îl poate afișa atunci când fișierul nu se încarcă. Pentru o imagine pur decorativă folosești <code>alt=""</code>.</p><p><strong>Greșeală frecventă.</strong> Într-o imagine informativă, numele fișierului nu descrie conținutul.',
      '<img src="pisica.jpg" alt="O pisică albă dormind">', '<img src="pisica.jpg" alt="O pisică albă dormind">',
      "Scrie un singur element img cu src carte.png și textul alternativ exact O carte deschisă.",
      '<img src="carte.png" alt="O carte deschisă">',
      String.raw`<[Ii][Mm][Gg]\s+(?:[Ss][Rr][Cc]\s*=\s*(?:"carte\.png"|'carte\.png'|carte\.png)\s+[Aa][Ll][Tt]\s*=\s*(?:"O carte deschisă"|'O carte deschisă')|[Aa][Ll][Tt]\s*=\s*(?:"O carte deschisă"|'O carte deschisă')\s+[Ss][Rr][Cc]\s*=\s*(?:"carte\.png"|'carte\.png'|carte\.png))\s*/?>`,
      "În elementul img, scrie calea în src și descrierea între ghilimele în alt."),
    syntax(html, htmlUnit, 5, "path-html-list", "Liste cu ul și li",
      'Folosește <code>&lt;ul&gt;</code> când ordinea elementelor nu schimbă sensul listei. Fiecare element se scrie în propriul <code>&lt;li&gt;</code>, în interiorul listei.</p><p>Browserul adaugă de obicei câte o bulină. Pentru pași care trebuie urmați în ordine, există <code>&lt;ol&gt;</code>, care îi numerotează implicit.</p><p><strong>Greșeală frecventă.</strong> Punerea textului direct în <code>ul</code>. Închide fiecare <code>li</code> înainte să scrii următorul.',
      "<ul>\n  <li>Apă</li>\n  <li>Pâine</li>\n</ul>", "<ul>\n  <li>Apă</li>\n  <li>Pâine</li>\n</ul>",
      "Scrie o listă neordonată cu două elemente, Mere și Pere, în această ordine. Închide explicit fiecare element.",
      "<ul>\n  <li>Mere</li>\n  <li>Pere</li>\n</ul>",
      String.raw`<[Uu][Ll]\s*>\s*<[Ll][Ii]\s*>\s*Mere\s*</[Ll][Ii]\s*>\s*<[Ll][Ii]\s*>\s*Pere\s*</[Ll][Ii]\s*>\s*</[Uu][Ll]\s*>`,
      "Pune Mere și Pere în două elemente li separate, ambele în interiorul listei ul.")
  ];
  const htmlResults = [
    "Fila se numește Acasă. În pagină apare Salut!.",
    "Se vede un titlu principal, apoi paragraful despre muzeu.",
    "Contactează-ne deschide contact.html dacă fișierul există în același folder.",
    "Browserul încarcă fotografia dacă pisica.jpg există. Textul alternativ descrie pisica pentru cine nu vede imaginea.",
    "Apar două elemente cu buline, Apă și Pâine, pe rânduri separate."
  ];
  htmlStart.forEach((item, index) => { item.exampleNote = htmlResults[index]; });

  const java = "Java", javaUnit = "Primul program Java";
  const javaStart = [
    syntax(java, javaUnit, 1, "path-java-main", "Clasa și metoda main",
      "Într-un program Java clasic, metoda <code>main</code> este punctul de intrare. <code>static</code> permite pornirea fără crearea unui obiect. În <code>Main.java</code>, clasa publică se numește <code>Main</code>.",
      "public static void main(String[] args) {}", "public class Main {\n    public static void main(String[] args) {\n    }\n}",
      "Scrie declarația metodei main cu parametrul String[] args și corp gol.", "public static void main(String[] args) {}",
      "public\\s+static\\s+void\\s+main\\s*\\(\\s*String\\s*\\[\\s*\\]\\s*args\\s*\\)\\s*\\{\\s*\\}", "main primește un tablou de texte și nu întoarce o valoare."),
    syntax(java, javaUnit, 2, "path-java-import", "Import și nume de clase",
      "<code>import</code> se scrie înaintea clasei. El îți permite să scrii numele scurt al unei clase în locul numelui complet cu pachet.",
      "import java.util.Scanner;", "import java.util.Scanner;\nimport java.util.ArrayList;\n// java.lang este disponibil implicit, de exemplu String.",
      "Scrie importul clasei ArrayList din pachetul java.util.", "import java.util.ArrayList;",
      "import\\s+java\\s*\\.\\s*util\\s*\\.\\s*ArrayList\\s*;", "Scrie pachetul și clasa, separate prin punct."),
    syntax(java, javaUnit, 3, "path-java-print", "Afișezi text cu println",
      "<code>System.out.println</code> scrie o valoare și trece pe rând nou. Textul se pune între ghilimele duble.",
      'System.out.println("Bună");', 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Java");\n        System.out.println(2 + 3);\n    }\n}',
      'Afișează exact "Salut!" folosind println. Scrie o instrucțiune.', 'System.out.println("Salut!");',
      'System\\s*\\.\\s*out\\s*\\.\\s*println\\s*\\(\\s*"Salut!"\\s*\\)\\s*;', "Un apel Java se încheie cu punct și virgulă."),
    syntax(java, javaUnit, 4, "path-java-int", "Variabilă, tip și valoare",
      "<code>int</code> reprezintă un număr întreg. Declari tipul înaintea numelui. Poți folosi variabila într-o expresie după ce i-ai dat o valoare.",
      "int scor = 3;", "int scor = 3;\nint total = scor + 2;\nSystem.out.println(total);",
      "Declară o variabilă int numită puncte cu valoarea inițială 7.", "int puncte = 7;",
      "int\\s+puncte\\s*=\\s*7\\s*;", "Scrie tip, nume, =, valoare, apoi ;.")
  ];

  const py = "Python", pyUnit = "Primele linii în Python";
  const pythonStart = [
    syntax(py, pyUnit, 1, "path-python-print", "Afișezi o valoare cu print",
      "<code>print()</code> afișează valoarea dintre paranteze. Ghilimelele semnalează text. Fără ghilimele, o expresie ca <code>2 + 3</code> este calculată.",
      'print("Salut!")', 'print("Bună")\nprint(2 + 3)\nprint("2 + 3")',
      "Afișează exact textul Salut! pe un rând.", 'print("Salut!")',
      String.raw`print\s*\(\s*(?:"Salut!"|'Salut!')\s*\)\s*;?`, "Scrie Salut! între ghilimele, în apelul print."),
    syntax(py, pyUnit, 2, "path-python-variable", "Salvezi o valoare într-o variabilă",
      "O atribuire precum <code>n = 2</code> asociază numele unei valori. Python deduce tipul din valoare. Poți folosi ulterior numele fără ghilimele.",
      "n = 2", "n = 2\nprint(n)\nprint(n + 3)",
      "Atribuie valoarea 8 variabilei puncte.", "puncte = 8", "puncte\\s*=\\s*8\\s*;?", "Numele se scrie în stânga semnului =."),
    syntax(py, pyUnit, 3, "path-python-input", "Citești un număr",
      "<code>input()</code> citește text. Dacă vrei să aduni două numere, folosește <code>int</code> ca să convertești textul la întreg.",
      "n = int(input())", "a = int(input())\nb = int(input())\nprint(a + b)",
      "Citește un întreg și păstrează-l în variabila varsta, într-un singur rând, fără mesaj de prompt.",
      "varsta = int(input())", "varsta\\s*=\\s*int\\s*\\(\\s*input\\s*\\(\\s*\\)\\s*\\)\\s*;?", "Apelează input() în interiorul lui int()."),
    syntax(py, pyUnit, 4, "path-python-if", "Alegi cu if",
      "<code>if</code> execută un bloc când condiția este adevărată. Pune două puncte după condiție și indentează rândul următor.",
      'if n > 0:\n    print("pozitiv")', 'if n == 0:\n    print("zero")\nelse:\n    print("nenul")',
      "Completează prima linie a unei condiții care testează dacă n este strict mai mare decât 10. Scrie inclusiv cele două puncte.",
      "if n > 10:", "if\\s+n\\s*>\\s*10\\s*:", "Scrie compararea înaintea celor două puncte.")
  ];

  const languages = [
    {
      key: "en", track: "Engleză (A1–A2)", name: "engleză",
      levels: ["1. A1 Începător", "1. A1 Începător", "2. A2 Elementar"],
      alphabet: ["J", "jay", "Y", "why", "Z", "zed"], letter: "J", spelling: "jay",
      numbers: ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"],
      groups: [
        ["Animale", [["cat", "pisică"], ["dog", "câine"], ["bird", "pasăre"], ["fish", "pește"]], "I see a cat. · Văd o pisică.", "câine", "dog"],
        ["Obiecte", [["book", "carte"], ["pen", "pix"], ["chair", "scaun"], ["table", "masă"]], "This is a book. · Aceasta este o carte.", "pix", "pen"],
        ["Familie", [["mother", "mamă"], ["father", "tată"], ["sister", "soră"], ["brother", "frate"]], "This is my sister. · Aceasta este sora mea.", "mamă", "mother"],
        ["Natură și anotimpuri", [["tree", "copac"], ["flower", "floare"], ["sun", "soare"], ["spring", "primăvară"], ["summer", "vară"], ["autumn", "toamnă"], ["winter", "iarnă"]], "It is spring. It is sunny. · E primăvară. E soare.", "iarnă", "winter"]
      ],
      introduction: ["What’s your name? · Cum te numești?\nMy name is Ana. · Mă numesc Ana.\nHow old are you? · Câți ani ai?\nI am nine. · Am nouă ani.", "Mă numesc Mia.", ["My name is Mia.", "My name is Mia", "I'm Mia.", "I'm Mia", "I am Mia.", "I am Mia"]],
      connect: ["I have a dog, and my sister has a cat. · Eu am un câine, iar sora mea are o pisică.\nIt is cold, so I wear a coat. · E frig, așa că port o haină.", "Am o carte și un pix.", ["I have a book and a pen.", "I have a book and a pen"]]
    },
    {
      key: "fr", track: "Limba Franceză", name: "franceză",
      levels: ["1. Modulul A1–A2", "1. Modulul A1–A2", "1. Modulul A1–A2"],
      alphabet: ["J", "ji", "G", "gé", "Z", "zède"], letter: "G", spelling: "gé",
      numbers: ["zéro", "un", "deux", "trois", "quatre", "cinq", "six", "sept", "huit", "neuf", "dix"],
      groups: [
        ["Animale", [["un chat", "o pisică"], ["un chien", "un câine"], ["un oiseau", "o pasăre"], ["un poisson", "un pește"]], "Je vois un chat. · Văd o pisică.", "un câine", "un chien"],
        ["Obiecte", [["un livre", "o carte"], ["un stylo", "un pix"], ["une chaise", "un scaun"], ["une table", "o masă"]], "C’est un livre. · Este o carte.", "un pix", "un stylo"],
        ["Familie", [["une mère", "o mamă"], ["un père", "un tată"], ["une sœur", "o soră"], ["un frère", "un frate"]], "C’est ma sœur. · Aceasta este sora mea.", "o mamă", "une mère"],
        ["Natură și anotimpuri", [["un arbre", "un copac"], ["une fleur", "o floare"], ["le soleil", "soarele"], ["le printemps", "primăvara"], ["l’été", "vara"], ["l’automne", "toamna"], ["l’hiver", "iarna"]], "C’est le printemps. Il fait beau. · E primăvară. E vreme frumoasă.", "soarele", "le soleil"]
      ],
      introduction: ["Comment tu t’appelles ? · Cum te numești?\nJe m’appelle Ana. · Mă numesc Ana.\nQuel âge as-tu ? · Câți ani ai?\nJ’ai neuf ans. · Am nouă ani.", "Mă numesc Mia.", ["Je m’appelle Mia.", "Je m’appelle Mia"]],
      connect: ["J’ai un chien et ma sœur a un chat. · Am un câine, iar sora mea are o pisică.\nIl fait froid, donc je mets un manteau. · E frig, așa că îmbrac o haină.", "Am o carte și un pix.", ["J’ai un livre et un stylo.", "J’ai un livre et un stylo"]]
    },
    {
      key: "es", track: "Limba Spaniolă", name: "spaniolă",
      levels: ["1. Modulul A1–A2", "1. Modulul A1–A2", "1. Modulul A1–A2"],
      alphabet: ["J", "jota", "Ñ", "eñe", "Z", "zeta"], letter: "Ñ", spelling: "eñe",
      numbers: ["cero", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez"],
      groups: [
        ["Animale", [["un gato", "o pisică"], ["un perro", "un câine"], ["un pájaro", "o pasăre"], ["un pez", "un pește"]], "Veo un gato. · Văd o pisică.", "un câine", "un perro"],
        ["Obiecte", [["un libro", "o carte"], ["un bolígrafo", "un pix"], ["una silla", "un scaun"], ["una mesa", "o masă"]], "Es un libro. · Este o carte.", "un pix", "un bolígrafo"],
        ["Familie", [["una madre", "o mamă"], ["un padre", "un tată"], ["una hermana", "o soră"], ["un hermano", "un frate"]], "Es mi hermana. · Este sora mea.", "o mamă", "una madre"],
        ["Natură și anotimpuri", [["un árbol", "un copac"], ["una flor", "o floare"], ["el sol", "soarele"], ["la primavera", "primăvara"], ["el verano", "vara"], ["el otoño", "toamna"], ["el invierno", "iarna"]], "Es primavera. Hace sol. · E primăvară. E soare.", "soarele", "el sol"]
      ],
      introduction: ["¿Cómo te llamas? · Cum te numești?\nMe llamo Ana. · Mă numesc Ana.\n¿Cuántos años tienes? · Câți ani ai?\nTengo nueve años. · Am nouă ani.", "Mă numesc Mia.", ["Me llamo Mia.", "Me llamo Mia"]],
      connect: ["Tengo un perro y mi hermana tiene un gato. · Am un câine, iar sora mea are o pisică.\nHace frío, así que me pongo un abrigo. · E frig, așa că îmbrac o haină.", "Am o carte și un pix.", ["Tengo un libro y un bolígrafo.", "Tengo un libro y un bolígrafo"]]
    }
  ];
  const languageLessons = languages.flatMap(lang => {
    const basics = "Primele cuvinte";
    function word(unit, order, suffix, title, theory, example, prompt, answers, rows = [], level = lang.levels[0]) {
      const glossary = rows.map(([term, def]) => ({term, def}));
      return lesson(lang.track, unit, order, `path-${lang.key}-${suffix}`, title, {
        level, language: lang.key, theory, example, prompt, acceptedAnswers: answers,
        glossary, hint: "Revino la teorie sau la modelul din Exemple.",
        explanation: "O variantă corectă este „" + answers[0] + "”."
      });
    }
    const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
    if (lang.key === "es") alphabet.splice(14, 0, "Ñ");
    const letters = lang.alphabet.filter((_, index) => index % 2 === 0).map((letter, index) => [letter, lang.alphabet[index * 2 + 1]]);
    const numbers = lang.numbers.map((number, index) => [index, number]);
    return [
      word(basics, 1, "alphabet", "Alfabetul",
        `<p>Începe cu literele în ordine. La dictarea unui nume folosești numele literelor. ${lang.key === "en" ? "Z este zed în engleza britanică." : lang.key === "es" ? "Ñ este o literă distinctă, după N." : "É și È sunt forme accentuate ale literei E."}</p>
        <p>${alphabet.join(" · ")}</p>${table("Litere de exersat", ["Literă", "Nume"], letters)}`,
        letters.map(([letter, name]) => letter + " → " + name).join("\n"), `Scrie numele literei ${lang.letter} în ${lang.name}.`, [lang.spelling], letters),
      word(basics, 2, "numbers", "Numerele de la 0 la 10", "<p>Citește fiecare număr și repetă-l înainte de a trece la următorul.</p>" + table("Numere", ["Cifră", "Cuvânt"], numbers),
        `2 → ${lang.numbers[2]}\n5 → ${lang.numbers[5]}\n10 → ${lang.numbers[10]}`,
        `Scrie numărul 7 cu litere, în ${lang.name}.`, [lang.numbers[7]], numbers.slice(1, 6).map(([n, w]) => [String(n), w])),
      ...lang.groups.map(([title, rows, example, target, answer], index) =>
        word(basics, index + 3, ["animals", "objects", "family", "nature"][index], title,
          `<p>Învață câte un cuvânt pe rând. ${lang.key === "en" ? "Citește cuvântul și spune-l cu voce tare." : "Repetă substantivul împreună cu articolul."}</p>` +
          table(title, [lang.name, "română"], rows), example, `Cum spui „${target}” în ${lang.name}?`, [answer], rows)),
      word("Propoziții de zi cu zi", 7, "introduce", "Spui cum te numești",
        "<p>Începe cu o întrebare scurtă și răspunde cu o propoziție completă. Repetă apoi schimbând numele sau vârsta.</p>", lang.introduction[0],
        `Tradu în ${lang.name} propoziția „${lang.introduction[1]}”`, lang.introduction[2], [], lang.levels[1]),
      word("Propoziții de zi cu zi", 8, "connect", "Legi două idei",
        "<p>Cu un cuvânt de legătură poți adăuga un lucru sau poți arăta rezultatul unei situații.</p>" +
        table("Cuvinte de legătură", [lang.name, "română"], lang.key === "en" ? [["and", "și"], ["so", "așa că"]] : lang.key === "fr" ? [["et", "și"], ["donc", "așa că"]] : [["y", "și"], ["así que", "așa că"]]),
        lang.connect[0], `Tradu în ${lang.name} propoziția „${lang.connect[1]}”`, lang.connect[2], [], lang.levels[2])
    ];
  });

  return [...firstQueries, ...writes, ...reports, assetProject, ...cppStart, ...cppAdvanced, ...cppGraphics,
    ...htmlStart, ...javaStart, ...pythonStart, ...languageLessons];
})();
