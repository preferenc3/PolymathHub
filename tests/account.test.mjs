import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { createAccountHandler } from "../api/account.mjs";
import { createProgressHandler, validateProgress } from "../api/progress.mjs";
import { createAdminAccountsHandler } from "../api/admin-accounts.mjs";
import { credentials, sameOrigin, configuration } from "../server/auth.mjs";

const env = { SUPABASE_URL: "https://project.supabase.co", SUPABASE_ANON_KEY: "public-test-key" };
const id = "11111111-1111-4111-8111-111111111111";
const user = { id, email: "student@example.invalid", user_metadata: { display_name: "Student" } };
const session = { user, access_token: "private-access-token", refresh_token: "private-refresh-token", expires_in: 3600 };
function result(body, status = 200) { return { ok: status >= 200 && status < 300, status, json: async () => body }; }
async function run(handler, { method = "GET", url = "/api/account", body, headers = {} } = {}) {
  const req = { method, url, body, headers: { host: "polymathhub.vercel.app", origin: "https://polymathhub.vercel.app", "content-type": "application/json", ...headers } };
  const response = { headers: {}, setHeader(name, value) { this.headers[name.toLowerCase()] = value; }, end(value) { this.body = JSON.parse(value); } };
  await handler(req, response); return response;
}

test("unconfigured accounts are explicit and never create a fake session", async () => {
  const handler = createAccountHandler({ env: {}, fetcher: () => { throw new Error("must not call"); } });
  const config = await run(handler, { url: "/api/account?action=config" });
  assert.deepEqual(config.body, { configured: false });
  const login = await run(handler, { method: "POST", url: "/api/account?action=login", body: { email: user.email, password: "long-password" } });
  assert.equal(login.statusCode, 503); assert.equal(login.headers["set-cookie"], undefined);
});
test("email is a syntactic identifier; no mailbox-existence or DNS check is performed", () => {
  assert.deepEqual(credentials({ email: " Student@Example.Invalid ", password: "long-password" }), { email: "student@example.invalid", password: "long-password" });
  assert.throws(() => credentials({ email: "not an email", password: "long-password" }));
  assert.throws(() => credentials({ email: user.email, password: "short" }));
  assert.equal(configuration({ SUPABASE_URL: "http://insecure.test", SUPABASE_ANON_KEY: "test" }), null);
});
test("cross-site writes are rejected before contacting the auth provider", async () => {
  const handler = createAccountHandler({ env, fetcher: () => { throw new Error("must not call"); } });
  for (const origin of ["https://attacker.example", "null", "http://polymathhub.vercel.app"]) {
    const response = await run(handler, { method: "POST", url: "/api/account?action=login", body: {}, headers: { origin } });
    assert.equal(response.statusCode, 403);
  }
  assert.equal(sameOrigin({ headers: { host: "127.0.0.1:8000", origin: "http://127.0.0.1:8000" } }), true);
});
test("password login stores opaque tokens only in protected cookies, never in JSON", async () => {
  const handler = createAccountHandler({ env, fetcher: async (url, options) => {
    assert.match(url, /grant_type=password/); assert.equal(JSON.parse(options.body).password, "long-password"); return result(session);
  } });
  const response = await run(handler, { method: "POST", url: "/api/account?action=login", body: { email: user.email, password: "long-password" } });
  assert.equal(response.statusCode, 200); assert.deepEqual(response.body, { user: { id, email: user.email, name: "Student" } });
  assert.equal(JSON.stringify(response.body).includes("private-"), false);
  for (const cookie of response.headers["set-cookie"]) { assert.match(cookie, /^__Host-/); assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/); assert.match(cookie, /Secure/); assert.match(cookie, /Path=\//); }
  assert.match(response.headers["cache-control"], /no-store/);
});
test("registration refuses to send confirmation emails when the provider is misconfigured", async () => {
  let calls = 0;
  const handler = createAccountHandler({ env, fetcher: async url => { ++calls; assert.match(url, /\/settings$/); return result({ mailer_autoconfirm: false }); } });
  const response = await run(handler, { method: "POST", url: "/api/account?action=register", body: { email: user.email, password: "long-password" } });
  assert.equal(response.statusCode, 503); assert.equal(calls, 1); assert.equal(response.headers["set-cookie"], undefined);
});
test("registration without email confirmation delegates password storage to Supabase Auth", async () => {
  const handler = createAccountHandler({ env, fetcher: async (url, options) => {
    if (url.endsWith("/settings")) return result({ mailer_autoconfirm: true });
    assert.match(url, /\/signup$/); assert.equal(JSON.parse(options.body).data.display_name, "Student"); return result(session);
  } });
  const response = await run(handler, { method: "POST", url: "/api/account?action=register", body: { email: user.email, password: "long-password", name: "Student" } });
  assert.equal(response.statusCode, 200); assert.equal(response.body.user.id, id);
});
test("expired sessions renew using the refresh cookie without leaking either token", async () => {
  const handler = createAccountHandler({ env, fetcher: async url => url.endsWith("/user") ? result({}, 401) : result(session) });
  const response = await run(handler, { headers: { cookie: "__Host-pm_access=expired; __Host-pm_refresh=refresh" } });
  assert.equal(response.statusCode, 200); assert.equal(response.body.user.id, id); assert.equal(response.headers["set-cookie"].length, 2);
});
test("upstream rate limits and failures are reported without exposing provider responses", async () => {
  const handler = createAccountHandler({ env, fetcher: async () => result({ secret: "must-not-leak" }, 429) });
  const response = await run(handler, { method: "POST", url: "/api/account?action=login", body: { email: user.email, password: "long-password" } });
  assert.equal(response.statusCode, 429); assert.equal(JSON.stringify(response.body).includes("must-not-leak"), false);
});
test("progress requires an authenticated server-validated session", async () => {
  const handler = createProgressHandler({ env, fetcher: () => { throw new Error("must not call"); } });
  const response = await run(handler, { url: "/api/progress" });
  assert.equal(response.statusCode, 401);
});
test("progress writes derive ownership from the verified session, ignoring a supplied user ID", async () => {
  let written;
  const handler = createProgressHandler({ env, fetcher: async (url, options) => {
    if (url.endsWith("/user")) return result(user);
    written = JSON.parse(options.body); assert.match(url, new RegExp("user_id=eq\\." + id)); assert.match(url, /revision=eq\.3/);
    assert.equal(options.headers.Authorization, "Bearer access"); return result([{ revision: 4, updated_at: "now" }]);
  } });
  const response = await run(handler, { method: "PUT", url: "/api/progress", headers: { cookie: "__Host-pm_access=access" }, body: { user_id: "another-user", course: { xp: 50 }, vocabulary: { saved: ["en:curious"] }, revision: 3 } });
  assert.equal(response.statusCode, 200); assert.equal(written.user_id, id); assert.equal(written.revision, 4);
});
test("a stale progress revision returns conflict rather than overwriting another session", async () => {
  const handler = createProgressHandler({ env, fetcher: async url => url.endsWith("/user") ? result(user) : result([]) });
  const response = await run(handler, { method: "PUT", url: "/api/progress", headers: { cookie: "__Host-pm_access=access" }, body: { course: {}, vocabulary: {}, revision: 2 } });
  assert.equal(response.statusCode, 409);
});
test("a tab bound to another account cannot read, write, or end the active session", async () => {
  const otherId = "22222222-2222-4222-8222-222222222222";
  const fetcher = async url => {
    assert.match(url, /\/auth\/v1\/user$/);
    return result({ ...user, id: otherId });
  };
  const headers = { cookie: "__Host-pm_access=second-account", "x-polymath-account": id };
  const progress = createProgressHandler({ env, fetcher });
  const account = createAccountHandler({ env, fetcher });
  for (const method of ["GET", "PUT"]) {
    const response = await run(progress, { method, url: "/api/progress", headers, body: { revision: null } });
    assert.equal(response.statusCode, 412);
  }
  const logout = await run(account, { method: "POST", url: "/api/account?action=logout", headers });
  assert.equal(logout.statusCode, 412);
  assert.equal(logout.headers["set-cookie"], undefined);
});
test("progress validation drops credentials and rebuilds untrusted source URLs", () => {
  const progress = validateProgress({ revision: null, course: { password: "secret", xp: -10, user: { email: user.email }, completedLessons: ["sql-1", "sql-1"], masteryPoints: { "sql-1": 1, invalid: -1 } }, vocabulary: { saved: ["en:curious", "en:curious"], cache: [{ id: "en:test", lang: "en", word: "test", examples: [], source: "online", sourceUrl: "javascript:alert(1)" }] } });
  assert.equal(progress.course.password, undefined); assert.equal(progress.course.user, undefined); assert.equal(progress.course.xp, undefined);
  assert.deepEqual(progress.course.completedLessons, ["sql-1"]); assert.deepEqual(progress.course.masteryPoints, { "sql-1": 1 });
  assert.deepEqual(progress.vocabulary.saved, ["en:curious"]); assert.match(progress.vocabulary.cache[0].sourceUrl, /^https:\/\/en\.wiktionary\.org/);
});

test("the admin directory requires a session and refuses authenticated non-admins", async () => {
  const handler = createAdminAccountsHandler({ env, fetcher: async url =>
    url.endsWith("/user") ? result(user) : result({ allowed: false }) });
  const url = "/api/admin-accounts";
  assert.equal((await run(handler, { url })).statusCode, 401);
  const headers = { cookie: "__Host-pm_access=access" };
  const denied = await run(handler, { url, headers });
  assert.equal(denied.statusCode, 403);
  assert.equal(denied.body.accounts, undefined);
  assert.deepEqual((await run(handler, { url: url + "?action=access", headers })).body, { allowed: false });
});

test("admin queries use the verified user token, bind to the active account, and paginate", async () => {
  const listing = { allowed: true, page: 2, matched: 26, page_size: 25, accounts: [{ name: "Student", xp: 25 }] };
  let rpcCalls = 0;
  const handler = createAdminAccountsHandler({ env, fetcher: async (url, options) => {
    if (url.endsWith("/user")) return result(user);
    rpcCalls++;
    assert.match(url, /polymath_admin_accounts$/);
    assert.equal(options.headers.Authorization, "Bearer access");
    assert.deepEqual(JSON.parse(options.body), { p_page: 2, p_query: "student", p_access_only: false });
    return result(listing);
  } });
  const headers = { cookie: "__Host-pm_access=access", "x-polymath-account": id };
  const url = "/api/admin-accounts?page=2&q=student";
  const response = await run(handler, { url, headers });
  assert.deepEqual(response.body, listing);
  assert.match(response.headers["cache-control"], /no-store/);
  assert.equal((await run(handler, { url, headers: { ...headers, "x-polymath-account": "other" } })).statusCode, 412);
  assert.equal(rpcCalls, 1);
});

// Exercise the real browser controller at its fetch/storage boundaries.
function accountBrowser({ storage = new Map(), remote = { course: { xp: 0 }, vocabulary: {}, revision: 0 }, failSave = false, beforeRead = () => {} } = {}) {
  const documentEvents = {}, windowEvents = {}, writes = [];
  let state = { xp: 0 }, words = {}, currentRemote = remote;
  const control = { querySelector: () => ({ setAttribute() {}, innerHTML: "" }) };
  const document = { hidden: true, getElementById: name => name === "account-control" ? control : null,
    addEventListener: (name, fn) => { documentEvents[name] = fn; } };
  const window = { addEventListener: (name, fn) => { windowEvents[name] = fn; }, dispatchEvent() {},
    PolymathApp: { snapshot: () => ({ state }), replaceProgress: value => { state = value || {}; }, toast() {}, accountProgress: () => state },
    PolymathStudio: { vocabularySnapshot: () => words, replaceVocabulary: value => { words = value; windowEvents["polymath:progress"]?.(); } } };
  const fetcher = async (path, options = {}) => {
    if (path.includes("action=config")) return result({ configured: true });
    if (path.includes("action=session")) return result({ user });
    if (path.includes("admin-accounts")) return result({ allowed: false });
    if (path === "/api/progress" && options.method === "PUT") {
      const payload = JSON.parse(options.body); writes.push(payload);
      if (failSave) throw new TypeError("Network unavailable");
      currentRemote = { ...payload, revision: payload.revision + 1 };
      return result({ revision: currentRemote.revision });
    }
    if (path === "/api/progress") { await beforeRead(); return result({ progress: currentRemote }); }
    throw Error("Unexpected path " + path);
  };
  vm.runInNewContext(fs.readFileSync(new URL("../account.js", import.meta.url), "utf8"), {
    window, document, fetch: fetcher, structuredClone, AbortSignal, Event, Intl,
    setTimeout: () => 1, clearTimeout() {},
    localStorage: { getItem: key => storage.get(key) || null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) }
  });
  return { window, storage, writes, start: () => documentEvents.DOMContentLoaded(),
    progress: value => { state = value; windowEvents["polymath:progress"](); },
    reconnect: () => windowEvents.online(),
    flush: async () => { documentEvents.visibilitychange(); await window.PolymathAccount.saving; },
    state: () => state };
}

test("account attempts survive a failed save and reload, then resume against the same cloud revision", async () => {
  const storage = new Map();
  const first = accountBrowser({ storage, failSave: true });
  await first.start();
  first.progress({ xp: 25, sqlPractice: { records: { e1: { passed: true } } } });
  await first.flush();
  assert.equal(first.window.PolymathAccount.ready, false);
  const second = accountBrowser({ storage });
  await second.start();
  await second.flush();
  assert.equal(second.state().xp, 25, "recover unsynced local work instead of replacing it with older cloud state");
  assert.equal(second.writes.length, 1);
  assert.equal(second.writes[0].revision, 0);
  assert.equal(second.window.PolymathAccount.revision, 1);
});

test("offline account recovery preserves local work without overwriting a newer cloud revision", async () => {
  const storage = new Map();
  const first = accountBrowser({ storage, failSave: true });
  await first.start(); first.progress({ xp: 25 }); await first.flush();
  const second = accountBrowser({ storage, remote: { course: { xp: 100 }, vocabulary: {}, revision: 1 } });
  await second.start(); await second.flush();
  assert.equal(second.state().xp, 25);
  assert.equal(second.writes.length, 0);
  assert.equal(second.window.PolymathAccount.ready, false);
  assert.match(second.window.PolymathAccount.sync, /altă sesiune/);
});

test("new attempts made after a failed save are retained for the next account connection", async () => {
  const storage = new Map();
  const first = accountBrowser({ storage, failSave: true });
  await first.start(); first.progress({ xp: 25 }); await first.flush();
  first.progress({ xp: 50 });
  const second = accountBrowser({ storage });
  await second.start(); await second.flush();
  assert.equal(second.state().xp, 50);
  assert.equal(second.writes[0].course.xp, 50);
  assert.equal(storage.size, 0, "acknowledged pending snapshot is removed after the save succeeds");
});

test("attempts made while reconnecting are not replaced by the earlier local snapshot", async () => {
  let release, reads = 0;
  const gate = new Promise(resolve => { release = resolve; });
  const browser = accountBrowser({ failSave: true, beforeRead: () => ++reads > 1 ? gate : undefined });
  await browser.start(); browser.progress({ xp: 25 }); await browser.flush();
  const retry = browser.reconnect();
  browser.progress({ xp: 50 });
  release();
  await retry;
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(browser.state().xp, 50);
});

test("account settings update only the authenticated user's display name", async () => {
  const handler = createAccountHandler({ env, fetcher: async (url, options) => {
    assert.ok(url.endsWith("/user"));
    if (options.method === "GET") return result(user);
    assert.equal(options.method, "PUT");
    assert.equal(options.headers.Authorization, "Bearer old");
    assert.deepEqual(JSON.parse(options.body), { data: { display_name: "Ana Maria" } });
    return result({ ...user, user_metadata: { display_name: "Ana Maria" } });
  } });
  const options = { method: "POST", url: "/api/account?action=profile", body: { name: " Ana Maria ", id: "other" } };
  assert.equal((await run(handler, options)).statusCode, 401);
  const headers = { cookie: "__Host-pm_access=old", "x-polymath-account": id };
  assert.equal((await run(handler, { ...options, headers: { ...headers, "x-polymath-account": "wrong" } })).statusCode, 412);
  const response = await run(handler, { ...options, headers });
  assert.deepEqual(response.body.user, { id, email: user.email, name: "Ana Maria" });
});

test("password update and self-deletion require the current password and bind a fresh session to the current account", async () => {
  const calls = [];
  const handler = createAccountHandler({ env, fetcher: async (url, options) => {
    calls.push([url, options.method]);
    if (url.endsWith("/user") && options.method === "GET") return result(user);
    const body = JSON.parse(options.body);
    if (url.includes("grant_type=password")) {
      assert.equal(body.email, user.email);
      return body.password === "old-password" ? result(session) : result({}, 401);
    }
    assert.equal(options.headers.Authorization, "Bearer private-access-token");
    if (url.endsWith("/user")) {
      assert.deepEqual(body, { password: "new-password", current_password: "old-password" });
      return result(user);
    }
    assert.match(url, /polymath_delete_own_account$/);
    assert.deepEqual(body, {});
    return result(true);
  } });
  const headers = { cookie: "__Host-pm_access=old", "x-polymath-account": id };
  const post = (action, body) => run(handler, { method: "POST", url: "/api/account?action=" + action, body, headers });
  assert.equal((await post("delete", { currentPassword: "old-password" })).statusCode, 400);
  assert.equal((await post("password", { currentPassword: "wrong", password: "new-password" })).statusCode, 401);
  assert.equal(calls.some(([, method]) => method === "PUT"), false);
  const changed = await post("password", { currentPassword: "old-password", password: "new-password" });
  assert.equal(changed.statusCode, 200);
  assert.match(changed.headers["set-cookie"][0], /private-access-token/);
  const removed = await post("delete", { currentPassword: "old-password", confirmation: "ȘTERGE", userId: "other" });
  assert.deepEqual(removed.body, { user: null });
  assert.match(removed.headers["set-cookie"][0], /Max-Age=0/);
});

test("reset writes an empty newer revision so stale progress cannot overwrite it", async () => {
  const handler = createProgressHandler({ env, fetcher: async (url, options) => {
    if (url.endsWith("/user")) return result(user);
    if (options.method === "GET") {
      assert.match(url, /select=revision$/);
      return result([{ revision: 7 }]);
    }
    assert.match(url, /revision=eq\.7$/);
    assert.equal(options.method, "PATCH");
    const body = JSON.parse(options.body);
    assert.equal(body.user_id, id);
    assert.equal(body.revision, 8);
    assert.deepEqual(body.course.completedLessons, []);
    assert.deepEqual(body.vocabulary, { saved: [], learned: [], cache: [] });
    return result([{ revision: 8 }]);
  } });
  const headers = { cookie: "__Host-pm_access=old", "x-polymath-account": id };
  const options = { method: "POST", url: "/api/progress?action=reset", headers };
  assert.equal((await run(handler, { ...options, body: {} })).statusCode, 400);
  assert.equal((await run(handler, { ...options, body: { confirmation: "RESETEAZĂ" } })).body.revision, 8);
});

test("administrator grant is scoped to the verified session and requires database authorization", async () => {
  const target = "22222222-2222-4222-8222-222222222222";
  let allowed = false;
  const handler = createAdminAccountsHandler({ env, fetcher: async (url, options) => {
    if (url.endsWith("/user")) return result(user);
    assert.match(url, /polymath_grant_administrator$/);
    assert.equal(options.headers.Authorization, "Bearer access");
    assert.deepEqual(JSON.parse(options.body), { p_user_id: target });
    return result(allowed);
  } });
  const headers = { cookie: "__Host-pm_access=access", "x-polymath-account": id };
  const options = { method: "POST", url: "/api/admin-accounts?action=grant", body: { userId: target }, headers };
  assert.equal((await run(handler, { ...options, headers: { ...headers, origin: "https://other.example" } })).statusCode, 403);
  assert.equal((await run(handler, options)).statusCode, 403);
  allowed = true;
  assert.deepEqual((await run(handler, options)).body, { granted: true });
});

test("revocation checks the actor, preserves the last administrator and tolerates a retry", async () => {
  const target = "22222222-2222-4222-8222-222222222222";
  let decision = "forbidden";
  const handler = createAdminAccountsHandler({ env, fetcher: async (url, options) => {
    if (url.endsWith("/user")) return result(user);
    assert.match(url, /polymath_revoke_administrator$/);
    assert.equal(options.headers.Authorization, "Bearer access");
    assert.deepEqual(JSON.parse(options.body), { p_user_id: target });
    return result(decision);
  } });
  const headers = { cookie: "__Host-pm_access=access", "x-polymath-account": id };
  const options = { method: "POST", url: "/api/admin-accounts?action=revoke", body: { userId: target }, headers };
  assert.equal((await run(handler, { ...options, headers: { ...headers, origin: "https://other.example" } })).statusCode, 403);
  assert.equal((await run(handler, { ...options, headers: { ...headers, "x-polymath-account": target } })).statusCode, 412);
  assert.equal((await run(handler, options)).statusCode, 403);
  decision = "last_admin";
  assert.equal((await run(handler, options)).statusCode, 409);
  for (decision of ["revoked", "absent"]) assert.deepEqual((await run(handler, options)).body, { revoked: true });
});
