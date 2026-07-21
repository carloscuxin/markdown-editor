const AUTH_KEY = 'gh_pat_token'

const Auth = {
  getToken() {
    return localStorage.getItem(AUTH_KEY)
  },

  setToken(token) {
    localStorage.setItem(AUTH_KEY, token)
  },

  clearToken() {
    localStorage.removeItem(AUTH_KEY)
  },

  isAuthenticated() {
    return !!this.getToken()
  },

  async validateToken() {
    const token = this.getToken()
    if (!token) return null
    try {
      const res = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) {
        this.clearToken()
        return null
      }
      return await res.json()
    } catch {
      return null
    }
  },

  async login(token) {
    this.setToken(token)
    const user = await this.validateToken()
    if (!user) {
      this.clearToken()
      return null
    }
    return user
  },

  logout() {
    this.clearToken()
    window.location.href = 'login.html'
  }
}
