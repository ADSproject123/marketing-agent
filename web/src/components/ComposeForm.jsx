import { useEffect, useMemo, useRef } from "react";
import { CAMPAIGN_ASSET_LIMITS } from "../campaign";
import { TEMPLATES } from "../templates";
import Icon from "./Icon";

const STEPS = ["Business", "Audience", "Offer & action", "Video style", "Review"];
const STEP_COPY = [
  ["What would you like to promote?", "Start with your shop, product, or service. We’ll save these details so your next campaign is easier."],
  ["Who should this campaign reach?", "Tell us who your customers are and what you want this video to achieve."],
  ["What should viewers do next?", "Give your campaign one clear action. Add an offer if you have one."],
  ["How should your video feel?", "Choose the language and personality that fit your brand."],
  ["Review your campaign", "Check the details below. Next, you can choose an opening and edit the script before generating your video."],
];
const FORM_COPY = [
  "Business details",
  "Tell us about the shop, product, or service you want to promote.",
];
const KINDS = [
  { value: "shop", label: "Shop", detail: "A place people visit", icon: "grid" },
  { value: "product", label: "Product", detail: "Something you sell", icon: "layers" },
  { value: "service", label: "Service", detail: "Something you do", icon: "user" },
  { value: "other", label: "Something else", detail: "An idea, event, or project", icon: "sparkles" },
];
const GOALS = [
  { value: "awareness", label: "Get discovered", detail: "Introduce your business to more people", icon: "globe" },
  { value: "sales", label: "Drive sales", detail: "Turn interest into visits or purchases", icon: "bolt" },
  { value: "launch", label: "Launch something new", detail: "Build excitement for a new offering", icon: "sparkles" },
];
const STYLES = [
  { value: "warm", label: "Warm & friendly", detail: "Personal, welcoming, and natural", icon: "user" },
  { value: "bold", label: "Bold & energetic", detail: "A strong hook and lively pacing", icon: "bolt" },
  { value: "clean", label: "Clean & modern", detail: "Clear, polished, and focused", icon: "layers" },
];
const CTA_LABELS = { visit: "Visit the shop", message: "Send a message", buy: "Buy or order", learn: "Learn more" };
const DESTINATION_COPY = {
  visit: ["Where should people visit?", "Shop address or directions"],
  message: ["Where should people message you?", "Phone number, Telegram, or Facebook Page"],
  buy: ["Where should people buy or order?", "Shop link, order number, or address"],
  learn: ["Where can people learn more?", "Website or social media link"],
};
const TEMPLATE_ICONS = {
  "": "layers",
  weekend_sale: "bolt",
  product_launch: "sparkles",
  local_cafe: "grid",
  app_feature: "activity",
  seasonal: "globe",
  auto_gemini: "sparkles",
};

function ChoiceGroup({ name, label, options, value, onChange, compact = false }) {
  return (
    <fieldset className={`campaign-choice-field ${compact ? "is-compact" : ""}`}>
      <legend>{label}</legend>
      <div className="campaign-choice-grid">
        {options.map((option) => (
          <label key={option.value} className={`campaign-choice ${value === option.value ? "is-selected" : ""}`}>
            <input type="radio" name={name} value={option.value} checked={value === option.value} onChange={(event) => onChange(event.target.value)} />
            <span className="campaign-choice-icon"><Icon name={option.icon} size={18} /></span>
            <span className="campaign-choice-copy"><strong>{option.label}</strong><span>{option.detail}</span></span>
            <span className="campaign-choice-check" aria-hidden="true">{value === option.value ? <Icon name="check" size={12} /> : null}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function ReviewSection({ title, editLabel, onEdit, children }) {
  return (
    <section className="campaign-review-section">
      <div className="campaign-review-head"><h3>{title}</h3><button type="button" className="campaign-edit-btn" onClick={onEdit} aria-label={editLabel}>Edit <Icon name="arrow-up-right" size={12} /></button></div>
      <dl>{children}</dl>
    </section>
  );
}

function ReviewDetail({ label, value }) {
  return value ? <div><dt>{label}</dt><dd>{value}</dd></div> : null;
}

export default function ComposeForm({
  draft, step, businessView = "list", onBusinessViewChange, promotions, profilesLoading,
  savingPromotion, profileError, errors = {}, starting, startStatus, startStatusClass,
  onDraftChange, onPromotionSelect, onDemoSelect, onSubmit, onBack, onEditStep,
}) {
  const headingRef = useRef(null);
  const formRef = useRef(null);
  const previousStep = useRef(step);
  const setBusinessView = onBusinessViewChange || (() => {});
  const busy = savingPromotion || starting;
  const showingBusinessList = step === 0 && businessView === "list";
  const change = (field) => (event) => onDraftChange(field, event.target.value);
  const fieldProps = (field) => ({ name: field, "aria-invalid": errors[field] ? true : undefined, "aria-describedby": errors[field] ? `campaign-error-${field}` : undefined });
  const [title, description] = step === 0 ? FORM_COPY : STEP_COPY[step];
  const destinationCopy = DESTINATION_COPY[draft.cta] || DESTINATION_COPY.visit;
  const destinationRequired = draft.cta === "visit" ? !draft.location.trim() : !draft.website.trim();
  const template = TEMPLATES.find((item) => item.id === draft.templateId);
  const assets = Array.isArray(draft.assets) ? draft.assets : [];
  const assetPreviews = useMemo(
    () => assets.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [assets],
  );

  useEffect(() => {
    if (previousStep.current !== step) {
      // After a finished campaign, return to the picker list.
      if (step === 0 && previousStep.current === 4) setBusinessView("list");
      headingRef.current?.focus();
      previousStep.current = step;
    }
  }, [step]);

  useEffect(() => {
    if (step !== 0) return;
    if (Object.keys(errors).length || profileError) setBusinessView("form");
  }, [step, errors, profileError]);

  useEffect(() => () => {
    for (const item of assetPreviews) URL.revokeObjectURL(item.url);
  }, [assetPreviews]);

  useEffect(() => {
    const firstError = Object.keys(errors)[0];
    if (firstError) {
      const field = formRef.current?.elements.namedItem(firstError);
      if (field?.focus) field.focus();
      else formRef.current?.querySelector(`input[name="${firstError}"]`)?.focus();
    }
  }, [errors]);

  const openBusinessForm = (promotionId = "") => {
    onPromotionSelect(promotionId);
    setBusinessView("form");
  };

  const handleBack = () => {
    if (showingBusinessList) return;
    if (step === 0 && businessView === "form") {
      setBusinessView("list");
      onPromotionSelect("");
      return;
    }
    if (step === 1) setBusinessView("form");
    onBack();
  };

  const handleSubmit = (event) => {
    if (showingBusinessList) {
      event.preventDefault();
      return;
    }
    onSubmit(event);
  };

  const handleEditStep = (nextStep) => {
    if (nextStep === 0) setBusinessView("form");
    onEditStep(nextStep);
  };

  if (showingBusinessList) {
    return (
      <section className="panel compose campaign-picker" aria-labelledby="compose-title">
        <div className="campaign-picker-head">
          <div>
            <h2 id="compose-title" ref={headingRef} tabIndex={-1}>Saved businesses & products</h2>
            <p>Select a row to continue, or create a new one.</p>
          </div>
          <button
            type="button"
            className="primary-btn"
            onClick={() => openBusinessForm("")}
            disabled={busy || profilesLoading}
          >
            <Icon name="sparkles" size={16} />
            Create new
          </button>
        </div>

        <div className="campaign-table-wrap">
          {profilesLoading ? (
            <p className="campaign-saved-status" role="status">Loading your saved profiles…</p>
          ) : promotions.length === 0 ? (
            <div className="campaign-table-empty">
              <p>No saved businesses yet.</p>
              <button
                type="button"
                className="primary-btn"
                onClick={() => openBusinessForm("")}
                disabled={busy}
              >
                <Icon name="sparkles" size={16} />
                Create new
              </button>
            </div>
          ) : (
            <table className="campaign-table">
              <thead>
                <tr>
                  <th scope="col">Name</th>
                  <th scope="col">Type</th>
                  <th scope="col">Location</th>
                  <th scope="col">Website</th>
                  <th scope="col"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {promotions.map((promotion) => {
                  const kindLabel = KINDS.find((item) => item.value === promotion.kind)?.label || "Business";
                  return (
                    <tr key={promotion.id}>
                      <td>
                        <button
                          type="button"
                          className="campaign-table-name"
                          onClick={() => openBusinessForm(promotion.id)}
                          disabled={busy}
                        >
                          {promotion.name}
                        </button>
                        {promotion.benefit || promotion.description ? (
                          <p className="campaign-table-sub">
                            {(promotion.benefit || promotion.description).slice(0, 90)}
                            {(promotion.benefit || promotion.description).length > 90 ? "…" : ""}
                          </p>
                        ) : null}
                      </td>
                      <td>{kindLabel}</td>
                      <td>{promotion.location || "—"}</td>
                      <td>
                        {promotion.website ? (
                          <span className="campaign-table-link">{promotion.website.replace(/^https?:\/\//, "")}</span>
                        ) : "—"}
                      </td>
                      <td className="campaign-table-action">
                        <button
                          type="button"
                          className="ghost-btn"
                          onClick={() => openBusinessForm(promotion.id)}
                          disabled={busy}
                        >
                          Use
                          <Icon name="arrow-right" size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="panel compose campaign-wizard" aria-labelledby="compose-title">
      <ol className="campaign-stepper" aria-label="Campaign creation steps">
        {STEPS.map((label, index) => (
          <li key={label} className={`${index === step ? "is-current" : ""} ${index < step ? "is-complete" : ""}`} aria-current={index === step ? "step" : undefined}>
            <span className="campaign-step-number" aria-hidden="true">{index < step ? <Icon name="check" size={13} /> : index + 1}</span>
            <span>{label}</span>
          </li>
        ))}
      </ol>

      <div className="campaign-step-head">
        <p className="panel-kicker">Step {step + 1} of {STEPS.length}</p>
        <h2 id="compose-title" ref={headingRef} tabIndex={-1}>{title}</h2>
        <p>{description}</p>
      </div>

      <form className="campaign-wizard-form" onSubmit={handleSubmit} ref={formRef}>
        {Object.keys(errors).length ? <div className="campaign-form-error" role="alert"><p>Please check these details:</p><ul>{Object.entries(errors).map(([field, message]) => <li key={field} id={`campaign-error-${field}`}>{message}</li>)}</ul></div> : null}
        <fieldset className="campaign-step-fields" disabled={busy}>
          {step === 0 && businessView === "form" ? (
            <div className="campaign-profile-form">
              <ChoiceGroup name="kind" label="What are you promoting?" options={KINDS} value={draft.kind} onChange={(value) => onDraftChange("kind", value)} compact />
              <label className="field"><span>Business or product name</span><input {...fieldProps("name")} value={draft.name} onChange={change("name")} required maxLength={120} autoComplete="organization" placeholder="For example: Soriya Coffee" /></label>
              <label className="field"><span>What do you offer?</span><textarea {...fieldProps("description")} value={draft.description} onChange={change("description")} required maxLength={1000} rows={3} placeholder="A neighborhood café serving locally roasted coffee and fresh pastries." /></label>
              <label className="field"><span>Why should someone choose you?</span><textarea {...fieldProps("benefit")} value={draft.benefit} onChange={change("benefit")} required maxLength={500} rows={2} placeholder="Freshly roasted beans, a quiet place to work, and friendly service." /><span className="field-hint">Share a real benefit that makes your offering special.</span></label>
              <div className="campaign-field-pair">
                <label className="field"><span>Location <span className="campaign-optional">Optional</span></span><input {...fieldProps("location")} value={draft.location} onChange={change("location")} maxLength={300} autoComplete="street-address" placeholder="City, neighborhood, or address" /></label>
                <label className="field"><span>Website <span className="campaign-optional">Optional</span></span><input {...fieldProps("website")} value={draft.website} onChange={change("website")} maxLength={500} inputMode="url" autoComplete="url" placeholder="https://yourbrand.com" /></label>
              </div>
              <p className="campaign-save-note"><Icon name="book" size={15} /> {draft.promotionId ? "This saved profile is ready to use." : "Your profile will be saved when you continue."}</p>
              {profileError ? <p className="campaign-form-error" role="alert">{profileError}</p> : null}
            </div>
          ) : null}

          {step === 1 ? (
            <>
              <ChoiceGroup name="goal" label="What is your main goal?" options={GOALS} value={draft.goal} onChange={(value) => onDraftChange("goal", value)} />
              <label className="field"><span>Target audience</span><textarea {...fieldProps("audience")} value={draft.audience} onChange={change("audience")} required maxLength={500} rows={4} placeholder="For example: Students and young professionals in Phnom Penh who want a comfortable place to study or work." /><span className="field-hint">Think about where they live, what they care about, and what they need.</span></label>
              <div className="campaign-tip"><Icon name="sparkles" size={17} /><p>A specific audience helps us create a stronger hook and a message that feels relevant.</p></div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <label className="field"><span>Special offer <span className="campaign-optional">Optional</span></span><textarea {...fieldProps("offer")} value={draft.offer} onChange={change("offer")} maxLength={400} rows={3} placeholder="For example: A free pastry with every large coffee this weekend." /><span className="field-hint">Leave this blank if you’re promoting your business without a special offer.</span></label>
              <label className="field"><span>When is the offer available? <span className="campaign-optional">Optional</span></span><input {...fieldProps("offerTiming")} value={draft.offerTiming} onChange={change("offerTiming")} maxLength={200} placeholder="For example: October 12–14, while supplies last" /></label>
              <label className="field"><span>What should viewers do?</span><select {...fieldProps("cta")} value={draft.cta} onChange={change("cta")}>{Object.entries(CTA_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
              <label className="field"><span>{destinationCopy[0]} {!destinationRequired ? <span className="campaign-optional">Optional</span> : null}</span><input {...fieldProps("destination")} value={draft.destination} onChange={change("destination")} maxLength={400} required={destinationRequired} placeholder={destinationCopy[1]} /><span className="field-hint">{draft.cta === "visit" && draft.location.trim() ? "We can use your saved location, or include the address you add here." : draft.cta !== "visit" && draft.website.trim() ? "We can use your website, or include the contact or link you add here." : "Add a contact, link, or address so viewers can take the next step."}</span></label>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <ChoiceGroup name="style" label="Video personality" options={STYLES} value={draft.style} onChange={(value) => onDraftChange("style", value)} />
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
          ) : null}

          {step === 4 ? (
            <div className="campaign-review">
              <ReviewSection title="Your business" editLabel="Edit business" onEdit={() => handleEditStep(0)}>
                <ReviewDetail label="Name" value={draft.name} /><ReviewDetail label="Promoting" value={KINDS.find((item) => item.value === draft.kind)?.label} /><ReviewDetail label="What you offer" value={draft.description} /><ReviewDetail label="Why choose you" value={draft.benefit} /><ReviewDetail label="Location" value={draft.location} /><ReviewDetail label="Website" value={draft.website} />
              </ReviewSection>
              <ReviewSection title="Audience & goal" editLabel="Edit audience and goal" onEdit={() => handleEditStep(1)}>
                <ReviewDetail label="Goal" value={GOALS.find((item) => item.value === draft.goal)?.label} /><ReviewDetail label="Audience" value={draft.audience} />
              </ReviewSection>
              <ReviewSection title="Offer & action" editLabel="Edit offer and action" onEdit={() => handleEditStep(2)}>
                <ReviewDetail label="Offer" value={draft.offer || "No special offer"} /><ReviewDetail label="Available" value={draft.offerTiming} /><ReviewDetail label="Viewer action" value={CTA_LABELS[draft.cta]} /><ReviewDetail label="Destination" value={draft.destination || (draft.cta === "visit" ? draft.location : draft.website)} />
              </ReviewSection>
              <ReviewSection title="Video direction" editLabel="Edit video direction" onEdit={() => handleEditStep(3)}>
                <ReviewDetail label="Personality" value={STYLES.find((item) => item.value === draft.style)?.label} /><ReviewDetail label="Language" value={draft.language === "km" ? "Khmer · ខ្មែរ" : "English"} /><ReviewDetail label="Creative angle" value={template?.label || "Chosen for your campaign"} /><ReviewDetail label="Extra direction" value={draft.extraNotes} /><ReviewDetail label="Source links" value={draft.urls} /><ReviewDetail label="Brand images" value={assets.length ? assets.map((file) => file.name).join(", ") : ""} />
              </ReviewSection>
              <div className="campaign-tip"><Icon name="shield" size={18} /><p>Review your script first. Your finished video then arrives in Telegram for approval before anything publishes.</p></div>
            </div>
          ) : null}
        </fieldset>

        <div className="campaign-wizard-actions">
          <button type="button" className="ghost-btn" onClick={handleBack} disabled={busy}>
            {step === 0 && businessView === "form" ? "Back to list" : "Back"}
          </button>
          <button type="submit" className="primary-btn" disabled={busy}>
            {step === 4 ? <Icon name="sparkles" size={16} /> : null}
            {starting ? "Writing script…" : savingPromotion ? "Saving profile…" : step === 4 ? "Generate script" : step === 0 && !draft.promotionId ? "Save & continue" : "Continue"}
            {!busy ? <Icon name="arrow-right" size={16} /> : null}
          </button>
        </div>
        {startStatus ? <p className={`compose-status ${startStatusClass}`} role={startStatusClass === "is-err" ? "alert" : "status"}>{startStatus}</p> : null}
      </form>
    </section>
  );
}
