import { useEffect, useMemo, useRef, useState } from "react";
import { ingestCampaignUrl } from "../api";
import { TEMPLATES } from "../templates";
import Icon from "./Icon";
import { Alert, Button } from "./ui";
import StepAudience from "./compose/StepAudience";
import StepBusiness from "./compose/StepBusiness";
import StepOffer from "./compose/StepOffer";
import StepReview from "./compose/StepReview";
import StepStyle from "./compose/StepStyle";
import { DESTINATION_COPY, FORM_COPY, KINDS, STEP_COPY, STEPS } from "./compose/constants";

export default function ComposeForm({
  draft, step, businessView = "list", onBusinessViewChange, promotions, profilesLoading,
  savingPromotion, profileError, errors = {}, starting, startStatus, startStatusClass,
  hasSavedDraft = false, onRestoreDraft, onDiscardDraft,
  onDraftChange, onPromotionSelect, onDemoSelect, onSubmit, onPlanWeek, onBack, onEditStep,
}) {
  const headingRef = useRef(null);
  const formRef = useRef(null);
  const previousStep = useRef(step);
  const setBusinessView = onBusinessViewChange || (() => {});
  const busy = savingPromotion || starting;
  const planningWeek = starting && String(startStatus || "").toLowerCase().includes("week");
  const writingScript = starting && !planningWeek;
  const showingBusinessList = step === 0 && businessView === "list";
  const change = (field) => (event) => onDraftChange(field, event.target.value);
  const fieldProps = (field) => ({ name: field, "aria-invalid": errors[field] ? true : undefined, "aria-describedby": errors[field] ? `campaign-error-${field}` : undefined });
  const [title, description] = step === 0 ? FORM_COPY : STEP_COPY[step];
  const destinationCopy = DESTINATION_COPY[draft.cta] || DESTINATION_COPY.visit;
  const destinationRequired = draft.cta === "visit" ? !draft.location.trim() : !draft.website.trim();
  const template = TEMPLATES.find((item) => item.id === draft.templateId);
  const assets = Array.isArray(draft.assets) ? draft.assets : [];
  const [ingestUrl, setIngestUrl] = useState("");
  const [ingestBusy, setIngestBusy] = useState(false);
  const [ingestStatus, setIngestStatus] = useState("");
  const [ingestError, setIngestError] = useState("");
  const assetPreviews = useMemo(
    () => assets.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [assets],
  );
  const khqrPreview = useMemo(
    () => (draft.khqrFile instanceof File ? URL.createObjectURL(draft.khqrFile) : ""),
    [draft.khqrFile],
  );

  const importFromUrl = async () => {
    if (ingestBusy || busy) return;
    const url = ingestUrl.trim();
    if (!url) {
      setIngestError("Paste a website URL to import.");
      return;
    }
    setIngestBusy(true);
    setIngestError("");
    setIngestStatus("Reading the page and drafting your campaign…");
    try {
      const data = await ingestCampaignUrl(url);
      const next = data?.draft || {};
      for (const [field, value] of Object.entries({
        name: next.name || "",
        kind: next.kind || draft.kind,
        description: next.description || "",
        benefit: next.benefit || "",
        location: next.location || "",
        website: next.website || url,
        goal: next.goal || draft.goal,
        cta: next.cta || draft.cta,
        audience: next.audience || "",
      })) {
        onDraftChange(field, value);
      }
      setIngestStatus("Campaign details filled from your link. Review and continue.");
      setBusinessView("form");
    } catch (err) {
      setIngestStatus("");
      setIngestError(err?.message || "Could not import that link.");
    } finally {
      setIngestBusy(false);
    }
  };

  useEffect(() => {
    if (previousStep.current !== step) {
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

  useEffect(() => () => {
    if (khqrPreview) URL.revokeObjectURL(khqrPreview);
  }, [khqrPreview]);

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
          <Button
            variant="primary"
            size="md"
            icon="sparkles"
            onClick={() => openBusinessForm("")}
            disabled={busy || profilesLoading}
          >
            Create new
          </Button>
        </div>

        {hasSavedDraft ? (
          <div className="campaign-draft-banner" role="status">
            <div className="campaign-draft-banner-text">
              <strong>Unsaved draft found</strong>
              <span>You have an in-progress campaign draft from an earlier session.</span>
            </div>
            <div className="campaign-draft-banner-actions">
              <Button variant="ghost" size="sm" onClick={onRestoreDraft}>
                Restore draft
              </Button>
              <Button variant="subtle" size="sm" onClick={onDiscardDraft}>
                Discard
              </Button>
            </div>
          </div>
        ) : null}

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
            <StepBusiness
              draft={draft}
              change={change}
              fieldProps={fieldProps}
              onDraftChange={onDraftChange}
              profileError={profileError}
              ingestUrl={ingestUrl}
              setIngestUrl={(value) => { setIngestUrl(value); setIngestError(""); }}
              ingestBusy={ingestBusy}
              ingestStatus={ingestStatus}
              ingestError={ingestError}
              importFromUrl={importFromUrl}
              busy={busy}
            />
          ) : null}
          {step === 1 ? (
            <StepAudience draft={draft} change={change} fieldProps={fieldProps} onDraftChange={onDraftChange} />
          ) : null}
          {step === 2 ? (
            <StepOffer
              draft={draft}
              change={change}
              fieldProps={fieldProps}
              onDraftChange={onDraftChange}
              destinationCopy={destinationCopy}
              destinationRequired={destinationRequired}
              khqrPreview={khqrPreview}
            />
          ) : null}
          {step === 3 ? (
            <StepStyle
              draft={draft}
              change={change}
              fieldProps={fieldProps}
              onDraftChange={onDraftChange}
              errors={errors}
              assets={assets}
              assetPreviews={assetPreviews}
              busy={busy}
            />
          ) : null}
          {step === 4 ? (
            <StepReview draft={draft} template={template} assets={assets} onEditStep={handleEditStep} />
          ) : null}
        </fieldset>

        <div className={`campaign-wizard-actions ${step === 4 ? "is-review" : ""}`}>
          <Button variant="ghost" size="md" onClick={handleBack} disabled={busy}>
            {step === 0 && businessView === "form" ? "Back to list" : "Back"}
          </Button>
          <div className="campaign-wizard-primary-actions">
            {step === 4 && onPlanWeek ? (
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={onPlanWeek}
                disabled={busy}
                loading={planningWeek}
                loadingText="Planning your week…"
                icon={!planningWeek ? "layers" : undefined}
                iconPosition="start"
              >
                Plan my week
              </Button>
            ) : null}
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={busy}
              loading={writingScript || savingPromotion}
              loadingText={writingScript ? "Writing script…" : savingPromotion ? "Saving profile…" : "Processing…"}
              icon={!(writingScript || savingPromotion) ? (step === 4 ? "sparkles" : "arrow-right") : undefined}
              iconPosition={step === 4 ? "start" : "end"}
            >
              {step === 4
                ? "Write one script"
                : step === 0 && !draft.promotionId
                  ? "Save & continue"
                  : "Continue"}
            </Button>
          </div>
        </div>
      </form>
      {startStatus ? <Alert tone={startStatusClass === "is-err" ? "danger" : "success"} className="compose-status">{startStatus}</Alert> : null}
    </section>
  );
}
