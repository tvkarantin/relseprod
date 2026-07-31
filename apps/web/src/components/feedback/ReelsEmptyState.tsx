import type { ReactNode } from 'react'

export interface ReelsEmptyStateStep {
  icon: ReactNode
  title: string
  description: string
}

export function ReelsEmptyState({
  title = 'Здесь пока пусто',
  description,
  action,
  steps,
}: {
  title?: string
  description: string
  action: ReactNode
  steps: ReelsEmptyStateStep[]
}) {
  return (
    <div className="reels-empty-state">
      <section className="reels-empty-main" aria-labelledby="reels-empty-title">
        <div className="reels-empty-illustration" aria-hidden="true">
          <span className="reels-empty-spark spark-one">✦</span>
          <span className="reels-empty-spark spark-two">✦</span>
          <span className="reels-empty-spark spark-three">✦</span>
          <span className="reels-empty-spark spark-four">+</span>
          <span className="reels-empty-folder folder-back" />
          <span className="reels-empty-folder folder-middle" />
          <span className="reels-empty-folder folder-front">
            <span className="reels-empty-brand-mark" />
          </span>
        </div>

        <h3 id="reels-empty-title">{title}</h3>
        <p>{description}</p>
        <div className="reels-empty-action">{action}</div>
      </section>

      <div className="reels-empty-steps" aria-label="Как начать работу">
        {steps.map((step, index) => (
          <div className="reels-empty-step-wrap" key={step.title}>
            <article className="reels-empty-step">
              <span className="reels-empty-step-icon" aria-hidden="true">
                {step.icon}
              </span>
              <span>
                <strong>{step.title}</strong>
                <small>{step.description}</small>
              </span>
            </article>
            {index < steps.length - 1 ? (
              <span className="reels-empty-step-arrow" aria-hidden="true">
                →
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  )
}
