const TOKEN_KEY = "ma_auth_token";

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
  const res = await fetch(path, {
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
  const res = await fetch("/api/health");
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
