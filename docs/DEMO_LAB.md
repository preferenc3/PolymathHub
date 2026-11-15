# Demonstrație PolymathHub — teză de an

Laborator: https://polymathhub-lab.vercel.app — branch `production`. Conturile și progresul sunt în baza Supabase separată a laboratorului. Site-ul principal rămâne pe `main`.

## Demonstrație de 5–7 minute

1. Deschide pagina principală: arată cele două domenii și primul pas sau continuarea bazată pe progres.
2. Deschide SQL → Tabele și primele interogări. Explică tabelul, coloanele și rezultatul exemplului calculat în SQLite.
3. La primul exercițiu, execută `SELECT name FROM customers;`: interogarea este validă, dar nu respectă cerința de a afișa toate coloanele. Arată explicația și Greșelile mele.
4. Corectează cu `SELECT * FROM customers;`. Arată tabelul rezultat, starea „Rezolvate ulterior” și soluția ta. Reexecută: XP nu crește a doua oară. Schimbă pe „Alte date”.
5. Deschide proiectul magazinului: trei rapoarte construite cu filtrare, JOIN și agregare. Fiecare cerință are progres separat și verificări pe date suplimentare.
6. Deschide Franceză → Au marché. Arată dialogul, traducerea, pronunția dacă browserul are o voce disponibilă și feedbackul pentru `vendre`. Completează `acheter`, `combien`, `combien`, apoi „Repetă fără răspunsuri”.
7. Conectează un cont propriu de laborator. Rezolvă o cerință și așteaptă „Progres salvat în cont”. Reîncarcă, deconectează-te și reconectează-te: progresul contului revine.

## Ce tehnologii poți explica

- HTML semantic și CSS: structură, interfață adaptată telefonului, focus și contrast.
- JavaScript: navigare, editor, feedback, stări, progres local și sincronizare.
- Python + SQLite: interogări executate în memorie, numai citire, comparația rezultatelor și date de verificare.
- Node.js: endpointuri pentru cont, sesiuni, autorizare și progres cu versiuni.
- Supabase Auth + PostgreSQL: autentificare, persistență, RLS pentru separarea conturilor.
- Git și Vercel: `production` pentru laborator, build și publicare fără modificarea lui `main`.

## Verificare locală

`npm ci`, apoi `POLYMATH_SQL_LAB=1 npm run dev`. Baza de date este opțională pentru practica de vizitator; conturile cer configurația separată a laboratorului în `.env.local` (fișier ignorat de Git).

- `npm test`: teste JavaScript pentru progres, conturi și franceză, plus teste Python pentru SQL.
- `POLYMATH_SQL_LAB=1 npm run build`: pregătește varianta de laborator.
- `npm run test:browser`: Chrome instalat local, toate cele 15 exerciții SQL, franceză, stări de eroare, progres, tastatură, telefon și axe-core.
- `POLYMATH_TEST_ACCOUNTS=/cale/privata/conturi-test.json node tests/lab-account-browser.mjs`: numai conturi sintetice din laborator. Nu include fișierul de credențiale în Git.

Accesul direct la laborator poate solicita autentificare Vercel deoarece este un deployment experimental protejat. Pentru profesor se poate folosi sesiunea proprietarului sau un link temporar creat din Vercel → Share. Protecția proiectului nu a fost dezactivată.

## Limite declarate

Progresul este destinat învățării, nu certificării antifraudă. Pronunția depinde de vocile browserului/sistemului. Greșelile vechi deja suprascrise înaintea acestei versiuni nu pot fi reconstruite. Auditul și riscurile rămase sunt documentate în `security-review-2026-11-14.md`.
