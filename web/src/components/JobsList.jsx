import { useEffect, useMemo, useRef, useState } from "react";
import Icon from "./Icon";
import { Button, EmptyState, Input, StatusBadge } from "./ui";

function jobTitle(job) {
  const raw = String(job.title || job.brief || "Untitled").trim();
  const firstLine = raw.split(/\n/)[0] || "Untitled";
  return firstLine;
}

function formatFriendlyDate(iso) {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now - d;
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return `${diffDays}d ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return iso;
  }
}

export default function JobsList({ jobs, activeJobId, error, onSelect, onRefresh }) {
  const [filter, setFilter] = useState("all");
  const [filterOpen, setFilterOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filterRef = useRef(null);

  useEffect(() => {
    if (!filterOpen) return;
    function handleClickOutside(e) {
      if (filterRef.current && !filterRef.current.contains(e.target)) {
        setFilterOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [filterOpen]);

  const counts = useMemo(() => {
    let live = 0;
    let review = 0;
    let posted = 0;
    let attention = 0;
    for (const job of jobs) {
      if (["queued", "generating", "collecting", "posting"].includes(job.status)) live++;
      if (job.status === "awaiting_approval") review++;
      if (job.status === "posted") posted++;
      if (["failed", "denied", "cancelled"].includes(job.status)) attention++;
    }
    return { all: jobs.length, live, review, posted, attention };
  }, [jobs]);

  const filterOptions = useMemo(() => [
    { id: "all", label: "All campaigns", badge: counts.all },
    { id: "review", label: "Needs review", badge: counts.review },
    { id: "live", label: "Live & generating", badge: counts.live },
    { id: "posted", label: "Posted to Facebook", badge: counts.posted },
    { id: "attention", label: "Issues & failed", badge: counts.attention },
  ], [counts]);

  const activeOption = filterOptions.find((o) => o.id === filter) || filterOptions[0];

  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (
        filter === "live" &&
        !["queued", "generating", "collecting", "posting"].includes(job.status)
      ) {
        return false;
      }
      if (filter === "review" && job.status !== "awaiting_approval") {
        return false;
      }
      if (filter === "posted" && job.status !== "posted") {
        return false;
      }
      if (
        filter === "attention" &&
        !["failed", "denied", "cancelled"].includes(job.status)
      ) {
        return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchTitle = (job.title || "").toLowerCase().includes(q);
        const matchBrief = (job.brief || "").toLowerCase().includes(q);
        const matchId = (job.id || "").toLowerCase().includes(q);
        if (!matchTitle && !matchBrief && !matchId) return false;
      }
      return true;
    });
  }, [jobs, filter, search]);

  return (
    <aside className="history-list" aria-label="Campaign history navigation">
      <div className="history-list-head">
        <div className="history-list-heading">
          <p className="panel-kicker">Workspace</p>
          <div className="history-list-title-row">
            <h2>Campaigns</h2>
            <span className="history-list-count-badge">
              {filteredJobs.length}{filteredJobs.length !== jobs.length ? ` / ${jobs.length}` : ""}
            </span>
          </div>
        </div>
        <Button
          variant="ghost"
          size="xs"
          icon="refresh"
          onClick={onRefresh}
          aria-label="Refresh campaigns"
          title="Refresh list"
        >
          Refresh
        </Button>
      </div>

      <div className="history-list-controls">
        <div className="history-search-wrap">
          <Input
            type="search"
            icon="activity"
            size="sm"
            placeholder="Search campaigns, ID, brief…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search ? (
            <button
              type="button"
              className="history-search-clear"
              onClick={() => setSearch("")}
              aria-label="Clear search"
            >
              <Icon name="x" size={13} />
            </button>
          ) : null}
        </div>
        <div className="history-filter-dropdown" ref={filterRef}>
          <button
            type="button"
            className={`history-filter-trigger ${filterOpen ? "is-open" : ""} ${filter !== "all" ? "has-filter" : ""}`}
            onClick={() => setFilterOpen((prev) => !prev)}
            aria-haspopup="listbox"
            aria-expanded={filterOpen}
            aria-label="Filter campaigns by status"
          >
            <div className="history-filter-trigger-label">
              <Icon name="filter" size={13} className="history-filter-icon" />
              <span className="history-filter-prefix">Status:</span>
              <strong className="history-filter-curr-name">{activeOption.label}</strong>
              <span className="history-filter-badge">{activeOption.badge}</span>
            </div>
            <Icon
              name="chevron-down"
              size={13}
              className={`history-filter-chevron ${filterOpen ? "is-open" : ""}`}
            />
          </button>

          {filterOpen ? (
            <ul className="history-filter-menu" role="listbox" aria-label="Status filters">
              {filterOptions.map((opt) => {
                const isSelected = opt.id === filter;
                return (
                  <li key={opt.id} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      className={`history-filter-item ${isSelected ? "is-active" : ""}`}
                      onClick={() => {
                        setFilter(opt.id);
                        setFilterOpen(false);
                      }}
                    >
                      <span className="history-filter-item-name">{opt.label}</span>
                      <div className="history-filter-item-meta">
                        <span className="history-filter-badge">{opt.badge}</span>
                        {isSelected ? (
                          <Icon name="check" size={13} className="history-filter-check" />
                        ) : null}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      </div>

      <div className="history-list-scroll">
        {!error && !filteredJobs.length ? (
          <EmptyState
            icon="layers"
            title={jobs.length ? "No matching campaigns" : "No campaigns yet"}
            description={
              jobs.length
                ? "Try adjusting your search query or status filter."
                : "Create a video to see your campaign history here."
            }
            action={
              !jobs.length ? (
                <Button to="/dashboard/compose" variant="primary" size="sm" icon="plus">
                  Make a video
                </Button>
              ) : (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilter("all");
                    setSearch("");
                  }}
                >
                  Reset filters
                </Button>
              )
            }
          />
        ) : null}

        {!error && filteredJobs.length ? (
          <ul className="history-queue-list">
            {filteredJobs.map((job) => {
              const selected = job.id === activeJobId;
              const hasVideo = Boolean(job.video_path || job.video_url);
              const hasFacebook = Boolean(job.facebook_post_url);

              return (
                <li key={job.id}>
                  <button
                    type="button"
                    className={`history-queue-item ${selected ? "is-selected" : ""}`}
                    aria-current={selected ? "true" : undefined}
                    onClick={() => onSelect(job.id)}
                  >
                    <div className="history-queue-item-top">
                      <StatusBadge status={job.status} size="sm" />
                      <span className="history-queue-id">#{job.id.slice(0, 8)}</span>
                      <span className="history-queue-time">
                        {formatFriendlyDate(job.updated_at || job.created_at)}
                      </span>
                    </div>

                    <strong className="history-queue-title">{jobTitle(job)}</strong>

                    <div className="history-queue-footer">
                      <span className="history-queue-pill">
                        {job.language === "km" ? "ខ្មែរ" : "EN"}
                      </span>
                      {hasVideo ? (
                        <span className="history-queue-pill has-video" title="Video ready">
                          <Icon name="video" size={11} /> Video
                        </span>
                      ) : null}
                      {hasFacebook ? (
                        <span className="history-queue-pill is-published" title="Published to Facebook">
                          <Icon name="globe" size={11} /> Facebook
                        </span>
                      ) : null}
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </aside>
  );
}
