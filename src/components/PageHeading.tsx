import type { ReactNode } from 'react'

type PageHeadingProps = {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
  className?: string
  titleId?: string
}

export function PageHeading({ eyebrow, title, description, actions, className = '', titleId }: PageHeadingProps) {
  return <header className={`page-heading ${className}`.trim()}>
    <div className="page-heading__copy">
      <p className="page-heading__eyebrow">{eyebrow}</p>
      <h1 id={titleId}>{title}</h1>
      <p className="page-heading__description">{description}</p>
    </div>
    {actions && <div className="page-heading__actions">{actions}</div>}
  </header>
}
