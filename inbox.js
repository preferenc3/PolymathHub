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
    const bell = document.querySelector("[data-open-inbox]");
    if (!bell) return;
    bell.hidden = !owner;
    bell.querySelector("[data-inbox-count]").textContent = total ? (total > 99 ? "99+" : String(total)) : "";
    bell.setAttribute("aria-label", total ? "Notificări necitite: " + total : "Notificări");
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
  function open(api, account, trigger, mode = "inbox") {
    if (!account.user || document.getElementById("notice-dialog")) return;
    const user = account.user.id;
    const dialog = document.createElement("dialog");
    dialog.id = "notice-dialog";
    dialog.setAttribute("aria-labelledby", "notice-title");
    dialog.innerHTML = '<header><h2 id="notice-title">Notificări</h2><button type="button" aria-label="Închide notificările" data-close>×</button></header><nav aria-label="Tipul notificărilor"></nav><section class="notice-body"></section><p class="notice-status" role="status"></p>';
    const nav = dialog.querySelector("nav"), content = dialog.querySelector("section"), status = dialog.querySelector("[role=status]");
    let entries = [];
    let box = mode === "direct" ? "project" : "account", page = 0, thread, version = 0, messages = [], formKey;
    function call(data) { return request(api, user, {...data, box}); }
    function tabs() {
      if (!account.admin || mode !== "inbox") { nav.replaceChildren(); return; }
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
    function reward(item) {
      if (item.kind === "bonus") return "+" + (item.after_value - item.before_value) + " XP";
      if (item.kind === "restore") return item.after_value + " zile consecutive";
      return item.after_value + " lecții pe zi";
    }
    const rewardTitles = {bonus:"Bonus XP", restore:"Serie restabilită", goal:"Obiectiv zilnic actualizat"};
    function row(item) {
      const adjustment = Object.hasOwn(rewardTitles,item.kind);
      const title = adjustment ? rewardTitles[item.kind] + " · " + reward(item) : item.subject;
      return '<li><button type="button" class="notice-row" '+(adjustment?'data-detail':'data-thread')+'="'+escape(item.id)+'">'+
        '<strong>'+escape(title)+'</strong><span>'+escape(item.sender)+' · '+escape(when(item.at))+'</span></button></li>';
    }
    function detail(id) {
      const item = entries.find(entry => entry.id === id);
      if (!item) return;
      content.innerHTML = back+'<h3 tabindex="-1">'+escape(rewardTitles[item.kind])+'</h3>'+
        '<dl class="notice-detail"><dt>Ai primit</dt><dd>'+escape(reward(item))+'</dd><dt>Motiv</dt><dd>'+escape(item.body)+
        '</dd><dt>De la</dt><dd>'+escape(item.sender)+'</dd><dt>Data</dt><dd>'+escape(when(item.at))+'</dd></dl>';
      content.querySelector("h3").focus();
    }
    async function list(visit = false) {
      dialog.querySelector("h2").textContent = "Notificări";
      thread = null; formKey = null;
      const v = busy(); tabs();
      content.replaceChildren();
      try {
        const result = await call({action:visit ? "visit" : "list",page});
        if (!fresh(v)) return;
        entries = result.items.slice(0,20);
        if (visit) sync(api,account,true).then(tabs);
        content.insertAdjacentHTML("beforeend", entries.length ? '<ul class="notice-feed">'+entries.map(row).join("")+'</ul>' : '<p>'+(box==="project"?"Încă nu ai conversații în această secțiune.":"Ești la zi cu notificările.")+'</p>');
        content.insertAdjacentHTML("beforeend", (page?'<button type="button" data-page="-1">Mai recente</button>':'')+(result.items.length>20?'<button type="button" data-page="1">Mai vechi</button>':''));
        status.textContent = "";
      } catch (err) {
        if (fresh(v)) { error(err); content.insertAdjacentHTML("beforeend", '<button type="button" data-retry-list="'+visit+'">Reîncearcă</button>'); }
      }
    }
    const back = mode === "inbox" ? '<button type="button" data-list>← Înapoi la notificări</button>' : "";
    function form(isNew) {
      return '<form class="notice-form">'+(isNew?'<label>Subiect<input name="subject" maxlength="120" required></label>':'')+
        '<label>'+(isNew?'Mesajul tău':'Răspunsul tău')+'<textarea name="body" maxlength="3000" rows="3" required></textarea></label>'+
        '<button type="submit">'+(isNew?(mode==='direct'?'Trimite mesajul':'Trimite feedback'):'Trimite răspunsul')+'</button></form>';
    }
    function message(m) {
      return '<li data-mine="'+Boolean(m.mine)+'"><div class="notice-meta"><b>'+(m.mine?'Tu':escape(m.sender))+'</b> · '+escape(when(m.created_at))+'</div><p>'+escape(m.body)+'</p></li>';
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
          dialog.querySelector("h2").textContent = "Conversație";
          content.innerHTML = back+'<h3 tabindex="-1">'+escape(result.subject)+'</h3>'+(messages[0]?.seq>1?'<button type="button" data-older>Mesaje anterioare</button>':'')+
            '<ol class="notice-messages">'+messages.map(message).join("")+'</ol>'+form(false);
          content.querySelector("h3").focus();
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
      if (el.dataset.box) { box = el.dataset.box; page = 0; return list(true); }
      if (el.hasAttribute("data-list")) return list();
      if (el.dataset.page) { page += Number(el.dataset.page); return list(); }
      if (el.dataset.thread) return read(el.dataset.thread);
      if (el.dataset.detail) return detail(el.dataset.detail);
      if (el.dataset.retryList) return list(el.dataset.retryList === "true");
      if (el.hasAttribute("data-older")) return read(thread,true);

    });
    dialog.addEventListener("submit",async event => {
      event.preventDefault();
      const f = event.target, btn = f.querySelector("[type=submit]");
      if (btn.disabled) return;
      const id = thread || formKey, data = new FormData(f), v = version;
      btn.disabled = true; status.textContent = "Se trimite…";
      try {
        await call({action:thread?"reply":mode==="direct"?"direct":"new",id,recipient:trigger.dataset.directRecipient,nonce:formKey,subject:data.get("subject"),body:data.get("body")});
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
    document.body.append(dialog); dialog.showModal();
    if (mode === "inbox") list(true);
    else {
      dialog.querySelector("h2").textContent = mode === "direct" ? "Mesaj direct" : "Feedback pentru echipă";
      formKey = crypto.randomUUID();
      content.innerHTML = (mode === "direct" ? '<p>Către <strong>'+escape(trigger.dataset.recipientName)+'</strong></p>' : '') + form(true);
      content.querySelector("input").focus();
    }
  }
  window.addEventListener("focus", () => { if (currentAccount?.user) sync(currentApi,currentAccount); });
  window.PolymathInbox = {open,sync};
})();
