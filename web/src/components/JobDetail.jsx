import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { approveJob, cancelJob, denyJob, redraftStoryboard, retryCampaignDraft } from "../api";
import { ACTIVE_STATUSES, formatTime, stageForJob, STEPS } from "../flow";
import { notify } from "../toast";
import Icon from "./Icon";
import QualityReport from "./QualityReport";
import { Badge, Button, EmptyState, StatusBadge } from "./ui";
import VideoPreview from "./VideoPreview";

function jobTitle(job) {
  const raw = String(job?.title || job?.brief || "Untitled").trim();
  return raw.split(/\n/)[0] || "Untitled";
}

function parseBrief(rawBrief) {
  if (!rawBrief || typeof rawBrief !== "string") return null;
  const lines = rawBrief.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const data = {};
  const labelMap = {
    "name": "Business name",
    "ឈ្មោះ": "Business name",
    "promotion type": "Promotion type",
    "ប្រភេទដែលត្រូវផ្សព្វផ្សាយ": "Promotion type",
    "what it offers": "What it offers",
    "អ្វីដែលផ្ដល់ជូន": "What it offers",
    "main customer benefit": "Customer benefit",
    "អត្ថប្រយោជន៍សំខាន់សម្រាប់អតិថិជន": "Customer benefit",
    "location": "Location",
    "ទីតាំង": "Location",
    "website": "Website",
    "គេហទំព័រ": "Website",
    "campaign goal": "Campaign goal",
    "គោលដៅយុទ្ធនាការ": "Campaign goal",
    "target audience": "Target audience",
    "អតិថិជនគោលដៅ": "Target audience",
    "offer": "Special offer",
    "ការផ្ដល់ជូន": "Special offer",
    "offer timing": "Offer timing",
    "រយៈពេលនៃការផ្ដល់ជូន": "Offer timing",
    "call to action": "Call to action",
    "ការអំពាវនាវឱ្យធ្វើសកម្មភាព": "Call to action",
    "action destination": "Destination",
    "កន្លែងធ្វើសកម្មភាព": "Destination",
    "telegram": "Telegram",
    "តេលេក្រាម": "Telegram",
    "video style": "Video style",
    "រចនាប័ទ្មវីដេអូ": "Video style",
    "target video length": "Length",
    "creative inspiration": "Creative angle",
    "គំនិតច្នៃប្រឌិត": "Creative angle",
    "additional creative direction": "Creative notes",
    "ការណែនាំច្នៃប្រឌិតបន្ថែម": "Creative notes",
  };

  for (const line of lines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx > 0) {
      const key = line.slice(0, colonIdx).trim().toLowerCase();
      const val = line.slice(colonIdx + 1).trim();
      const mapped = labelMap[key];
      if (mapped && val) {
        data[mapped] = val;
      }
    }
  }
  return Object.keys(data).length > 0 ? data : null;
}

function ScriptActions({ job, onRefresh }) {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [actionType, setActionType] = useState("");
  const retryScript =
    job.status === "failed" &&
    !job.storyboard &&
    ["BUSINESS CAMPAIGN BRIEF", "សេចក្តីសង្ខេបយុទ្ធនាការអាជីវកម្ម"].some((heading) =>
      (job.brief || "").startsWith(heading)
    );

  async function prepareDraft(retry = false) {
    if (busy) return;
    setBusy(true);
    setActionType(retry ? "retry" : "revise");
    try {
      const response = retry
        ? await retryCampaignDraft(job.id, job.updated_at)
        : await redraftStoryboard(job.id);
      navigate(`/dashboard/compose?draft=${encodeURIComponent(response.job.id)}`);
    } catch (err) {
      notify.error(err.message || "Could not prepare the script.");
      setBusy(false);
      setActionType("");
    }
  }

  async function handleApprove() {
    if (busy) return;
    setBusy(true);
    setActionType("approve");
    try {
      await approveJob(job.id);
      notify.success("Approved! Uploading to Facebook Page.");
      if (onRefresh) onRefresh();
    } catch (err) {
      notify.error(err.message || "Could not approve campaign.");
    } finally {
      setBusy(false);
      setActionType("");
    }
  }

  async function handleDeny() {
    if (busy) return;
    setBusy(true);
    setActionType("deny");
    try {
      await denyJob(job.id);
      notify.info("Campaign publication denied.");
      if (onRefresh) onRefresh();
    } catch (err) {
      notify.error(err.message || "Could not deny campaign.");
    } finally {
      setBusy(false);
      setActionType("");
    }
  }

  async function handleCancel() {
    if (busy) return;
    setBusy(true);
    setActionType("cancel");
    try {
      await cancelJob(job.id);
      notify.info("Campaign generation cancelled.");
      if (onRefresh) onRefresh();
    } catch (err) {
      notify.error(err.message || "Could not cancel campaign.");
    } finally {
      setBusy(false);
      setActionType("");
    }
  }

  function handleDuplicate() {
    try {
      localStorage.setItem(
        "ma_campaign_clone",
        JSON.stringify({
          brief: job.brief || "",
          language: job.language || "en",
        })
      );
      notify.success("Cloned campaign into composer.");
    } catch {
      // Ignore localStorage errors
    }
    navigate("/dashboard/compose?clone=true");
  }

  let actions = null;

  if (job.status === "awaiting_approval") {
    actions = (
      <>
        <Button
          variant="primary"
          size="sm"
          icon="check"
          loading={busy && actionType === "approve"}
          loadingText="Publishing…"
          disabled={busy}
          onClick={handleApprove}
        >
          Approve & Publish
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon="sparkles"
          loading={busy && actionType === "revise"}
          disabled={busy}
          onClick={() => prepareDraft()}
        >
          Revise
        </Button>
        <Button variant="ghost" size="sm" icon="layers" onClick={handleDuplicate}>
          Duplicate
        </Button>
        <Button
          variant="danger"
          size="sm"
          loading={busy && actionType === "deny"}
          disabled={busy}
          onClick={handleDeny}
        >
          Deny
        </Button>
      </>
    );
  } else if (["queued", "generating", "collecting", "posting"].includes(job.status)) {
    actions = (
      <>
        <Button to="/dashboard/pipeline" variant="primary" size="sm" icon="activity">
          View Pipeline
        </Button>
        {["queued", "generating"].includes(job.status) ? (
          <Button
            variant="ghost"
            size="sm"
            icon="x"
            loading={busy && actionType === "cancel"}
            loadingText="Cancelling…"
            disabled={busy}
            onClick={handleCancel}
          >
            Cancel
          </Button>
        ) : null}
      </>
    );
  } else if (retryScript) {
    actions = (
      <>
        <Button
          variant="primary"
          size="sm"
          icon="refresh"
          loading={busy && actionType === "retry"}
          loadingText="Generating…"
          disabled={busy}
          onClick={() => prepareDraft(true)}
        >
          Retry script
        </Button>
        <Button variant="ghost" size="sm" icon="layers" onClick={handleDuplicate}>
          Duplicate
        </Button>
      </>
    );
  } else if (["script_review", "failed"].includes(job.status)) {
    actions = (
      <>
        <Button
          to={`/dashboard/compose?draft=${encodeURIComponent(job.id)}`}
          variant="primary"
          size="sm"
          icon="sparkles"
        >
          Review script
        </Button>
        <Button variant="ghost" size="sm" icon="layers" onClick={handleDuplicate}>
          Duplicate
        </Button>
      </>
    );
  } else if (["posted", "denied", "cancelled"].includes(job.status)) {
    actions = (
      <>
        <Button
          variant="ghost"
          size="sm"
          icon="sparkles"
          loading={busy && actionType === "revise"}
          loadingText="Preparing…"
          disabled={busy}
          onClick={() => prepareDraft()}
        >
          Revise
        </Button>
        <Button variant="ghost" size="sm" icon="layers" onClick={handleDuplicate}>
          Duplicate
        </Button>
      </>
    );
  }

  if (!actions) return null;
  return <div className="history-detail-actions">{actions}</div>;
}

export default function JobDetail({ job, onRefresh, onBack }) {
  if (!job) {
    return (
      <div className="history-detail is-empty">
        <EmptyState
          icon="file"
          title="Select a campaign"
          description="Choose a campaign from the list to inspect its vertical video preview, caption, creative brief, and publishing history."
        />
      </div>
    );
  }

  const stage = stageForJob(job);
  const stageTitle = stage && STEPS[stage] ? STEPS[stage].title : null;
  const isGenerating = ACTIVE_STATUSES.has(job.status);
  const parsedBrief = useMemo(() => parseBrief(job.brief), [job.brief]);
  const assets = Array.isArray(job.assets) ? job.assets : [];

  const copyId = () => {
    navigator.clipboard.writeText(job.id);
    notify.info(`Campaign ID #${job.id.slice(0, 8)} copied.`);
  };

  const copyCaption = () => {
    if (!job.caption) return;
    navigator.clipboard.writeText(job.caption);
    notify.success("Social caption copied to clipboard!");
  };

  return (
    <article className="history-detail" aria-label="Campaign detail workspace">
      <header className="history-detail-head">
        {onBack ? (
          <button
            type="button"
            className="history-mobile-back-btn"
            onClick={onBack}
            aria-label="Back to all campaigns"
          >
            <Icon name="chevron-right" size={15} className="history-back-icon" />
            <span>All campaigns</span>
          </button>
        ) : null}

        <div className="history-detail-head-top">
          <div className="history-detail-chips">
            <StatusBadge status={job.status} size="sm" />
            <button
              type="button"
              className="history-id-chip"
              onClick={copyId}
              title="Click to copy Campaign ID"
            >
              <span>#{job.id.slice(0, 8)}</span>
              <Icon name="copy" size={11} />
            </button>
            <span className="history-lang-chip">
              {job.language === "km" ? "🇰🇭 Khmer · ខ្មែរ" : "🇬🇧 English"}
            </span>
            <span className="history-time-chip">
              <Icon name="clock" size={12} />
              {formatTime(job.updated_at || job.created_at)}
            </span>
          </div>

          <ScriptActions key={job.id} job={job} onRefresh={onRefresh} />
        </div>

        <div className="history-detail-title-wrap">
          <h1 className="history-detail-title">{jobTitle(job)}</h1>
          {parsedBrief?.["Business name"] ? (
            <p className="history-detail-subtitle">
              Business: <strong>{parsedBrief["Business name"]}</strong>
              {parsedBrief["Promotion type"] ? ` · ${parsedBrief["Promotion type"]}` : ""}
            </p>
          ) : null}
        </div>
      </header>

      {job.error ? (
        <div className="history-detail-banner is-error" role="alert">
          <Icon name="alert" size={18} />
          <div>
            <strong>Generation error</strong>
            <p>{job.error}</p>
          </div>
        </div>
      ) : null}

      {isGenerating ? (
        <div className="history-detail-banner is-active" role="status">
          <span className="sys-status-dot" aria-hidden="true" />
          <div className="history-banner-copy">
            <strong>Video generating in pipeline</strong>
            <p>
              Current stage: {stageTitle || "In progress"}. Track real-time progress on Live pipeline.
            </p>
          </div>
          <Button to="/dashboard/pipeline" variant="ghost" size="xs" icon="activity">
            Live pipeline
          </Button>
        </div>
      ) : null}

      <div className="history-detail-grid">
        <div className="history-col-creative">
          <section className="history-card history-card-video" aria-labelledby="history-video-title">
            <div className="history-card-header">
              <div className="history-card-title-group">
                <Icon name="video" size={17} className="history-card-icon" />
                <h3 id="history-video-title">Video creative</h3>
              </div>
              <Badge variant={job.video_path || job.video_url ? "success" : "neutral"} size="sm">
                {job.video_path || job.video_url ? "Rendered MP4" : "9:16 Vertical"}
              </Badge>
            </div>
            <div className="history-card-body">
              <VideoPreview key={job.id} job={job} />
            </div>
          </section>

          {job.caption ? (
            <section className="history-card history-card-caption" aria-labelledby="history-caption-title">
              <div className="history-card-header">
                <div className="history-card-title-group">
                  <Icon name="send" size={16} className="history-card-icon" />
                  <h3 id="history-caption-title">Social caption</h3>
                </div>
                <Button
                  variant="ghost"
                  size="xs"
                  icon="copy"
                  onClick={copyCaption}
                  title="Copy caption to clipboard"
                >
                  Copy caption
                </Button>
              </div>
              <div className="history-card-body">
                <p className="history-caption-text">{job.caption}</p>
                <div className="history-caption-stats">
                  <span>{job.caption.length} characters</span>
                  <span aria-hidden="true">·</span>
                  <span>{job.caption.split(/\s+/).filter(Boolean).length} words</span>
                </div>
              </div>
            </section>
          ) : null}

          {job.facebook_post_url ? (
            <section className="history-card history-card-published">
              <div className="history-card-header">
                <div className="history-card-title-group">
                  <Icon name="globe" size={17} className="history-card-icon" />
                  <h3>Facebook Page</h3>
                </div>
                <Badge variant="success" size="sm" dot>Published</Badge>
              </div>
              <div className="history-card-body">
                <p className="history-published-note">
                  This campaign was approved and published to your connected Facebook page.
                </p>
                <Button
                  href={job.facebook_post_url}
                  target="_blank"
                  rel="noreferrer"
                  variant="primary"
                  size="sm"
                  icon="arrow-up-right"
                  iconPosition="end"
                >
                  View post on Facebook
                </Button>
              </div>
            </section>
          ) : null}
        </div>

        <div className="history-col-specs">
          <section className="history-card history-card-specs" aria-labelledby="history-specs-title">
            <div className="history-card-header">
              <div className="history-card-title-group">
                <Icon name="file" size={17} className="history-card-icon" />
                <h3 id="history-specs-title">Campaign brief & setup</h3>
              </div>
              <Badge variant="neutral" size="sm">
                {job.language === "km" ? "Khmer" : "English"}
              </Badge>
            </div>
            <div className="history-card-body">
              {parsedBrief ? (
                <dl className="history-specs-list">
                  {Object.entries(parsedBrief).map(([label, value]) => (
                    <div key={label} className="history-spec-item">
                      <dt>{label}</dt>
                      <dd>{value}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <pre className="history-brief-raw">{job.brief}</pre>
              )}
            </div>
          </section>

          <QualityReport report={job.quality_report} />

          {assets.length ? (
            <section className="history-card history-card-assets" aria-labelledby="history-assets-title">
              <div className="history-card-header">
                <div className="history-card-title-group">
                  <Icon name="layers" size={17} className="history-card-icon" />
                  <h3 id="history-assets-title">Attached assets</h3>
                </div>
                <Badge variant="neutral" size="sm">
                  {assets.length} file{assets.length === 1 ? "" : "s"}
                </Badge>
              </div>
              <div className="history-card-body">
                <ul className="history-asset-list">
                  {assets.map((asset) => (
                    <li key={asset.id} className="history-asset-item">
                      <Icon name="file" size={14} />
                      <span title={asset.title || asset.name}>{asset.title || asset.name}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </article>
  );
}
