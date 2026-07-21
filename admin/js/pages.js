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

    Pages._createInsertPanel()

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
  },

  _createInsertPanel() {
    const container = document.querySelector('#editor-container')
    if (!container) return
    const panel = document.createElement('div')
    panel.className = 'insert-panel'
    panel.innerHTML = [
      '<span class="ip-label">Insertar:</span>',
      '<button onclick="Pages.insertCallout(\'info\')" title="Callout informativo">Info</button>',
      '<button onclick="Pages.insertCallout(\'warning\')" title="Callout de advertencia">Warn</button>',
      '<button onclick="Pages.insertCallout(\'danger\')" title="Callout de peligro">Danger</button>',
      '<button onclick="Pages.insertCallout(\'success\')" title="Callout de exito">Success</button>',
      '<span class="ip-divider"></span>',
      '<button onclick="Pages.insertTabs()" title="Insertar tabs">Tabs</button>',
      '<button onclick="Pages.insertTOC()" title="Insertar tabla de contenido">TOC</button>',
      '<button onclick="Pages.insertMermaid()" title="Insertar diagrama Mermaid">Mermaid</button>',
      '<span class="ip-divider"></span>',
      '<button onclick="Pages.insertTemplate(\'page\')" title="Plantilla de pagina">Pagina</button>',
      '<button onclick="Pages.insertTemplate(\'api\')" title="Plantilla API">API</button>',
      '<button onclick="Pages.insertTemplate(\'guide\')" title="Plantilla guia">Guia</button>'
    ].join('')

    const toolbar = container.querySelector('.toastui-editor-defaultUI-toolbar')
    if (toolbar) {
      toolbar.insertAdjacentElement('afterend', panel)
    } else {
      container.appendChild(panel)
    }
  },

  _insertContent(text) {
    const editor = window.editor
    if (!editor) return
    if (editor.getCurrentMode() === 'wysiwyg') {
      const squire = editor.getCurrentModeEditor().getEditor()
      if (squire.insertHTML) {
        squire.insertHTML(text)
        squire.focus()
      }
    } else {
      const mdEditor = editor.getCurrentModeEditor()
      if (mdEditor.replaceSelection) {
        mdEditor.replaceSelection(text)
        mdEditor.focus()
      }
    }
  },

  insertCallout(type) {
    const html = '<div class="callout callout-' + type + '">Escribe el contenido aqu&iacute;...</div><p><br></p>'
    this._insertContent(html)
  },

  insertTabs() {
    const html = '<div class="tab-group"><div class="tab-nav"><button type="button" class="tab-btn active" data-tab="tab1">Pesta&ntilde;a 1</button><button type="button" class="tab-btn" data-tab="tab2">Pesta&ntilde;a 2</button></div><div class="tab-content active" data-tab="tab1">Contenido de la pesta&ntilde;a 1</div><div class="tab-content" data-tab="tab2">Contenido de la pesta&ntilde;a 2</div></div><p><br></p>'
    this._insertContent(html)
  },

  insertTOC() {
    const html = '<nav class="toc"><h4>Tabla de Contenido</h4></nav><p><br></p>'
    this._insertContent(html)
  },

  insertMermaid() {
    const code = 'flowchart TD\n    A[Inicio] --> B[Proceso]\n    B --> C[Fin]'
    if (window.editor.getCurrentMode() === 'wysiwyg') {
      var pre = document.createElement('pre')
      var codeEl = document.createElement('code')
      codeEl.className = 'language-mermaid'
      codeEl.textContent = code
      pre.appendChild(codeEl)
      var container = document.createElement('p')
      container.appendChild(pre)
      container.appendChild(document.createElement('br'))
      this._insertContent(container.outerHTML)
    } else {
      this._insertContent('\n```mermaid\n' + code + '\n```\n')
    }
  },

  insertTemplate(type) {
    const templates = {
      page: '# T&iacute;tulo de la p&aacute;gina\n\n## Descripci&oacute;n\n\nDescribe el prop&oacute;sito de esta p&aacute;gina.\n\n## Detalles\n\nContenido principal aqu&iacute;.\n\n## Referencias\n\n- [Enlace](url)',
      api: '# API Reference\n\n## Endpoint\n\n`GET /api/v1/resource`\n\n## Par&aacute;metros\n\n| Param | Tipo | Descripci&oacute;n |\n|-------|------|-----------------|\n| `id` | string | Identificador |\n\n## Respuesta\n\n```json\n{\n  "status": "ok",\n  "data": {}\n}\n```\n\n## Errores\n\n| C&oacute;digo | Descripci&oacute;n |\n|---------|-------------|\n| 400 | Bad Request |\n| 401 | No autorizado |',
      guide: '# Gu&iacute;a: T&iacute;tulo\n\n## Prerrequisitos\n\n- Requisito 1\n- Requisito 2\n\n## Paso 1: T&iacute;tulo del paso\n\nInstrucciones detalladas.\n\n## Paso 2: T&iacute;tulo del paso\n\nM&aacute;s instrucciones.\n\n## Resoluci&oacute;n de problemas\n\n### Error com&uacute;n\n\nSoluci&oacute;n al problema.\n\n## Siguientes pasos\n\n- [ ] Tarea pendiente\n- [x] Tarea completada'
    }

    const markdown = templates[type] || ''
    if (!markdown) return

    if (window.editor.getCurrentMode() === 'wysiwyg') {
      const md = new markdownit({ html: true, breaks: true })
      this._insertContent(md.render(markdown))
    } else {
      this._insertContent('\n' + markdown + '\n')
    }
  }
}
