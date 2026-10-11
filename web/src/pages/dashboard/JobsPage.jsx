import JobDetail from "../../components/JobDetail";
import JobsList from "../../components/JobsList";
import { useDashboard } from "../../dashboard/DashboardContext";

export default function JobsPage() {
  const { jobs, activeJobId, jobsError, setActiveJobId, loadJobs, activeJob } =
    useDashboard();

  return (
    <div className="dash-page">
      <header className="dash-page-head">
        <div>
          <h1>Campaign history</h1>
          <p className="dash-page-lede">
            Keep every campaign in view, from the first idea to the final post.
          </p>
        </div>
      </header>

      <div className="ops-grid">
        <JobsList
          jobs={jobs}
          activeJobId={activeJobId}
          error={jobsError}
          onSelect={setActiveJobId}
          onRefresh={() => loadJobs()}
        />
        <JobDetail job={activeJob} />
      </div>
    </div>
  );
}
