import Icon from "../Icon";
import { Alert, Button } from "../ui";

const DAY_LABELS = {
  monday: "Monday",
  wednesday: "Wednesday",
  friday: "Friday",
};

const ROLE_LABELS = {
  awareness: "Awareness",
  product: "Product",
  offer: "Offer",
};

export default function StepWeeklyPlan({
  posts = [],
  selectedDays = [],
  onToggleDay,
  onSelectAll,
  onCreateSelected,
  onBack,
  busy = false,
  status = "",
  statusClass = "",
}) {
  const selectedCount = selectedDays.length;
  const allSelected = posts.length > 0 && selectedCount === posts.length;

  return (
    <section className="panel compose campaign-wizard" aria-labelledby="weekly-plan-title">
      <div className="campaign-step-head">
        <p className="panel-kicker">Weekly plan</p>
        <h2 id="weekly-plan-title" tabIndex={-1}>Your 3-post week</h2>
        <p>Pick which posts to turn into script drafts. You can edit each script before generating a video.</p>
      </div>

      <div className="weekly-plan-toolbar">
        <button
          type="button"
          className="weekly-plan-select-all"
          onClick={() => onSelectAll(!allSelected)}
          disabled={busy || !posts.length}
        >
          {allSelected ? "Clear selection" : "Select all"}
        </button>
        <span className="weekly-plan-count">{selectedCount} of {posts.length} selected</span>
      </div>

      <ul className="weekly-plan-list">
        {posts.map((post) => {
          const checked = selectedDays.includes(post.day);
          const id = `weekly-post-${post.day}`;
          return (
            <li key={post.day} className={`weekly-plan-card ${checked ? "is-selected" : ""}`}>
              <label className="weekly-plan-card-label" htmlFor={id}>
                <input
                  id={id}
                  type="checkbox"
                  checked={checked}
                  disabled={busy}
                  onChange={() => onToggleDay(post.day)}
                />
                <span className="weekly-plan-card-body">
                  <span className="weekly-plan-card-meta">
                    <span className="weekly-plan-day">{DAY_LABELS[post.day] || post.day}</span>
                    <span className="weekly-plan-role">{ROLE_LABELS[post.role] || post.role}</span>
                  </span>
                  <strong className="weekly-plan-title">{post.title}</strong>
                  <span className="weekly-plan-angle">{post.angle}</span>
                  <span className="weekly-plan-cta">
                    <Icon name="bolt" size={14} />
                    {post.cta}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>

      <div className="campaign-wizard-actions">
        <Button variant="ghost" size="md" onClick={onBack} disabled={busy}>
          Back to review
        </Button>
        <Button
          variant="primary"
          size="md"
          onClick={onCreateSelected}
          disabled={busy || selectedCount < 1}
          loading={busy}
          loadingText="Creating drafts…"
          icon={!busy ? "sparkles" : undefined}
          iconPosition="start"
        >
          Create selected drafts
        </Button>
      </div>
      {status ? (
        <Alert tone={statusClass === "is-err" ? "danger" : "success"} className="compose-status">
          {status}
        </Alert>
      ) : null}
    </section>
  );
}
