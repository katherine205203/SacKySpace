// Browser-only fixtures for the local mobile audit. It never runs in the app.
(() => {
  const projectRef = 'aqelusxjkayiuninbmnw'
  const storageKey = `sb-${projectRef}-auth-token`
  const now = Math.floor(Date.now() / 1000)
  const user = { id: 'mobile-audit-user', aud: 'authenticated', role: 'authenticated', email: 'mobile-audit@example.test' }
  localStorage.setItem(storageKey, JSON.stringify({
    access_token: 'mobile-audit-access-token',
    refresh_token: 'mobile-audit-refresh-token',
    token_type: 'bearer',
    expires_in: 60 * 60,
    expires_at: now + 60 * 60,
    user,
  }))

  const json = (body, status = 200, headers = {}) => new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  })
  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input?.url ?? ''
    if (!url.includes('supabase.co')) return originalFetch(input, init)
    if (url.includes('/auth/v1/user')) return json(user)
    if (url.includes('/rest/v1/')) {
      const method = String(init?.method ?? 'GET').toUpperCase()
      if (method === 'DELETE' || method === 'PATCH' || method === 'POST') return json([])
      return json([])
    }
    if (url.includes('/functions/')) return json({})
    return originalFetch(input, init)
  }
})()
