import { FolderOpen } from 'lucide-react'

import './reference-pages.css'

export function ResourcesPage() {
  return (
    <div className="rf-reference-page rf-resources-page">
      <div className="rf-reference-title">
        <div>
          <h1>Мои ресурсы</h1>
          <p>Храните полезные материалы, ссылки, медиа и документы в одном месте.</p>
        </div>
      </div>

      <section className="rf-resources-empty" aria-labelledby="resources-empty-title">
        <span className="rf-resources-empty-icon" aria-hidden="true">
          <FolderOpen size={28} strokeWidth={1.7} />
        </span>
        <h2 id="resources-empty-title">Ресурсов пока нет</h2>
        <p>Когда вы добавите материалы, они появятся здесь.</p>
      </section>
    </div>
  )
}
