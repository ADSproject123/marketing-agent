import { TEMPLATES } from "../templates";

export default function ComposeForm({
  templateId,
  brief,
  urls,
  notes,
  starting,
  startStatus,
  startStatusClass,
  onTemplateChange,
  onBriefChange,
  onUrlsChange,
  onNotesChange,
  onStart,
}) {
  return (
    <section className="panel compose" aria-labelledby="compose-title">
      <div className="panel-head">
        <div>
          <p className="panel-kicker">Workspace</p>
          <h2 id="compose-title">Campaign brief</h2>
        </div>
        <p className="panel-note">
          Templates prefill the brief. Leave sources blank if Gemini should invent them.
        </p>
      </div>

      <form className="compose-form" onSubmit={onStart}>
        <fieldset className="template-field">
          <legend>Template</legend>
          <div className="template-grid" role="listbox" aria-label="Campaign templates">
            {TEMPLATES.map((t) => {
              const selected = templateId === t.id;
              return (
                <button
                  key={t.id || "custom"}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`template-card ${selected ? "is-selected" : ""}`}
                  onClick={() => onTemplateChange(t.id)}
                >
                  <span className="template-card-label">{t.label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="field">
          <span>Brief</span>
          <textarea
            rows={3}
            value={brief}
            onChange={(ev) => onBriefChange(ev.target.value)}
            placeholder="What should this short video sell or say?"
          />
        </label>

        <label className="field">
          <span>Source URLs (optional, one per line)</span>
          <textarea
            rows={3}
            value={urls}
            onChange={(ev) => onUrlsChange(ev.target.value)}
            placeholder="https://example.com/sale"
          />
        </label>

        <label className="field">
          <span>Extra notes (optional)</span>
          <textarea
            rows={2}
            value={notes}
            onChange={(ev) => onNotesChange(ev.target.value)}
            placeholder="Tone, offer details, must-include lines…"
          />
        </label>

        <div className="compose-actions">
          <button type="submit" className="primary-btn" disabled={starting}>
            {starting ? "Starting…" : "Start job"}
          </button>
          <p className={`compose-status ${startStatusClass}`} aria-live="polite">
            {startStatus}
          </p>
        </div>
      </form>
    </section>
  );
}
