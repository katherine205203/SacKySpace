import { Link } from 'react-router-dom'

export function HomePage() {
  return (
    <section className="home-screen" id="home" aria-labelledby="home-title">
      <div className="page-intro">
        <p className="eyebrow">Sắc Ký</p>
        <h2 id="home-title">Một khoảng nhỏ để lắng nghe mình.</h2>
        <p className="page-intro__copy">Bắt đầu từ việc gọi tên điều đang hiện diện, thật chậm và đủ thật.</p>
      </div>
      <div className="home-actions">
        <Link className="button button--primary" to="/checkin">Tạo check-in</Link>
        <Link className="button button--secondary" to="/checkin/history">Xem lịch sử</Link>
      </div>
      <div className="placeholder-panel">
        <span className="placeholder-panel__icon" aria-hidden="true">✦</span>
        <div>
          <p className="placeholder-panel__title">Check-in là nơi bắt đầu.</p>
          <p className="muted-text">Những không gian khác sẽ được mở rộng từng bước.</p>
        </div>
      </div>
    </section>
  )
}
