import JobDetail from "../../components/JobDetail";
import JobsList from "../../components/JobsList";
import { PageHeader } from "../../components/ui";
import { useDashboard } from "../../dashboard/DashboardContext";

export default function JobsPage() {
  const { jobs, activeJobId, jobsError, setActiveJobId, loadJobs, activeJob } =
    useDashboard();

  return (
    <div className="dash-page">
      <PageHeader
        kicker="Workspace"
        title="Campaign history"
        description="Keep every campaign in view, from the first idea to the final post."
      />

      <div className="ops-grid">
        <JobsList
          jobs={jobs}
          activeJobId={activeJobId}
          error={jobsError}
          onSelect={setActiveJobId}
          onRefresh={() => loadJobs()}
        />
        <JobDetail job={activeJob} onRefresh={() => loadJobs()} />
      </div>
    </div>
  );
}
