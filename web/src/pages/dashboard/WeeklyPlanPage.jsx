import { useMemo, useState } from "react";
import Icon from "../../components/Icon";
import { Button, Panel } from "../../components/ui";
import { useDashboard } from "../../dashboard/DashboardContext";
import { KINDS, VIDEO_LENGTHS } from "../../components/compose/constants";

const DAY_META = {
  monday: { label: "Monday", role: "Awareness", icon: "globe" },
  wednesday: { label: "Wednesday", role: "Product", icon: "layers" },
  friday: { label: "Friday", role: "Offer", icon: "bolt" },
};

export default function WeeklyPlanPage() {
  const {
    weeklyPlan,
    weeklySelectedDays,
    onWeeklyToggleDay,
    onWeeklySelectAll,
    onCreateWeeklyDrafts,
    onPlanWeek,
    onClearWeeklyPlan,
    campaignDraft,
    campaignErrors,
    onCampaignDraftChange,
    onPromotionSelect,
    promotions,
    profilesLoading,
    starting,
  } = useDashboard();

  const [setupTouched, setSetupTouched] = useState(false);
  const posts = Array.isArray(weeklyPlan) ? weeklyPlan : [];
  const hasPlan = posts.length === 3;
  const selectedCount = weeklySelectedDays.length;
  const allSelected = hasPlan && selectedCount === posts.length;
  const busy = starting;
  const selectedPromotion = useMemo(
    () => promotions.find((item) => item.id === campaignDraft.promotionId) || null,
    [promotions, campaignDraft.promotionId],
  );
  const setupErrors = setupTouched ? campaignErrors : {};
  const canGenerate = Boolean(campaignDraft.promotionId || campaignDraft.name?.trim());

  const change = (field) => (event) => {
    setSetupTouched(true);
    onCampaignDraftChange(field, event.target.value);
  };

  if (!hasPlan) {
    return (
      <div className="dash-page">
        <Panel className="weekly-plan-setup">
          <div className="weekly-plan-setup-section">
            <h2>Business</h2>
            {profilesLoading ? (
              <p className="campaign-saved-status" role="status">Loading…</p>
            ) : promotions.length === 0 ? (
              <div className="weekly-plan-setup-empty">
                <p>Add a business first.</p>
                <Button to="/dashboard/compose" variant="primary" size="sm" icon="sparkles" iconPosition="start">
                  Make a video
                </Button>
              </div>
            ) : (
              <div className="weekly-plan-biz-list" role="list">
                {promotions.map((promotion) => {
                  const kindLabel = KINDS.find((item) => item.value === promotion.kind)?.label || "Business";
                  const selected = campaignDraft.promotionId === promotion.id;
                  return (
                    <button
                      key={promotion.id}
                      type="button"
                      role="listitem"
                      className={`weekly-plan-biz-card ${selected ? "is-selected" : ""}`}
                      onClick={() => {
                        setSetupTouched(true);
                        onPromotionSelect(promotion.id);
                      }}
                      disabled={busy}
                    >
                      <span className="weekly-plan-biz-copy">
                        <strong>{promotion.name}</strong>
                        <small>{kindLabel}{promotion.location ? ` · ${promotion.location}` : ""}</small>
                      </span>
                      {selected ? <Icon name="check" size={16} /> : null}
                    </button>
                  );
                })}
              </div>
            )}
            {setupErrors.name || setupErrors.description || setupErrors.benefit ? (
              <p className="campaign-form-error" role="alert">Finish saving this business first.</p>
            ) : null}
          </div>

          <div className="weekly-plan-setup-section">
            <h2>Settings</h2>
            <fieldset className="campaign-language" disabled={busy}>
              <legend>Language</legend>
              <div className="campaign-language-options">
                <label className="campaign-language-option">
                  <input type="radio" name="weekly-language" value="en" checked={campaignDraft.language === "en"} onChange={change("language")} />
                  <span>English</span>
                </label>
                <label className="campaign-language-option">
                  <input type="radio" name="weekly-language" value="km" checked={campaignDraft.language === "km"} onChange={change("language")} />
                  <span>Khmer <span className="campaign-language-native" lang="km">ខ្មែរ</span></span>
                </label>
              </div>
            </fieldset>

            <div className="weekly-plan-length-grid" role="group" aria-label="Video length">
              {VIDEO_LENGTHS.map((item) => {
                const selected = (campaignDraft.videoLength || "30") === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    className={`weekly-plan-length-card ${selected ? "is-selected" : ""}`}
                    onClick={() => {
                      setSetupTouched(true);
                      onCampaignDraftChange("videoLength", item.value);
                    }}
                    disabled={busy}
                  >
                    <strong>{item.label}</strong>
                  </button>
                );
              })}
            </div>

            <label className="field">
              <span>Offer focus <span className="campaign-optional">Optional</span></span>
              <textarea
                name="offer"
                value={campaignDraft.offer || ""}
                onChange={change("offer")}
                maxLength={400}
                rows={2}
                disabled={busy}
                placeholder="Weekend special, new service, etc."
              />
            </label>
          </div>

          {promotions.length ? (
            <div className="weekly-plan-page-actions">
              <Button
                variant="primary"
                size="md"
                onClick={() => {
                  setSetupTouched(true);
                  onPlanWeek();
                }}
                disabled={busy || !canGenerate}
                loading={busy}
                loadingText="Planning…"
                icon={!busy ? "clock" : undefined}
                iconPosition="start"
              >
                Generate week
              </Button>
            </div>
          ) : null}
        </Panel>
      </div>
    );
  }

  return (
    <div className="dash-page">
      <Panel className="weekly-plan-page">
        <div className="weekly-plan-page-toolbar">
          <div>
            <h2>Schedule</h2>
            <p className="weekly-plan-page-sub">{selectedCount} selected</p>
          </div>
          <div className="weekly-plan-page-toolbar-actions">
            <button
              type="button"
              className="campaign-edit-btn"
              onClick={() => onWeeklySelectAll(!allSelected)}
              disabled={busy}
            >
              {allSelected ? "Clear" : "Select all"}
            </button>
          </div>
        </div>

        <ul className="weekly-plan-schedule">
          {posts.map((post, index) => {
            const meta = DAY_META[post.day] || {
              label: post.day,
              role: post.role,
              icon: "sparkles",
            };
            const checked = weeklySelectedDays.includes(post.day);
            const id = `weekly-schedule-${post.day}`;
            return (
              <li key={post.day} className={`weekly-plan-schedule-item ${checked ? "is-selected" : ""}`}>
                <label className="weekly-plan-schedule-label" htmlFor={id}>
                  <input
                    id={id}
                    type="checkbox"
                    checked={checked}
                    disabled={busy}
                    onChange={() => onWeeklyToggleDay(post.day)}
                  />
                  <span className="weekly-plan-schedule-day">
                    <span className="weekly-plan-schedule-index" aria-hidden="true">{index + 1}</span>
                    <span className="weekly-plan-schedule-day-copy">
                      <strong>{meta.label}</strong>
                      <span>{meta.role}</span>
                    </span>
                  </span>
                  <span className="weekly-plan-schedule-body">
                    <span className="weekly-plan-schedule-icon" aria-hidden="true">
                      <Icon name={meta.icon} size={18} />
                    </span>
                    <span className="weekly-plan-schedule-copy">
                      <strong>{post.title}</strong>
                      <span className="weekly-plan-schedule-angle">{post.angle}</span>
                      <span className="weekly-plan-schedule-cta">
                        <Icon name="bolt" size={13} />
                        {post.cta}
                      </span>
                    </span>
                  </span>
                  <span className={`weekly-plan-schedule-check ${checked ? "is-on" : ""}`} aria-hidden="true">
                    {checked ? <Icon name="check" size={12} /> : null}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>

        <div className="weekly-plan-page-actions">
          <Button variant="ghost" size="md" onClick={onClearWeeklyPlan} disabled={busy}>
            Back
          </Button>
          <Button
            variant="primary"
            size="md"
            onClick={onCreateWeeklyDrafts}
            disabled={busy || selectedCount < 1}
            loading={busy}
            loadingText="Creating…"
            icon={!busy ? "sparkles" : undefined}
            iconPosition="start"
          >
            Create {selectedCount} script{selectedCount === 1 ? "" : "s"}
          </Button>
        </div>
      </Panel>
    </div>
  );
}
