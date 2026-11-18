import { ApiError, configuration, send, provider, sessionFor, fail, checkExpectedAccount, sameOrigin, readJson } from "../server/auth.mjs";

export function createAdminAccountsHandler({ env = process.env, fetcher = fetch } = {}) {
  return async function handler(req, res) {
    try {
      const params = new URL(req.url, "http://localhost").searchParams;
      const roleAction = params.get("action");
      const changeRole = req.method === "POST" && ["grant", "revoke"].includes(roleAction);
      if (req.method !== "GET" && !changeRole) {
        res.setHeader("Allow", "GET, POST");
        throw new ApiError(405, "Metodă indisponibilă.");
      }

      if (changeRole && !sameOrigin(req)) throw new ApiError(403, "Cererea nu poate fi acceptată de pe această pagină.");
      const config = configuration(env);
      if (!config) throw new ApiError(503, "Administrarea conturilor nu este disponibilă.");
      const call = provider(config, fetcher);
      const session = await sessionFor(req, res, call);
      if (!session) throw new ApiError(401, "Conectează-te pentru a accesa panoul.");
      checkExpectedAccount(req, session.user);

      if (changeRole) {
        if (!req.headers["x-polymath-account"]) throw new ApiError(412, "Reîncarcă panoul și încearcă din nou.");
        const { userId } = await readJson(req, 1024);
        if (typeof userId !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(userId)) {
          throw new ApiError(400, "Contul selectat nu este valid.");
        }
        if (roleAction === "revoke") {
          const result = await call("/rest/v1/rpc/polymath_revoke_administrator", {
            method: "POST", token: session.token, body: { p_user_id: userId }
          });
          if (result === "last_admin") throw new ApiError(409, "Acesta este ultimul administrator. Acordă mai întâi rolul unui alt cont.");
          if (result === "absent") return send(res, 200, { revoked: true });
          if (result !== "revoked") throw new ApiError(403, "Ai nevoie de rolul de administrator.");
          return send(res, 200, { revoked: true });
        }
        const result = await call("/rest/v1/rpc/polymath_grant_administrator", {
          method: "POST", token: session.token, body: { p_user_id: userId }
        });
        if (result !== true) throw new ApiError(403, "Rolul nu a putut fi acordat. Verifică drepturile și dacă mai există contul.");
        return send(res, 200, { granted: true });
      }

      const page = Number(params.get("page") ?? "1");
      if (!Number.isSafeInteger(page) || page < 1 || page > 1_000_000) {
        throw new ApiError(400, "Pagina cerută nu este validă.");
      }
      const accessOnly = params.get("action") === "access";
      const result = await call("/rest/v1/rpc/polymath_admin_accounts", {
        method: "POST",
        token: session.token,
        body: { p_page: page, p_query: (params.get("q") || "").trim().slice(0, 120), p_access_only: accessOnly }
      });
      if (accessOnly) return send(res, 200, { allowed: result?.allowed === true });
      if (result?.allowed !== true) throw new ApiError(403, "Panoul este disponibil doar administratorilor.");
      return send(res, 200, result);
    } catch (error) {
      fail(res, error);
    }
  };
}

export default createAdminAccountsHandler();
