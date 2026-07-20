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

      const items = files.map(f => {
        const date = new Date().toLocaleDateString('es-ES')
        return { name: f.name, date }
      })

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
      this.initEditor('')
      return
    }

    try {
      const { content } = await API.getPage(filename)
      this.initEditor(content)
    } catch (err) {
      this.showToast(`Error al cargar: ${err.message}`, 'error')
      this.initEditor('')
    }
  },

  initEditor(initialValue) {
    if (window.editor) return

    window.editor = new toastui.Editor({
      el: document.querySelector('#editor-container'),
      initialEditType: 'wysiwyg',
      height: '600px',
      initialValue,
      placeholder: 'Escribe el contenido aquí...',
      toolbarItems: [
        'heading', 'bold', 'italic', 'strike',
        'divider', 'hr', 'quote',
        'divider', 'ul', 'ol', 'task', 'indent', 'outdent',
        'divider', 'table', 'image', 'link',
        'divider', 'code', 'codeblock'
      ],
      usageStatistics: false
    })

    window.editor.addHook('addImageBlobHook', async (blob, callback) => {
      try {
        const base64 = await Pages._blobToBase64(blob)
        const timestamp = Date.now()
        const origName = blob.name || `file-${timestamp}`
        const filename = `${timestamp}-${origName}`

        await API.uploadImage(filename, base64)
        const url = `https://raw.githubusercontent.com/carloscuxin/markdown-editor/main/assets/uploads/${filename}`

        if (blob.type.startsWith('image/')) {
          callback(url, origName.replace(/\.[^.]+$/, ''))
        } else {
          const editor = window.editor
          const displayName = origName
          const link = `[${displayName}](${url})`
          if (editor.getCurrentMode() === 'wysiwyg') {
            editor.getCurrentModeEditor().getEditor().insertHTML(`<a href="${url}">${displayName}</a>&nbsp;`)
          } else {
            editor.getCurrentModeEditor().replaceSelection(link)
          }
          Pages.showToast(`Archivo subido: ${displayName}`, 'success')
        }
      } catch (err) {
        Pages.showToast(`Error al subir archivo: ${err.message}`, 'error')
      }
    })
  },

  _blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const base64 = reader.result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
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

    const markdown = window.editor.getMarkdown()
    if (!markdown.trim()) {
      this.showToast('El contenido está vacío', 'error')
      return
    }

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
  },

  async previewMermaid() {
    if (!window.editor) return
    const markdown = window.editor.getMarkdown()
    const mermaidRegex = /```mermaid\n([\s\S]*?)```/g
    const matches = [...markdown.matchAll(mermaidRegex)]

    if (matches.length === 0) {
      this.showToast('No se encontraron bloques de código mermaid', 'error')
      return
    }

    const container = document.getElementById('mermaid-container')
    if (!container) return

    container.innerHTML = '<div class="loading">Renderizando diagramas...</div>'
    document.getElementById('mermaid-modal').style.display = 'flex'

    try {
      mermaid.initialize({ startOnLoad: false, theme: 'default' })

      const renderAll = async () => {
        container.innerHTML = ''
        for (let i = 0; i < matches.length; i++) {
          const code = matches[i][1].trim()
          const div = document.createElement('div')
          div.className = 'mermaid'
          div.textContent = code
          container.appendChild(div)
        }
        await mermaid.run({ nodes: container.querySelectorAll('.mermaid') })
      }

      await renderAll()
    } catch (err) {
      container.innerHTML = `<div class="error">Error al renderizar: ${err.message}</div>`
    }
  },

  closeMermaidModal(event) {
    if (event && event.target !== event.currentTarget) return
    const modal = document.getElementById('mermaid-modal')
    if (modal) modal.style.display = 'none'
  }
}
