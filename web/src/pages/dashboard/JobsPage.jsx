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
          <p className="panel-kicker">Archive</p>
          <h1>Jobs</h1>
          <p className="dash-page-lede">
            Select a job to inspect caption, stage, and publish status. Tracking also
            updates the Pipeline page.
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
