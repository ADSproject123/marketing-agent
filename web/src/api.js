const TOKEN_KEY = "ma_auth_token";

/** Empty in local Vite (proxy). Set VITE_API_URL on Vercel → your Render API URL. */
const API_BASE = String(import.meta.env.VITE_API_URL || "")
  .trim()
  .replace(/\/$/, "");

function apiUrl(path) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${API_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function parseError(res) {
  const data = await res.json().catch(() => ({}));
  const detail = data.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => d.msg || JSON.stringify(d)).join("; ");
  }
  return `HTTP ${res.status}`;
}

async function api(path, { method = "GET", body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(apiUrl(path), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const err = new Error(await parseError(res));
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export async function fetchHealth() {
  const res = await fetch(apiUrl("/api/health"));
  if (!res.ok) throw new Error("down");
  return res.json();
}

export async function registerAccount({ name, email, password }) {
  return api("/api/auth/register", {
    method: "POST",
    auth: false,
    body: { name, email, password },
  });
}

export async function loginAccount({ email, password }) {
  return api("/api/auth/login", {
    method: "POST",
    auth: false,
    body: { email, password },
  });
}

export async function fetchMe() {
  return api("/api/auth/me");
}

export async function fetchJobs(limit = 20) {
  return api(`/api/jobs?limit=${limit}`);
}

export async function startJob({ brief = "", urls = [], notes = null, template = "" } = {}) {
  return api("/api/jobs", {
    method: "POST",
    body: { brief, urls, notes, template },
  });
}

export async function fetchIntegrations() {
  return api("/api/integrations");
}

export async function saveIntegrations(payload) {
  return api("/api/integrations", {
    method: "PUT",
    body: payload,
  });
}

export async function startFacebookConnect() {
  return api("/api/integrations/facebook/connect");
}

export async function fetchFacebookPendingPages() {
  return api("/api/integrations/facebook/pages");
}

export async function selectFacebookPage(pageId) {
  return api("/api/integrations/facebook/select", {
    method: "POST",
    body: { page_id: pageId },
  });
}

export async function disconnectFacebook() {
  return api("/api/integrations/facebook", { method: "DELETE" });
}
