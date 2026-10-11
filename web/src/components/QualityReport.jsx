import Icon from "./Icon";

export default function QualityReport({ report }) {
  if (!report?.checks?.length) return null;
  const attention = report.checks.filter((check) => check.status !== "pass").length;
  return (
    <section className="quality-report" aria-label="Video checks">
      <div className="quality-report-head"><h3>Video checks</h3><span>{attention ? `${attention} to review` : "Checks passed"}</span></div>
      <ul>
        {report.checks.map((check) => (
          <li key={check.id} className={`is-${check.status}`}>
            <span className="quality-check-icon" aria-hidden="true"><Icon name={check.status === "pass" ? "check" : "alert"} size={15} /></span>
            <div><strong>{check.label}</strong><p>{check.detail}</p></div>
            <span className="quality-check-status">{check.status === "pass" ? "Passed" : check.status === "fail" ? "Needs attention" : "Review"}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
