export default function PageHeader({
  kicker,
  title,
  description,
  badge,
  actions,
  breadcrumbs,
  className = "",
  ...props
}) {
  return (
    <header className={`ui-page-header dash-page-head ${className}`.trim()} {...props}>
      <div className="ui-page-header-main">
        {breadcrumbs ? <div className="ui-page-header-breadcrumbs">{breadcrumbs}</div> : null}
        {kicker ? <p className="panel-kicker">{kicker}</p> : null}
        <div className="ui-page-header-title-row">
          <h1>{title}</h1>
          {badge ? <div className="ui-page-header-badge">{badge}</div> : null}
        </div>
        {description ? (
          <p className="dash-page-lede">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="ui-page-header-actions">{actions}</div> : null}
    </header>
  );
}
