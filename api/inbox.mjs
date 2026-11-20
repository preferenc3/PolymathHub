import {ApiError, configuration, send, provider, sessionFor, fail, checkExpectedAccount, sameOrigin, readJson} from "../server/auth.mjs";

export function createInboxHandler({env = process.env, fetcher = fetch} = {}) {
  return async function handler(req, res) {
    try {
      if (req.method !== "POST") { res.setHeader("Allow", "POST"); throw new ApiError(405, "Metodă indisponibilă."); }
      if (!sameOrigin(req)) throw new ApiError(403, "Origine nevalidă.");
      const config = configuration(env);
      if (!config) throw new ApiError(503, "Notificările sunt momentan indisponibile.");
      const call = provider(config, fetcher);
      const session = await sessionFor(req, res, call);
      if (!session) throw new ApiError(401, "Conectează-te pentru a vedea notificările.");
      if (!req.headers["x-polymath-account"]) throw new ApiError(412, "Redeschide notificările.");
      checkExpectedAccount(req, session.user);
      const {action, box = "account", id, recipient, subject, body, nonce, page = 0} = await readJson(req, 20000);
      const uuid = /^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i;
      if (!["counts","list","visit","direct","seen","new","reply","thread"].includes(action) || !["account","project"].includes(box)
          || !Number.isSafeInteger(page) || page < 0 || page > 1000000
          || (!["counts","list","visit"].includes(action) && !uuid.test(id))
          || (["new","direct","reply"].includes(action) && (!uuid.test(nonce) || typeof body !== "string" || !body.trim() || body.trim().length > 3000))
          || (action === "direct" && (box !== "project" || !uuid.test(recipient)))
          || (["new","direct"].includes(action) && (typeof subject !== "string" || !subject.trim() || subject.trim().length > 120))) {
        throw new ApiError(400, "Verifică subiectul și mesajul.");
      }
      const direct = action === "direct";
      const args = direct
        ? {p_id:id,p_recipient:recipient,p_subject:subject,p_body:body,p_nonce:nonce}
        : {p_action:action,p_box:box,p_id:id??null,p_subject:subject??null,p_body:body??null,p_nonce:nonce??null,p_page:page};
      const data = await call("/rest/v1/rpc/" + (direct ? "polymath_start_message" : "polymath_inbox"),
        {method:"POST", token:session.token, body:args});
      if (data?.error) {
        const errors = {forbidden:[403,"Nu ai acces la aceste notificări."], missing:[404,"Conversația nu este disponibilă."],
          conflict:[409,"Mesajul s-a schimbat. Redeschide conversația."]};
        throw new ApiError(...(errors[data.error] || [400,"Cererea nu a putut fi aplicată."]));
      }
      send(res,200,data);
    } catch (error) { fail(res,error); }
  };
}
export default createInboxHandler();
