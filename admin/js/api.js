const API = {
  _headers() {
    return {
      Authorization: `Bearer ${Auth.getToken()}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    }
  },

  _repoURL(path = '') {
    const owner = 'carloscuxin'
    const repo = 'markdown-editor'
    return `https://api.github.com/repos/${owner}/${repo}/contents${path}`
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

  async listPages() {
    const data = await this._request(this._repoURL('/wiki'))
    if (!Array.isArray(data)) return []
    return data.filter(f => f.name.endsWith('.html') && f.type === 'file')
  },

  async getPage(filename) {
    const data = await this._request(this._repoURL(`/wiki/${encodeURIComponent(filename)}`))
    const content = atob(data.content.replace(/\n/g, ''))
    return { content, sha: data.sha }
  },

  async savePage(filename, content, sha = null) {
    const payload = {
      message: `docs: actualiza ${filename}`,
      content: btoa(content),
      branch: 'main',
    }
    if (sha) payload.sha = sha
    return this._request(this._repoURL(`/wiki/${encodeURIComponent(filename)}`), {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  },

  async createPage(filename, content) {
    return this.savePage(filename, content)
  },

  async deletePage(filename, sha) {
    return this._request(this._repoURL(`/wiki/${encodeURIComponent(filename)}`), {
      method: 'DELETE',
      body: JSON.stringify({
        message: `docs: elimina ${filename}`,
        sha,
        branch: 'main',
      }),
    })
  },

  async uploadImage(filename, content) {
    return this._request(this._repoURL(`/assets/uploads/${encodeURIComponent(filename)}`), {
      method: 'PUT',
      body: JSON.stringify({
        message: `docs: sube imagen ${filename}`,
        content,
        branch: 'main',
      }),
    })
  },

  async getMeta() {
    try {
      const data = await this._request(this._repoURL('/wiki/_meta.json'))
      return JSON.parse(atob(data.content.replace(/\n/g, '')))
    } catch { return { pages: [] } }
  },

  async saveMeta(meta) {
    const content = JSON.stringify(meta, null, 2)
    let sha = null
    try {
      const existing = await this._request(this._repoURL('/wiki/_meta.json'))
      sha = existing.sha
    } catch {}
    const payload = {
      message: 'docs: actualiza page tree',
      content: btoa(content),
      branch: 'main',
    }
    if (sha) payload.sha = sha
    return this._request(this._repoURL('/wiki/_meta.json'), {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
  }
}
