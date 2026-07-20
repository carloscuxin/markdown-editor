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

    mermaid.initialize({ startOnLoad: false, theme: 'default' })

    window.editor.eventManager.listen('previewRenderAfter', (preview) => {
      const els = preview._previewContent.querySelectorAll('pre > code.language-mermaid')
      els.forEach(el => {
        const pre = el.parentElement
        if (pre.querySelector('svg')) return
        const code = el.textContent
        pre.textContent = code
        pre.className = 'mermaid'
      })
      mermaid.run({ nodes: preview._previewContent.querySelectorAll('pre.mermaid') })
    })

    const renderWysiwygMermaid = () => {
      const ww = window.editor.getCurrentModeEditor()
      if (!ww || !ww.getBody) return
      const body = ww.getBody()
      const blocks = body.querySelectorAll('pre code.language-mermaid')
      blocks.forEach(codeEl => {
        const pre = codeEl.parentElement
        if (pre.querySelector('svg')) return
        pre.dataset.mermaid = codeEl.textContent
        pre.textContent = codeEl.textContent
        pre.className = 'mermaid'
        pre.removeChild(codeEl)
      })
      mermaid.run({ nodes: body.querySelectorAll('pre.mermaid') })
    }
    const restoreWysiwygMermaid = () => {
      const ww = window.editor.getCurrentModeEditor()
      if (!ww || !ww.getBody) return
      const body = ww.getBody()
      body.querySelectorAll('pre.mermaid[data-mermaid]').forEach(pre => {
        const code = pre.dataset.mermaid
        delete pre.dataset.mermaid
        pre.className = ''
        pre.textContent = ''
        const codeEl = document.createElement('code')
        codeEl.className = 'language-mermaid'
        codeEl.textContent = code
        pre.appendChild(codeEl)
      })
    }

    window.editor.eventManager.listen('wysiwygSetValueAfter', renderWysiwygMermaid)
    window.editor.eventManager.listen('wysiwygGetValueBefore', restoreWysiwygMermaid)
    window.editor.eventManager.listen('changeMode', () => {
      if (window.editor.getCurrentMode() === 'wysiwyg') setTimeout(renderWysiwygMermaid, 200)
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
  }
}
