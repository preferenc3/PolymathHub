(() => {
  "use strict";
  const escape = value => String(value ?? "").replace(/[<>&"']/g, ch => ({"<":"&lt;",">":"&gt;","&":"&amp;",'"':"&quot;","'":"&#39;"}[ch]));
  const date = new Intl.DateTimeFormat("ro-RO", {dateStyle:"medium", timeStyle:"short"});
  const when = value => date.format(new Date(value));
  let currentApi, currentAccount;
  let owner, lastCheck = 0, counts = {}, ticket = 0;
  function request(api, id, data) {
    return api("/api/inbox", {method:"POST", headers:{"x-polymath-account":id}, body:JSON.stringify(data)});
  }
  function paint() {
    const total = (counts.account || 0) + (counts.project || 0);
    const badge = document.querySelector("[data-inbox-count]");
    if (badge) badge.textContent = total ? String(total) : "";
    const avatar = document.querySelector("#account-control button");
    avatar?.toggleAttribute("data-unread", total > 0);
    if (total && avatar) avatar.setAttribute("aria-label", "Setări cont, notificări necitite: " + total);
    else if (owner && avatar) avatar.setAttribute("aria-label", "Setări cont");
  }
  async function sync(api, account, force = false) {
    currentApi = api; currentAccount = account;
    const id = account.user?.id;
    if (owner !== id) {
      document.querySelector("#notice-dialog")?.close();
      owner = id; counts = {}; lastCheck = 0; ticket++;
    }
    paint();
    if (!id || (!force && Date.now() - lastCheck < 60000)) return;
    lastCheck = Date.now();
    const mine = ++ticket;
    try {
      const result = await request(api, id, {action:"counts"});
      if (mine === ticket) { counts = result; paint(); }
    } catch { /* The inbox itself offers an explicit retry. */ }
  }
  function open(api, account, trigger) {
    if (!account.user || document.getElementById("notice-dialog")) return;
    const user = account.user.id;
    const dialog = document.createElement("dialog");
    dialog.id = "notice-dialog";
    dialog.setAttribute("aria-labelledby", "notice-title");
    dialog.innerHTML = '<header><h2 id="notice-title">Notificări</h2><button type="button" aria-label="Închide notificările" data-close>×</button></header><nav aria-label="Tipul notificărilor"></nav><section class="notice-body"></section><p class="notice-status" role="status"></p>';
    const nav = dialog.querySelector("nav"), content = dialog.querySelector("section"), status = dialog.querySelector("[role=status]");
    let box = "account", page = 0, thread, version = 0, messages = [], formKey;
    function call(data) { return request(api, user, {...data, box}); }
    function tabs() {
      if (!account.admin) { nav.replaceChildren(); return; }
      for (const [key,label] of [["account","Cont"],["project","Proiect"]]) {
        let tab = nav.querySelector('[data-box="'+key+'"]');
        if (!tab) {
          tab = document.createElement("button"); tab.type = "button"; tab.dataset.box = key;
          nav.append(tab);
        }
        tab.textContent = label + (counts[key] ? " ("+counts[key]+")" : "");
        tab.setAttribute("aria-pressed",String(box === key));
      }
    }
    function fresh(v) { return dialog.open && account.user?.id === user && version === v; }
    function busy() { status.textContent = "Se încarcă…"; return ++version; }
    function error(err) { status.textContent = err.message || "Mesajele sunt temporar indisponibile."; }
    function row(item) {
      const feedback = item.kind === "feedback";
      const value = Number(item.after_value) - Number(item.before_value);
      const title = feedback ? item.subject : item.kind === "bonus" ? "+"+value+" XP" :
        item.kind === "restore" ? "Serie restabilită · "+item.after_value+" zile" : "Obiectiv zilnic · "+item.after_value;
      const action = feedback ? '<button type="button" data-thread="'+escape(item.id)+'">'+escape(title)+'</button>' : '<strong>'+escape(title)+'</strong>';
      return '<li><div class="notice-meta">'+(item.unread?'<b>Nou</b> ':'')+escape(when(item.at))+(item.sender?' · '+escape(item.sender):'')+'</div>'+action+'<p>'+escape(item.body)+'</p>'+
        (!feedback && item.unread?'<button type="button" data-seen="'+escape(item.id)+'">Marchează ca citită</button>':'')+'</li>';
    }
    async function list() {
      thread = null; formKey = null;
      const v = busy(); tabs();
      content.innerHTML = box === "account" ? '<button type="button" data-new>Trimite feedback</button>' : '';
      try {
        const result = await call({action:"list",page});
        if (!fresh(v)) return;
        const entries = result.items.slice(0,20);
        content.insertAdjacentHTML("beforeend", entries.length ? '<ul class="notice-feed">'+entries.map(row).join("")+'</ul>' : '<p>'+(box==="project"?"Încă nu ai mesaje de feedback de la utilizatori.":"Ești la zi cu notificările.")+'</p>');
        content.insertAdjacentHTML("beforeend", (page?'<button type="button" data-page="-1">Mai recente</button>':'')+(result.items.length>20?'<button type="button" data-page="1">Mai vechi</button>':''));
        status.textContent = "";
      } catch (err) {
        if (fresh(v)) { error(err); content.insertAdjacentHTML("beforeend", '<button type="button" data-list>Reîncearcă</button>'); }
      }
    }
    const back = '<button type="button" data-list>← Înapoi la notificări</button>';
    function form(isNew) {
      return '<form class="notice-form">'+(isNew?'<label>Subiect<input name="subject" maxlength="120" required></label>':'')+
        '<label>'+(isNew?'Mesajul tău':'Răspunsul tău')+'<textarea name="body" maxlength="3000" rows="3" required></textarea></label>'+
        '<button type="submit">'+(isNew?'Trimite feedback':'Trimite răspunsul')+'</button></form>';
    }
    function message(m) {
      return '<li data-mine="'+Boolean(m.mine)+'"><div class="notice-meta"><b>'+(m.mine?'Tu':m.from_team?'Echipa PolymathHub':'Utilizator')+'</b> · '+escape(when(m.created_at))+'</div><p>'+escape(m.body)+'</p></li>';
    }
    async function read(id, older = false) {
      const v = busy(); thread = id;
      if (!older) content.innerHTML = back;
      try {
        const result = await call({action:"thread", id, page:older?messages[0].seq:0});
        if (!fresh(v)) return;
        if (older) {
          messages = [...result.messages,...messages];
          content.querySelector(".notice-messages").insertAdjacentHTML("afterbegin",result.messages.map(message).join(""));
          if (messages[0]?.seq <= 1) content.querySelector("[data-older]")?.remove();
        } else {
          messages = result.messages; formKey = crypto.randomUUID();
          content.innerHTML = back+'<h3>'+escape(result.subject)+'</h3>'+(messages[0]?.seq>1?'<button type="button" data-older>Mesaje anterioare</button>':'')+
            '<ol class="notice-messages">'+messages.map(message).join("")+'</ol>'+form(false);
          sync(api, account, true).then(tabs);
        }
        status.textContent = "";
      } catch (err) {
        if (fresh(v)) { error(err); if (!older) content.insertAdjacentHTML("beforeend", '<button type="button" data-thread="'+escape(id)+'">Reîncearcă</button>'); }
      }
    }
    dialog.addEventListener("click", async event => {
      const el = event.target.closest("button");
      if (!el || el.disabled) return;
      if (el.hasAttribute("data-close")) return dialog.close();
      if (el.dataset.box) { box = el.dataset.box; page = 0; return list(); }
      if (el.hasAttribute("data-list")) return list();
      if (el.dataset.page) { page += Number(el.dataset.page); return list(); }
      if (el.dataset.thread) return read(el.dataset.thread);
      if (el.hasAttribute("data-older")) return read(thread,true);
      if (el.hasAttribute("data-new")) {
        version++; thread = null; formKey = crypto.randomUUID(); status.textContent = "";
        content.innerHTML = back+"<h3>Feedback pentru echipă</h3>"+form(true);
        content.querySelector("input").focus();
      }
      if (el.dataset.seen) {
        const v = version; el.disabled = true;
        try { await call({action:"seen",id:el.dataset.seen}); await sync(api,account,true); if (fresh(v)) list(); }
        catch (err) { if (fresh(v)) { el.disabled = false; error(err); } }
      }
    });
    dialog.addEventListener("submit",async event => {
      event.preventDefault();
      const f = event.target, btn = f.querySelector("[type=submit]");
      if (btn.disabled) return;
      const id = thread || formKey, data = new FormData(f), v = version;
      btn.disabled = true; status.textContent = "Se trimite…";
      try {
        await call({action:thread?"reply":"new",id,nonce:formKey,subject:data.get("subject"),body:data.get("body")});
        if (fresh(v)) read(id);
      } catch (err) { if (fresh(v)) { btn.disabled = false; error(err); } }
    });
    let pressedOutside = false;
    function outside(e) {
      const r = dialog.getBoundingClientRect();
      return e.target===dialog && (e.clientX<r.left || e.clientX>r.right || e.clientY<r.top || e.clientY>r.bottom);
    }
    dialog.addEventListener("pointerdown",e=>{pressedOutside=outside(e);});
    dialog.addEventListener("click",e=>{if(pressedOutside && outside(e)) dialog.close();});
    window.addEventListener("polymath:account",tabs);
    dialog.addEventListener("close",()=>{window.removeEventListener("polymath:account",tabs); version++; dialog.remove(); trigger?.focus({preventScroll:true});});
    document.body.append(dialog); dialog.showModal(); list(); sync(api,account,true).then(tabs);
  }
  window.addEventListener("focus", () => { if (currentAccount?.user) sync(currentApi,currentAccount); });
  window.PolymathInbox = {open,sync};
})();
