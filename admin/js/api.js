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
    return data.filter(f => f.name.endsWith('.md') && f.type === 'file')
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
  }
}
