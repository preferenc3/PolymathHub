import { avatars, ApiError, configuration, send, sameOrigin, readJson, provider, sessionFor, publicUser, credentials, setSession, fail, checkExpectedAccount } from "../server/auth.mjs";

import patterns from "../profile-patterns.js";

const settingsActions = ["banner", "profile", "password", "delete"];

async function settings(req, res, action, body, call) {
  const session = await sessionFor(req, res, call);
  if (!session?.user?.id) throw new ApiError(401, "Conectează-te pentru a modifica setările.");
  if (!req.headers["x-polymath-account"]) throw new ApiError(412, "Reîncarcă setările contului și încearcă din nou.");
  checkExpectedAccount(req, session.user);

  if (action === "banner") {
    if (typeof body.banner !== "string" || !Object.hasOwn(patterns, body.banner))
      throw new ApiError(400, "Alege un model de copertă din listă.");
    const user = await call("/auth/v1/user", {method:"PUT", token:session.token, body:{data:{banner:body.banner}}});
    if (user.id !== session.user.id || user.user_metadata?.banner !== body.banner)
      throw new ApiError(503, "Modelul copertei nu a putut fi salvat.");
    return send(res, 200, {user:publicUser(user)});
  }
  if (action === "profile") {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name || name.length > 60 || /[\u0000-\u001f\u007f]/.test(name)) {
      throw new ApiError(400, "Introdu un nume între 1 și 60 de caractere.");
    }
    const data = { display_name: name };
    if (body.avatar !== undefined) {
      if (!avatars.includes(body.avatar)) throw new ApiError(400, "Alege un avatar din listă.");
      data.avatar = body.avatar;
    }
    const user = await call("/auth/v1/user", { method: "PUT", token: session.token, body: { data } });
    if (user.id !== session.user.id) throw new ApiError(503, "Numele nu a putut fi actualizat.");
    return send(res, 200, { user: publicUser(user) });
  }

  const { currentPassword } = body;
  if (typeof currentPassword !== "string" || !currentPassword || currentPassword.length > 128) {
    throw new ApiError(400, "Introdu parola actuală.");
  }
  if (action === "delete" && body.confirmation !== "ȘTERGE") {
    throw new ApiError(400, "Scrie ȘTERGE pentru a confirma.");
  }
  const password = action === "password" ? credentials({ email: session.user.email, password: body.password }).password : null;
  if (password === currentPassword) throw new ApiError(400, "Alege o parolă diferită de cea actuală.");

  let fresh;
  try {
    fresh = await call("/auth/v1/token?grant_type=password", {
      method: "POST", body: { email: session.user.email, password: currentPassword }
    });
  } catch (error) {
    if (error.status === 401) throw new ApiError(401, "Parola actuală este incorectă.");
    throw error;
  }
  if (fresh.user?.id !== session.user.id || !fresh.access_token || !fresh.refresh_token) {
    throw new ApiError(401, "Nu am putut confirma contul activ.");
  }
  if (action === "delete") {
    const deleted = await call("/rest/v1/rpc/polymath_delete_own_account", { method: "POST", token: fresh.access_token, body: {} });
    if (deleted !== true) throw new ApiError(409, "Ștergerea nu a fost confirmată. Încearcă din nou.");
    setSession(req, res, null);
    return send(res, 200, { user: null });
  }
  const user = await call("/auth/v1/user", {
    method: "PUT", token: fresh.access_token, body: { password, current_password: currentPassword }
  });
  if (user.id !== session.user.id) throw new ApiError(503, "Parola nu a putut fi actualizată.");
  setSession(req, res, fresh);
  return send(res, 200, { user: publicUser(user) });
}

export function createAccountHandler({ env = process.env, fetcher = fetch } = {}) {
  return async function handler(req, res) {
    try {
      const action = new URL(req.url, "http://localhost").searchParams.get("action") || "session";
      const config = configuration(env);
      if (req.method === "GET" && action === "config") return send(res, 200, { configured: Boolean(config) });
      if (!config) throw new ApiError(503, "Autentificarea nu este activată momentan.");
      const call = provider(config, fetcher);
      if (req.method === "GET" && action === "session") {
        const session = await sessionFor(req, res, call);
        return send(res, 200, { user: session ? publicUser(session.user) : null });
      }
      if (req.method !== "POST" || !["login", "register", "logout", ...settingsActions].includes(action)) { res.setHeader("Allow", "GET, POST"); throw new ApiError(405, "Metodă indisponibilă."); }
      if (!sameOrigin(req)) throw new ApiError(403, "Cererea nu poate fi acceptată de pe această pagină.");
      if (action === "logout") {
        const session = await sessionFor(req, res, call);
        if (session) checkExpectedAccount(req, session.user);
        if (session) await call("/auth/v1/logout?scope=local", { method: "POST", token: session.token });
        setSession(req, res, null); return send(res, 200, { user: null });
      }
      const body = await readJson(req, 4096);
      if (settingsActions.includes(action)) return await settings(req, res, action, body, call);
      const input = credentials(body);
      let session;
      if (action === "register") {
        // Do not send confirmation emails: the owner explicitly requested unverified email identifiers.
        const settings = await call("/auth/v1/settings");
        if (settings.mailer_autoconfirm !== true) throw new ApiError(503, "Crearea conturilor nu este disponibilă momentan.");
        const name = String(body.name || input.email.split("@")[0]).trim().slice(0, 60);
        session = await call("/auth/v1/signup", { method: "POST", body: { ...input, data: { display_name: name } } });
      } else session = await call("/auth/v1/token?grant_type=password", { method: "POST", body: input });
      if (!session.access_token || !session.refresh_token || !session.user?.id) throw new ApiError(503, "Contul nu poate fi deschis momentan.");
      setSession(req, res, session);
      return send(res, 200, { user: publicUser(session.user) });
    } catch (error) { fail(res, error); }
  };
}

export default createAccountHandler();
