import { Link } from 'react-router-dom'
import type { GiftHomeProjection } from '../../gift/types'

type PersonalSurfacesProps = {
  futureLetter: { availableCount: number; availableTitle: string | null }
  gift?: GiftHomeProjection
}

export function PersonalSurfaces({ futureLetter, gift }: PersonalSurfacesProps) {
  return <section className="home-v2__card home-v2__personal" aria-labelledby="personal-title">
    <h2 id="personal-title">Dành cho mình</h2>
    <div className="home-v2__personal-grid"><FutureMeSurface projection={futureLetter} /><GiftSurface projection={gift} /></div>
  </section>
}

function FutureMeSurface({ projection }: { projection: { availableCount: number; availableTitle: string | null } }) {
  const copy = projection.availableCount > 0 ? `${projection.availableCount} thư đang chờ mở${projection.availableTitle ? ` · ${projection.availableTitle}` : ''}` : 'Chưa có thư đang chờ mở'
  return <Link className="home-v2__personal-surface home-v2__future-me" to="/future-letter"><div><h3>Thư cho mình</h3><p>{copy}</p></div><div className="home-v2__envelope" aria-hidden="true"><span className="home-v2__seal">S</span></div><span className="home-v2__surface-arrow" aria-hidden="true">→</span></Link>
}

function GiftSurface({ projection }: { projection?: GiftHomeProjection }) {
  const gift = projection?.todayGift ?? projection?.gift
  const copy = gift ? (gift.status === 'delivered' ? 'Một món quà đang đợi bạn mở' : gift.status === 'draft' ? 'Bản nháp đang chờ bạn hoàn thiện' : 'Đã gửi · đến lúc 03:00 ngày mai') : 'Chưa có quà cho ngày mai'
  return <Link className="home-v2__personal-surface home-v2__gift" to="/gift-for-tmr"><div><h3>Quà cho ngày mai</h3><p>{copy}</p></div><div className="home-v2__gift-art" aria-hidden="true"><span>🎁</span></div><span className="home-v2__surface-arrow" aria-hidden="true">→</span></Link>
}
