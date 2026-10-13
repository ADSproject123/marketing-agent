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

export async function fetchJobs(limit = 20, offset = 0) {
  return api(`/api/jobs?limit=${limit}&offset=${offset}`);
}

export async function fetchJob(id) {
  return api(`/api/jobs/${encodeURIComponent(id)}`);
}

export async function fetchPromotions() {
  return api("/api/promotions");
}

export async function createPromotion({ kind, name, description, benefit = "", location = "", website = "" }) {
  return api("/api/promotions", {
    method: "POST",
    body: { kind, name, description, benefit, location, website },
  });
}

export async function ingestCampaignUrl(url) {
  return api("/api/campaign/ingest", {
    method: "POST",
    body: { url },
  });
}

export async function createWeeklyPlan({
  brief = "",
  urls = [],
  notes = null,
  language = "en",
} = {}) {
  return api("/api/campaign/weekly-plan", {
    method: "POST",
    body: { brief, urls, notes, language },
  });
}

async function submitCampaign(path, {
  brief = "",
  urls = [],
  notes = null,
  template = "",
  language = "en",
  assets = [],
} = {}) {
  const files = Array.isArray(assets) ? assets.filter(Boolean) : [];
  if (!files.length) {
    return api(path, {
      method: "POST",
      body: { brief, urls, notes, template, language },
    });
  }

  const form = new FormData();
  form.append("brief", brief || "");
  form.append("notes", notes || "");
  form.append("template", template || "");
  form.append("language", language || "en");
  form.append("urls", JSON.stringify(urls || []));
  for (const file of files) form.append("assets", file, file.name);

  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(apiUrl(path), {
    method: "POST",
    headers,
    body: form,
  });
  if (!res.ok) {
    const err = new Error(await parseError(res));
    err.status = res.status;
    throw err;
  }
  return res.json();
}

export function startJob(payload = {}) {
  return submitCampaign("/api/jobs", payload);
}

export function createCampaignDraft(payload = {}) {
  return submitCampaign("/api/campaign-drafts", payload);
}

export function saveStoryboard(id, storyboard, updatedAt) {
  return api(`/api/jobs/${encodeURIComponent(id)}/storyboard`, {
    method: "PUT",
    body: { storyboard, expected_updated_at: updatedAt },
  });
}

export function reviseStoryboard(id, action, storyboard, updatedAt) {
  return api(`/api/jobs/${encodeURIComponent(id)}/revise`, {
    method: "POST",
    body: { action, storyboard, expected_updated_at: updatedAt },
  });
}

export function renderStoryboard(id, storyboard, updatedAt) {
  return api(`/api/jobs/${encodeURIComponent(id)}/render`, {
    method: "POST",
    body: { storyboard, expected_updated_at: updatedAt },
  });
}

export function redraftStoryboard(id, action) {
  return api(`/api/jobs/${encodeURIComponent(id)}/redraft`, {
    method: "POST",
    body: action ? { action } : {},
  });
}

export function retryCampaignDraft(id, updatedAt) {
  return api(`/api/jobs/${encodeURIComponent(id)}/draft`, {
    method: "POST",
    body: { expected_updated_at: updatedAt },
  });
}

export function approveJob(id) {
  return api(`/api/jobs/${encodeURIComponent(id)}/approve`, {
    method: "POST",
  });
}

export function denyJob(id) {
  return api(`/api/jobs/${encodeURIComponent(id)}/deny`, {
    method: "POST",
  });
}

export function cancelJob(id) {
  return api(`/api/jobs/${encodeURIComponent(id)}/cancel`, {
    method: "POST",
  });
}

// Images and videos remain account-owned, so media requests carry the same
// authentication as JSON requests and are displayed through local blob URLs.
export async function fetchPrivateMedia(path, signal) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(apiUrl(path), { headers, signal });
  if (!res.ok) {
    const err = new Error(await parseError(res));
    err.status = res.status;
    throw err;
  }
  return res.blob();
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

export async function fetchSchedules() {
  return api("/api/schedules");
}

export async function createSchedule(payload) {
  return api("/api/schedules", {
    method: "POST",
    body: payload,
  });
}

export async function updateSchedule(id, payload) {
  return api(`/api/schedules/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: payload,
  });
}

export async function toggleSchedule(id) {
  return api(`/api/schedules/${encodeURIComponent(id)}/toggle`, {
    method: "POST",
  });
}

export async function runScheduleNow(id) {
  return api(`/api/schedules/${encodeURIComponent(id)}/run-now`, {
    method: "POST",
  });
}

export async function deleteSchedule(id) {
  return api(`/api/schedules/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}
