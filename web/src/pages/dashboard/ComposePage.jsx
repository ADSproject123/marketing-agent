import ComposeForm from "../../components/ComposeForm";
import Icon from "../../components/Icon";
import { useDashboard } from "../../dashboard/DashboardContext";

export default function ComposePage() {
  const {
    online,
    templateId,
    brief,
    urls,
    notes,
    starting,
    startStatus,
    startStatusClass,
    onTemplateChange,
    setBrief,
    setUrls,
    setNotes,
    onStart,
  } = useDashboard();

  return (
    <div className="dash-page">
      <header className="dash-page-head">
        <div>
          <p className="panel-kicker">Create</p>
          <h1>New campaign</h1>
          <p className="dash-page-lede">
            Turn your next idea into a video campaign. Start with a brief and follow its progress in real time.
          </p>
        </div>
      </header>

      <div className="workspace">
        <ComposeForm
          templateId={templateId}
          brief={brief}
          urls={urls}
          notes={notes}
          starting={starting}
          startStatus={startStatus}
          startStatusClass={startStatusClass}
          onTemplateChange={onTemplateChange}
          onBriefChange={setBrief}
          onUrlsChange={setUrls}
          onNotesChange={setNotes}
          onStart={onStart}
        />

        <aside className="panel readiness" aria-labelledby="ready-title">
          <div className="panel-head">
            <div>
              <p className="panel-kicker">Your workflow</p>
              <h2 id="ready-title">Ready to create</h2>
            </div>
          </div>
          <ul className="ready-list">
            <li className={online ? "is-ok" : ""}>
              <span className="ready-item-label"><span className="ready-icon"><Icon name="activity" size={17} /></span>Campaign service</span>
              <strong>{online ? "Connected" : "Offline"}</strong>
            </li>
            <li>
              <span className="ready-item-label"><span className="ready-icon"><Icon name="send" size={17} /></span>Review & approval</span>
              <strong>Telegram</strong>
            </li>
            <li>
              <span className="ready-item-label"><span className="ready-icon"><Icon name="video" size={17} /></span>Video creation</span>
              <strong>NotebookLM</strong>
            </li>
            <li>
              <span className="ready-item-label"><span className="ready-icon"><Icon name="globe" size={17} /></span>Publishing</span>
              <strong>Facebook Page</strong>
            </li>
          </ul>
          <div className="ready-callout">
            <Icon name="shield" size={21} />
            <div><h3>You’re always in control</h3><p>Your preview arrives in Telegram. Approve it when you’re happy, or decline to stop the campaign.</p></div>
          </div>
          <p className="ready-note"><Icon name="clock" size={15} /> Video creation usually takes a few minutes.</p>
        </aside>
      </div>
    </div>
  );
}
