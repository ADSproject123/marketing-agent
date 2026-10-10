import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  disconnectFacebook,
  fetchIntegrations,
  saveIntegrations,
  selectFacebookPage,
  startFacebookConnect,
} from "../../api";
import Icon from "../../components/Icon";

const EMPTY = {
  telegram_bot_token: "",
  telegram_user_id: "",
  gemini_api_keys: "",
  gemini_model: "",
  skip_notebooklm: false,
  clear_telegram_bot_token: false,
  clear_gemini_api_keys: false,
};

export default function SettingsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connectingFb, setConnectingFb] = useState(false);
  const [status, setStatus] = useState(null);
  const [notebooklm, setNotebooklm] = useState(null);
  const [facebookOauth, setFacebookOauth] = useState(null);
  const [pendingPages, setPendingPages] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchIntegrations();
      const integ = data.integrations || {};
      setStatus(integ);
      setNotebooklm(data.notebooklm || null);
      setFacebookOauth(data.facebook_oauth || null);
      setPendingPages(data.facebook_oauth?.pending_pages || []);
      setForm((prev) => ({
        ...prev,
        telegram_user_id: integ.telegram_user_id ?? "",
        gemini_model: integ.gemini_model || "",
        skip_notebooklm: Boolean(integ.skip_notebooklm),
        telegram_bot_token: "",
        gemini_api_keys: "",
        clear_telegram_bot_token: false,
        clear_gemini_api_keys: false,
      }));
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    const fb = searchParams.get("facebook");
    if (!fb) return;
    if (fb === "connected") {
      setMessage("Facebook Page connected.");
      load();
    } else if (fb === "pick") {
      setMessage("Choose which Facebook Page to publish to.");
      load();
    } else if (fb === "error") {
      setError(searchParams.get("message") || "Facebook Login failed.");
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(ev) {
    ev.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const payload = {
        telegram_user_id:
          form.telegram_user_id === "" || form.telegram_user_id === null
            ? null
            : Number(form.telegram_user_id),
        gemini_model: form.gemini_model || null,
        skip_notebooklm: Boolean(form.skip_notebooklm),
        clear_telegram_bot_token: form.clear_telegram_bot_token,
        clear_gemini_api_keys: form.clear_gemini_api_keys,
      };
      if (form.telegram_bot_token.trim()) {
        payload.telegram_bot_token = form.telegram_bot_token.trim();
      }
      if (form.gemini_api_keys.trim()) {
        payload.gemini_api_keys = form.gemini_api_keys.trim();
      }
      const data = await saveIntegrations(payload);
      setStatus(data.integrations);
      setMessage(data.message || "Saved.");
      setForm((prev) => ({
        ...prev,
        telegram_bot_token: "",
        gemini_api_keys: "",
        clear_telegram_bot_token: false,
        clear_gemini_api_keys: false,
      }));
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setSaving(false);
    }
  }

  async function onConnectFacebook() {
    setConnectingFb(true);
    setError("");
    setMessage("");
    try {
      const data = await startFacebookConnect();
      window.location.href = data.url;
    } catch (err) {
      setError(String(err.message || err));
      setConnectingFb(false);
    }
  }

  async function onSelectPage(pageId) {
    setSaving(true);
    setError("");
    try {
      const data = await selectFacebookPage(pageId);
      setStatus(data.integrations);
      setPendingPages([]);
      setMessage(data.message || "Page connected.");
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setSaving(false);
    }
  }

  async function onDisconnectFacebook() {
    setSaving(true);
    setError("");
    try {
      const data = await disconnectFacebook();
      setStatus((prev) => ({ ...prev, ...data.integrations }));
      setPendingPages([]);
      setMessage(data.message || "Facebook disconnected.");
      await load();
    } catch (err) {
      setError(String(err.message || err));
    } finally {
      setSaving(false);
    }
  }

  const ready = status?.ready || {};
  const oauthReady = Boolean(facebookOauth?.configured);

  return (
    <div className="dash-page">
      <header className="dash-page-head">
        <div>
          <p className="panel-kicker">Account</p>
          <h1>Integrations</h1>
          <p className="dash-page-lede">
            Connect Telegram, Gemini, and Facebook. Facebook uses Login — no pasting
            Page tokens. Other secrets stay encrypted after you save.
          </p>
        </div>
      </header>

      {loading ? <p className="empty-panel">Loading settings…</p> : null}
      {error ? <p className="auth-error">{error}</p> : null}
      {message ? <p className="compose-status is-ok">{message}</p> : null}

      {!loading ? (
        <>
          <div className="overview-stats settings-ready">
            <article className={`overview-stat ${ready.telegram ? "is-ready" : ""}`}>
              <p className="overview-stat-label">Telegram</p>
              <p className="overview-stat-value">{ready.telegram ? "Ready" : "Needed"}</p>
            </article>
            <article className={`overview-stat ${ready.gemini ? "is-ready" : ""}`}>
              <p className="overview-stat-label">Gemini</p>
              <p className="overview-stat-value">{ready.gemini ? "Ready" : "Needed"}</p>
            </article>
            <article className={`overview-stat ${ready.facebook ? "is-ready" : ""}`}>
              <p className="overview-stat-label">Facebook</p>
              <p className="overview-stat-value">{ready.facebook ? "Ready" : "Optional"}</p>
            </article>
            <article className="overview-stat">
              <p className="overview-stat-label">NotebookLM</p>
              <p className="overview-stat-value">
                {notebooklm?.server_authenticated ? "Server OK" : "Server login"}
              </p>
            </article>
          </div>

          <form className="settings-form" onSubmit={onSubmit}>
            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="panel-kicker">Telegram</p>
                  <h2>Bot + your user ID</h2>
                </div>
              </div>
              <p className="panel-note settings-inline-note">
                Create a bot with @BotFather. Get your numeric ID from @userinfobot. Then
                open your bot and tap Start so it can message you.
              </p>
              <div className="settings-grid">
                <label className="field">
                  <span>
                    Bot token{" "}
                    {status?.telegram_bot_token_set ? "(saved — leave blank to keep)" : ""}
                  </span>
                  <input
                    type="password"
                    autoComplete="off"
                    value={form.telegram_bot_token}
                    onChange={(ev) => setField("telegram_bot_token", ev.target.value)}
                    placeholder="123456:ABC..."
                  />
                </label>
                <label className="field">
                  <span>Your Telegram user ID</span>
                  <input
                    type="number"
                    required
                    value={form.telegram_user_id}
                    onChange={(ev) => setField("telegram_user_id", ev.target.value)}
                    placeholder="1099911298"
                  />
                </label>
              </div>
              {status?.telegram_bot_token_set ? (
                <label className="settings-check">
                  <input
                    type="checkbox"
                    checked={form.clear_telegram_bot_token}
                    onChange={(ev) => setField("clear_telegram_bot_token", ev.target.checked)}
                  />
                  Clear saved bot token
                </label>
              ) : null}
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="panel-kicker">Gemini</p>
                  <h2>AI keys</h2>
                </div>
              </div>
              <div className="settings-grid">
                <label className="field">
                  <span>
                    API keys (comma-separated){" "}
                    {status?.gemini_api_keys_set ? "(saved — leave blank to keep)" : ""}
                  </span>
                  <textarea
                    rows={2}
                    value={form.gemini_api_keys}
                    onChange={(ev) => setField("gemini_api_keys", ev.target.value)}
                    placeholder="key_one,key_two"
                  />
                </label>
                <label className="field">
                  <span>Model (optional)</span>
                  <input
                    type="text"
                    value={form.gemini_model}
                    onChange={(ev) => setField("gemini_model", ev.target.value)}
                    placeholder="gemini-flash-lite-latest"
                  />
                </label>
              </div>
              {status?.gemini_api_keys_set ? (
                <label className="settings-check">
                  <input
                    type="checkbox"
                    checked={form.clear_gemini_api_keys}
                    onChange={(ev) => setField("clear_gemini_api_keys", ev.target.checked)}
                  />
                  Clear saved Gemini keys
                </label>
              ) : null}
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="panel-kicker">Facebook</p>
                  <h2>Connect a Page</h2>
                </div>
              </div>
              <p className="panel-note settings-inline-note">
                Log in with Facebook and choose a Page you manage. No App ID / token paste
                needed on your side.
              </p>

              {status?.facebook_connected ? (
                <div className="fb-connected">
                  <p>
                    Connected to <strong>{status.facebook_page_name || "Facebook Page"}</strong>
                    {status.facebook_page_id ? (
                      <span className="job-meta"> · ID {status.facebook_page_id}</span>
                    ) : null}
                  </p>
                  <div className="hero-actions">
                    <button
                      type="button"
                      className="primary-btn"
                      disabled={connectingFb}
                      onClick={onConnectFacebook}
                    >
                      {connectingFb ? "Opening Facebook…" : "Reconnect"}
                    </button>
                    <button
                      type="button"
                      className="ghost-btn"
                      disabled={saving}
                      onClick={onDisconnectFacebook}
                    >
                      Disconnect
                    </button>
                  </div>
                </div>
              ) : (
                <div className="hero-actions">
                  <button
                    type="button"
                    className="primary-btn"
                    disabled={!oauthReady || connectingFb}
                    onClick={onConnectFacebook}
                  >
                    {connectingFb ? "Opening Facebook…" : "Continue with Facebook"}
                  </button>
                </div>
              )}

              {!oauthReady ? (
                <p className="jobs-note" style={{ marginTop: "0.85rem" }}>
                  Server needs <code>FACEBOOK_APP_ID</code> + <code>FACEBOOK_APP_SECRET</code>{" "}
                  in <code>.env</code>, and this redirect URI in Meta app settings:
                  <br />
                  <code>http://127.0.0.1:8787/api/integrations/facebook/callback</code>
                </p>
              ) : null}

              {pendingPages.length > 0 ? (
                <div className="fb-page-picker">
                  <p className="panel-kicker">Choose a Page</p>
                  <ul className="fb-page-list">
                    {pendingPages.map((page) => (
                      <li key={page.id}>
                        <button
                          type="button"
                          className="ghost-btn"
                          disabled={saving}
                          onClick={() => onSelectPage(page.id)}
                        >
                          {page.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>

            <section className="panel">
              <div className="panel-head">
                <div>
                  <p className="panel-kicker">NotebookLM</p>
                  <h2>Video engine</h2>
                </div>
              </div>
              <p className="jobs-note">
                {notebooklm?.note ||
                  "NotebookLM login is shared on the server for now (Google browser cookies)."}
              </p>
              <p className="job-meta">
                Server auth:{" "}
                {notebooklm?.server_authenticated ? "authenticated" : "not authenticated"}
              </p>
              <label className="settings-check">
                <input
                  type="checkbox"
                  checked={form.skip_notebooklm}
                  onChange={(ev) => setField("skip_notebooklm", ev.target.checked)}
                />
                Skip NotebookLM video (caption / Telegram test only)
              </label>
            </section>

            <div className="compose-actions">
              <button type="submit" className="primary-btn" disabled={saving}>
                <Icon name="check" size={18} />
                {saving ? "Saving…" : "Save integrations"}
              </button>
            </div>
          </form>
        </>
      ) : null}
    </div>
  );
}
