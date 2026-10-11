import Icon from "./Icon";
import { Badge } from "./ui";

export default function QualityReport({ report }) {
  if (!report?.checks?.length) return null;
  const attention = report.checks.filter((check) => check.status !== "pass").length;

  return (
    <section className="quality-report" aria-label="Video checks">
      <div className="quality-report-head">
        <h3>Video checks</h3>
        <Badge variant={attention ? "warning" : "success"} size="sm" dot>
          {attention ? `${attention} to review` : "Checks passed"}
        </Badge>
      </div>
      <ul>
        {report.checks.map((check) => {
          const isPass = check.status === "pass";
          const isFail = check.status === "fail";
          const badgeVariant = isPass ? "success" : isFail ? "danger" : "warning";
          const statusLabel = isPass ? "Passed" : isFail ? "Needs attention" : "Review";

          return (
            <li key={check.id} className={`is-${check.status}`}>
              <span className="quality-check-icon" aria-hidden="true">
                <Icon name={isPass ? "check" : "alert"} size={15} />
              </span>
              <div>
                <strong>{check.label}</strong>
                <p>{check.detail}</p>
              </div>
              <Badge variant={badgeVariant} size="sm" className="quality-check-status-badge">
                {statusLabel}
              </Badge>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
