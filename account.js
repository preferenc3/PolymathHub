(function () {
  "use strict";
  const $ = id => document.getElementById(id);
  const account = { user: null, admin: false, configured: false, ready: false, revision: null, sync: "", loading: false, dirty: false, saving: null, timer: null, authenticating: false };
  window.PolymathAccount = account;
  const text = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const accountIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>';
  async function api(path, options = {}) {
    const response = await fetch(path, { ...options, credentials: "same-origin", cache: "no-store", headers: { "Content-Type": "application/json", ...options.headers }, signal: AbortSignal.timeout(options.method === "POST" ? 28_000 : 12_000) });
    let data; try { data = await response.json(); } catch { data = {}; }
    if (!response.ok) { const error = new Error(data.error || "Serviciul nu este disponibil momentan."); error.status = response.status; throw error; }
    return data;
  }
  function snapshot() {
    const course = structuredClone(window.PolymathApp.snapshot().state);
    delete course.user; delete course.customLessons;
    return { course, vocabulary: window.PolymathStudio.vocabularySnapshot(), revision: account.revision };
  }
  function stored(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || "null") || fallback; } catch { return fallback; } }
  const pendingKey = userId => "polymath_pending_progress_v1:" + userId;
  function pendingProgress(userId) {
    const value = stored(pendingKey(userId), null);
    return value && value.course && value.vocabulary && (value.revision === null || Number.isSafeInteger(value.revision)) ? value : null;
  }
  function retainPending(value = snapshot()) {
    if (!account.user) return;
    try { localStorage.setItem(pendingKey(account.user.id), JSON.stringify(value)); } catch { /* Existing account storage remains the fallback when storage is full. */ }
  }
  function clearPending(userId, expected) {
    try {
      // A second tab may have queued newer work while this request was in flight.
      if (!expected || localStorage.getItem(pendingKey(userId)) === JSON.stringify(expected)) localStorage.removeItem(pendingKey(userId));
    } catch { /* Storage may be unavailable. */ }
  }
  function emptyVocabulary() { return { saved: [], learned: [], cache: [] }; }
  function restoreProgress(course, vocabulary, userId) {
    account.restoring = true;
    try {
      window.PolymathStudio.replaceVocabulary(vocabulary);
      window.PolymathApp.replaceProgress(course, userId);
    } finally { account.restoring = false; }
  }
  function initials(user) {
    const parts = (user.name || user.email || "").trim().split(/\s+/).filter(Boolean);
    return parts.slice(0, 2).map(part => [...part][0].toUpperCase()).join("") || "?";
  }
  const avatarGroups = window.ProfileAvatars || {};
  const avatarChoices = new Map(Object.values(avatarGroups).flat().map(entry => [entry[0], entry]));
  const themes = [
    ["daylight-clean", "Crem"], ["emerald-forest", "Verde"], ["ocean-deep", "Albastru"],
    ["ruby-clay", "Roșu"], ["cyber-dark", "Noapte"], ["sepia-book", "Sepia"],
    ["neon-amethyst", "Violet"], ["sunset-amber", "Chihlimbar"]
  ];
  const themeKey = "polymath_appearance";
  function avatarMark(user) {
    const [, , symbol, style] = avatarChoices.get(user.avatar) || [];
    return `<span class="avatar-mark${style ? " avatar-" + style : ""}" aria-hidden="true">${text(symbol || initials(user))}</span>`;
  }
  function avatarPicker(user) {
    const selected = user.avatar || "initials";
    const currentGroup = Object.keys(avatarGroups).find(group => avatarGroups[group].some(([id]) => id === selected));
    return `<fieldset class="avatar-picker"><legend>Alege avatarul</legend>
      <label class="avatar-category">Colecție<select data-avatar-category>
        ${Object.keys(avatarGroups).map(group => `<option ${group === currentGroup ? "selected" : ""}>${text(group)}</option>`).join("")}
      </select></label>
      ${Object.entries(avatarGroups).map(([group, entries]) => `<div class="avatar-grid" data-avatar-group="${text(group)}" ${group === currentGroup ? "" : "hidden"}>
        ${entries.map(([id, label, symbol, style]) => `<label title="${text(label)}"><input type="radio" name="avatar" value="${id}" aria-label="${text(label)}" ${id === selected ? "checked" : ""}><span class="avatar-mark${style ? " avatar-" + style : ""}" aria-hidden="true">${text(symbol || initials(user))}</span></label>`).join("")}
      </div>`).join("")}
    </fieldset>`;
  }
  function applyAppearance(value) {
    if (!themes.some(([id]) => id === value)) return;
    document.documentElement.setAttribute("data-theme", value);
  }
  function appearancePicker() {
    const selected = document.documentElement.getAttribute("data-theme") || "daylight-clean";
    return `<details class="settings-group" name="account-section"><summary>Aspect și culori</summary>
      <fieldset class="appearance-picker"><legend>Alege o temă</legend>
      ${themes.map(([id, label]) => `<label><input type="radio" name="appearance" value="${id}" ${id === selected ? "checked" : ""}><span class="theme-swatch" data-palette="${id}"></span>${label}</label>`).join("")}
      </fieldset></details>`;
  }
  function renderControl() {
    const control = $("account-control"); control.hidden = !account.configured;
    if (!account.configured) return;
    const label = account.user ? "Setări cont" : "Intră în cont";
    control.innerHTML = `<button type="button" class="account-button account-avatar" data-open-account aria-haspopup="dialog" aria-label="${label}" title="${label}">${account.user ? avatarMark(account.user) : accountIcon}</button>`;
    if ($("account-sync")) $("account-sync").textContent = account.sync;
    window.dispatchEvent(new Event("polymath:account"));
  }
  async function applyUser(user, { discardPending = false } = {}) {
    account.recovering = account.user?.id === user.id && !discardPending;
    account.loading = true;
    clearTimeout(account.timer);
    if (account.saving) await account.saving;
    account.ready = false;
    account.user = user;
    account.admin = false;
    account.dirty = false;
    let pending = discardPending ? null : pendingProgress(user.id);
    const headers = { "X-Polymath-Account": user.id };
    const access = api("/api/admin-accounts?action=access", { headers }).then(
      result => result.allowed === true,
      () => false
    );
    try {
      const result = await api("/api/progress", { headers });
      if (account.recovering) pending = pendingProgress(user.id);
      const progress = result.progress;
      account.revision = progress?.revision ?? null;
      // Keep unsynced work after a reload. Only replay it against the version it was based on.
      restoreProgress(pending?.course || progress?.course || null, pending?.vocabulary || progress?.vocabulary || emptyVocabulary(), user.id);
      if (discardPending) clearPending(user.id);
      account.dirty = Boolean(pending);
      account.ready = !pending || pending.revision === account.revision;
      if (pending) {
        account.revision = pending.revision;
        account.sync = account.ready ? "Modificările păstrate pe dispozitiv se vor sincroniza."
          : "Progresul s-a schimbat în altă sesiune. Modificările tale rămân pe acest dispozitiv; reîncarcă din cont doar dacă vrei să le înlocuiești.";
      } else account.sync = progress ? "Progresul contului este actualizat." : "Cont conectat. Progresul se va salva automat.";
    } catch {
      if (account.recovering) pending = pendingProgress(user.id);
      account.revision = pending?.revision ?? null;
      account.dirty = Boolean(pending);
      restoreProgress(pending?.course || window.PolymathApp.accountProgress?.(user.id) || stored("polymath_edtech_state_v2:" + user.id, null), pending?.vocabulary || stored("polymath_vocabulary_v1:" + user.id, emptyVocabulary()), user.id);
      account.sync = "Sincronizarea nu este disponibilă. Încearcă să reîncarci progresul contului.";
    } finally {
      account.admin = await access;
      account.loading = false;
      account.recovering = false;
      renderControl();
      if (account.ready && account.dirty) queueSave();
    }
  }
  function flush() {
    if (account.saving) return account.saving;
    if (!account.ready || !account.user || !account.dirty) return;
    account.dirty = false;
    account.sync = "Se salvează progresul…";
    renderControl();
    const headers = { "X-Polymath-Account": account.user.id };
    const savingUserId = account.user.id;
    const payload = snapshot();
    retainPending(payload);
    account.saving = api("/api/progress", { method: "PUT", headers, body: JSON.stringify(payload) })
      .then(result => {
        account.revision = result.revision;
        account.sync = "Progres salvat în cont.";
        if (account.dirty) retainPending();
        else clearPending(savingUserId, payload);
      })
      .catch(error => {
        account.sync = error.message;
        account.dirty = true;
        account.ready = false;
        window.PolymathApp.toast(error.status === 412 ? error.message
          : error.status === 409 ? "Progres actualizat în altă sesiune. Deschide setările contului pentru reîncărcare."
          : "Progresul contului nu s-a putut sincroniza. Verifică setările contului.");
      })
      .finally(() => {
        account.saving = null;
        renderControl();
        if (account.ready && account.dirty) queueSave();
      });
    return account.saving;
  }
  function queueSave() {
    if (!account.user || account.restoring || (account.loading && !account.recovering)) return;
    account.dirty = true;
    retainPending();
    clearTimeout(account.timer);
    if (account.ready && !account.loading) account.timer = setTimeout(flush, 900);
  }
  function dialog() {
    if (!$("account-dialog")) {
      const element = document.createElement("dialog"); element.id = "account-dialog"; element.className = "auth-dialog";
      element.setAttribute("aria-labelledby", "auth-title");
      element.addEventListener("close", () => $("account-control")?.querySelector("button")?.focus());
      document.body.appendChild(element);
    }
    return $("account-dialog");
  }
  function open(mode = "login") {
    if (account.loading || account.authenticating) return;
    const element = dialog();
    if (account.user) {
      element.innerHTML = `<button type="button" class="dialog-close" data-close-account aria-label="Închide setările">×</button>
        <h2 id="auth-title" class="dialog-heading" tabindex="-1">Setările contului</h2>
        <div class="settings-identity"><span class="settings-avatar" aria-hidden="true">${avatarMark(account.user)}</span><div><strong id="settings-account-name">${text(account.user.name)}</strong><span>${text(account.user.email)}</span></div></div>
        ${account.admin ? '<button type="button" class="admin-entry settings-admin-entry" data-open-admin aria-haspopup="dialog"><img src="/assets/icons/caret-right.svg" alt="">Panou administrator</button>' : ""}
        <details class="settings-group" name="account-section" open><summary>Profil și avatar</summary>
        <form class="auth-form settings-form" data-account-action="profile">
          ${avatarPicker(account.user)}
          <label>Nume afișat<input type="text" name="name" autocomplete="nickname" maxlength="60" required value="${text(account.user.name)}"></label>
          <button class="studio-primary" type="submit">Salvează profilul</button>
        </form></details>
        ${appearancePicker()}
        <details class="settings-group" name="account-section"><summary>Schimbă parola</summary>
          <form class="auth-form settings-form" data-account-action="password">
            <label>Parola actuală<input type="password" name="currentPassword" autocomplete="current-password" maxlength="128" required></label>
            <label>Parola nouă<input type="password" name="password" autocomplete="new-password" minlength="10" maxlength="128" required></label>
            <label>Repetă parola nouă<input type="password" name="repeatPassword" autocomplete="new-password" minlength="10" maxlength="128" required></label>
            <button class="studio-primary" type="submit">Salvează parola</button>
          </form>
        </details>
        <details class="settings-group" name="account-section"><summary>Resetează progresul</summary>
          <form class="auth-form settings-form" data-account-action="reset">
            <p>Șterge exercițiile, greșelile și punctele salvate în cont. Rezultatele atelierului SQL sunt stocate separat în browser.</p>
            <label>Scrie RESETEAZĂ<input name="confirmation" autocomplete="off" maxlength="10" required></label>
            ${window.PolymathSqlCourse ? '<label class="settings-check"><input type="checkbox" name="includeWorkshop"><span>Include progresul atelierului SQL din acest browser</span></label>' : ""}
            <button class="settings-danger" type="submit">Resetează progresul</button>
          </form>
        </details>
        <details class="settings-group" name="account-section"><summary>Șterge contul</summary>
          <form class="auth-form settings-form" data-account-action="delete">
            <p>Contul și progresul salvat în el vor fi șterse definitiv.</p>
            <label>Parola actuală<input type="password" name="currentPassword" autocomplete="current-password" maxlength="128" required></label>
            <label>Scrie ȘTERGE<input name="confirmation" autocomplete="off" maxlength="6" required></label>
            <button class="settings-danger" type="submit">Șterge definitiv contul</button>
          </form>
        </details>
        <p id="auth-feedback" class="settings-feedback" role="status"></p>
        <div class="settings-footer">
          <p id="account-sync" class="account-sync" role="status">${text(account.sync)}</p>
          <button class="studio-secondary" type="button" data-reload-account>Reîncarcă progresul</button>
          <button type="button" class="studio-secondary" data-logout-account>Deconectează-te</button>
        </div>`;
      if (account.dirty || !account.ready) {
        const retry = document.createElement("button");
        retry.type = "button"; retry.className = "studio-primary"; retry.dataset.retryAccount = "";
        retry.textContent = "Reîncearcă sincronizarea";
        element.querySelector("[data-reload-account]").before(retry);
      }
    } else {
      const register = mode === "register";
      element.innerHTML = `<button type="button" class="dialog-close" data-close-account aria-label="Închide autentificarea">×</button><span class="eyebrow">POLYMATHHUB</span><h2 id="auth-title">${register ? "Creează un cont" : "Conectează-te"}</h2><p class="auth-intro">Salvează progresul și revino la el de pe alt dispozitiv.</p><form id="auth-form" class="auth-form" data-mode="${mode}"><label>Email<input type="email" name="email" autocomplete="username" maxlength="254" required></label><label>Parolă<input type="password" name="password" autocomplete="${register ? "new-password" : "current-password"}" minlength="10" maxlength="128" required></label><button class="studio-primary" type="submit">${register ? "Creează contul" : "Conectează-te"}</button></form><div id="auth-feedback" role="status" aria-live="polite"></div><p class="auth-switch">${register ? 'Ai deja cont? <button type="button" data-auth-mode="login">Conectează-te</button>' : 'Nu ai cont? <button type="button" data-auth-mode="register">Creează unul</button>'}</p>${register ? '<p class="auth-note">Folosește un email în format valid ca identificator și o parolă de minimum 10 caractere. Nu trebuie să ai acces la căsuța poștală.</p>' : ""}`;
    }
    if (!account.user) element.insertAdjacentHTML("beforeend", appearancePicker());
    if (!element.open) element.showModal();
    (account.user ? element.querySelector("#auth-title") : element.querySelector("input"))?.focus();
  }

  const adminDateFormat = new Intl.DateTimeFormat("ro-RO", { dateStyle: "short", timeStyle: "short" });
  function formatAdminDate(value) {
    if (!value) return "—";
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : adminDateFormat.format(date);
  }

  function openAdmin() {
    if (!account.admin || !account.user || account.loading || account.authenticating || $("admin-dialog")) return;
    const userId = account.user.id;
    const element = document.createElement("dialog");
    element.id = "admin-dialog";
    element.className = "auth-dialog admin-dialog";
    element.setAttribute("aria-labelledby", "admin-title");
    element.innerHTML = `
      <button type="button" class="dialog-close" data-close-admin aria-label="Închide panoul">×</button>
      <span class="eyebrow">POLYMATHHUB · ADMINISTRARE</span>
      <h2 id="admin-title">Panou administrator</h2>
      ${window.PolymathCatalog ? '<div class="admin-views" role="group" aria-label="Administrare"><button type="button" data-admin-view="accounts" aria-pressed="true">Utilizatori</button><button type="button" data-admin-view="content" aria-pressed="false">Conținut didactic</button></div><section data-content-editor hidden></section>' : ""}
      <section data-admin-accounts>
      <dl class="admin-summary" hidden>
        <div><dt>Conturi în total</dt><dd data-stat="total"></dd></div>
        <div><dt>Conectate în ultimele 7 zile</dt><dd data-stat="active_7d"></dd></div>
        <div><dt>Cu progres salvat</dt><dd data-stat="with_progress"></dd></div>
      </dl>
      <form class="admin-search">
        <label for="admin-search-input">Caută după nume sau email</label>
        <div><input type="search" id="admin-search-input" maxlength="120" autocomplete="off">
        <button type="submit" class="studio-primary">Caută</button></div>
      </form>
      <p class="account-sync" role="status" data-admin-status></p>
      <div class="admin-grant-confirm" data-admin-confirm hidden>
        <p data-admin-recipient></p>
        <button type="button" class="studio-primary" data-admin-grant>Confirmă rolul</button>
        <button type="button" class="studio-secondary" data-admin-cancel>Anulează</button>
      </div>
      <div class="admin-table-wrap" hidden>
        <table class="admin-table">
          <thead><tr><th scope="col">Nume și email</th><th scope="col">Creat la</th><th scope="col">Ultima conectare</th>
            <th scope="col">XP</th><th scope="col">${window.PolymathSqlCourse ? "Exerciții SQL" : "Lecții parcurse"}</th><th scope="col">${window.PolymathSqlCourse ? "De repetat" : "Cuvinte salvate"}</th>${window.PolymathSqlCourse ? '<th scope="col">Proiect final</th>' : ""}<th scope="col">Rol</th></tr></thead>
          <tbody></tbody>
        </table>
      </div>
      <nav class="admin-pagination" aria-label="Paginile listei de conturi" hidden>
        <button type="button" class="studio-secondary" data-admin-prev>Anterior</button>
        <span data-admin-page></span>
        <button type="button" class="studio-secondary" data-admin-next>Următor</button>
      </nav></section>`;
    const select = selector => element.querySelector(selector);
    for (const button of element.querySelectorAll("[data-admin-view]")) button.onclick = () => {
      const content = button.dataset.adminView === "content";
      select("[data-admin-accounts]").hidden = content;
      const editor = select("[data-content-editor]");
      editor.hidden = !content;
      for (const tab of element.querySelectorAll("[data-admin-view]")) tab.setAttribute("aria-pressed", String(tab === button));
      if (content && !editor.childElementCount) window.PolymathCatalog.edit(editor, api, userId);
    };
    const status = select("[data-admin-status]");
    const rows = select("tbody");
    const stats = select(".admin-summary");
    const table = select(".admin-table-wrap");
    const pager = select(".admin-pagination");
    const prev = select("[data-admin-prev]");
    const next = select("[data-admin-next]");
    let page = 1;
    let query = "";
    let requestId = 0;
    let granting = false;
    let selected = null;
    const confirmation = select("[data-admin-confirm]");
    const grant = select("[data-admin-grant]");
    function clearSelection() {
      selected = null;
      confirmation.hidden = true;
    }

    async function loadAccounts(requestedPage, message = "") {
      clearSelection();
      const currentRequest = ++requestId;
      const isCurrent = () => element.open && requestId === currentRequest && account.user?.id === userId;
      const params = new URLSearchParams({ page: requestedPage, q: query });
      status.textContent = "Se încarcă lista de conturi…";
      rows.replaceChildren();
      table.hidden = pager.hidden = true;
      try {
        const data = await api("/api/admin-accounts?" + params, {
          headers: { "X-Polymath-Account": userId }
        });
        if (!isCurrent()) return;
        const pages = Math.max(1, Math.ceil(data.matched / data.page_size));
        page = data.page;
        for (const field of stats.querySelectorAll("[data-stat]")) {
          field.textContent = data.summary[field.dataset.stat];
        }
        stats.hidden = false;
        rows.innerHTML = data.accounts.map(row => `<tr>
          <th scope="row"><strong>${text(row.name)}</strong><span>${text(row.email || "—")}</span></th>
          <td>${text(formatAdminDate(row.created_at))}</td><td>${text(formatAdminDate(row.last_sign_in_at))}</td>
          <td>${text(row.xp)}</td><td>${text(window.PolymathSqlCourse ? row.sql_completed : row.lessons)}</td><td>${text(window.PolymathSqlCourse ? row.sql_review : row.saved_words)}</td>${window.PolymathSqlCourse ? `<td>${text(row.sql_project)}/3</td>` : ""}
          <td>${row.is_admin ? `<span class="admin-role">Administrator</span> <button type="button" class="studio-secondary" data-pick-admin="${text(row.id)}" data-role-action="revoke" aria-label="Retrage rolul de administrator pentru ${text(row.email || row.name)}">Retrage rolul</button>`
            : row.id ? `<button type="button" class="studio-secondary" data-pick-admin="${text(row.id)}" aria-label="Acordă rol de administrator pentru ${text(row.email || row.name)}">Acordă rol</button>` : "Utilizator"}</td>
        </tr>`).join("");
        table.hidden = data.accounts.length === 0;
        pager.hidden = pages === 1;
        prev.disabled = page === 1;
        next.disabled = page >= pages;
        select("[data-admin-page]").textContent = `Pagina ${page} din ${pages}`;
        status.textContent = message || (data.matched === 0 ? "Niciun cont găsit." : `Conturi găsite: ${data.matched}`);
      } catch (error) {
        if (!isCurrent()) return;
        stats.hidden = true;
        status.textContent = error.message || "Lista de conturi nu a putut fi încărcată.";
      }
    }

    select("form").addEventListener("submit", event => {
      event.preventDefault();
      query = select("#admin-search-input").value.trim();
      loadAccounts(1);
    });
    table.addEventListener("click", event => {
      const button = event.target.closest("[data-pick-admin]");
      if (!button || granting) return;
      selected = { action: button.dataset.roleAction || "grant", id: button.dataset.pickAdmin, label: button.closest("tr").querySelector("th span").textContent, button };
      const revoke = selected.action === "revoke";
      grant.textContent = revoke ? "Confirmă retragerea" : "Confirmă acordarea";
      select("[data-admin-recipient]").textContent = revoke
        ? `Retragi rolul de administrator pentru ${selected.label}? Contul și progresul se păstrează.`
        : `Acorzi rolul de administrator pentru ${selected.label}? Va putea gestiona utilizatori, roluri și conținut.`;
      confirmation.hidden = false;
      select("[data-admin-cancel]").focus();
    });
    select("[data-admin-cancel]").addEventListener("click", () => {
      selected?.button.focus();
      clearSelection();
    });
    grant.addEventListener("click", async () => {
      if (!selected || granting) return;
      granting = true;
      grant.disabled = true;
      const target = selected;
      try {
        await api("/api/admin-accounts?action=" + target.action, {
          method: "POST", headers: { "X-Polymath-Account": userId }, body: JSON.stringify({ userId: target.id })
        });
        if (target.action === "revoke" && target.id === userId) {
          account.admin = false;
          renderControl();
          element.close();
          window.PolymathApp.toast("Rolul tău de administrator a fost retras.");
        } else if (element.open) {
          select("#admin-search-input").focus();
          await loadAccounts(page, target.action === "revoke" ? "Rolul de administrator a fost retras." : "Rolul de administrator a fost acordat.");
        }
      } catch (error) {
        if (element.open) status.textContent = error.message;
      } finally {
        granting = grant.disabled = false;
      }
    });
    prev.addEventListener("click", () => loadAccounts(page - 1));
    next.addEventListener("click", () => loadAccounts(page + 1));
    select("[data-close-admin]").addEventListener("click", () => element.close());
    element.addEventListener("close", () => {
      element.remove();
      const profile = $("account-dialog");
      if (!account.admin) profile?.querySelector("[data-open-admin]")?.remove();
      (profile?.querySelector("[data-open-admin]") || profile?.querySelector("#auth-title"))?.focus();
    });
    document.body.appendChild(element);
    element.showModal();
    select("#admin-search-input").focus();
    loadAccounts(1);
  }
  function clearAccountCache(userId) {
    for (const prefix of ["pm_learning_workspace_v1:", "pm_sql_practice_v1:", "polymath_edtech_state_v2:", "polymath_vocabulary_v1:", "polymath_pending_progress_v1:"]) {
      try { localStorage.removeItem(prefix + userId); } catch { /* Storage may be unavailable. */ }
    }
  }

  function returnToGuest() {
    clearTimeout(account.timer);
    account.user = null;
    account.admin = account.ready = account.dirty = false;
    account.revision = null;
    restoreProgress(window.PolymathApp.guestProgress(), stored("polymath_vocabulary_v1", emptyVocabulary()), null);
    renderControl();
    $("account-dialog")?.close();
  }

  async function saveSetting(form) {
    if (!account.user || account.loading || account.authenticating) return;
    const action = form.dataset.accountAction;
    const values = new FormData(form);
    const body = Object.fromEntries(values);
    const feedback = $("auth-feedback");
    const submit = form.querySelector('button[type="submit"]');
    if (action === "password" && body.password !== body.repeatPassword) {
      feedback.textContent = "Parolele noi trebuie să coincidă.";
      form.elements.repeatPassword.focus();
      return;
    }
    delete body.repeatPassword;
    const changesProgress = action === "reset" || action === "delete";
    const wasReady = account.ready;
    const userId = account.user.id;
    account.authenticating = true;
    if (changesProgress) {
      account.ready = false;
      clearTimeout(account.timer);
    }
    submit.disabled = true;
    feedback.textContent = "Se salvează…";
    try {
      if (account.saving) await account.saving;
      const path = action === "reset" ? "/api/progress?action=reset" : "/api/account?action=" + action;
      const result = await api(path, {
        method: "POST", headers: { "X-Polymath-Account": userId }, body: JSON.stringify(body)
      });
      if (action === "delete") {
        clearAccountCache(userId);
        try { localStorage.removeItem("polymath-workshop-mistake:" + userId); } catch {}
        returnToGuest();
        window.PolymathApp.toast("Contul a fost șters.");
      } else if (action === "reset") {
        clearAccountCache(userId);
        if (body.includeWorkshop === "on") {
          try { localStorage.removeItem("polymath-university-sql-completed"); localStorage.removeItem("polymath-workshop-mistake:" + userId); } catch { /* Storage may be unavailable. */ }
        }
        account.dirty = false;
        account.revision = result.revision;
        account.ready = true;
        account.sync = "Progresul contului a fost resetat.";
        restoreProgress(null, emptyVocabulary(), userId);
        renderControl();
        form.reset();
        feedback.textContent = account.sync;
      } else {
        account.user = result.user;
        renderControl();
        if (action === "profile") {
          $("settings-account-name").textContent = result.user.name;
          $("account-dialog").querySelector(".settings-avatar").innerHTML = avatarMark(result.user);
          form.elements.name.value = result.user.name;
          feedback.textContent = "Profilul a fost actualizat.";
        } else {
          form.reset();
          feedback.textContent = "Parola a fost actualizată.";
        }
      }
    } catch (error) {
      if (changesProgress && account.user) {
        account.ready = wasReady && ![409, 412].includes(error.status);
        if (account.ready && account.dirty) queueSave();
      }
      feedback.textContent = error.message;
    } finally {
      account.authenticating = false;
      submit.disabled = false;
    }
  }

  document.addEventListener("submit", async event => {
    if (event.target.matches("[data-account-action]")) {
      event.preventDefault();
      await saveSetting(event.target);
      return;
    }
    if (event.target.id !== "auth-form") return;
    event.preventDefault(); const form = event.target; const values = new FormData(form); const mode = form.dataset.mode;
    if (account.authenticating || account.loading || account.user) return;
    account.authenticating = true;
    const submit = form.querySelector('button[type="submit"]');
    submit.disabled = true;
    $("auth-feedback").textContent = "Se verifică datele…";
    try {
      const data = await api("/api/account?action=" + mode, { method: "POST", body: JSON.stringify({ email: values.get("email"), password: values.get("password") }) });
      form.reset(); await applyUser(data.user);
      $("account-dialog").close(); window.PolymathApp.toast(mode === "register" ? "Cont creat. Bine ai venit!" : "Te-ai conectat la cont.");
    } catch (error) { $("auth-feedback").innerHTML = `<p class="feedback-error">${text(error.message || "Conectarea nu a reușit. Încearcă din nou.")}</p>`; }
    finally { account.authenticating = false; submit.disabled = false; }
  });
  document.addEventListener("change", event => {
    const input = event.target;
    if (input.matches("[data-avatar-category]")) {
      input.closest(".avatar-picker").querySelectorAll("[data-avatar-group]").forEach(group => {
        group.hidden = group.dataset.avatarGroup !== input.value;
      });
    } else if (input.matches('input[name="appearance"]')) {
      applyAppearance(input.value);
      try { localStorage.setItem(themeKey, input.value); } catch {}
      window.PolymathApp.setTheme?.(input.value);
    }
  });
  document.addEventListener("click", async event => {
    const button = event.target.closest("button"); if (!button) return;
    if (button.hasAttribute("data-open-account")) open();
    else if (button.hasAttribute("data-open-admin")) openAdmin();
    else if (button.hasAttribute("data-close-account")) $("account-dialog").close();
    else if (button.dataset.authMode) open(button.dataset.authMode);
    else if (button.hasAttribute("data-retry-account") && account.user && !account.loading && !account.authenticating) {
      button.disabled = true;
      await applyUser(account.user);
      await flush();
      open();
    }
    else if (button.hasAttribute("data-reload-account") && account.user && !account.loading && !account.authenticating) {
      button.disabled = true;
      await applyUser(account.user, { discardPending: true });
      button.disabled = false;
    }
    else if (button.hasAttribute("data-logout-account") && account.user && !account.loading && !account.authenticating) {
      account.authenticating = true;
      button.disabled = true;
      try {
        await flush();
        if (account.dirty && account.ready) await flush();
        await api("/api/account?action=logout", {
          method: "POST", headers: { "X-Polymath-Account": account.user.id }, body: "{}"
        });
        returnToGuest();
        window.PolymathApp.toast("Ai ieșit din cont.");
      } catch (error) { $("auth-feedback").textContent = error.message; button.disabled = false; }
      finally { account.authenticating = false; }
    }
  });
  window.addEventListener("polymath:progress", queueSave);
  window.addEventListener("online", () => {
    if (account.user && account.dirty && !account.loading && !account.authenticating) return applyUser(account.user);
  });
  document.addEventListener("visibilitychange", () => { if (document.hidden && account.ready && account.dirty) flush(); });
  document.addEventListener("DOMContentLoaded", async () => {
    try { applyAppearance(localStorage.getItem(themeKey)); } catch {}
    try {
      const config = await api("/api/account?action=config"); account.configured = config.configured;
      if (!account.configured) return;
      const result = await api("/api/account?action=session"); if (result.user) await applyUser(result.user);
    } catch { /* The public learning experience remains usable without accounts. */ }
    finally {
      renderControl();
      if (window.PolymathSqlCourse && account.configured && window.location?.search && new URLSearchParams(window.location.search).get("profil") === "1") {
        const url = new URL(window.location.href);
        url.searchParams.delete("profil");
        history.replaceState(history.state, "", url);
        open();
      }
    }
  });
})();
