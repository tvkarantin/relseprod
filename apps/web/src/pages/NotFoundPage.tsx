import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="page-content">
      <div className="surface card-message">
        <div className="card-message-icon" aria-hidden="true">
          404
        </div>
        <h3>Страница не найдена</h3>
        <p>Возможно, ссылка устарела или раздел ещё не реализован.</p>
        <Link to="/" className="button button-primary">
          На главную
        </Link>
      </div>
    </div>
  )
}
