import Icon from "../Icon";

export function Card({
  children,
  variant = "default",
  hoverable = false,
  padding = "default",
  className = "",
  as: Component = "div",
  ...props
}) {
  return (
    <Component
      className={`ui-card ui-card-${variant} ui-card-pad-${padding} ${hoverable ? "is-hoverable" : ""} ${className}`.trim()}
      {...props}
    >
      {children}
    </Component>
  );
}

export function CardHeader({
  children,
  className = "",
  action,
  ...props
}) {
  return (
    <div className={`ui-card-header ${className}`.trim()} {...props}>
      <div className="ui-card-header-content">{children}</div>
      {action ? <div className="ui-card-header-action">{action}</div> : null}
    </div>
  );
}

export function CardTitle({
  children,
  kicker,
  as: Component = "h2",
  className = "",
  ...props
}) {
  return (
    <div className="ui-card-title-wrap">
      {kicker ? <p className="ui-kicker">{kicker}</p> : null}
      <Component className={`ui-card-title ${className}`.trim()} {...props}>
        {children}
      </Component>
    </div>
  );
}

export function CardDescription({
  children,
  className = "",
  ...props
}) {
  return (
    <p className={`ui-card-description ${className}`.trim()} {...props}>
      {children}
    </p>
  );
}

export function CardContent({
  children,
  className = "",
  ...props
}) {
  return (
    <div className={`ui-card-content ${className}`.trim()} {...props}>
      {children}
    </div>
  );
}

export function CardFooter({
  children,
  className = "",
  bordered = true,
  ...props
}) {
  return (
    <div
      className={`ui-card-footer ${bordered ? "has-border" : ""} ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}

/**
 * Standard Panel component that encapsulates common Card + CardHeader patterns.
 */
export function Panel({
  kicker,
  title,
  subtitle,
  action,
  children,
  className = "",
  as = "section",
  hoverable = false,
  padding = "default",
  ...props
}) {
  return (
    <Card
      as={as}
      hoverable={hoverable}
      padding={padding}
      className={`panel ${className}`.trim()}
      {...props}
    >
      {title || kicker || action || subtitle ? (
        <CardHeader action={action}>
          {kicker ? <p className="panel-kicker">{kicker}</p> : null}
          {title ? <h2>{title}</h2> : null}
          {subtitle ? <p className="panel-note">{subtitle}</p> : null}
        </CardHeader>
      ) : null}
      {children}
    </Card>
  );
}

export default Card;
