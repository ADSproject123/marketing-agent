import { TEMPLATES } from "../templates";
import Icon from "./Icon";

const TEMPLATE_DETAILS = {
  "": { label: "Start from scratch", icon: "file", description: "Your idea, your direction" },
  weekend_sale: { icon: "bolt", description: "Turn an offer into attention" },
  product_launch: { icon: "sparkles", description: "Introduce something new" },
  local_cafe: { label: "Food & drink", icon: "globe", description: "Bring your local story to life" },
  app_feature: { label: "App & feature", icon: "layers", description: "Show what makes it useful" },
  seasonal: { label: "Seasonal campaign", icon: "clock", description: "Make the most of the moment" },
  auto_gemini: { label: "Surprise me", icon: "sparkles", description: "Let AI create a fresh concept" },
};

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
          <p className="panel-kicker">Campaign builder</p>
          <h2 id="compose-title">Make your next great campaign</h2>
        </div>
        <p className="panel-note">
          A little direction is all you need. We’ll handle the creative work.
        </p>
      </div>

      <form className="compose-form" onSubmit={onStart}>
        <fieldset className="template-field">
          <legend className="form-section-head">
            <span className="form-section-number">1</span>
            Choose a starting point
          </legend>
          <div className="template-grid" aria-label="Campaign templates">
            {TEMPLATES.map((t) => {
              const selected = templateId === t.id;
              const details = TEMPLATE_DETAILS[t.id] || TEMPLATE_DETAILS[""];
              return (
                <button
                  key={t.id || "custom"}
                  type="button"
                  aria-pressed={selected}
                  className={`template-card ${selected ? "is-selected" : ""}`}
                  onClick={() => onTemplateChange(t.id)}
                >
                  <span className="template-card-icon"><Icon name={details.icon} size={19} /></span>
                  <span className="template-card-copy">
                    <span className="template-card-label">{details.label || t.label}</span>
                    <span className="template-card-description">{details.description}</span>
                  </span>
                  <span className="template-card-check" aria-hidden="true">
                    {selected ? <Icon name="check" size={13} /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="field">
          <span className="form-section-head" id="campaign-brief-label">
            <span className="form-section-number">2</span>
            Tell us about your campaign
          </span>
          <span className="field-hint" id="campaign-brief-hint">What are you promoting, and who should see it?</span>
          <textarea
            aria-labelledby="campaign-brief-label"
            aria-describedby="campaign-brief-hint"
            rows={4}
            value={brief}
            onChange={(ev) => onBriefChange(ev.target.value)}
            placeholder="For example: Introduce our new summer collection to young professionals. Highlight comfort, versatility, and our launch offer."
          />
        </label>

        <div className="compose-fields">
          <label className="field">
            <span className="field-label" id="campaign-sources-label">Source links <span>Optional</span></span>
            <textarea
              aria-labelledby="campaign-sources-label"
              aria-describedby="campaign-sources-hint"
              rows={3}
              value={urls}
              onChange={(ev) => onUrlsChange(ev.target.value)}
              placeholder="https://yourbrand.com/product"
            />
            <span className="field-hint" id="campaign-sources-hint">Add one URL per line, or leave blank for AI-generated sources.</span>
          </label>

          <label className="field">
            <span className="field-label" id="campaign-notes-label">Creative direction <span>Optional</span></span>
            <textarea
              aria-labelledby="campaign-notes-label"
              aria-describedby="campaign-notes-hint"
              rows={3}
              value={notes}
              onChange={(ev) => onNotesChange(ev.target.value)}
              placeholder="Brand voice, offer details, or anything we should include…"
            />
            <span className="field-hint" id="campaign-notes-hint">Help shape the tone, message, and call to action.</span>
          </label>
        </div>

        <div className="compose-actions">
          <button type="submit" className="primary-btn" disabled={starting}>
            <Icon name="sparkles" size={17} />
            {starting ? "Creating campaign…" : "Generate campaign"}
            {!starting ? <Icon name="arrow-right" size={16} /> : null}
          </button>
          <p className="compose-submit-note"><Icon name="shield" size={14} /> You review before anything publishes.</p>
        </div>
        {startStatus ? (
          <p className={`compose-status ${startStatusClass}`} role={startStatusClass === "is-err" ? "alert" : "status"}>
            {startStatus}
          </p>
        ) : null}
      </form>
    </section>
  );
}
