import { CAMPAIGN_ASSET_LIMITS } from "../../campaign";
import { TEMPLATES } from "../../templates";
import Icon from "../Icon";
import { ChoiceGroup } from "./FormBits";
import { STYLES, TEMPLATE_ICONS, VIDEO_LENGTHS } from "./constants";

export default function StepStyle({
  draft, change, fieldProps, onDraftChange, errors, assets, assetPreviews, busy,
}) {
  return (
    <>
      <ChoiceGroup name="style" label="Video personality" options={STYLES} value={draft.style} onChange={(value) => onDraftChange("style", value)} />
      <ChoiceGroup
        name="videoLength"
        label="How long should the video be?"
        options={VIDEO_LENGTHS}
        value={draft.videoLength || "30"}
        onChange={(value) => onDraftChange("videoLength", value)}
        compact
      />
      <fieldset className="campaign-language" aria-describedby="campaign-language-hint">
        <legend>Campaign language</legend>
        <div className="campaign-language-options">
          <label className="campaign-language-option"><input type="radio" name="language" value="en" checked={draft.language === "en"} onChange={change("language")} /><span>English</span></label>
          <label className="campaign-language-option"><input type="radio" name="language" value="km" checked={draft.language === "km"} onChange={change("language")} /><span>Khmer <span className="campaign-language-native" lang="km">ខ្មែរ</span></span></label>
        </div>
        <p className="field-hint" id="campaign-language-hint">The language for your captions, script, and video.</p>
      </fieldset>
      <fieldset className="template-field" aria-describedby="campaign-template-hint">
        <legend>Predefined creative angle</legend>
        <div className="template-grid" role="listbox" aria-label="Campaign templates">
          {TEMPLATES.map((item) => {
            const selected = draft.templateId === item.id;
            const description = item.id === "auto_gemini"
              ? "Gemini invents the creative from your business details."
              : item.id === ""
                ? "No preset — we’ll shape the angle from your answers."
                : (item.brief || item.notes || "").slice(0, 90) + ((item.brief || item.notes || "").length > 90 ? "…" : "");
            return (
              <button
                key={item.id || "custom"}
                type="button"
                role="option"
                aria-selected={selected}
                className={`template-card ${selected ? "is-selected" : ""}`}
                onClick={() => onDraftChange("templateId", item.id)}
              >
                <span className="template-card-icon" aria-hidden="true">
                  <Icon name={TEMPLATE_ICONS[item.id] || "layers"} size={18} />
                </span>
                <span className="template-card-copy">
                  <span className="template-card-label">{item.label}</span>
                  <span className="template-card-description">{description}</span>
                </span>
                {selected ? <span className="template-card-check" aria-hidden="true"><Icon name="check" size={14} /></span> : null}
              </button>
            );
          })}
        </div>
        <p className="field-hint" id="campaign-template-hint">Pick a preset or leave “Custom” / “Choose for me” and we’ll adapt to your details.</p>
      </fieldset>
      <label className="field"><span>Anything else we should know? <span className="campaign-optional">Optional</span></span><textarea {...fieldProps("extraNotes")} value={draft.extraNotes} onChange={change("extraNotes")} maxLength={500} rows={3} placeholder="Brand colors, words to avoid, or an important detail to include." /></label>
      <label className="field"><span>Source links <span className="campaign-optional">Optional</span></span><textarea {...fieldProps("urls")} value={draft.urls} onChange={change("urls")} maxLength={5000} rows={2} placeholder="https://yourbrand.com/product" /><span className="field-hint">Add up to 10 URLs, one per line, for product information or inspiration.</span></label>
      <div className="field campaign-assets-field">
        <span>Logo & product photos <span className="campaign-optional">Optional</span></span>
        <label className={`campaign-assets-picker ${errors.assets ? "is-invalid" : ""}`}>
          <input
            {...fieldProps("assets")}
            type="file"
            accept={CAMPAIGN_ASSET_LIMITS.accept.join(",")}
            multiple
            disabled={busy}
            onChange={(event) => {
              const selected = Array.from(event.target.files || []);
              const next = [...assets, ...selected].slice(0, CAMPAIGN_ASSET_LIMITS.maxFiles);
              onDraftChange("assets", next);
              event.target.value = "";
            }}
          />
          <span className="campaign-assets-picker-copy">
            <strong>Upload brand images</strong>
            <span>PNG, JPG, or WEBP · up to {CAMPAIGN_ASSET_LIMITS.maxFiles} files · 5 MB each</span>
          </span>
        </label>
        {assetPreviews.length ? (
          <ul className="campaign-assets-list">
            {assetPreviews.map((item, index) => (
              <li key={`${item.file.name}-${item.file.size}-${index}`}>
                <img src={item.url} alt="" />
                <span>{item.file.name}</span>
                <button
                  type="button"
                  className="ghost-btn campaign-assets-remove"
                  disabled={busy}
                  onClick={() => onDraftChange("assets", assets.filter((_, i) => i !== index))}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <span className="field-hint">NotebookLM will use these photos and logo when generating your video.</span>
      </div>
    </>
  );
}
