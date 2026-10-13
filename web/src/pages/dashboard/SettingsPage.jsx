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
import {
  Button,
  FormField,
  Input,
  Panel,
  StatCard,
  Textarea,
} from "../../components/ui";
import { notify } from "../../toast";

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
  async function load() {
    setLoading(true);
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
      notify.error(String(err.message || err));
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
      notify.success("Facebook Page connected.");
      load();
    } else if (fb === "pick") {
      notify.info("Choose which Facebook Page to publish to.");
      load();
    } else if (fb === "error") {
      notify.error(searchParams.get("message") || "Facebook Login failed.");
    }
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(ev) {
    ev.preventDefault();
    setSaving(true);
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
      setStatus(data.integrations || {});
      notify.success("Integrations saved.");
      setForm((prev) => ({
        ...prev,
        telegram_bot_token: "",
        gemini_api_keys: "",
        clear_telegram_bot_token: false,
        clear_gemini_api_keys: false,
      }));
    } catch (err) {
      notify.error(String(err.message || err));
    } finally {
      setSaving(false);
    }
  }

  async function onConnectFacebook() {
    setConnectingFb(true);
    try {
      const { auth_url } = await startFacebookConnect();
      window.location.href = auth_url;
    } catch (err) {
      notify.error(String(err.message || err));
      setConnectingFb(false);
    }
  }

  async function onDisconnectFacebook() {
    if (!confirm("Disconnect your Facebook Page?")) return;
    setSaving(true);
    try {
      await disconnectFacebook();
      notify.success("Facebook disconnected.");
      await load();
    } catch (err) {
      notify.error(String(err.message || err));
    } finally {
      setSaving(false);
    }
  }

  async function onSelectPage(pageId) {
    setSaving(true);
    try {
      await selectFacebookPage(pageId);
      notify.success("Page selected.");
      setPendingPages([]);
      await load();
    } catch (err) {
      notify.error(String(err.message || err));
    } finally {
      setSaving(false);
    }
  }

  const ready = {
    telegram: Boolean(status?.telegram_ready),
    gemini: Boolean(status?.gemini_api_keys_set),
    facebook: Boolean(status?.facebook_connected),
  };

  const oauthReady = Boolean(facebookOauth?.oauth_configured);

  return (
    <div className="dash-page">
      {loading ? <p className="empty-panel">Loading…</p> : null}

      {!loading ? (
        <>
          <div className="overview-stats settings-ready">
            <StatCard
              label="Telegram"
              value={ready.telegram ? "Ready" : "Needed"}
              icon="send"
              tone={ready.telegram ? "green" : "amber"}
            />
            <StatCard
              label="Gemini"
              value={ready.gemini ? "Ready" : "Needed"}
              icon="sparkles"
              tone={ready.gemini ? "green" : "amber"}
            />
            <StatCard
              label="Facebook"
              value={ready.facebook ? "Ready" : "Optional"}
              icon="globe"
              tone={ready.facebook ? "green" : "blue"}
            />
            <StatCard
              label="NotebookLM"
              value={notebooklm?.server_authenticated ? "Server OK" : "Server login"}
              icon="video"
              tone={notebooklm?.server_authenticated ? "green" : "violet"}
            />
          </div>

          <form className="settings-form" onSubmit={onSubmit}>
            <Panel
              kicker="Telegram"
              title="Bot + your user ID"
              subtitle="Create a bot with @BotFather. Get your numeric ID from @userinfobot. Then open your bot and tap Start so it can message you."
            >
              <div className="settings-grid">
                <FormField
                  label={
                    <>
                      Bot token{" "}
                      {status?.telegram_bot_token_set ? "(saved — leave blank to keep)" : ""}
                    </>
                  }
                >
                  <Input
                    type="password"
                    autoComplete="off"
                    value={form.telegram_bot_token}
                    onChange={(ev) => setField("telegram_bot_token", ev.target.value)}
                    placeholder="123456:ABC..."
                  />
                </FormField>
                <FormField label="Your Telegram user ID" required>
                  <Input
                    type="number"
                    required
                    value={form.telegram_user_id}
                    onChange={(ev) => setField("telegram_user_id", ev.target.value)}
                    placeholder="1099911298"
                  />
                </FormField>
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
            </Panel>

            <Panel kicker="Gemini" title="AI keys">
              <div className="settings-grid">
                <FormField
                  label={
                    <>
                      API keys (comma-separated){" "}
                      {status?.gemini_api_keys_set ? "(saved — leave blank to keep)" : ""}
                    </>
                  }
                >
                  <Textarea
                    rows={2}
                    value={form.gemini_api_keys}
                    onChange={(ev) => setField("gemini_api_keys", ev.target.value)}
                    placeholder="key_one,key_two"
                  />
                </FormField>
                <FormField label="Model (optional)">
                  <Input
                    type="text"
                    value={form.gemini_model}
                    onChange={(ev) => setField("gemini_model", ev.target.value)}
                    placeholder="gemini-flash-lite-latest"
                  />
                </FormField>
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
            </Panel>

            <Panel
              kicker="Facebook"
              title="Connect a Page"
              subtitle="Log in with Facebook and choose a Page you manage. No App ID / token paste needed on your side."
            >
              {status?.facebook_connected ? (
                <div className="fb-connected">
                  <p>
                    Connected to <strong>{status.facebook_page_name || "Facebook Page"}</strong>
                    {status.facebook_page_id ? (
                      <span className="job-meta"> · ID {status.facebook_page_id}</span>
                    ) : null}
                  </p>
                  <div className="settings-actions">
                    <Button
                      variant="primary"
                      size="sm"
                      disabled={connectingFb}
                      loading={connectingFb}
                      onClick={onConnectFacebook}
                    >
                      Reconnect
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={saving}
                      onClick={onDisconnectFacebook}
                    >
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="settings-actions">
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!oauthReady || connectingFb}
                    loading={connectingFb}
                    loadingText="Opening Facebook…"
                    onClick={onConnectFacebook}
                  >
                    Continue with Facebook
                  </Button>
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
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={saving}
                          onClick={() => onSelectPage(page.id)}
                        >
                          {page.name}
                        </Button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </Panel>

            <Panel
              kicker="NotebookLM"
              title="Video engine"
              subtitle={
                notebooklm?.note ||
                "NotebookLM login is shared on the server for now (Google browser cookies)."
              }
            >
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
            </Panel>

            <div className="compose-actions">
              <Button
                type="submit"
                variant="primary"
                size="md"
                icon="check"
                disabled={saving}
                loading={saving}
                loadingText="Saving…"
              >
                Save integrations
              </Button>
            </div>
          </form>
        </>
      ) : null}
    </div>
  );
}
