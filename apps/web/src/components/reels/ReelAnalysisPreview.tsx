import type { ReelAnalysisView, ReelAnalysisSegment } from '@/types/analysis'
import { formatDuration } from '@/utils/format'

export interface ReelAnalysisPreviewProps {
  analysis: ReelAnalysisView
}

export function ReelAnalysisPreview({ analysis }: ReelAnalysisPreviewProps) {
  const renderSegment = (title: string, segment: ReelAnalysisSegment | null | undefined) => {
    if (!segment) return null
    return (
      <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'var(--color-bg)', borderRadius: '6px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
          <strong style={{ color: 'var(--color-text-muted)' }}>{title}</strong>
          <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
            [{formatDuration(segment.start)} - {formatDuration(segment.end)}]
          </span>
        </div>
        <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{segment.text}</p>
      </div>
    )
  }

  return (
    <div style={{ marginTop: '1.5rem', borderTop: '1px solid var(--color-border)', paddingTop: '1.5rem' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <span style={{ color: 'var(--color-text-muted)' }}>Исходный язык:</span>
          <div>{analysis.sourceLanguage || 'Не определен'}</div>
        </div>
        <div>
          <span style={{ color: 'var(--color-text-muted)' }}>Модель:</span>
          <div>{analysis.resolvedModel || analysis.requestedModel}</div>
        </div>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ margin: '0 0 0.5rem 0' }}>Тема</h4>
        <p style={{ margin: 0 }}>{analysis.topic}</p>
      </div>

      <div style={{ marginBottom: '1.5rem' }}>
        <h4 style={{ margin: '0 0 0.5rem 0' }}>Краткое содержание</h4>
        <p style={{ margin: 0 }}>{analysis.summary}</p>
      </div>

      <h4 style={{ margin: '0 0 1rem 0', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
        Структура сценария
      </h4>
      
      {renderSegment('Хук (Hook)', analysis.hook)}
      
      {analysis.mainPart && analysis.mainPart.length > 0 && (
        <div style={{ marginBottom: '1rem', padding: '1rem', backgroundColor: 'var(--color-bg)', borderRadius: '6px' }}>
          <strong style={{ color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.5rem' }}>Основная часть (Main Part)</strong>
          {analysis.mainPart.map((seg, idx) => (
            <div key={idx} style={{ marginBottom: idx < (analysis.mainPart?.length ?? 0) - 1 ? '1rem' : 0 }}>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.25rem' }}>
                <span style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  [{formatDuration(seg.start)} - {formatDuration(seg.end)}]
                </span>
              </div>
              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{seg.text}</p>
            </div>
          ))}
        </div>
      )}

      {renderSegment('Заключение (Conclusion)', analysis.conclusion)}
      {renderSegment('Призыв к действию (CTA)', analysis.cta)}

      <h4 style={{ margin: '1.5rem 0 1rem 0', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }}>
        Полный перевод
      </h4>
      <div style={{ padding: '1rem', backgroundColor: 'var(--color-bg)', borderRadius: '6px', whiteSpace: 'pre-wrap' }}>
        {analysis.russianTranscript}
      </div>
    </div>
  )
}
