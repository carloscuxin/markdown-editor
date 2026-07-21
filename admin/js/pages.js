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
            <h3>${p.name.replace('.html', '')}</h3>
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
      titleEl.textContent = isNew ? 'Nueva página' : `Editando: ${filename.replace('.html', '')}`
    }

    if (isNew) {
      this.initEditor('')
      return
    }

    try {
      const { content } = await API.getPage(filename)
      const turndownService = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' })
      turndownService.keep((node) => node.classList &&
        (node.classList.contains('callout') || node.classList.contains('tab-group') ||
         node.classList.contains('tab-nav') || node.classList.contains('tab-content') ||
         node.classList.contains('tab-btn') || node.classList.contains('toc') ||
         node.classList.contains('mermaid')))
      this.initEditor(turndownService.turndown(content))
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
        .replace(/^-|-$/g, '') + '.html'
    }

    const markdown = window.editor.getMarkdown()
    if (!markdown.trim()) {
      this.showToast('El contenido está vacío', 'error')
      return
    }

    const md = new markdownit({ html: true, breaks: true })
    const htmlBody = md.render(markdown)
    const title = (isNew ? titleInput?.value : name.replace('.html', '')) || 'Sin título'
    const fullHtml = Pages.wrapInTemplate(htmlBody, { title, date: new Date().toLocaleDateString('es-ES') })

    try {
      if (isNew) {
        await API.createPage(name, fullHtml)
      } else {
        const { sha } = await API.getPage(filename)
        await API.savePage(name, fullHtml, sha)
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
  },

  wrapInTemplate(content, { title }) {
    return '<!DOCTYPE html>\n<html lang="es">\n<head>\n  <meta charset="utf-8">\n  <meta name="viewport" content="width=device-width, initial-scale=1.0">\n  <title>' + title + '</title>\n  <link rel="stylesheet" href="https://raw.githubusercontent.com/carloscuxin/markdown-editor/main/assets/css/wiki.css">\n  <script src="https://cdn.jsdelivr.net/npm/mermaid@10/dist/mermaid.min.js"><\/script>\n</head>\n<body>\n  <header class="wiki-header">\n    <div class="wiki-header-inner">\n      <h1>Documentaci&oacute;n</h1>\n      <nav>\n        <a href="index.html">Inicio</a>\n        <a href="../admin/dashboard.html">Admin</a>\n      </nav>\n    </div>\n  </header>\n  <button class="wiki-sidebar-toggle">&#9776;</button>\n  <div class="wiki-layout">\n    <aside class="wiki-sidebar" id="wiki-sidebar">\n      <input type="text" class="wiki-search" placeholder="Buscar..." id="wiki-search">\n      <nav class="wiki-tree" id="wiki-tree"></nav>\n    </aside>\n    <main class="wiki-content">\n      <h1 class="wiki-page-title">' + title + '</h1>\n      ' + content + '\n    </main>\n  </div>\n  <script src="https://raw.githubusercontent.com/carloscuxin/markdown-editor/main/assets/js/wiki.js"><\/script>\n</body>\n</html>'
  },

  async loadTree() {
    const container = document.getElementById('tree-container')
    if (!container) return
    try {
      const meta = await API.getMeta()
      Pages._renderTree(container, meta)
    } catch (err) {
      container.innerHTML = ''
    }
  },

  _renderTree(container, meta) {
    const pages = meta.pages || []
    const dropState = { drag: null }

    function findChildren(parent) {
      return pages.filter(p => p.parent === parent).sort((a, b) => (a.order || 0) - (b.order || 0))
    }

    function buildHTML(name) {
      const p = pages.find(p => p.name === name)
      if (!p) return ''
      const children = findChildren(name)
      const title = p.title || name.replace('.html', '')
      let html = '<div class="tree-item" draggable="true" data-name="' + name + '"'
      html += ' ondragstart="event.dataTransfer.setData(\'text/plain\',\'' + name + '\')"'
      html += ' ondragover="event.preventDefault(); event.target.closest(\'.tree-item\').classList.add(\'drag-over\')"'
      html += ' ondragleave="event.target.closest(\'.tree-item\').classList.remove(\'drag-over\')"'
      html += ' ondrop="Pages._onTreeDrop(event, \'' + name + '\')">'
      html += '<span class="tree-drag-handle">&#9776;</span>'
      html += '<a href="editor.html?file=' + encodeURIComponent(name) + '" class="tree-link">' + title + '</a>'
      html += '</div>'
      if (children.length) {
        html += '<div class="tree-children">'
        children.forEach(c => { html += buildHTML(c.name) })
        html += '</div>'
      }
      return html
    }

    const roots = pages.filter(p => !p.parent)
    if (roots.length === 0 && pages.length > 0) {
      container.innerHTML = '<div class="tree-flat">' +
        pages.map(p => '<div class="tree-item" draggable="true" data-name="' + p.name + '">' +
          '<span class="tree-drag-handle">&#9776;</span>' +
          '<a href="editor.html?file=' + encodeURIComponent(p.name) + '" class="tree-link">' +
          (p.title || p.name.replace('.html', '')) + '</a></div>').join('') + '</div>'
    } else {
      container.innerHTML = '<div class="tree-roots">' +
        roots.map(r => buildHTML(r.name)).join('') + '</div>'
    }
  },

  async _onTreeDrop(event, targetName) {
    event.preventDefault()
    event.target.closest('.tree-item')?.classList.remove('drag-over')
    const draggedName = event.dataTransfer.getData('text/plain')
    if (!draggedName || draggedName === targetName) return

    try {
      const meta = await API.getMeta()
      const pages = meta.pages || []
      const dragged = pages.find(p => p.name === draggedName)
      if (!dragged) return

      dragged.parent = targetName
      await API.saveMeta(meta)
      Pages.loadTree()
      Pages.showToast('Jerarquía actualizada', 'success')
    } catch (err) {
      Pages.showToast('Error al guardar tree: ' + err.message, 'error')
    }
  }
}
