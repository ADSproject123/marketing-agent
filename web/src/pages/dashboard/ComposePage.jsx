import ComposeForm from "../../components/ComposeForm";
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
          <p className="panel-kicker">Compose</p>
          <h1>Start a campaign job</h1>
          <p className="dash-page-lede">
            Pick a template, add optional sources, then start. You’ll be taken to the
            pipeline to track progress.
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
              <p className="panel-kicker">Operations</p>
              <h2 id="ready-title">Run checklist</h2>
            </div>
          </div>
          <ul className="ready-list">
            <li className={online ? "is-ok" : ""}>
              <span>Python runtime</span>
              <strong>{online ? "Connected" : "Not connected"}</strong>
            </li>
            <li>
              <span>Approval gate</span>
              <strong>Telegram</strong>
            </li>
            <li>
              <span>Video engine</span>
              <strong>NotebookLM</strong>
            </li>
            <li>
              <span>Publish target</span>
              <strong>Facebook Page</strong>
            </li>
          </ul>
          <p className="ready-note">
            Jobs can take several minutes while NotebookLM renders the short.
          </p>
        </aside>
      </div>
    </div>
  );
}
