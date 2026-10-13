import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  createSchedule,
  deleteSchedule,
  fetchIntegrations,
  fetchSchedules,
  fetchPromotions,
  runScheduleNow,
  toggleSchedule,
  updateSchedule,
} from "../../api";
import { notify } from "../../toast";
import Icon from "../../components/Icon";
import { Badge, Button, Card, EmptyState, Input, Spinner, StatusBadge } from "../../components/ui";

const DAYS_OF_WEEK = [
  { id: "mon", label: "Mon", full: "Monday" },
  { id: "tue", label: "Tue", full: "Tuesday" },
  { id: "wed", label: "Wed", full: "Wednesday" },
  { id: "thu", label: "Thu", full: "Thursday" },
  { id: "fri", label: "Fri", full: "Friday" },
  { id: "sat", label: "Sat", full: "Saturday" },
  { id: "sun", label: "Sun", full: "Sunday" },
];

const VIDEO_STYLES = [
  "Warm and friendly",
  "Energetic & bold",
  "Professional & sleek",
  "Modern & upbeat",
];

const LENGTHS = [
  { sec: 15, label: "15s · Quick hook" },
  { sec: 30, label: "30s · Balanced" },
  { sec: 45, label: "45s · Detailed" },
  { sec: 60, label: "60s · Story" },
];

function formatFriendlyNextRun(iso) {
  if (!iso) return "Not scheduled";
  try {
    const target = new Date(iso);
    const now = new Date();
    const diffMs = target - now;
    if (diffMs < 0) return "Due now";
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 60) return `In ${diffMins}m (${target.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `In ${diffHours}h (${target.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })})`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return `Tomorrow at ${target.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
    return `${target.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} at ${target.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`;
  } catch {
    return iso;
  }
}

function formatDays(days = []) {
  if (!days || !days.length) return "No days";
  if (days.length === 7) return "Every day";
  if (days.length === 5 && !days.includes("sat") && !days.includes("sun")) return "Weekdays (Mon–Fri)";
  if (days.length === 2 && days.includes("sat") && days.includes("sun")) return "Weekends (Sat–Sun)";
  return days.map((d) => d.charAt(0).toUpperCase() + d.slice(1)).join(", ");
}

export default function SchedulesPage() {
  const [schedules, setSchedules] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [facebookConfigured, setFacebookConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);
  const [saving, setSaving] = useState(false);
  const [runningId, setRunningId] = useState(null);

  // Form State
  const [contentMode, setContentMode] = useState("custom"); // custom | profile | weekly
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [language, setLanguage] = useState("en");
  const [videoStyle, setVideoStyle] = useState("Warm and friendly");
  const [targetDuration, setTargetDuration] = useState(30);
  const [scheduleType, setScheduleType] = useState("recurring"); // recurring | once
  const [timeOfDay, setTimeOfDay] = useState("09:00");
  const [selectedDays, setSelectedDays] = useState(["mon", "wed", "fri"]);
  const [runAt, setRunAt] = useState("");
  const [autoPostFacebook, setAutoPostFacebook] = useState(true);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [schedRes, profRes, integRes] = await Promise.all([
        fetchSchedules().catch(() => ({ schedules: [] })),
        fetchPromotions().catch(() => ({ promotions: [] })),
        fetchIntegrations().catch(() => ({})),
      ]);
      setSchedules(schedRes.schedules || []);
      setProfiles(profRes.promotions || profRes.profiles || []);
      setFacebookConfigured(Boolean(integRes.facebook_connected || integRes.facebook_page_id));
    } catch (err) {
      setError(err.message || "Failed to load schedules.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openCreateModal() {
    setEditingSchedule(null);
    setContentMode("custom");
    setTitle("");
    setBrief("");
    setLanguage("en");
    setVideoStyle("Warm and friendly");
    setTargetDuration(30);
    setScheduleType("recurring");
    setTimeOfDay("09:00");
    setSelectedDays(["mon", "wed", "fri"]);
    setRunAt("");
    setAutoPostFacebook(true);
    setModalOpen(true);
  }

  function openEditModal(sched) {
    setEditingSchedule(sched);
    setContentMode("custom");
    setTitle(sched.title || "");
    setBrief(sched.brief || "");
    setLanguage(sched.language || "en");
    setVideoStyle(sched.video_style || "Warm and friendly");
    setTargetDuration(sched.target_duration || 30);
    setScheduleType(sched.schedule_type || "recurring");
    setTimeOfDay(sched.time_of_day || "09:00");
    setSelectedDays(sched.days_of_week || ["mon", "wed", "fri"]);
    setRunAt(sched.run_at || "");
    setAutoPostFacebook(Boolean(sched.auto_post_facebook));
    setModalOpen(true);
  }

  function handleProfileSelect(profileId) {
    const prof = profiles.find((p) => p.id === profileId);
    if (!prof) return;
    if (!title) setTitle(`${prof.name} Automated Spotlight`);
    const briefText = [
      `Name: ${prof.name}`,
      `Promotion type: ${prof.promotion_type || "Product"}`,
      prof.offer ? `Offer: ${prof.offer}` : "",
      prof.benefit ? `Main customer benefit: ${prof.benefit}` : "",
      prof.destination ? `Action destination: ${prof.destination}` : "",
    ].filter(Boolean).join("\n");
    setBrief(briefText);
  }

  function handleWeeklyRoleSelect(role) {
    const roles = {
      awareness: {
        title: "Weekly Brand Awareness Post",
        brief: "Create an engaging hook introducing the core problem and everyday frustration our business solves for customers. Warm, relatable tone with a clear invitation to check our page.",
      },
      product: {
        title: "Weekly Product Showcase Post",
        brief: "Deep dive into our product features, craftsmanship, and benefits. Show how easy it is to use and why customers love it.",
      },
      offer: {
        title: "Weekly Weekend Special Offer Post",
        brief: "Highlight our current special promotion, package, or customer benefit. Strong direct call to action to order or message us today.",
      },
    };
    const chosen = roles[role];
    if (chosen) {
      setTitle(chosen.title);
      setBrief(chosen.brief);
    }
  }

  function toggleDay(dayId) {
    setSelectedDays((prev) =>
      prev.includes(dayId) ? prev.filter((d) => d !== dayId) : [...prev, dayId]
    );
  }

  async function handleSaveSchedule(e) {
    e.preventDefault();
    if (!title.trim() || !brief.trim()) {
      notify.error("Please provide both a title and campaign brief.");
      return;
    }
    if (scheduleType === "recurring" && !selectedDays.length) {
      notify.error("Please select at least one day of the week.");
      return;
    }
    if (scheduleType === "once" && !runAt) {
      notify.error("Please select a date and time for the one-off schedule.");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        brief: brief.trim(),
        language,
        video_style: videoStyle,
        target_duration: targetDuration,
        schedule_type: scheduleType,
        time_of_day: timeOfDay,
        days_of_week: selectedDays,
        run_at: scheduleType === "once" ? runAt : null,
        auto_post_facebook: autoPostFacebook,
        is_active: true,
      };

      if (editingSchedule) {
        await updateSchedule(editingSchedule.id, payload);
        notify.success("Schedule updated successfully.");
      } else {
        await createSchedule(payload);
        notify.success("New automated schedule created.");
      }
      setModalOpen(false);
      loadData();
    } catch (err) {
      notify.error(err.message || "Could not save schedule.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(sched) {
    try {
      const res = await toggleSchedule(sched.id);
      notify.info(
        res.schedule.is_active
          ? `Schedule "${sched.title}" resumed.`
          : `Schedule "${sched.title}" paused.`
      );
      loadData();
    } catch (err) {
      notify.error(err.message || "Could not toggle schedule.");
    }
  }

  async function handleRunNow(sched) {
    if (runningId) return;
    setRunningId(sched.id);
    try {
      const res = await runScheduleNow(sched.id);
      if (res.ok) {
        notify.success(res.message || "Campaign generated! Rendering video now.");
      } else {
        notify.error(res.message || "Run failed.");
      }
      loadData();
    } catch (err) {
      notify.error(err.message || "Failed to trigger run.");
    } finally {
      setRunningId(null);
    }
  }

  async function handleDelete(sched) {
    if (!window.confirm(`Are you sure you want to delete the schedule "${sched.title}"?`)) {
      return;
    }
    try {
      await deleteSchedule(sched.id);
      notify.success("Schedule deleted.");
      loadData();
    } catch (err) {
      notify.error(err.message || "Failed to delete schedule.");
    }
  }

  // Derived Stats
  const activeCount = useMemo(() => schedules.filter((s) => s.is_active).length, [schedules]);
  const autoFbCount = useMemo(
    () => schedules.filter((s) => s.is_active && s.auto_post_facebook).length,
    [schedules]
  );
  const nextUpcoming = useMemo(() => {
    const active = schedules.filter((s) => s.is_active && s.next_run_at);
    if (!active.length) return null;
    active.sort((a, b) => new Date(a.next_run_at) - new Date(b.next_run_at));
    return active[0];
  }, [schedules]);

  return (
    <div className="schedules-page">
      <header className="page-header schedules-header">
        <div className="page-header-content">
          <p className="panel-kicker">Automation & Scheduling</p>
          <h1 className="page-title">Automated Schedules</h1>
          <p className="page-description">
            Schedule automatic AI video creation and hands-free publishing directly to your connected Facebook Page.
          </p>
        </div>
        <div className="page-header-actions">
          <Button variant="primary" size="md" icon="plus" onClick={openCreateModal}>
            New Schedule
          </Button>
        </div>
      </header>

      {/* Stats row */}
      <section className="schedules-stats-grid" aria-label="Schedule statistics">
        <div className="sched-stat-card">
          <div className="sched-stat-icon">
            <Icon name="calendar" size={20} />
          </div>
          <div className="sched-stat-info">
            <span className="sched-stat-label">Total Schedules</span>
            <strong className="sched-stat-value">{schedules.length}</strong>
            <span className="sched-stat-sub">{activeCount} active</span>
          </div>
        </div>

        <div className="sched-stat-card">
          <div className="sched-stat-icon is-fb">
            <Icon name="globe" size={20} />
          </div>
          <div className="sched-stat-info">
            <span className="sched-stat-label">Auto-Post to Facebook</span>
            <strong className="sched-stat-value">{autoFbCount}</strong>
            <span className="sched-stat-sub">
              {facebookConfigured ? "Facebook Page connected" : "Setup Page in Settings"}
            </span>
          </div>
        </div>

        <div className="sched-stat-card">
          <div className="sched-stat-icon is-next">
            <Icon name="clock" size={20} />
          </div>
          <div className="sched-stat-info">
            <span className="sched-stat-label">Next Execution</span>
            <strong className="sched-stat-value is-next-val">
              {nextUpcoming ? formatFriendlyNextRun(nextUpcoming.next_run_at) : "None scheduled"}
            </strong>
            <span className="sched-stat-sub">
              {nextUpcoming ? nextUpcoming.title : "Activate a schedule"}
            </span>
          </div>
        </div>
      </section>

      {/* Schedules List */}
      <main className="schedules-main">
        {loading ? (
          <div className="schedules-loading">
            <Spinner size="lg" />
            <p>Loading scheduled campaigns…</p>
          </div>
        ) : error ? (
          <div className="schedules-error" role="alert">
            <Icon name="alert" size={20} />
            <p>{error}</p>
            <Button variant="ghost" size="sm" onClick={loadData}>
              Try again
            </Button>
          </div>
        ) : !schedules.length ? (
          <EmptyState
            icon="calendar"
            title="No automated schedules yet"
            description="Create your first schedule to let the marketing agent automatically write scripts, render vertical videos, and publish them to Facebook on your timetable."
            action={
              <Button variant="primary" size="md" icon="plus" onClick={openCreateModal}>
                Create your first schedule
              </Button>
            }
          />
        ) : (
          <div className="schedules-grid">
            {schedules.map((sched) => {
              const isRunning = runningId === sched.id || sched.last_status === "running";
              return (
                <article
                  key={sched.id}
                  className={`sched-card ${sched.is_active ? "is-active" : "is-paused"}`}
                  aria-labelledby={`sched-title-${sched.id}`}
                >
                  <header className="sched-card-head">
                    <div className="sched-card-title-group">
                      <div className="sched-card-top-row">
                        <button
                          type="button"
                          className={`sched-toggle-pill ${sched.is_active ? "active" : "paused"}`}
                          onClick={() => handleToggle(sched)}
                          title={sched.is_active ? "Click to pause" : "Click to resume"}
                        >
                          <span className="sched-pulse-dot" />
                          <span>{sched.is_active ? "Active" : "Paused"}</span>
                        </button>
                        <span className="sched-time-pill">
                          <Icon name="clock" size={12} />
                          <span>
                            {sched.schedule_type === "recurring"
                              ? `${formatDays(sched.days_of_week)} · ${sched.time_of_day}`
                              : `One-off · ${sched.time_of_day || ""}`}
                          </span>
                        </span>
                      </div>
                      <h2 id={`sched-title-${sched.id}`} className="sched-card-title">
                        {sched.title}
                      </h2>
                    </div>

                    <div className="sched-card-badges">
                      {sched.auto_post_facebook ? (
                        <span className="sched-badge has-fb" title="Direct publishing to Facebook">
                          <Icon name="globe" size={11} /> Auto-Post Facebook
                        </span>
                      ) : (
                        <span className="sched-badge is-review" title="Requires manual approval">
                          <Icon name="shield" size={11} /> Review First
                        </span>
                      )}
                      <span className="sched-badge">
                        {sched.language === "km" ? "🇰🇭 Khmer" : "🇬🇧 English"}
                      </span>
                      <span className="sched-badge">{sched.target_duration}s</span>
                    </div>
                  </header>

                  <div className="sched-card-body">
                    <p className="sched-brief-preview">{sched.brief}</p>

                    <div className="sched-card-meta-row">
                      <div className="sched-meta-item">
                        <span className="sched-meta-label">Next Run</span>
                        <strong className="sched-meta-val">
                          {sched.is_active ? formatFriendlyNextRun(sched.next_run_at) : "Paused"}
                        </strong>
                      </div>
                      {sched.last_run_at ? (
                        <div className="sched-meta-item">
                          <span className="sched-meta-label">Last Run</span>
                          <span className="sched-meta-val">
                            {formatFriendlyNextRun(sched.last_run_at).replace("In", "")}
                            {sched.last_status === "success" && (
                              <span className="sched-run-tag success">✓ Success</span>
                            )}
                            {sched.last_status === "failed" && (
                              <span className="sched-run-tag failed">⚠ Failed</span>
                            )}
                          </span>
                        </div>
                      ) : (
                        <div className="sched-meta-item">
                          <span className="sched-meta-label">Executions</span>
                          <span className="sched-meta-val">{sched.run_count} runs</span>
                        </div>
                      )}
                    </div>

                    {sched.last_job_id ? (
                      <div className="sched-last-job-link">
                        <Link to="/dashboard/jobs" className="sched-job-anchor">
                          <span>View last generated campaign (#{sched.last_job_id.slice(0, 8)})</span>
                          <Icon name="arrow-up-right" size={13} />
                        </Link>
                      </div>
                    ) : null}
                  </div>

                  <footer className="sched-card-footer">
                    <Button
                      variant="primary"
                      size="xs"
                      icon="play"
                      loading={isRunning}
                      loadingText="Running…"
                      onClick={() => handleRunNow(sched)}
                      title="Instantly generate and test this schedule now"
                    >
                      Run Now
                    </Button>
                    <div className="sched-footer-btn-group">
                      <Button
                        variant="ghost"
                        size="xs"
                        icon="refresh"
                        onClick={() => openEditModal(sched)}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        icon="trash"
                        onClick={() => handleDelete(sched)}
                        aria-label="Delete schedule"
                      >
                        Delete
                      </Button>
                    </div>
                  </footer>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {/* Modal: Create / Edit Schedule */}
      {modalOpen && (
        <div className="ui-modal-overlay" role="dialog" aria-modal="true">
          <div className="ui-modal-card sched-modal-card">
            <div className="ui-modal-head">
              <div>
                <p className="panel-kicker">Automation Setup</p>
                <h2 className="ui-modal-title">
                  {editingSchedule ? "Edit Schedule" : "Create Automated Schedule"}
                </h2>
              </div>
              <button
                type="button"
                className="ui-modal-close"
                onClick={() => setModalOpen(false)}
                aria-label="Close modal"
              >
                <Icon name="x" size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveSchedule} className="sched-modal-form">
              {/* Content Source Selection */}
              <div className="sched-source-tabs">
                <button
                  type="button"
                  className={`sched-source-tab ${contentMode === "custom" ? "active" : ""}`}
                  onClick={() => setContentMode("custom")}
                >
                  <Icon name="sparkles" size={14} />
                  <span>Custom Topic</span>
                </button>
                <button
                  type="button"
                  className={`sched-source-tab ${contentMode === "profile" ? "active" : ""}`}
                  onClick={() => setContentMode("profile")}
                >
                  <Icon name="file" size={14} />
                  <span>Saved Business Profile</span>
                </button>
                <button
                  type="button"
                  className={`sched-source-tab ${contentMode === "weekly" ? "active" : ""}`}
                  onClick={() => setContentMode("weekly")}
                >
                  <Icon name="clock" size={14} />
                  <span>Weekly Series Role</span>
                </button>
              </div>

              {contentMode === "profile" && (
                <div className="sched-helper-box">
                  <label htmlFor="sched-profile-select">Choose business profile:</label>
                  {profiles.length ? (
                    <select
                      id="sched-profile-select"
                      className="ui-select"
                      onChange={(e) => handleProfileSelect(e.target.value)}
                      defaultValue=""
                    >
                      <option value="" disabled>
                        Select a saved business profile…
                      </option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.promotion_type || "Business"})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="sched-helper-empty">
                      No business profiles saved yet. Fill in custom details below.
                    </p>
                  )}
                </div>
              )}

              {contentMode === "weekly" && (
                <div className="sched-weekly-roles">
                  <button
                    type="button"
                    className="sched-role-btn"
                    onClick={() => handleWeeklyRoleSelect("awareness")}
                  >
                    <strong>Monday · Awareness</strong>
                    <span>Frustration & empathy hook</span>
                  </button>
                  <button
                    type="button"
                    className="sched-role-btn"
                    onClick={() => handleWeeklyRoleSelect("product")}
                  >
                    <strong>Wednesday · Product</strong>
                    <span>Feature spotlight & proof</span>
                  </button>
                  <button
                    type="button"
                    className="sched-role-btn"
                    onClick={() => handleWeeklyRoleSelect("offer")}
                  >
                    <strong>Friday · Offer</strong>
                    <span>Weekend special & CTA</span>
                  </button>
                </div>
              )}

              {/* Title & Brief */}
              <div className="sched-form-group">
                <label htmlFor="sched-title-input">Schedule Name</label>
                <Input
                  id="sched-title-input"
                  placeholder="e.g. Wednesday Product Spotlight Reel"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="sched-form-group">
                <label htmlFor="sched-brief-input">What should the video promote?</label>
                <textarea
                  id="sched-brief-input"
                  className="ui-textarea"
                  rows={4}
                  placeholder="Business details, offer, key benefits, customer target, call to action…"
                  value={brief}
                  onChange={(e) => setBrief(e.target.value)}
                  required
                />
              </div>

              {/* Language & Video Options */}
              <div className="sched-form-row">
                <div className="sched-form-group">
                  <label htmlFor="sched-lang-select">Language</label>
                  <select
                    id="sched-lang-select"
                    className="ui-select"
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                  >
                    <option value="en">🇬🇧 English</option>
                    <option value="km">🇰🇭 Khmer · ភាសាខ្មែរ</option>
                  </select>
                </div>

                <div className="sched-form-group">
                  <label htmlFor="sched-style-select">Video Style</label>
                  <select
                    id="sched-style-select"
                    className="ui-select"
                    value={videoStyle}
                    onChange={(e) => setVideoStyle(e.target.value)}
                  >
                    {VIDEO_STYLES.map((s) => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sched-form-group">
                  <label htmlFor="sched-duration-select">Target Length</label>
                  <select
                    id="sched-duration-select"
                    className="ui-select"
                    value={targetDuration}
                    onChange={(e) => setTargetDuration(Number(e.target.value))}
                  >
                    {LENGTHS.map((l) => (
                      <option key={l.sec} value={l.sec}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Schedule Type & Days */}
              <div className="sched-schedule-box">
                <div className="sched-box-head">
                  <label>Schedule Timing</label>
                  <div className="sched-type-toggle">
                    <button
                      type="button"
                      className={`sched-type-btn ${scheduleType === "recurring" ? "active" : ""}`}
                      onClick={() => setScheduleType("recurring")}
                    >
                      Recurring Weekly
                    </button>
                    <button
                      type="button"
                      className={`sched-type-btn ${scheduleType === "once" ? "active" : ""}`}
                      onClick={() => setScheduleType("once")}
                    >
                      One-time Date
                    </button>
                  </div>
                </div>

                {scheduleType === "recurring" ? (
                  <div className="sched-days-picker">
                    <span className="sched-days-label">Select days of week:</span>
                    <div className="sched-days-row">
                      {DAYS_OF_WEEK.map((d) => {
                        const isSelected = selectedDays.includes(d.id);
                        return (
                          <button
                            key={d.id}
                            type="button"
                            className={`sched-day-pill ${isSelected ? "selected" : ""}`}
                            onClick={() => toggleDay(d.id)}
                            aria-pressed={isSelected}
                          >
                            {d.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="sched-form-group">
                    <label htmlFor="sched-date-input">Execution Date & Time</label>
                    <input
                      id="sched-date-input"
                      type="datetime-local"
                      className="ui-input"
                      value={runAt}
                      onChange={(e) => setRunAt(e.target.value)}
                      required
                    />
                  </div>
                )}

                <div className="sched-time-row">
                  <div className="sched-form-group">
                    <label htmlFor="sched-time-input">Execution Time</label>
                    <input
                      id="sched-time-input"
                      type="time"
                      className="ui-input"
                      value={timeOfDay}
                      onChange={(e) => setTimeOfDay(e.target.value)}
                      required
                    />
                  </div>
                  <div className="sched-tz-note">
                    <span>Timezone: <strong>Asia/Phnom_Penh (GMT+7)</strong></span>
                  </div>
                </div>
              </div>

              {/* Publishing Mode Toggle */}
              <div className="sched-publish-toggle-box">
                <div className="sched-publish-left">
                  <div className="sched-publish-title-row">
                    <Icon name="globe" size={17} className="sched-fb-icon" />
                    <strong>Auto-Post directly to Facebook Page</strong>
                  </div>
                  <p className="sched-publish-desc">
                    {autoPostFacebook
                      ? "Hands-free: Once rendered, the video will automatically upload and publish to your connected Facebook Page."
                      : "Review first: Video is generated and saved as awaiting approval on Telegram & Dashboard."}
                  </p>
                  {!facebookConfigured && autoPostFacebook && (
                    <p className="sched-fb-warning">
                      ⚠️ Note: Connect your Facebook Page in Settings to enable direct posting.
                    </p>
                  )}
                </div>
                <label className="sched-switch">
                  <input
                    type="checkbox"
                    checked={autoPostFacebook}
                    onChange={(e) => setAutoPostFacebook(e.target.checked)}
                  />
                  <span className="sched-slider" />
                </label>
              </div>

              <div className="ui-modal-actions">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={saving}
                  loadingText="Saving schedule…"
                >
                  {editingSchedule ? "Update Schedule" : "Create Schedule"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
