const API = {
  OWNER: 'carloscuxin',
  REPO: 'markdown-editor',

  _headers() {
    return {
      Authorization: `Bearer ${Auth.getToken()}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    }
  },

  _repoURL(path = '') {
    return `https://api.github.com/repos/${this.OWNER}/${this.REPO}/contents${path}`
  },

  async _request(url, options = {}) {
    const res = await fetch(url, { ...options, headers: this._headers() })
    if (res.status === 401) {
      Auth.clearToken()
      window.location.href = 'login.html'
      throw new Error('Sesión expirada')
    }
    const body = await res.json()
    if (!res.ok) throw new Error(body.message || `Error ${res.status}`)
    return body
  },

  async getUser() {
    return this._request('https://api.github.com/user')
  },

  async listDocs(subfolder = '') {
    const path = subfolder ? `/docs/${subfolder}` : '/docs'
    const data = await this._request(this._repoURL(path))
    if (!Array.isArray(data)) return []
    return data.filter(f => f.name.endsWith('.md') && f.type === 'file')
  },

  async getDoc(path) {
    const data = await this._request(this._repoURL(`/docs/${path}`))
    const content = atob(data.content.replace(/\n/g, ''))
    return { content, sha: data.sha, path }
  },

  async saveDoc(path, content, sha = null) {
    const safePath = path.replace(/^\/+/, '').replace(/\.\./g, '')
    const payload = {
      message: `docs: actualiza ${safePath}`,
      content: btoa(unescape(encodeURIComponent(content))),
      branch: 'main',
    }
    if (sha) payload.sha = sha
    return this._request(this._repoURL(`/docs/${safePath}`), {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  async deleteDoc(path, sha) {
    const safePath = path.replace(/^\/+/, '').replace(/\.\./g, '')
    return this._request(this._repoURL(`/docs/${safePath}`), {
      method: 'DELETE',
      body: JSON.stringify({
        message: `docs: elimina ${safePath}`,
        sha,
        branch: 'main',
      }),
    })
  }
}
