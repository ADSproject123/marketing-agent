import ComposeForm from "../../components/ComposeForm";
import StepWeeklyPlan from "../../components/compose/StepWeeklyPlan";
import StoryboardEditor from "../../components/StoryboardEditor";
import { Alert, Button, PageHeader, Panel } from "../../components/ui";
import { useDashboard } from "../../dashboard/DashboardContext";

export default function ComposePage() {
  const {
    campaignDraft, campaignStep, businessView, setBusinessView, campaignErrors, promotions,
    profilesLoading, savingPromotion, profileError, starting, startStatus, startStatusClass,
    onCampaignDraftChange, onPromotionSelect, onDemoSelect, onCampaignSubmit, onPlanWeek,
    onCampaignBack, onCampaignEditStep,
    weeklyPlan, weeklySelectedDays, onWeeklyToggleDay, onWeeklySelectAll, onCreateWeeklyDrafts,
    hasSavedDraft, onRestoreDraft, onDiscardDraft,
    scriptJob, storyboard, scriptErrors, scriptBusy, scriptStatus, scriptStatusClass,
    scriptDirty, scriptLoading, scriptLoadError, onStoryboardChange, onStoryboardAction, onReloadScript,
    scriptCanEditSetup,
  } = useDashboard();
  const pickingBusiness = campaignStep === 0 && businessView === "list";
  const reviewingScript = campaignStep === 5 && scriptJob && storyboard;
  const reviewingWeek = campaignStep === 6 && Array.isArray(weeklyPlan) && weeklyPlan.length === 3;

  if (scriptLoading || scriptLoadError) return (
    <div className="dash-page">
      <Panel className="script-loading">
        <h1>{scriptLoading ? "Loading your script…" : "Script could not load"}</h1>
        {scriptLoadError ? (
          <>
            <Alert tone="danger">{scriptLoadError}</Alert>
            <div className="detail-actions" style={{ marginTop: "1rem" }}>
              <Button variant="primary" size="sm" onClick={onReloadScript}>
                Try again
              </Button>
              <Button to="/dashboard/jobs" variant="ghost" size="sm">
                Campaigns
              </Button>
            </div>
          </>
        ) : (
          <p>Restoring your saved campaign draft.</p>
        )}
      </Panel>
    </div>
  );

  return (
    <div className={`dash-page ${pickingBusiness ? "is-business-picker" : ""}`}>
      {pickingBusiness ? null : (
        <PageHeader
          kicker="Create"
          title={
            reviewingScript
              ? "Your campaign script"
              : reviewingWeek
                ? "Plan my week"
                : "New campaign"
          }
          description={
            reviewingScript
              ? "Review the plan, then generate your marketing video."
              : reviewingWeek
                ? "Approve the week’s posts, then create script drafts for the ones you want."
                : "Fill in your business details to shape the video."
          }
          className="campaign-page-head"
        />
      )}

      <div className={`workspace campaign-workspace ${pickingBusiness ? "is-picker" : ""}`}>
        {reviewingScript ? (
          <StoryboardEditor
            job={scriptJob}
            storyboard={storyboard}
            errors={scriptErrors}
            busy={scriptBusy}
            dirty={scriptDirty}
            status={scriptStatus}
            statusClass={scriptStatusClass}
            onChange={onStoryboardChange}
            onAction={onStoryboardAction}
            onReload={onReloadScript}
            onBack={scriptCanEditSetup ? () => onCampaignEditStep(4) : undefined}
          />
        ) : reviewingWeek ? (
          <StepWeeklyPlan
            posts={weeklyPlan}
            selectedDays={weeklySelectedDays}
            onToggleDay={onWeeklyToggleDay}
            onSelectAll={onWeeklySelectAll}
            onCreateSelected={onCreateWeeklyDrafts}
            onBack={onCampaignBack}
            busy={starting}
            status={startStatus}
            statusClass={startStatusClass}
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
            startStatus={startStatus}
            startStatusClass={startStatusClass}
            hasSavedDraft={hasSavedDraft}
            onRestoreDraft={onRestoreDraft}
            onDiscardDraft={onDiscardDraft}
            onDraftChange={onCampaignDraftChange}
            onPromotionSelect={onPromotionSelect}
            onDemoSelect={onDemoSelect}
            onSubmit={onCampaignSubmit}
            onPlanWeek={onPlanWeek}
            onBack={onCampaignBack}
            onEditStep={onCampaignEditStep}
          />
        )}
      </div>
    </div>
  );
}
