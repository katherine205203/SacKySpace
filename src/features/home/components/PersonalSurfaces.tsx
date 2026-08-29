import { Link } from 'react-router-dom'

export function PersonalSurfaces() {
  return <section className="home-v2__card home-v2__personal" aria-labelledby="personal-title">
    <h2 id="personal-title">Dành cho mình</h2>
    <div className="home-v2__personal-grid"><FutureMeSurface /><GiftSurface /></div>
  </section>
}

function FutureMeSurface() {
  return <Link className="home-v2__personal-surface home-v2__future-me" to="/future-letter"><div><h3>Thư cho mình</h3><p>Chưa có thư đang chờ mở</p></div><div className="home-v2__envelope" aria-hidden="true"><span className="home-v2__seal">S</span></div><span className="home-v2__surface-arrow" aria-hidden="true">→</span></Link>
}

function GiftSurface() {
  return <Link className="home-v2__personal-surface home-v2__gift" to="/gift-for-tmr"><div><h3>Quà cho ngày mai</h3><p>Chưa có quà đang chờ</p></div><div className="home-v2__gift-art" aria-hidden="true"><span>🎁</span></div><span className="home-v2__surface-arrow" aria-hidden="true">→</span></Link>
}
