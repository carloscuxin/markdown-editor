const Pages = {
  async loadDashboard() {
    const list = document.getElementById('pages-list')
    const empty = document.getElementById('empty-state')
    if (!list) return

    list.innerHTML = '<div class="loading">Cargando páginas...</div>'

    try {
      const files = await API.listPages()
      if (files.length === 0) {
        list.innerHTML = ''
        if (empty) empty.style.display = 'block'
        return
      }
      if (empty) empty.style.display = 'none'

      const promises = files.map(async f => {
        const date = new Date().toLocaleDateString('es-ES')
        const author = '—'
        return { name: f.name, date, author }
      })

      const items = await Promise.all(promises)
      list.innerHTML = items.map(p => `
        <div class="page-card">
          <div class="page-info">
            <h3>${p.name.replace('.md', '')}</h3>
            <span class="page-meta">${p.name} · ${p.date}</span>
          </div>
          <div class="page-actions">
            <button class="btn btn-sm" onclick="Pages.editPage('${p.name}')">Editar</button>
            <button class="btn btn-sm btn-danger" onclick="Pages.confirmDelete('${p.name}')">Eliminar</button>
          </div>
        </div>
      `).join('')
    } catch (err) {
      list.innerHTML = `<div class="error">Error al cargar: ${err.message}</div>`
    }
  },

  editPage(filename) {
    window.location.href = `editor.html?file=${encodeURIComponent(filename)}`
  },

  confirmDelete(filename) {
    if (!confirm(`¿Eliminar "${filename}" permanentemente?`)) return
    this.deletePage(filename)
  },

  async deletePage(filename) {
    const toast = document.getElementById('toast')
    try {
      const { sha } = await API.getPage(filename)
      await API.deletePage(filename, sha)
      this.showToast('Página eliminada', 'success')
      this.loadDashboard()
    } catch (err) {
      this.showToast(`Error: ${err.message}`, 'error')
    }
  },

  async loadEditor() {
    const params = new URLSearchParams(window.location.search)
    const filename = params.get('file')
    const titleEl = document.getElementById('page-title')
    const isNew = !filename

    if (titleEl) {
      titleEl.textContent = isNew ? 'Nueva página' : `Editando: ${filename.replace('.md', '')}`
    }

    if (isNew) {
      this.initQuill()
      return
    }

    try {
      const { content } = await API.getPage(filename)
      const html = new showdown.Converter().makeHtml(content)
      this.initQuill(html)
    } catch (err) {
      this.showToast(`Error al cargar: ${err.message}`, 'error')
    }
  },

  initQuill(html = '') {
    if (window.quill) return
    window.quill = new Quill('#editor-container', {
      theme: 'snow',
      placeholder: 'Escribe el contenido aquí...',
      modules: {
        toolbar: [
          ['bold', 'italic', 'underline', 'strike'],
          [{ header: [1, 2, 3, false] }],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link', 'code-block'],
          ['clean'],
        ],
      },
    })
    if (html) window.quill.root.innerHTML = html
  },

  async savePage() {
    const params = new URLSearchParams(window.location.search)
    const filename = params.get('file')
    const isNew = !filename

    const titleInput = document.getElementById('title-input')
    let name = filename

    if (isNew) {
      const raw = (titleInput?.value || '').trim()
      if (!raw) {
        this.showToast('Ingresa un título para la página', 'error')
        return
      }
      name = raw
        .toLowerCase()
        .replace(/[^a-z0-9áéíóúüñ\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '') + '.md'
    }

    const html = window.quill?.root.innerHTML || ''
    if (!html || html === '<p><br></p>') {
      this.showToast('El contenido está vacío', 'error')
      return
    }

    const markdown = new TurndownService().turndown(html)

    try {
      if (isNew) {
        await API.createPage(name, markdown)
      } else {
        const { sha } = await API.getPage(filename)
        await API.savePage(name, markdown, sha)
      }
      this.showToast('Página guardada correctamente', 'success')
      setTimeout(() => { window.location.href = 'dashboard.html' }, 1200)
    } catch (err) {
      this.showToast(`Error al guardar: ${err.message}`, 'error')
    }
  },

  showToast(message, type = 'success') {
    const toast = document.getElementById('toast')
    if (!toast) return
    toast.textContent = message
    toast.className = `toast toast-${type} show`
    setTimeout(() => { toast.className = 'toast' }, 3000)
  }
}
