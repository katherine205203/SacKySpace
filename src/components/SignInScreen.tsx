import { useState, type FormEvent } from 'react'
import { signIn } from '../services/supabase/auth'

export function SignInScreen() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSubmitting(true)
    setError(null)
    try {
      await signIn(email.trim(), password)
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Unable to sign in.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="auth-screen">
      <section className="auth-card" aria-labelledby="sign-in-title">
        <div className="brand-lockup">
          <span className="brand-mark" aria-hidden="true">S</span>
          <span>SacKy</span>
        </div>
        <p className="eyebrow">Sắc Ký</p>
        <h1 id="sign-in-title">Đăng nhập vào Sắc Ký</h1>
        <p className="auth-card__copy">Một khoảng nhỏ để lắng nghe mình.</p>
        <form className="auth-form" onSubmit={handleSubmit}>
          <label>
            Email
            <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </label>
          <label>
            Mật khẩu
            <input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required />
          </label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button button--primary" type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Đang đăng nhập…' : 'Đăng nhập'}
          </button>
        </form>
        <p className="auth-card__hint">Không có đăng ký công khai.</p>
      </section>
    </main>
  )
}
