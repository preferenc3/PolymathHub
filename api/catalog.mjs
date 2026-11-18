import { ApiError, configuration, send, sameOrigin, readJson, provider, sessionFor, checkExpectedAccount, fail } from "../server/auth.mjs";

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;

export default async function catalog(req, res) {
  try {
    const action = new URL(req.url, "http://localhost").searchParams.get("action") || "list";
    const method = {list:"GET", admin:"GET", save:"POST", check:"POST"}[action];
    if (req.method !== method) throw new ApiError(405, "Operație indisponibilă.");
    if (method === "POST" && !sameOrigin(req)) throw new ApiError(403, "Originea cererii nu este validă.");
    const config = configuration(process.env);
    if (!config) throw new ApiError(503, "Catalogul nu este disponibil momentan.");
    const call = provider(config);
    let token;
    if (action === "admin" || action === "save") {
      const session = await sessionFor(req, res, call);
      if (!session) throw new ApiError(401, "Conectează-te pentru a administra conținutul.");
      checkExpectedAccount(req, session.user);
      if (!req.headers["x-polymath-account"]) throw new ApiError(412, "Redeschide panoul de administrare.");
      token = session.token;
      const access = await call("/rest/v1/rpc/polymath_admin_accounts", {method:"POST", token, body:{p_page:1,p_query:"",p_access_only:true}});
      if (!access?.allowed) throw new ApiError(403, "Ai nevoie de rolul de administrator.");
    }
    const rpc = (name, body) => call("/rest/v1/rpc/polymath_catalog" + name, {method:"POST", token, body});
    if (method === "GET") return send(res, 200, {items:await rpc("", {p_admin:action === "admin"})});
    const item = await readJson(req, 80000);
    if (action === "check") {
      if (!uuid.test(item.id) || typeof item.answer !== "string" || !item.answer.trim() || item.answer.length > 500) throw new ApiError(400, "Introdu un răspuns de cel mult 500 de caractere.");
      const correct = await rpc("_check", {p_id:item.id,p_answer:item.answer.trim()});
      if (correct === null) throw new ApiError(404, "Întrebarea nu mai este publicată.");
      return send(res, 200, {correct});
    }
    if (!["domain","topic","question"].includes(item.kind) || typeof item.published !== "boolean" ||
        (item.kind === "domain" ? item.parent != null : !uuid.test(item.parent)) ||
        (item.id != null && (!uuid.test(item.id) || !Number.isSafeInteger(item.revision)))) throw new ApiError(400, "Selecția nu este validă.");
    for (const [key,limit] of Object.entries({title:250,body:12000,example:6000,answer:500})) {
      if (typeof item[key] !== "string" || item[key].length > limit) throw new ApiError(400, "Verifică lungimea câmpurilor.");
    }
    if (!item.title.trim() || (item.kind === "question") !== Boolean(item.answer.trim())) throw new ApiError(400, "Completează titlul și răspunsul cerut.");
    const id = await rpc("_save", {p_item:item});
    if (!id) throw new ApiError(409, "Materialul s-a schimbat. Redeschide editorul pentru versiunea curentă.");
    send(res, 200, {id});
  } catch (error) { fail(res, error); }
}

