import { Check, ShieldCheck, Sparkles, Star } from 'lucide-react'
import './reference-pages.css'

const FEATURES = ['Безлимитные сценарии','Планирование контента','Расширенная библиотека ресурсов','Экспорт в PDF, DOCX и TXT','Приоритетная поддержка']
export function SubscriptionPage(){
  return <div className="rf-reference-page rf-subscription-page">
    <div className="rf-sub-hero"><span><Sparkles size={16}/> Подписка RealsFlow</span><h1>Выбери <em>свой ритм</em></h1><p>RealsFlow помогает создавать сценарии, снимать и публиковать рилсы легко и стабильно. Выберите тариф, который подходит именно вам.</p></div>
    <div className="rf-plan-grid">
      <article className="rf-plan"><div className="rf-plan-title"><h2>Старт</h2><span>текущий</span></div><p>Для тех, кто начинает<br/>и хочет попробовать.</p><strong>0 <small>₽</small></strong><small>Навсегда</small><hr/>{['Создание сценариев — 5 в месяц','Библиотека идей и сценариев','Экспорт сценариев','Базовые ресурсы','Поддержка по почте'].map(x=><div className="rf-plan-feature" key={x}><Check size={16}/>{x}</div>)}<button className="rf-plan-secondary">Текущий тариф</button></article>
      <article className="rf-plan"><div className="rf-plan-title"><h2>PRO · Месяц</h2></div><p>Больше возможностей<br/>для стабильного контента.</p><strong>990 <small>₽</small></strong><small>в месяц</small><hr/>{FEATURES.map(x=><div className="rf-plan-feature" key={x}><Check size={16}/>{x}</div>)}<button className="rf-plan-primary">Выбрать план</button></article>
      <article className="rf-plan rf-plan-best"><div className="rf-best-badge"><Star size={14}/> самое выгодное</div><div className="rf-plan-title"><h2>PRO · Год</h2></div><p>Максимум возможностей<br/>по лучшей цене.</p><strong>9 990 <small>₽</small></strong><small>в год</small><hr/>{[...FEATURES,'Ранний доступ к новым функциям'].map(x=><div className="rf-plan-feature" key={x}><Check size={16}/>{x}</div>)}<button className="rf-plan-primary">Выбрать годовой план</button><div className="rf-safe"><ShieldCheck size={14}/>Безопасная оплата</div></article>
    </div>
  </div>
}
