(function(){
  "use strict";
  const builtins = {sql:"00000000-0000-4000-8000-000000000001",limbi:"00000000-0000-4000-8000-000000000002"};
  const labels = {domain:"Domeniu",topic:"Temă",question:"Întrebare"};
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const link = id => "/#material?id=" + encodeURIComponent(id);
  const builtin = id => Object.values(builtins).includes(id);
  let items = [], loading = true, failed = false, fetchRevision = 0;

  async function refresh() {
    const revision = ++fetchRevision;
    try {
      const response = await fetch("/api/catalog",{cache:"no-store",signal:AbortSignal.timeout(10000)});
      if (!response.ok) throw Error();
      const data = await response.json();
      if (revision !== fetchRevision) return;
      items = data.items;
      failed = false;
    } catch {
      if (revision !== fetchRevision) return;
      failed = true;
    }
    loading = false;
    document.querySelectorAll("[data-catalog-links]").forEach(el => el.innerHTML = links());
    document.querySelectorAll("[data-catalog-view]").forEach(renderView);
  }
  function links() {
    return items.filter(i => i.kind === "domain" && (!builtin(i.id) || items.some(t=>t.parent === i.id))).map(i =>
      `<a class="explore-destination" href="${link(i.id)}"><span class="explore-symbol"><img src="/assets/icons/book-open.svg" alt=""></span><span><strong>${esc(i.title)}</strong><small>${builtin(i.id)?"Teme suplimentare":"Teme și exerciții"}</small></span><img class="explore-arrow" src="/assets/icons/caret-right.svg" alt=""></a>`
    ).join("");
  }
  function rows(list) {
    return list.map(i=>`<a class="course-row" href="${link(i.id)}"><span class="row-copy"><h3>${esc(i.title)}</h3></span><img class="icon" src="/assets/icons/arrow-right.svg" alt=""></a>`).join("");
  }
  function renderView(host) {
    const id = host.dataset.id;
    if (host.dataset.catalogView === "list") {
      const scope = host.dataset.domain;
      const list = scope ? items.filter(i=>i.parent === builtins[scope === "programare" ? "sql" : scope]) :
        items.filter(i=>i.kind === "domain" && (!builtin(i.id) || items.some(t=>t.parent === i.id)));
      host.innerHTML = list.length ? `<section><h2>Din catalog</h2>${rows(list)}</section>` : "";
      return;
    }
    const entry = items.find(i=>i.id === id && i.kind !== "question");
    if (!entry) {
      host.innerHTML = `<h1>${loading?"Se încarcă materialul…":failed?"Catalogul nu s-a putut încărca.":"Materialul nu mai este publicat."}</h1>${failed?'<button class="secondary" data-retry-catalog>Reîncearcă</button>':""} <a href="#cursuri">Înapoi la cursuri</a>`;
      host.querySelector("[data-retry-catalog]")?.addEventListener("click",refresh);
      return;
    }
    const parent = items.find(i=>i.id === entry.parent);
    const children = items.filter(i=>i.parent === id);
    host.innerHTML = `<a class="text-button" href="${parent?link(parent.id):"#cursuri"}">← ${esc(parent?.title || "Cursuri")}</a><h1>${esc(entry.title)}</h1>
      ${entry.body?`<section><h2>${entry.kind === "domain"?"Despre domeniu":"Teorie"}</h2><p class="catalog-prose">${esc(entry.body)}</p></section>`:""}
      ${entry.example?`<section><h2>Exemple</h2><p class="catalog-prose">${esc(entry.example)}</p></section>`:""}
      <section><h2>${entry.kind === "domain"?"Teme":"Practică"}</h2>${!children.length?"<p>Materialele pentru această secțiune urmează să fie publicate.</p>":entry.kind === "domain"?rows(children):children.map((q,index)=>`<form class="auth-form catalog-question" data-question="${esc(q.id)}"><label>${index+1}. ${esc(q.title)}<input name="answer" maxlength="500" required autocomplete="off"></label>${q.body?`<details><summary>Indiciu</summary><p class="catalog-prose">${esc(q.body)}</p></details>`:""}<button class="secondary" type="submit">Verifică răspunsul</button><p role="status"></p></form>`).join("")}</section>`;
    for (const form of host.querySelectorAll("[data-question]")) {
      if (form.dataset.question === host.dataset.focusQuestion) form.elements.answer.focus();
      form.onsubmit = async e => {
        e.preventDefault();
        const answer = form.elements.answer.value.trim();
        const status = form.querySelector("[role=status]"), submit = form.querySelector("button");
        if (submit.disabled) return;
        submit.disabled = true;
        const q = children.find(i=>i.id === form.dataset.question);
        try {
          const response = await fetch("/api/catalog?action=check",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({id:q.id,answer}),signal:AbortSignal.timeout(12000)});
          const result = await response.json();
          if (!response.ok) throw Error(result.error || "Verificarea a eșuat.");
          if (!form.isConnected) return;
          status.textContent = result.correct?"Corect. "+q.example:"Mai încearcă. "+(q.body || "Recitește teoria și exemplul.");
          if (!result.correct) window.dispatchEvent(new CustomEvent("polymath:catalog-mistake",{detail:{at:new Date().toISOString(), id:entry.id, questionId:q.id, title:q.title, answer, feedback:status.textContent}}));
        } catch (error) { status.textContent = error.message; }
        finally { submit.disabled = false; }
      };
    }
  }
  async function edit(host, api, userId) {
    const headers = {"X-Polymath-Account":userId};
    host.innerHTML = `<p role="status">Se încarcă materialele…</p>`;
    let library;
    try { library = (await api("/api/catalog?action=admin",{headers})).items; }
    catch (error) {
      host.innerHTML = `<p role="status">${esc(error.message)}</p><button class="studio-secondary" type="button">Reîncearcă</button>`;
      host.querySelector("button").onclick = () => edit(host,api,userId);
      return;
    }
    host.innerHTML = `<div class="catalog-toolbar"><label>Tip de material<select data-kind><option value="domain">Domeniu</option><option value="topic">Temă</option><option value="question">Întrebare</option></select></label><label>Material<select data-existing></select></label></div><div data-fields></div><p role="status" data-editor-status></p>`;
    const kind = host.querySelector("[data-kind]"), existing = host.querySelector("[data-existing]"), fields = host.querySelector("[data-fields]"), status = host.querySelector("[data-editor-status]");
    const path = i => {
      const parent = library.find(row=>row.id === i.parent);
      return parent ? path(parent) + " › " + i.title : i.title;
    };
    function list(selected="") {
      existing.innerHTML = `<option value="">Creează material</option>` + library.filter(i=>i.kind===kind.value && !builtin(i.id)).map(i=>`<option value="${esc(i.id)}">${esc(path(i))}${i.published?"":" · Ciornă"}</option>`).join("");
      existing.value = selected;
      form();
    }
    function form() {
      const type = kind.value, entry = library.find(i=>i.id===existing.value);
      const parents = library.filter(i=>i.kind === (type === "topic"?"domain":"topic"));
      status.textContent = "";
      if (type !== "domain" && !parents.length) {
        fields.innerHTML = `<p>Creează mai întâi ${type === "topic"?"un domeniu":"o temă"}.</p>`;
        return;
      }
      fields.innerHTML = `<form class="auth-form settings-form catalog-form">
        ${type !== "domain"?`<label>${type === "topic"?"Domeniu":"Temă"}<select name="parent" ${entry?"disabled":""}>${parents.map(p=>`<option value="${esc(p.id)}" ${entry?.parent===p.id?"selected":""}>${esc(path(p))}</option>`).join("")}</select></label>`:""}
        <label>${type === "question"?"Întrebare":"Titlu"}<input name="title" maxlength="250" value="${esc(entry?.title)}" required></label>
        <label>${type === "domain"?"Descriere":type === "topic"?"Teorie":"Indiciu"}<textarea rows="4" name="body" maxlength="12000">${esc(entry?.body)}</textarea></label>
        ${type !== "domain"?`<label>${type === "question"?"Explicație după rezolvare":"Exemple"}<textarea rows="3" name="example" maxlength="6000">${esc(entry?.example)}</textarea></label>`:""}
        ${type === "question"?`<label>Răspuns corect<input name="answer" maxlength="500" required value="${esc(entry?.answer)}"></label>`:""}
        <label>Vizibilitate<select name="visibility"><option value="draft">Ciornă</option><option value="public" ${entry?.published?"selected":""}>Publicat</option></select></label>
        <button class="studio-primary" type="submit">Salvează materialul</button></form>`;
      const editor = fields.querySelector("form");
      editor.onsubmit = async e => {
        e.preventDefault();
        const f = editor.elements, submit = editor.querySelector("button");
        if (submit.disabled) return;
        const item = {kind:type,parent:entry?.parent || f.parent?.value || null,title:f.title.value.trim(),body:f.body.value.trim(),example:f.example?.value.trim() || "",answer:f.answer?.value.trim() || "",published:f.visibility.value === "public"};
        if (entry) Object.assign(item,{id:entry.id,revision:entry.revision});
        submit.disabled = kind.disabled = existing.disabled = true;
        status.textContent = "Se salvează…";
        try {
          const {id} = await api("/api/catalog?action=save",{method:"POST",headers,body:JSON.stringify(item)});
          Object.assign(item,{id,revision:(entry?.revision || 0)+1});
          if (entry) library[library.indexOf(entry)] = item; else library.push(item);
          list(id);
          let ancestor = library.find(i=>i.id===item.parent);
          while (ancestor?.published) ancestor = library.find(i=>i.id===ancestor.parent);
          status.textContent = !item.published?"Ciornă salvată.":ancestor?"Salvat. Publică și materialul părinte pentru a-l face vizibil.":"Material publicat.";
          await refresh();
        } catch (error) { status.textContent = error.message; }
        finally { submit.disabled = kind.disabled = existing.disabled = false; }
      };
    }
    kind.onchange = () => list();
    existing.onchange = form;
    list();
  }
  window.PolymathCatalog = {links,renderView,edit};
  refresh();
})();

