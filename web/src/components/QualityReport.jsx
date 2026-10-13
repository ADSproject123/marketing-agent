import Icon from "./Icon";
import { Badge } from "./ui";

export default function QualityReport({ report }) {
  if (!report?.checks?.length) return null;
  const attention = report.checks.filter((check) => check.status !== "pass").length;

  return (
    <div className="history-card history-quality-card" aria-label="Video quality and policy checks">
      <div className="history-card-header">
        <div className="history-card-title-group">
          <Icon name="shield" size={17} className="history-card-icon" />
          <h3>Quality & Safety checks</h3>
        </div>
        <Badge variant={attention ? "warning" : "success"} size="sm" dot>
          {attention ? `${attention} to review` : "All passed"}
        </Badge>
      </div>
      <ul className="history-quality-list">
        {report.checks.map((check) => {
          const isPass = check.status === "pass";
          const isFail = check.status === "fail";
          const badgeVariant = isPass ? "success" : isFail ? "danger" : "warning";
          const statusLabel = isPass ? "Passed" : isFail ? "Needs attention" : "Review";

          return (
            <li key={check.id} className={`quality-check-item is-${check.status}`}>
              <span className={`quality-check-icon is-${check.status}`} aria-hidden="true">
                <Icon name={isPass ? "check" : "alert"} size={14} />
              </span>
              <div className="quality-check-info">
                <strong>{check.label}</strong>
                <p>{check.detail}</p>
              </div>
              <Badge variant={badgeVariant} size="sm" className="quality-check-badge">
                {statusLabel}
              </Badge>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
