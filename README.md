# PolymathHub · Învață cu sens

Platformă publică de învățare în română pentru programare și limbi străine: https://polymathhub.vercel.app. Interfață HTML/CSS/JavaScript, cu funcții Vercel opționale pentru conturi și progres în PostgreSQL/Supabase.

## Noua experiență

- **Acasă**: acces direct la lecția curentă, alegerea între programare și limbi străine, progres și vocabular. Fără hero decorativ sau nume de utilizator inventat.
- **Explorează**: catalogul existent, cu filtre, căutare de capitole și selecția disciplinei.
- **Învățare**: teorie, exemple, scriere, potrivire și quiz; curriculumul existent este păstrat.
- **Laborator SQL**: primul exercițiu SQL rulează o interogare SELECT pe două seturi de date de test, într-o bază SQLite temporară. Interfața afișează tabelul rezultat și feedbackul. Funcția Python de pe Vercel nu necesită cont sau variabile de mediu.
- **Vocabular**: engleză, franceză și spaniolă, cu româna ca limbă de sprijin.
- **Progresul meu / Realizări**: activitate, calendar, XP, ligi și realizări.

Paginile au rute proprii în fragmentul URL. Navigarea Înapoi/Înainte și reîncărcarea păstrează pagina și lecția sau cuvântul indicat în adresă. Interfața include navigare laterală pe Acasă/Explorează și meniu compact în antet în celelalte pagini. În Învățare, capitolele și filele sunt într-o bară deasupra lecției. Include focus vizibil și reducerea animațiilor conform preferinței sistemului.

## Dicționar și carduri

Selecția inițială conține **24 de fișe originale**: 8 pentru fiecare limbă. Fiecare are traducere, explicație în română și în limba studiată, pronunție fonetică, utilizare, două exemple traduse și un exercițiu.

Căutarea locală acceptă cuvântul sau traducerea română, fără a impune diacritice. Pentru alte cuvinte, se introduce forma din limba selectată și se apasă **Caută**. Căutarea online trimite termenul către serviciile publice de dicționar; explicațiile și exemplele sunt traduse prin MyMemory. Este afișat primul sens disponibil. Dacă sursa nu oferă exemple sau un serviciu nu răspunde, interfața indică acest lucru explicit.

Steaua salvează cuvântul în **Colecția mea**. **Practică rapidă** folosește cuvintele salvate din limba selectată; când colecția este goală, folosește selecția disponibilă. Răspunsul rămâne ascuns până la verificare sau dezvăluire. Cuvintele exersate sunt marcate fără a acorda XP repetat. Pronunția audio folosește vocile disponibile în browser/dispozitiv.

Progresul cursurilor rămâne în cheia existentă `polymath_edtech_state_v2`. Vocabularul folosește separat `polymath_vocabulary_v1`. Pentru vizitatori, datele rămân în browser. Integrarea opțională de conturi permite email/parolă fără confirmare pe email și sincronizarea progresului prin Supabase. Activarea necesită baza de date și variabilele Vercel: vezi [ghidul de conturi și parole](docs/accounts-and-passwords.md). Autentificarea nu este prezentată ca activă dacă serviciul nu este configurat. Site-ul este destinat utilizării online.

## Pornire și verificare

Necesită Node.js 22 și Python 3.12+ pentru laboratorul SQL. Serverul de dezvoltare include aceleași rute API ca Vercel. Interfața nu are dependențe JavaScript de runtime.

```sh
npm run dev
# http://127.0.0.1:8000

npm test
npm run build
```

Buildul pregătește paginile, resursele și pachetele de lecții în `dist/`. Testele unitare verifică fișele bilingve, căutarea, validarea răspunsurilor, alegerea sensului, conversia răspunsurilor API, fallbackul, cotele și limitele UTF-8, cookie-urile de sesiune, protecția originii, izolarea accesului și conflictele de progres. Testele de cont folosesc răspunsuri de serviciu simulate; integrarea reală necesită configurarea Supabase. Vechile scripturi de audit din `tests/` rămân disponibile separat; unele presupun Chrome instalat într-o cale fixă și structura vechii interfețe.

## Unde găsești fișierele

| Ce vrei să modifici | Unde lucrezi |
| --- | --- |
| Designul, culorile și aspectul pe telefon | [frontend/design](frontend/design) conține stilurile CSS. [assets](assets) conține imaginile, pictogramele și înregistrările audio. |
| Paginile și navigarea | [frontend/pages](frontend/pages) conține paginile HTML. Pagina principală este `learning-workspace.html`, iar biblioteca este `library.html`. Navigarea bibliotecii și tabloul de bord sunt în [frontend/library](frontend/library). |
| Lecțiile și exercițiile | [frontend/curriculum](frontend/curriculum) conține colecțiile de lecții. [frontend/languages](frontend/languages) și [frontend/sql](frontend/sql) conțin activitățile interactive. |
| Formularele de cont, profilul și notificările | [frontend/account](frontend/account) conține interfața pentru utilizator. |
| Autentificarea și parolele | [api/account.mjs](api/account.mjs) primește cererile de conectare. [backend/auth/session.mjs](backend/auth/session.mjs) verifică și gestionează sesiunile. Supabase Auth gestionează parolele utilizatorilor. [Ghid de configurare](docs/accounts-and-passwords.md) |
| Backendul și baza de date | [api](api) conține rutele Vercel, [backend/sql](backend/sql) conține datele și evaluatorul SQL, iar [supabase/migrations](supabase/migrations) păstrează istoricul modificărilor bazei de date. |
| Găzduirea și configurarea | [vercel.json](vercel.json) configurează Vercel. [config/hosting.json](config/hosting.json) păstrează identificatorul proiectului Sites. Comanda `npm run build` pregătește și copia locală cerută la împachetare. [.env.example](.env.example) arată ce variabile trebuie configurate. |

### Fișiere folosite doar la dezvoltare

- [scripts/curriculum](scripts/curriculum) conține instrumentele folosite la pregătirea colecțiilor C++, multilingve și multidisciplinare. Site-ul folosește lecțiile deja generate. Cele două generatoare din `polyglot/` depind de fișiere sursă externe folosite la importul inițial.
- [tests](tests) conține testele automate și auditurile de interfață. [docs](docs) păstrează ghidurile, verificările de design și rapoartele de laborator.
- [scripts/build-static.js](scripts/build-static.js) pregătește versiunea publică. [scripts/public-files.cjs](scripts/public-files.cjs) asociază fiecare adresă publică cu fișierul sursă. Atât buildul, cât și serverul local folosesc această listă.

## Surse pentru căutarea online

- [FreeDictionaryAPI.com](https://freedictionaryapi.com/): date din Wiktionary, cu [licență CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/).
- [Wiktionary](https://en.wiktionary.org/): sursă alternativă; fișele afișează linkul paginii originale.
- [MyMemory](https://mymemory.translated.net/doc/spec.php): traduceri automate, supuse disponibilității și cotelor serviciului.

Fișele online păstrează atribuirea și indică traducerile automate. Nuanțele, polisemia și traducerile trebuie interpretate în context.
