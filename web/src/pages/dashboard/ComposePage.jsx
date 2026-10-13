import { useNavigate } from "react-router-dom";
import ComposeForm from "../../components/ComposeForm";
import StoryboardEditor from "../../components/StoryboardEditor";
import { Button, Panel } from "../../components/ui";
import { useDashboard } from "../../dashboard/DashboardContext";

export default function ComposePage() {
  const navigate = useNavigate();
  const {
    jobs, setActiveJobId,
    campaignDraft, campaignStep, businessView, setBusinessView, campaignErrors, promotions,
    profilesLoading, savingPromotion, profileError, starting,
    onCampaignDraftChange, onPromotionSelect, onDemoSelect, onCampaignSubmit,
    onCampaignBack, onCampaignEditStep,
    hasSavedDraft, onRestoreDraft, onDiscardDraft,
    scriptJob, storyboard, scriptErrors, scriptBusy,
    scriptDirty, scriptLoading, scriptLoadError, onStoryboardChange, onStoryboardAction, onReloadScript,
    scriptCanEditSetup,
  } = useDashboard();
  const pickingBusiness = campaignStep === 0 && (businessView === "list" || businessView === "detail");
  const reviewingScript = campaignStep === 5 && scriptJob && storyboard;

  const onOpenJob = (job) => {
    if (!job?.id) return;
    if (job.status === "script_review" || (job.status === "failed" && job.storyboard)) {
      navigate(`/dashboard/compose?draft=${encodeURIComponent(job.id)}`);
      return;
    }
    setActiveJobId(job.id);
    navigate("/dashboard/jobs");
  };

  if (scriptLoading || scriptLoadError) return (
    <div className="dash-page">
      <Panel className="script-loading">
        <h1>{scriptLoading ? "Loading script…" : "Script unavailable"}</h1>
        {scriptLoadError ? (
          <div className="detail-actions" style={{ marginTop: "1rem" }}>
            <Button variant="primary" size="sm" onClick={onReloadScript}>
              Try again
            </Button>
            <Button to="/dashboard/jobs" variant="ghost" size="sm">
              History
            </Button>
          </div>
        ) : null}
      </Panel>
    </div>
  );

  return (
    <div className={`dash-page ${pickingBusiness ? "is-business-picker" : ""}`}>
      <div className={`workspace campaign-workspace ${pickingBusiness ? "is-picker" : ""}`}>
        {reviewingScript ? (
          <StoryboardEditor
            job={scriptJob}
            storyboard={storyboard}
            errors={scriptErrors}
            busy={scriptBusy}
            dirty={scriptDirty}
            onChange={onStoryboardChange}
            onAction={onStoryboardAction}
            onReload={onReloadScript}
            onBack={scriptCanEditSetup ? () => onCampaignEditStep(1) : undefined}
          />
        ) : (
          <ComposeForm
            draft={campaignDraft}
            step={campaignStep}
            businessView={businessView}
            onBusinessViewChange={setBusinessView}
            promotions={promotions}
            profilesLoading={profilesLoading}
            savingPromotion={savingPromotion}
            profileError={profileError}
            errors={campaignErrors}
            starting={starting}
            hasSavedDraft={hasSavedDraft}
            onRestoreDraft={onRestoreDraft}
            onDiscardDraft={onDiscardDraft}
            onDraftChange={onCampaignDraftChange}
            onPromotionSelect={onPromotionSelect}
            onDemoSelect={onDemoSelect}
            onSubmit={onCampaignSubmit}
            onBack={onCampaignBack}
            onEditStep={onCampaignEditStep}
            jobs={jobs}
            onOpenJob={onOpenJob}
          />
        )}
      </div>
    </div>
  );
}
