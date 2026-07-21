const Editor = {
  _instance: null,
  _dirty: false,
  _currentPath: null,
  _currentSha: null,
  _lastSaved: '',
  _draftTimer: null,

  async init() {
    const params = new URLSearchParams(window.location.search)
    const filePath = params.get('file')
    const titleEl = document.getElementById('page-title')
    const domainSelect = document.getElementById('domain-select')

    if (filePath) {
      this._currentPath = filePath
      titleEl.textContent = `Editando: ${filePath}`
      domainSelect.value = filePath.split('/')[0] || ''
      domainSelect.disabled = true
      await this._loadDoc(filePath)
    } else {
      titleEl.textContent = 'Nuevo documento'
      this._initEditor(this._loadDraft() || '')
    }

    domainSelect.addEventListener('change', () => this._updatePathPreview())

    document.getElementById('template-select').addEventListener('change', (e) => {
      if (e.target.value) this._applyTemplate(e.target.value)
      e.target.value = ''
    })
  },

  _initEditor(content) {
    this._instance = new EasyMDE({
      element: document.getElementById('editor-container'),
      value: content,
      autosave: { enabled: false },
      toolbar: [
        'heading', 'bold', 'italic', 'strikethrough', '|',
        'quote', 'unordered-list', 'ordered-list', '|',
        'link', 'image', 'table', 'horizontal-rule', '|',
        'code', 'side-by-side', 'fullscreen', '|',
        'preview', 'guide'
      ],
      status: false,
      minHeight: '60vh',
      spellChecker: false,
    })

    this._lastSaved = content
    this._instance.codemirror.on('change', () => {
      this._dirty = this._instance.value() !== this._lastSaved
      clearTimeout(this._draftTimer)
      this._draftTimer = setTimeout(() => this._persistDraft(), 2000)
    })
  },

  async _loadDoc(path) {
    try {
      const { content, sha } = await API.getDoc(path)
      this._currentSha = sha
      this._initEditor(content)
    } catch (err) {
      this._initEditor('')
      this._toast(`Error al cargar: ${err.message}`, 'error')
    }
  },

  async save() {
    const status = document.getElementById('editor-status')
    const domainSelect = document.getElementById('domain-select')
    const content = this._instance.value()

    if (!content.trim()) {
      this._toast('El contenido está vacío', 'error')
      return
    }

    let path = this._currentPath
    if (!path) {
      const domain = domainSelect.value
      if (!domain) {
        this._toast('Seleccioná un dominio', 'error')
        return
      }
      const filename = this._slugify(content.split('\n')[0] || 'documento') + '.md'
      path = `${domain}/${filename}`
    }

    if (status) status.textContent = 'Guardando...'

    try {
      await API.saveDoc(path, content, this._currentSha)
      this._currentPath = path
      this._dirty = false
      this._lastSaved = content
      this._clearDraft()
      this._toast('Guardado correctamente', 'success')
      if (status) {
        status.textContent = '✓ Guardado'
        setTimeout(() => { status.textContent = '' }, 2000)
      }
      if (!this._currentSha) {
        window.history.replaceState({}, '', `editor.html?file=${encodeURIComponent(path)}`)
      }
      const { sha } = await API.getDoc(path)
      this._currentSha = sha
    } catch (err) {
      this._toast(`Error al guardar: ${err.message}`, 'error')
      if (status) status.textContent = ''
    }
  },

  preview() {
    const md = new markdownit({ html: true, breaks: true, linkify: true })
    const html = md.render(this._instance.value())
    document.getElementById('preview-content').innerHTML = html
    document.getElementById('preview-modal').style.display = 'flex'
  },

  _slugify(text) {
    return text
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s-]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60)
  },

  _applyTemplate(type) {
    const templates = {
      epic: `# Epic: [Título]\n\n## Descripción\n\nDescribe el epic.\n\n## Objetivos\n\n- Objetivo 1\n- Objetivo 2\n\n## Criterios de aceptación\n\n- [ ] Criterio 1\n- [ ] Criterio 2\n\n## Historias asociadas\n\n| ID | Título | Estado |\n|----|--------|--------|\n| | | |`,
      'user-story': `# User Story: [Título]\n\n**Como** [rol]\n**Quiero** [acción]\n**Para** [beneficio]\n\n## Criterios de aceptación\n\n- [ ] Criterio 1\n- [ ] Criterio 2\n\n## Notas técnicas\n\nImplementación sugerida.\n\n## Estimación\n\n- Story Points: \n- Complejidad: Baja/Media/Alta`,
      brd: `# BRD: [Nombre del Proyecto]\n\n## Resumen Ejecutivo\n\nDescripción del proyecto.\n\n## Objetivos\n\n- Objetivo 1\n- Objetivo 2\n\n## Alcance\n\n### Incluido\n- \n\n### No incluido\n- \n\n## Requisitos\n\n### Funcionales\n- \n\n### No funcionales\n- \n\n## Restricciones\n\n- \n\n## Aprobaciones\n\n| Rol | Nombre | Fecha |\n|-----|--------|-------|\n| | | |`,
      'release-note': `# Release Note: v[X.Y.Z]\n\n**Fecha:** YYYY-MM-DD\n\n## Nuevas funcionalidades\n\n- \n\n## Mejoras\n\n- \n\n## Correcciones\n\n- \n\n## Breaking changes\n\n- \n\n## Instalación\n\n\`\`\`bash\n# comando\n\`\`\``,
      adr: `# ADR-[NNN]: [Título]\n\n**Estado:** Propuesto / Aceptado / Obsoleto\n**Fecha:** YYYY-MM-DD\n**Decisor(es):** [Nombres]\n\n## Contexto\n\nDescribe el problema o decisión.\n\n## Decisión\n\nDescribe la decisión tomada.\n\n## Consecuencias\n\n### Positivas\n- \n\n### Negativas\n- \n\n### Riesgos\n- `,
      'meeting-notes': `# Notas de Reunión: [Título]\n\n**Fecha:** YYYY-MM-DD\n**Participantes:** \n**Duración:** \n\n## Agenda\n\n1. \n\n## Discusión\n\n### Punto 1\n\nNotas.\n\n## Acciones\n\n| Acción | Responsable | Fecha |\n|--------|-------------|-------|\n| | | |\n\n## Próxima reunión\n\n- Fecha: \n- Temas: `
    }

    if (templates[type] && this._instance) {
      this._instance.value(templates[type])
      this._dirty = true
    }
  },

  _updatePathPreview() {
    const domain = document.getElementById('domain-select').value
    const titleEl = document.getElementById('page-title')
    if (domain && !this._currentPath) {
      titleEl.textContent = `Nuevo en ${domain}/...`
    }
  },

  _persistDraft() {
    if (!this._dirty) return
    try {
      localStorage.setItem('editor-draft:' + (this._currentPath || '__new__'), JSON.stringify({
        content: this._instance.value(),
        domain: document.getElementById('domain-select').value,
        savedAt: Date.now()
      }))
    } catch (e) {}
  },

  _loadDraft() {
    try {
      const key = 'editor-draft:' + (this._currentPath || '__new__')
      const data = JSON.parse(localStorage.getItem(key))
      if (data && data.content && confirm('Tienes un borrador sin guardar. ¿Restaurar?')) {
        if (data.domain) document.getElementById('domain-select').value = data.domain
        return data.content
      }
      if (data) localStorage.removeItem(key)
    } catch (e) {}
    return null
  },

  _clearDraft() {
    try {
      localStorage.removeItem('editor-draft:' + (this._currentPath || '__new__'))
    } catch (e) {}
  },

  _toast(message, type = 'success') {
    const toast = document.getElementById('toast')
    if (!toast) return
    toast.textContent = message
    toast.className = `toast toast-${type} show`
    setTimeout(() => { toast.className = 'toast' }, 3000)
  }
}
