import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ingestCampaignUrl } from "../api";
import { formatTime } from "../flow";
import { jobDisplayTitle, jobsForPromotion } from "../promotions";
import { notify } from "../toast";
import Icon from "./Icon";
import { Button, StatusBadge } from "./ui";
import StepBrief from "./compose/StepBrief";
import StepBusiness from "./compose/StepBusiness";
import { DESTINATION_COPY, FORM_COPY, KINDS, STEP_COPY, STEPS } from "./compose/constants";

export default function ComposeForm({
  draft, step, businessView = "list", onBusinessViewChange, promotions, profilesLoading,
  savingPromotion, profileError, errors = {}, starting,
  hasSavedDraft = false, onRestoreDraft, onDiscardDraft,
  onDraftChange, onPromotionSelect, onSubmit, onBack, onEditStep,
  jobs = [], onOpenJob,
}) {
  const navigate = useNavigate();
  const headingRef = useRef(null);
  const formRef = useRef(null);
  const previousStep = useRef(step);
  const setBusinessView = onBusinessViewChange || (() => {});
  const busy = savingPromotion || starting;
  const writingScript = starting;
  const showingBusinessList = step === 0 && businessView === "list";
  const showingBusinessDetail = step === 0 && businessView === "detail";
  const change = (field) => (event) => onDraftChange(field, event.target.value);
  const fieldProps = (field) => ({ name: field, "aria-invalid": errors[field] ? true : undefined, "aria-describedby": errors[field] ? `campaign-error-${field}` : undefined });
  const [title, description] = step === 0 ? FORM_COPY : STEP_COPY[step] || STEP_COPY[1];
  const destinationCopy = DESTINATION_COPY[draft.cta] || DESTINATION_COPY.visit;
  const destinationRequired = draft.cta === "visit" ? !draft.location.trim() : !draft.website.trim();
  const assets = Array.isArray(draft.assets) ? draft.assets : [];
  const [ingestUrl, setIngestUrl] = useState("");
  const [ingestBusy, setIngestBusy] = useState(false);
  const assetPreviews = useMemo(
    () => assets.map((file) => ({ file, url: URL.createObjectURL(file) })),
    [assets],
  );
  const khqrPreview = useMemo(
    () => (draft.khqrFile instanceof File ? URL.createObjectURL(draft.khqrFile) : ""),
    [draft.khqrFile],
  );

  const selectedPromotion = useMemo(
    () => promotions.find((item) => item.id === draft.promotionId) || null,
    [promotions, draft.promotionId],
  );

  const businessJobs = useMemo(
    () => (selectedPromotion ? jobsForPromotion(jobs, selectedPromotion) : []),
    [jobs, selectedPromotion],
  );

  const jobCounts = useMemo(() => {
    const map = new Map();
    for (const promotion of promotions) {
      map.set(promotion.id, jobsForPromotion(jobs, promotion).length);
    }
    return map;
  }, [jobs, promotions]);

  const importFromUrl = async () => {
    if (ingestBusy || busy) return;
    const url = ingestUrl.trim();
    if (!url) {
      notify.warning("Paste a website URL to import.");
      return;
    }
    setIngestBusy(true);
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
      notify.success("Details imported from your link.");
      setBusinessView("form");
    } catch (err) {
      notify.error(err?.message || "Could not import that link.");
    } finally {
      setIngestBusy(false);
    }
  };

  useEffect(() => {
    if (previousStep.current !== step) {
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

  const openBusinessDetail = (promotionId) => {
    onPromotionSelect(promotionId);
    setBusinessView("detail");
  };

  const startNewVideo = (promotionId = "") => {
    onPromotionSelect(promotionId);
    if (promotionId && onEditStep) {
      onEditStep(1);
      return;
    }
    setBusinessView("form");
  };

  const handleBack = () => {
    if (showingBusinessList) return;
    if (step === 0 && businessView === "detail") {
      setBusinessView("list");
      onPromotionSelect("");
      return;
    }
    if (step === 0 && businessView === "form") {
      if (draft.promotionId) setBusinessView("detail");
      else {
        setBusinessView("list");
        onPromotionSelect("");
      }
      return;
    }
    if (step === 1) setBusinessView(draft.promotionId ? "detail" : "form");
    onBack();
  };

  const handleSubmit = (event) => {
    if (showingBusinessList || showingBusinessDetail) {
      event.preventDefault();
      return;
    }
    onSubmit(event);
  };

  const openJob = (job) => {
    if (onOpenJob) {
      onOpenJob(job);
      return;
    }
    if (job.status === "script_review" || (job.status === "failed" && job.storyboard)) {
      navigate(`/dashboard/compose?draft=${encodeURIComponent(job.id)}`);
      return;
    }
    navigate("/dashboard/jobs");
  };

  if (showingBusinessDetail && selectedPromotion) {
    const kindLabel = KINDS.find((item) => item.value === selectedPromotion.kind)?.label || "Business";
    return (
      <section className="panel compose campaign-picker campaign-biz-detail" aria-labelledby="compose-title">
        <div className="campaign-picker-head">
          <div>
            <button type="button" className="campaign-biz-back" onClick={handleBack} disabled={busy}>
              <Icon name="arrow-right" size={14} className="campaign-biz-back-icon" />
              All businesses
            </button>
            <h2 id="compose-title" ref={headingRef} tabIndex={-1}>{selectedPromotion.name}</h2>
            <p>
              {kindLabel}
              {selectedPromotion.location ? ` · ${selectedPromotion.location}` : ""}
            </p>
          </div>
          {businessJobs.length ? (
            <Button
              variant="primary"
              size="sm"
              icon="sparkles"
              onClick={() => startNewVideo(selectedPromotion.id)}
              disabled={busy}
            >
              New video
            </Button>
          ) : null}
        </div>

        <div className="campaign-biz-detail-body">
          <div className="campaign-biz-detail-meta">
            {selectedPromotion.benefit || selectedPromotion.description ? (
              <p>{selectedPromotion.benefit || selectedPromotion.description}</p>
            ) : null}
            {selectedPromotion.website ? (
              <a className="text-link" href={selectedPromotion.website} target="_blank" rel="noreferrer">
                {selectedPromotion.website.replace(/^https?:\/\//, "")}
              </a>
            ) : null}
          </div>

          <div className="campaign-biz-videos">
            <div className="campaign-biz-videos-head">
              <h3>Videos</h3>
              <span>{businessJobs.length}</span>
            </div>
            {businessJobs.length ? (
              <ul className="campaign-biz-video-list">
                {businessJobs.map((job) => (
                  <li key={job.id}>
                    <button
                      type="button"
                      className="campaign-biz-video-item"
                      onClick={() => openJob(job)}
                      disabled={busy}
                    >
                      <span className="campaign-biz-video-top">
                        <StatusBadge status={job.status} size="sm" />
                        <span className="job-id">#{job.id.slice(0, 8)}</span>
                      </span>
                      <strong>{jobDisplayTitle(job)}</strong>
                      <span className="campaign-biz-video-meta">
                        {formatTime(job.updated_at || job.created_at)}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="campaign-biz-videos-empty">
                <p>No videos for this business yet.</p>
                <Button
                  variant="primary"
                  size="sm"
                  icon="sparkles"
                  onClick={() => startNewVideo(selectedPromotion.id)}
                  disabled={busy}
                >
                  New video
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (showingBusinessList) {
    return (
      <section className="panel compose campaign-picker" aria-labelledby="compose-title">
        <div className="campaign-picker-head">
          <div>
            <h2 id="compose-title" ref={headingRef} tabIndex={-1}>Saved businesses</h2>
            <p>Open a business for its videos, or add a new one.</p>
          </div>
          {promotions.length ? (
            <Button
              variant="primary"
              size="sm"
              icon="sparkles"
              onClick={() => startNewVideo("")}
              disabled={busy || profilesLoading}
            >
              New business
            </Button>
          ) : null}
        </div>

        {hasSavedDraft ? (
          <div className="campaign-draft-banner" role="status">
            <div className="campaign-draft-banner-text">
              <strong>Unsaved draft found</strong>
              <span>In-progress draft from an earlier session.</span>
            </div>
            <div className="campaign-draft-banner-actions">
              <Button variant="ghost" size="sm" onClick={onRestoreDraft}>
                Restore
              </Button>
              <Button variant="subtle" size="sm" onClick={onDiscardDraft}>
                Discard
              </Button>
            </div>
          </div>
        ) : null}

        <div className="campaign-biz-list-wrap">
          {profilesLoading ? (
            <p className="campaign-saved-status" role="status">Loading…</p>
          ) : promotions.length === 0 ? (
            <div className="campaign-table-empty">
              <p>No saved businesses yet.</p>
              <Button variant="primary" size="sm" icon="sparkles" onClick={() => startNewVideo("")} disabled={busy}>
                New business
              </Button>
            </div>
          ) : (
            <ul className="campaign-biz-list">
              {promotions.map((promotion) => {
                const kindItem = KINDS.find((item) => item.value === promotion.kind);
                const kindLabel = kindItem?.label || "Business";
                const kindIcon = kindItem?.icon || "grid";
                const count = jobCounts.get(promotion.id) || 0;
                const desc = promotion.benefit || promotion.description;
                return (
                  <li key={promotion.id} className="campaign-biz-item">
                    <button
                      type="button"
                      className="campaign-biz-card"
                      onClick={() => openBusinessDetail(promotion.id)}
                      disabled={busy}
                    >
                      <div className="campaign-biz-card-top">
                        <span className="campaign-biz-card-badge">
                          <Icon name={kindIcon} size={13} />
                          {kindLabel}
                        </span>
                        <span className="campaign-biz-card-count">
                          <Icon name="video" size={12} />
                          {count} {count === 1 ? "video" : "videos"}
                        </span>
                      </div>

                      <div className="campaign-biz-card-body">
                        <strong className="campaign-biz-card-title">{promotion.name}</strong>
                        {desc ? (
                          <p className="campaign-biz-card-desc">{desc}</p>
                        ) : (
                          <p className="campaign-biz-card-desc-placeholder">Ready to create marketing videos</p>
                        )}
                      </div>

                      <div className="campaign-biz-card-footer">
                        <div className="campaign-biz-card-meta">
                          {promotion.location ? (
                            <span className="campaign-biz-card-loc" title={promotion.location}>
                              <Icon name="globe" size={13} />
                              <span>{promotion.location}</span>
                            </span>
                          ) : promotion.website ? (
                            <span className="campaign-biz-card-loc" title={promotion.website}>
                              <Icon name="globe" size={13} />
                              <span>{promotion.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                            </span>
                          ) : (
                            <span className="campaign-biz-card-loc-empty">
                              <Icon name="sparkles" size={12} />
                              <span>Ready</span>
                            </span>
                          )}
                        </div>
                        <span className="campaign-biz-card-action">
                          <span>View videos</span>
                          <Icon name="arrow-right" size={13} />
                        </span>
                      </div>
                    </button>
                  </li>
                );
              })}

              <li className="campaign-biz-item">
                <button
                  type="button"
                  className="campaign-biz-card campaign-biz-card-add"
                  onClick={() => startNewVideo("")}
                  disabled={busy || profilesLoading}
                  aria-label="Add new business"
                >
                  <div className="campaign-biz-card-add-icon">
                    <Icon name="plus" size={20} />
                  </div>
                  <strong className="campaign-biz-card-add-title">Add business</strong>
                  <span className="campaign-biz-card-add-sub">Create another profile to generate videos</span>
                </button>
              </li>
            </ul>
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
        <p className="panel-kicker">Step {Math.min(step, 1) + 1} of {STEPS.length}</p>
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
              setIngestUrl={setIngestUrl}
              ingestBusy={ingestBusy}
              importFromUrl={importFromUrl}
              busy={busy}
            />
          ) : null}
          {step === 1 ? (
            <StepBrief
              draft={draft}
              change={change}
              fieldProps={fieldProps}
              onDraftChange={onDraftChange}
              destinationCopy={destinationCopy}
              destinationRequired={destinationRequired}
              khqrPreview={khqrPreview}
              errors={errors}
              assets={assets}
              assetPreviews={assetPreviews}
              busy={busy}
            />
          ) : null}
        </fieldset>

        <div className="campaign-wizard-actions">
          <Button variant="ghost" size="md" onClick={handleBack} disabled={busy}>
            {step === 0 && businessView === "form"
              ? (draft.promotionId ? "Back to business" : "Back to list")
              : "Back"}
          </Button>
          <div className="campaign-wizard-primary-actions">
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={busy}
              loading={writingScript || savingPromotion}
              loadingText={writingScript ? "Writing script…" : savingPromotion ? "Saving profile…" : "Processing…"}
              icon={!(writingScript || savingPromotion) ? (step === 1 ? "sparkles" : "arrow-right") : undefined}
              iconPosition={step === 1 ? "start" : "end"}
            >
              {step === 1
                ? "Write script"
                : step === 0 && !draft.promotionId
                  ? "Save & continue"
                  : "Continue"}
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}
