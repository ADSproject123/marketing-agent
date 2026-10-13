import { useEffect } from "react";
import JobDetail from "../../components/JobDetail";
import JobsList from "../../components/JobsList";
import { useDashboard } from "../../dashboard/DashboardContext";

export default function JobsPage() {
  const { jobs, activeJobId, jobsError, setActiveJobId, loadJobs, activeJob } =
    useDashboard();

  // On desktop, auto-select the latest campaign if none selected
  useEffect(() => {
    if (!activeJobId && jobs.length > 0 && typeof window !== "undefined" && window.innerWidth > 900) {
      setActiveJobId(jobs[0].id);
    }
  }, [activeJobId, jobs, setActiveJobId]);

  // Keyboard navigation up / down through campaigns
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (["INPUT", "TEXTAREA"].includes(event.target.tagName)) return;
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      if (!jobs.length) return;

      const currentIndex = jobs.findIndex((j) => j.id === activeJobId);
      if (event.key === "ArrowDown") {
        event.preventDefault();
        const next = currentIndex < jobs.length - 1 ? currentIndex + 1 : 0;
        setActiveJobId(jobs[next].id);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        const prev = currentIndex > 0 ? currentIndex - 1 : jobs.length - 1;
        setActiveJobId(jobs[prev].id);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [jobs, activeJobId, setActiveJobId]);

  return (
    <section
      className={`history-page ${activeJob ? "has-selection" : "no-selection"}`}
      aria-label="Campaign history workspace"
    >
      <JobsList
        jobs={jobs}
        activeJobId={activeJobId}
        error={jobsError}
        onSelect={setActiveJobId}
        onRefresh={() => loadJobs()}
      />
      <JobDetail
        job={activeJob}
        onRefresh={() => loadJobs()}
        onBack={() => setActiveJobId(null)}
      />
    </section>
  );
}
