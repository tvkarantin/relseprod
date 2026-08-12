import { FileText, Folder, Link as LinkIcon, Plus, Search, Video } from 'lucide-react'
import './reference-pages.css'

const RESOURCES = [
  ['Гайд: Как писать цепляющие заголовки','PDF · 2.4 МБ','PDF','Google Drive','Активный'],
  ['Тренды Reels — май 2025','Ссылка','Ссылка','Notion','Активный'],
  ['Примеры удачных рилс','Видео · 320 МБ','Видео','YouTube','Активный'],
  ['Фоны и текстуры','Папка · 18 файлов','Папка','Dropbox','Активный'],
  ['Чек-лист подготовки к съёмке','DOCX · 28 КБ','Документ','Google Drive','Черновик'],
  ['Подборка музыки для Reels','Ссылка','Ссылка','Spotify','Активный'],
  ['Шаблон сценария Reels','PDF · 1.1 МБ','PDF','Google Drive','Архивный'],
  ['Как снимать рилс дома','Видео · 210 МБ','Видео','Яндекс Диск','Активный'],
]

export function ResourcesPage(){
  return <div className="rf-reference-page">
    <div className="rf-reference-title"><div><h1>Мои ресурсы</h1><p>Храните полезные материалы: гайды, ссылки, медиа и документы.</p></div><button className="rf-ref-primary"><Plus size={18}/>Добавить ресурс</button></div>
    <div className="rf-ref-toolbar"><label><Search size={18}/><input placeholder="Поиск по ресурсам"/></label><button>Фильтры</button><button>Тип: Все⌄</button><button>Статус: Все⌄</button></div>
    <div className="rf-resource-table"><div className="rf-resource-row rf-resource-head"><span>Название</span><span>Тип</span><span>Источник</span><span>Статус</span><span>Обновлено</span><span>Действия</span></div>
      {RESOURCES.map((r,i)=><div className="rf-resource-row" key={r[0]}><span className="rf-resource-name">{i%3===0?<FileText size={20}/>:i%3===1?<LinkIcon size={20}/>:i%3===2?<Video size={20}/>:<Folder size={20}/>}<b>{r[0]}<small>{r[1]}</small></b></span><span>{r[2]}</span><span>{r[3]}</span><span><i className={`rf-pill ${r[4]==='Активный'?'green':r[4]==='Черновик'?'orange':'gray'}`}>{r[4]}</i></span><span>{26-i*2} мая 2025</span><span>⋮</span></div>)}
    </div>
  </div>
}
