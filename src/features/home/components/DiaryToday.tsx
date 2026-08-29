import { Link } from 'react-router-dom'
import type { HomeDiaryPreview } from '../types'

export function DiaryToday({ preview }: { preview: HomeDiaryPreview }) {
  return <section className="home-v2__card home-v2__diary" aria-labelledby="diary-today-title">
    <div className="home-v2__diary-copy"><header className="home-v2__section-header"><div><h2 id="diary-today-title">Nhật ký hôm nay</h2>{preview.status !== 'empty' && <span className="home-v2__status-pill">{preview.status === 'draft' ? 'Draft' : 'Đã lưu'}</span>}</div></header>{preview.status === 'empty' && <div className="home-v2__empty"><span aria-hidden="true">✎</span><p>Hôm nay vẫn còn một khoảng trống để bạn viết xuống điều đang ở lại.</p></div>}{preview.status !== 'empty' && <><h3>{preview.title}</h3><p>{preview.excerpt}</p></>}<Link className="text-link" to="/diary">{preview.status === 'empty' ? 'Mở nhật ký' : 'Mở lại nhật ký'} →</Link></div>{preview.imageUrl ? <img className="home-v2__diary-image" src={preview.imageUrl} alt="" /> : <div className="home-v2__diary-art" aria-hidden="true"><span>✦</span></div>}
  </section>
}
