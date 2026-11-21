# Verificare de securitate — laboratorul PolymathHub

Data verificărilor: 14–15 noiembrie 2026. Scop: branchul `production`, laboratorul SQL și franceză, conturile și progresul. Site-ul principal și baza lui nu au fost modificate în această verificare. Rezultatele de mai jos descriu probe concrete; nu reprezintă garanția absenței tuturor vulnerabilităților.

## Rezultat și remediere

Nu a fost identificată o scurgere de chei privilegiate în istoricul Git verificat și nu a fost reprodus accesul unui vizitator sau al unui cont obișnuit la datele altor conturi din laborator. Au fost reparate pierderea progresului nesincronizat după reîncărcare și lipsa unei politici CSP pentru laborator.

### 1. Progres pierdut după o eroare de conexiune — remediat

În `account.js`, un PUT eșuat oprea sincronizarea, iar o reîncărcare înlocuia copia locală cu versiunea mai veche din server. Încercările efectuate înainte de reîncărcare se puteau pierde. Acum fiecare cont păstrează separat o copie a modificărilor nesincronizate și revizia pe care au fost făcute. Copia este retrimisă numai când revizia serverului corespunde. Dacă altă sesiune a actualizat serverul, copia locală rămâne disponibilă, serverul nu este suprascris și interfața explică situația. Reîncărcarea explicită din cont rămâne o alegere de înlocuire a copiei locale, descrisă lângă buton.

Probe: cele două teste inițiale de regresie au eșuat înaintea schimbării și au trecut după ea. Teste suplimentare verifică păstrarea încercărilor făcute după primul eșec de salvare și a celor făcute în timp ce cererea de reconectare așteaptă răspunsul. Comanda `node --test tests/account.test.mjs` trece 19 teste, inclusiv autentificarea, proprietatea progresului, conflictul de revizie și accesul administrativ.

### 2. Politică CSP pentru laborator — implementată, se verifică și după publicare

`vercel.json:13` declară `script-src 'self'` fără `unsafe-eval`, `connect-src 'self'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'` și `form-action 'self'`. Stilurile inline existente rămân permise; scripturile inline și execuția de șiruri JavaScript nu sunt permise. Laboratorul folosește scripturi și resurse locale, iar comunicarea cu Supabase trece prin API-ul de aceeași origine.

Această configurație este pentru laboratorul de pe `production`. Nu trebuie copiată automat peste aplicația veche: ar opri evaluatorul JavaScript din aceasta. Comportamentul `Function()` sub CSP este documentat de [MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src#unsafe_eval_expressions). O politică CSP reduce anumite consecințe ale injectării; nu înlocuiește validarea sau autorizarea.

## Probe privind conturile și accesul la date

Proiectele au fost identificate în Supabase: laboratorul `preference-sql-lab` (`nfcnlugfdousvnqtdruq`) este separat de `polymathhub-accounts` (`immbgfskrbqtezcuvcvz`). Aceste identificatoare sunt publice, nu secrete.

Au fost create două conturi sintetice exclusiv în baza laboratorului, prin fluxul public de înregistrare, fără modificarea rolurilor. Setarea existentă de confirmare email a fost citită înainte: era dezactivată, astfel încât nu s-a trimis email. Datele de conectare și tokenurile nu sunt incluse în repository sau în acest raport. Nu au fost citite ori modificate datele reale ale altor utilizatori pentru aceste probe.

| Verificare directă în API-ul Supabase al laboratorului | Rezultat |
| --- | --- |
| Citirea progresului fără autentificare | HTTP 401 |
| Apelarea RPC-ului administrativ fără autentificare | HTTP 401 |
| RPC administrativ cu un cont obișnuit | `allowed: false`, fără lista conturilor |
| Citirea progresului contului A | Numai rândul lui A |
| Citirea rândului contului B cu sesiunea A | Listă goală |
| Actualizarea rândului B cu sesiunea A | Niciun rând modificat; revizia B a rămas 0 |
| Schimbarea proprietarului rândului A către B | HTTP 403 |

Verificarea catalogului PostgreSQL confirmă RLS activ pe `public.learning_progress`, cu politici SELECT/INSERT/UPDATE legate de `auth.uid() = user_id`; UPDATE are și `WITH CHECK`. Rolul `anon` nu are drept SELECT pe progres. Tabelul privat de administratori are RLS activ, niciun grant de citire pentru `authenticated` și nicio politică permisivă. Aceste reguli urmează modelul documentat în [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security).

Codul endpointurilor a fost verificat: `api/progress.mjs:43` derivă proprietarul din sesiunea validată, nu din ID-ul furnizat de client. Operațiile de scriere verifică originea (`server/auth.mjs:22`). Cookie-urile de producție folosesc prefixul `__Host-`, `HttpOnly`, `Secure`, `SameSite=Lax`, `Path=/` (`server/auth.mjs:52`). Tokenurile nu sunt trimise în corpul JSON și răspunsurile de cont/progres au `Cache-Control: private, no-store`. Antetul `X-Polymath-Account` detectează schimbarea contului într-o altă filă; nu este folosit drept dovadă de autentificare.

## Avertismente care rămân

### 3. RPC administrativ cu SECURITY DEFINER — acces intenționat, protecție verificată

Advisorul Supabase avertizează că `public.polymath_admin_accounts(integer,text,boolean)` poate fi apelată de `authenticated` și rulează cu `SECURITY DEFINER`. Definiția citită din baza reală verifică imediat existența lui `auth.uid()` în `polymath_private.administrators`, înainte de a citi conturile, și are `search_path = ''`. Apelul anonim este interzis, iar apelul unui cont obișnuit returnează doar `allowed: false`. Nu s-a demonstrat o expunere a listei de conturi. Nu s-au schimbat granturi sau administratori doar pentru a elimina avertismentul. Nu a fost exercitat un cont administrator real, pentru a evita accesarea datelor altora.

Într-o etapă ulterioară se poate reduce suprafața API printr-un RPC intermediar fără privilegii și o funcție privată sau un serviciu administrativ separat. Este o schimbare de arhitectură care necesită retestarea completă a autorizării. [Explicația advisorului](https://supabase.com/docs/guides/database/database-linter?lint=0029_authenticated_security_definer_function_executable).

### 4. Protecția parolelor compromise este dezactivată

Advisorul laboratorului confirmă setarea dezactivată. Aplicația cere parole de 10–128 caractere, iar stocarea lor aparține Supabase Auth. Conform [documentației Supabase](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection), verificarea parolelor compromise este disponibilă pe planul Pro și superior. Nu s-a modificat planul sau facturarea și nu s-au schimbat setările de autentificare. Nu au fost efectuate teste agresive de forțare a parolelor sau de limitare a traficului.

### 5. JavaScript-ul educațional din site-ul principal este neizolat

Pe `main` la `b5615bc5efa75bb2f0fd0312f2a2254f8702bdb3`, `app.js:2204` execută codul introdus de cursant cu `new Function(code)` în contextul paginii. Codul poate accesa DOM-ul, stocarea locală și poate face cereri autentificate de aceeași origine. Cookie-urile HttpOnly împiedică citirea directă a tokenurilor, dar nu împiedică folosirea sesiunii prin `fetch`. Un exemplu malițios copiat și executat de utilizator poate astfel altera propriul progres sau interfața. Nu s-a demonstrat injectarea automată către alți utilizatori.

Această funcție nu este încărcată de pagina SQL/franceză a laboratorului. Codul principal nu a fost schimbat. Înainte de extinderea evaluatorului JS, se recomandă un executor într-un context separat, fără acces la originea aplicației și cu limite de timp/resurse; un simplu Worker de aceeași origine nu este singur suficient pentru toate aceste restricții.

### 6. Progresul este adecvat studiului, nu certificării

RLS protejează progresul între conturi. Totuși proprietarul își poate modifica propriile date prin client/API: stările de rezolvare și XP sunt revendicate de client. Deduplicarea XP împiedică acumularea prin repetarea normală a unui exercițiu; nu constituie un mecanism antifraudă. Pentru evaluare cu note sau certificate, rezultatele și recompensele ar trebui calculate și înregistrate autoritativ pe server.

## Dependențe de dezvoltare

`npm audit --json`, repetat la 15 noiembrie, raportează trei pachete cu severitate moderată și zero probleme high/critical: dependența directă de dezvoltare `htmlhint@1.9.2` și dependențele ei tranzitive `glob@13.0.6`, `minimatch@10.2.6`. Sunt avertismente despre anularea traversării fișierelor și amplificarea calculelor de potrivire a tiparelor, în uneltele de verificare. `npm audit --omit=dev --json` raportează zero vulnerabilități; aplicația publicată nu folosește aceste unelte în execuția utilizatorilor. Pachetele de dezvoltare pot fi totuși instalate în mediul de build.

Nu s-a aplicat automat `npm audit fix --force`: soluția propusă era revenirea la `htmlhint@1.7.0`, marcată incompatibilă de npm. Următorul pas este o actualizare compatibilă sau înlocuirea controlată a verificatorului HTML, cu rerularea verificărilor. Referințe: [glob GHSA-3g3m-2fjr-6pw4](https://github.com/advisories/GHSA-3g3m-2fjr-6pw4), [minimatch GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249).

## Căutarea secretelor

Au fost inspectate toate cele 292 de obiecte Git de tip blob accesibile din referințele locale existente (`git rev-list --objects --all`), inclusiv istoria ambelor branchuri. Scanarea a căutat blocuri de chei private, formate cunoscute de tokenuri GitHub și chei API pentru servicii AI, chei secrete Supabase, chei AWS, URL-uri de baze de date cu parolă și JWT-uri cu rol `service_role`. Au fost verificate și nume de fișiere sensibile; `.env.example` a fost tratat drept șablon. Nu au existat potriviri confirmate. Secretele de test au fost păstrate în afara repository-ului, în fișiere locale cu permisiuni restrictive.

Limite: scanarea bazată pe tipare nu poate demonstra absența oricărei parole arbitrare, a secretelor codificate într-un format necunoscut, a obiectelor șterse inaccesibile prin referințe, a logurilor de platformă sau a artefactelor din afara repository-ului. Nu s-a rescris istoricul și nu s-au rotit credențiale fără dovada unei expuneri.

## Ce este public și ce trebuie protejat

- Adresa API arată unde se trimit cererile. Rutele apelate din browser și sursa publică pot fi observate; ascunderea lor nu înlocuiește autentificarea.
- O cheie Supabase publicabilă identifică proiectul/aplicația și poate apărea în client. Accesul efectiv trebuie limitat prin autentificare, granturi și RLS.
- O cheie secretă sau `service_role` poate oferi privilegii ridicate și nu trebuie să apară în browser, repository public sau loguri. Parolele și tokenurile individuale de sesiune sunt de asemenea private. [Documentația cheilor Supabase](https://supabase.com/docs/guides/getting-started/api-keys).

Verificarea în browser a deploymentului final, precum și rezultatele întregii suite și ale buildului sunt raportate separat la livrare. Acest audit nu certifică securitatea tuturor configurațiilor Vercel/Supabase sau a tuturor funcțiilor aplicației principale.
