import ComposeForm from "../../components/ComposeForm";
import StoryboardEditor from "../../components/StoryboardEditor";
import { Link } from "react-router-dom";
import { useDashboard } from "../../dashboard/DashboardContext";

export default function ComposePage() {
  const {
    campaignDraft, campaignStep, businessView, setBusinessView, campaignErrors, promotions,
    profilesLoading, savingPromotion, profileError, starting, startStatus, startStatusClass,
    onCampaignDraftChange, onPromotionSelect, onDemoSelect, onCampaignSubmit,
    onCampaignBack, onCampaignEditStep,
    scriptJob, storyboard, scriptErrors, scriptBusy, scriptStatus, scriptStatusClass,
    scriptDirty, scriptLoading, scriptLoadError, onStoryboardChange, onStoryboardAction, onReloadScript,
    scriptCanEditSetup,
  } = useDashboard();
  const pickingBusiness = campaignStep === 0 && businessView === "list";
  const reviewingScript = campaignStep === 5 && scriptJob && storyboard;

  if (scriptLoading || scriptLoadError) return (
    <div className="dash-page"><section className="panel script-loading"><h1>{scriptLoading ? "Loading your script…" : "Script could not load"}</h1>{scriptLoadError ? <><p role="alert">{scriptLoadError}</p><div className="detail-actions"><button className="primary-btn" type="button" onClick={onReloadScript}>Try again</button><Link className="ghost-btn" to="/dashboard/jobs">Campaigns</Link></div></> : <p>Restoring your saved campaign draft.</p>}</section></div>
  );

  return (
    <div className={`dash-page ${pickingBusiness ? "is-business-picker" : ""}`}>
      {pickingBusiness ? null : (
        <header className="dash-page-head campaign-page-head">
          <div>
            <p className="panel-kicker">Create</p>
            <h1>{reviewingScript ? "Your campaign script" : "New campaign"}</h1>
            <p className="dash-page-lede">{reviewingScript ? "Review the plan, then generate your marketing video." : "Fill in your business details to shape the video."}</p>
          </div>
        </header>
      )}

      <div className={`workspace campaign-workspace ${pickingBusiness ? "is-picker" : ""}`}>
        {reviewingScript ? <StoryboardEditor
          job={scriptJob} storyboard={storyboard} errors={scriptErrors} busy={scriptBusy}
          dirty={scriptDirty} status={scriptStatus} statusClass={scriptStatusClass}
          onChange={onStoryboardChange} onAction={onStoryboardAction} onReload={onReloadScript}
          onBack={scriptCanEditSetup ? () => onCampaignEditStep(4) : undefined}
        /> : <ComposeForm
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
          onDraftChange={onCampaignDraftChange}
          onPromotionSelect={onPromotionSelect}
          onDemoSelect={onDemoSelect}
          onSubmit={onCampaignSubmit}
          onBack={onCampaignBack}
          onEditStep={onCampaignEditStep}
        />}
      </div>
    </div>
  );
}
