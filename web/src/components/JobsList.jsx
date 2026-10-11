import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon";
import { Alert, Button, EmptyState, Input, Panel, StatusBadge, Tabs } from "./ui";
import { formatTime } from "../flow";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "live", label: "In progress" },
  { id: "review", label: "Awaiting approval" },
  { id: "posted", label: "Published" },
  { id: "attention", label: "Needs attention" },
];

export default function JobsList({ jobs, activeJobId, error, onSelect, onRefresh }) {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

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
    <Panel
      kicker="Campaign history"
      title={
        <>
          All campaigns <span className="jobs-count">{filteredJobs.length}</span>
        </>
      }
      subtitle="Select a campaign to review its script, preview the video, approve, or make a revision."
      action={
        <Button variant="ghost" size="xs" icon="refresh" onClick={onRefresh}>
          Refresh
        </Button>
      }
      className="jobs"
      id="jobs"
      aria-labelledby="jobs-title"
    >
      <div className="jobs-controls">
        <div className="jobs-search-wrap">
          <Input
            type="search"
            icon="activity"
            size="sm"
            placeholder="Search campaigns by name, brief, or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="jobs-filters-row">
          <Tabs
            items={FILTERS}
            activeId={filter}
            onChange={setFilter}
            size="sm"
            ariaLabel="Filter campaigns by status"
          />
        </div>
      </div>

      <div className="jobs-list">
        {error ? (
          <Alert tone="danger" title="Could not load campaigns">
            {error}
          </Alert>
        ) : null}

        {!error && !filteredJobs.length ? (
          <EmptyState
            icon="layers"
            title={jobs.length ? "No campaigns match your filter" : "Your first campaign starts here"}
            description={
              jobs.length
                ? "Try clearing your search query or selecting a different status filter."
                : "Create a brief and we’ll turn it into a video. Your campaigns will appear here as they progress."
            }
            action={
              !jobs.length ? (
                <Button to="/dashboard/compose" variant="primary" size="sm" icon="plus">
                  Create a campaign
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
                  Clear filters
                </Button>
              )
            }
          />
        ) : null}

        {!error
          ? filteredJobs.map((job) => {
              const metaBits = [
                formatTime(job.updated_at || job.created_at),
                job.video_path ? "Video ready" : null,
                job.facebook_post_url ? "Published" : null,
                job.error ? "Needs attention" : null,
              ].filter(Boolean);
              const selected = job.id === activeJobId ? "is-selected" : "";
              return (
                <button
                  key={job.id}
                  type="button"
                  className={`job-row ${selected}`}
                  aria-pressed={Boolean(selected)}
                  onClick={() => onSelect(job.id)}
                >
                  <span className="job-row-icon">
                    <Icon name="video" size={19} />
                  </span>
                  <span className="job-row-main">
                    <span className="job-brief">
                      {job.title || job.brief || "Untitled campaign"}
                    </span>
                    <span className="job-meta">{metaBits.join(" · ")}</span>
                  </span>
                  <span className="job-row-end">
                    <StatusBadge status={job.status} />
                    <span className="job-id">#{job.id.slice(0, 8)}</span>
                  </span>
                  <span className="job-row-chevron">
                    <Icon name="chevron-right" size={17} />
                  </span>
                </button>
              );
            })
          : null}
      </div>
    </Panel>
  );
}
