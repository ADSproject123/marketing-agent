import { Link } from "react-router-dom";
import JobDetail from "../../components/JobDetail";
import JobsList from "../../components/JobsList";
import Icon from "../../components/Icon";
import { useDashboard } from "../../dashboard/DashboardContext";

export default function JobsPage() {
  const { jobs, activeJobId, jobsError, setActiveJobId, loadJobs, activeJob } =
    useDashboard();

  return (
    <div className="dash-page">
      <header className="dash-page-head">
        <div>
          <p className="panel-kicker">Your workspace</p>
          <h1>Campaigns</h1>
          <p className="dash-page-lede">
            Keep every campaign in view, from the first idea to the final post.
          </p>
        </div>
        <Link className="primary-btn" to="/dashboard/compose"><Icon name="plus" size={17} /> New campaign</Link>
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
