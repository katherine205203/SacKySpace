import { Link } from 'react-router-dom'
import { signOut } from '../../services/supabase/auth'
import { PageHeading } from '../../components/PageHeading'
import './more.css'

const destinations = [
  { to: '/future-letter', icon: '✉', title: 'Future Letter', copy: 'Gửi một điều cho mình của những ngày khác.' },
  { to: '/gift-for-tmr', icon: '🎁', title: 'Gift for Tomorrow', copy: 'Chuẩn bị một món quà nhỏ cho ngày mai.' },
  { to: '/admin-studio', icon: '⚙', title: 'Admin Studio', copy: 'Quản lý reference data và vận hành workspace.' },
]

export function MorePage() {
  return <section className="more-page" aria-labelledby="more-page-title">
    <PageHeading className="more-page__header" eyebrow="SacKy" title="Thêm" description="Những không gian còn lại của hành trình, gọn trong một chỗ." />
    <div className="more-page__grid">{destinations.map((item) => <Link className="more-page__tile" key={item.to} to={item.to}><span className="more-page__tile-icon" aria-hidden="true">{item.icon}</span><span><strong>{item.title}</strong><small>{item.copy}</small></span><b aria-hidden="true">→</b></Link>)}<article className="more-page__tile more-page__tile--quiet"><span className="more-page__tile-icon" aria-hidden="true">♡</span><span><strong>Cài đặt & hồ sơ</strong><small>Tùy chọn cá nhân và thiết lập sẽ được mở rộng trong các phiên bản tiếp theo.</small></span><em>Sắp có</em></article></div>
    <button className="button button--secondary more-page__signout" type="button" onClick={() => void signOut()}>Đăng xuất</button>
  </section>
}
