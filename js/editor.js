const Editor = {
  _instance: null,
  _dirty: false,
  _currentPath: null,
  _currentSha: null,
  _lastSaved: '',
  _draftTimer: null,
  _mkdocsSha: null,

  async init() {
    const params = new URLSearchParams(window.location.search)
    const filePath = params.get('file')
    const titleEl = document.getElementById('page-title')
    const domainSelect = document.getElementById('domain-select')
    const navSelect = document.getElementById('nav-section-select')
    const newNavInput = document.getElementById('new-nav-input')

    await this._loadNavSections()

    if (filePath) {
      this._currentPath = filePath
      titleEl.textContent = `Editando: ${filePath}`
      domainSelect.value = filePath.split('/')[0] || ''
      domainSelect.disabled = true
      navSelect.disabled = true
      await this._loadDoc(filePath)
    } else {
      titleEl.textContent = 'Nuevo documento'
      this._initEditor(this._loadDraft() || '')
    }

    domainSelect.addEventListener('change', () => {
      this._updateNavSections(domainSelect.value)
      this._updatePathPreview()
    })

    navSelect.addEventListener('change', () => {
      newNavInput.style.display = navSelect.value === '__new__' ? 'block' : 'none'
      if (navSelect.value !== '__new__') newNavInput.value = ''
    })

    document.getElementById('template-select').addEventListener('change', (e) => {
      if (e.target.value) this._applyTemplate(e.target.value)
      e.target.value = ''
    })
  },

  async _loadNavSections() {
    try {
      const { content, sha } = await API.getMkDocsYaml()
      this._mkdocsSha = sha
      this._mkdocsContent = content
      this._navStructure = this._parseNav(content)
    } catch (err) {
      this._navStructure = {
        'Agile': { 'Overview': true, 'Epics': true, 'User Stories': true, 'Business Requirements': true, 'Release Notes': true, 'Reports': true, 'Meeting Notes': true },
        'Technical': { 'Overview': true, 'API': true, 'Architecture': true, 'ADRs': true, 'Runbooks': true, 'Batch Processing': true },
        'User Guides': { 'Overview': true, 'Getting Started': true, 'Features': true, 'FAQ': true },
        'Templates': { 'Overview': true, 'Epic': true, 'User Story': true, 'BRD': true, 'Release Note': true, 'ADR': true, 'Meeting Notes': true },
      }
      this._mkdocsContent = ''
    }
  },

  _parseNav(yamlContent) {
    const structure = {}
    const lines = yamlContent.split('\n')
    let inNav = false
    let currentDomain = null

    for (const line of lines) {
      if (line.trim() === 'nav:') {
        inNav = true
        continue
      }
      if (!inNav) continue

      if (line.match(/^  - [\w][\w -]*:/)) {
        const match = line.match(/^  - ([\w][\w -]*):/)
        if (match) {
          currentDomain = match[1]
          structure[currentDomain] = {}
        }
      } else if (currentDomain && line.match(/^    - [\w][\w -]*:/)) {
        const match = line.match(/^    - ([\w][\w -]*):/)
        if (match) {
          structure[currentDomain][match[1]] = true
        }
      } else if (line.match(/^- /) && !line.startsWith('  ')) {
        break
      }
    }
    return structure
  },

  _updateNavSections(domain) {
    const navSelect = document.getElementById('nav-section-select')
    const newNavInput = document.getElementById('new-nav-input')
    navSelect.innerHTML = '<option value="">Sección*</option>'
    newNavInput.style.display = 'none'
    navSelect.value = ''

    if (!domain) return

    const sections = this._navStructure[domain] || this._navStructure[domain.charAt(0).toUpperCase() + domain.slice(1)] || {}
    for (const section of Object.keys(sections)) {
      const opt = document.createElement('option')
      opt.value = section
      opt.textContent = section
      navSelect.appendChild(opt)
    }

    const newOpt = document.createElement('option')
    newOpt.value = '__new__'
    newOpt.textContent = '+ Nueva sección...'
    navSelect.appendChild(newOpt)
  },

  _initEditor(content) {
    var TuiEditor = toastui.Editor
    const { codeSyntaxHighlight, colorSyntax } = TuiEditor.plugin
    this._instance = new TuiEditor({
      el: document.getElementById('editor-container'),
      initialValue: content,
      initialEditType: 'markdown',
      previewStyle: 'vertical',
      height: '100%',
      usageStatistics: false,
      plugins: [[codeSyntaxHighlight, { highlighter: Prism }], colorSyntax]
    })

    this._lastSaved = content
    this._instance.on('change', () => {
      this._dirty = this._instance.getMarkdown() !== this._lastSaved
      clearTimeout(this._draftTimer)
      this._draftTimer = setTimeout(() => this._persistDraft(), 2000)
    })
  },

  async _loadDoc(path) {
    try {
      const { content, sha } = await API.getDoc(path)
      this._currentSha = sha
      const titleInput = document.getElementById('doc-title')
      const filename = path.split('/').pop().replace('.md', '')
      titleInput.value = filename.replace(/-/g, ' ')
      titleInput.disabled = true
      this._initEditor(content)
    } catch (err) {
      this._initEditor('')
      this._toast(`Error al cargar: ${err.message}`, 'error')
    }
  },

  async save() {
    const status = document.getElementById('editor-status')
    const domainSelect = document.getElementById('domain-select')
    const navSelect = document.getElementById('nav-section-select')
    const newNavInput = document.getElementById('new-nav-input')
    const titleInput = document.getElementById('doc-title')
    const content = this._instance.getMarkdown()

    if (!content.trim()) {
      this._toast('El contenido está vacío', 'error')
      return
    }

    let path = this._currentPath
    let docTitle = ''
    if (!path) {
      const domain = domainSelect.value
      if (!domain) {
        this._toast('Seleccioná un dominio', 'error')
        domainSelect.focus()
        return
      }

      let navSection = navSelect.value
      if (navSection === '__new__') {
        navSection = newNavInput.value.trim()
        if (!navSection) {
          this._toast('Ingresá el nombre de la nueva sección', 'error')
          newNavInput.focus()
          return
        }
        navSection = this._slugify(navSection)
      }
      if (!navSection) {
        this._toast('Seleccioná una sección del nav', 'error')
        navSelect.focus()
        return
      }

      docTitle = titleInput.value.trim()
      if (!docTitle) {
        this._toast('Ingresá el título del documento', 'error')
        titleInput.focus()
        return
      }

      const slug = this._slugify(docTitle) || 'documento'
      path = `${domain}/${navSection}/${slug}.md`

      if (!this._navStructure[domain]) {
        this._navStructure[domain] = {}
      }
      this._navStructure[domain][navSection] = true
    } else {
      docTitle = titleInput.value.trim() || path.split('/').pop().replace('.md', '')
    }

    if (status) status.textContent = 'Guardando...'

    try {
      await API.saveDoc(path, content, this._currentSha)
      this._currentPath = path
      this._dirty = false
      this._lastSaved = content
      this._clearDraft()

      if (!this._currentSha) {
        await this._updateMkDocsNav(path, docTitle)
      }

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

  async _updateMkDocsNav(path, docTitle) {
    if (!this._mkdocsContent) return

    const parts = path.replace('.md', '').split('/')
    const domain = parts[0]
    const section = parts[1]
    const title = docTitle || parts[2]

    let yaml = this._mkdocsContent
    const domainPattern = new RegExp(`^  - ${domain}:`, 'm')
    const domainMatch = yaml.match(domainPattern)

    if (!domainMatch) {
      const sectionHeader = yaml.includes('# --- Editor ---') ? '# --- Editor ---' : 'nav:'
      const domainBlock = `  - ${domain.charAt(0).toUpperCase() + domain.slice(1)}:\n    - Overview: ${domain}/index.md\n    - ${section.charAt(0).toUpperCase() + section.slice(1)}:\n      - "${title}": ${path}`
      yaml = yaml.replace(sectionHeader, `${domainBlock}\n${sectionHeader}`)
    } else {
      const domainIdx = yaml.indexOf(domainMatch[0])
      const afterDomain = yaml.substring(domainIdx)
      const sectionPattern = new RegExp(`^    - ${section}:`, 'm')
      const sectionMatch = afterDomain.match(sectionPattern)

      if (!sectionMatch) {
        const navEntry = `    - ${section.charAt(0).toUpperCase() + section.slice(1)}:\n      - "${title}": ${path}`
        const lines = yaml.split('\n')
        const domainLineIdx = lines.findIndex(l => l.includes(domainMatch[0]))
        let insertIdx = domainLineIdx + 1
        while (insertIdx < lines.length && (lines[insertIdx].startsWith('    - ') || lines[insertIdx].startsWith('      -'))) {
          insertIdx++
        }
        lines.splice(insertIdx, 0, navEntry)
        yaml = lines.join('\n')
      } else {
        const sectionIdx = yaml.indexOf(sectionMatch[0], domainIdx)
        const afterSection = yaml.substring(sectionIdx)
        const lastEntryMatch = afterSection.match(/      - "[^"]*": [^\n]+/g)
        if (lastEntryMatch) {
          const lastEntry = lastEntryMatch[lastEntryMatch.length - 1]
          const lastEntryIdx = yaml.indexOf(lastEntry, sectionIdx) + lastEntry.length
          yaml = yaml.substring(0, lastEntryIdx) + `\n      - "${title}": ${path}` + yaml.substring(lastEntryIdx)
        }
      }
    }

    try {
      await API.saveMkDocsYaml(yaml, this._mkdocsSha)
      this._mkdocsContent = yaml
    } catch (err) {
      this._toast('Nav no actualizado. Agregá manualmente a mkdocs.yml', 'error')
    }
  },

  preview() {
    const md = markdownit({
      html: true,
      breaks: true,
      linkify: true,
      highlight: (str, lang) => {
        if (lang === 'mermaid') return `<pre class="language-mermaid"><code class="language-mermaid">${md.utils.escapeHtml(str)}</code></pre>`
        if (lang && Prism.languages[lang]) {
          try { return `<pre class="language-${lang}"><code class="language-${lang}">${Prism.highlight(str, Prism.languages[lang], lang)}</code></pre>` } catch (e) {}
        }
        return `<pre class="language-text"><code class="language-text">${md.utils.escapeHtml(str)}</code></pre>`
      }
    })
      .use(markdownitFootnote)
      .use(markdownitDeflist)
      .use(markdownitMark)
      .use(markdownitIns)
      .use(markdownitSub)
      .use(markdownitSup)
      .use(markdownitEmoji)
      .use(markdownitTaskLists, { enabled: true })

    const html = md.render(this._instance.getMarkdown())
    const container = document.getElementById('preview-content')
    container.innerHTML = `<div class="md-typeset" data-md-color-scheme="default">${html}</div>`

    container.querySelectorAll('code.language-mermaid').forEach(el => {
      const pre = el.parentElement
      const div = document.createElement('div')
      div.className = 'mermaid'
      div.textContent = el.textContent
      pre.replaceWith(div)
    })

    if (window.mermaid) {
      mermaid.initialize({ startOnLoad: false, theme: 'default' })
      mermaid.run({ querySelector: '.mermaid' })
    }

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
      this._instance.setMarkdown(templates[type])
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
        content: this._instance.getMarkdown(),
        title: document.getElementById('doc-title').value,
        domain: document.getElementById('domain-select').value,
        navSection: document.getElementById('nav-section-select').value,
        savedAt: Date.now()
      }))
    } catch (e) {}
  },

  _loadDraft() {
    try {
      const key = 'editor-draft:' + (this._currentPath || '__new__')
      const data = JSON.parse(localStorage.getItem(key))
      if (data && data.content && confirm('Tienes un borrador sin guardar. ¿Restaurar?')) {
        if (data.title) document.getElementById('doc-title').value = data.title
        if (data.domain) document.getElementById('domain-select').value = data.domain
        if (data.navSection) {
          this._updateNavSections(data.domain)
          document.getElementById('nav-section-select').value = data.navSection
        }
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
