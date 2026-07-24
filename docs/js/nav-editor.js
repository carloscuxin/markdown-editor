const NavEditor = {
  _rawYaml: '',
  _sha: null,
  _navRange: null,
  _tree: [],
  _nodeMap: {},
  _expanded: new Set(),
  _knownPaths: null,
  _dirty: false,
  _saving: false,
  _errorSticky: false,
  state: 'idle',
  _sortables: [],
  _idCounter: 0,
  _pendingYaml: null,
  _addModalParentId: null,
  _toastTimer: null,

  async init() {
    document.getElementById('add-root-btn').addEventListener('click', () => this._openAddModal(null))
    document.getElementById('save-btn').addEventListener('click', () => this._openSaveModal())
    document.getElementById('reload-btn').addEventListener('click', () => this._load())
    document.getElementById('discard-btn').addEventListener('click', () => this._discardChanges())
    document.getElementById('preview-btn').addEventListener('click', () => this._openPreview())
    document.getElementById('confirm-save-btn').addEventListener('click', () => this._confirmSave())
    document.getElementById('cancel-save-btn').addEventListener('click', () => {
      document.getElementById('save-modal').style.display = 'none'
    })
    document.getElementById('close-preview-btn').addEventListener('click', () => {
      document.getElementById('preview-modal').style.display = 'none'
    })
    document.getElementById('add-form').addEventListener('submit', (e) => this._submitAddModal(e))
    document.getElementById('cancel-add-btn').addEventListener('click', () => {
      document.getElementById('add-modal').style.display = 'none'
    })
    document.querySelectorAll('input[name="add-type"]').forEach(r => {
      r.addEventListener('change', () => this._updateAddModalFields())
    })

    document.getElementById('nav-tree-container').addEventListener('click', (e) => this._onTreeClick(e))

    document.addEventListener('keydown', (e) => {
      const isSaveCombo = e.key.toLowerCase() === 's' && (e.ctrlKey || e.metaKey)
      if (!isSaveCombo) return
      e.preventDefault()
      if (this._currentState() === 'dirty') this._openSaveModal()
    })

    await this._load()
    this._loadKnownPaths()
  },

  // --- Timeout wrapper -----------------------------------------------------
  // api.js's public methods don't accept a signal/options param (its interface
  // is intentionally left untouched), so a real AbortController can't reach
  // the underlying fetch from here. This races the call against a rejecting
  // timer instead: it can't cancel the in-flight request, but it gives the UI
  // the "esto tardó demasiado" outcome the spec asks for.
  _withTimeout(promise, ms = 10000) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms)),
    ])
  },

  // --- Error classification -------------------------------------------------
  // api.js's _request only ever throws `new Error(body.message || ...)` - it
  // never exposes the HTTP status or response headers, so real X-RateLimit-Reset
  // parsing or a true 403/429/409 status check isn't possible without touching
  // api.js's interface. This classifies by message-shape instead, which is a
  // degraded but workable substitute given that constraint.
  _classifyError(err) {
    if (err && err.message === 'TIMEOUT') {
      return 'La solicitud tardó demasiado. Intenta de nuevo.'
    }
    if (err instanceof TypeError) {
      return 'Error de conexión. Verifica tu conexión a internet.'
    }
    const msg = (err && err.message) || ''
    if (/rate limit/i.test(msg)) {
      return 'Límite de API de GitHub excedido. Intentá de nuevo en unos minutos.'
    }
    if (/sha|conflict|does not match/i.test(msg)) {
      return 'El archivo cambió en GitHub. Recargá la página para ver la versión más reciente.'
    }
    return msg || 'Ocurrió un error inesperado.'
  },

  async _load() {
    const container = document.getElementById('nav-tree-container')
    this._errorSticky = false
    this._saving = false
    try {
      const { content, sha } = await this._withTimeout(API.getMkDocsYaml())
      this._rawYaml = content
      this._sha = sha
      this._navRange = this._extractNavBlock(content)
      const parsed = jsyaml.load(this._navRange.text) || {}
      this._idCounter = 0
      this._tree = this._parseList(parsed.nav || [])
      this._indexTree()
      this._expanded = new Set(this._tree.map(n => n.id))
      this._dirty = false
      document.getElementById('reload-banner').style.display = 'none'
      this._render()
    } catch (err) {
      container.innerHTML = `<p class="nav-editor-error">Error al cargar mkdocs.yml: ${escapeHtml(this._classifyError(err))}</p>`
    }
  },

  async _loadKnownPaths() {
    try {
      this._knownPaths = await this._withTimeout(API.listAllDocPaths())
    } catch {
      this._knownPaths = null
    }
    const datalist = document.getElementById('known-paths-list')
    datalist.innerHTML = (this._knownPaths || []).map(p => `<option value="${escapeHtml(p)}"></option>`).join('')
    this._render()
  },

  // --- Parsing: nav: block is edited in isolation, the rest of mkdocs.yml
  // (theme, plugins, its comments) is left byte-for-byte untouched. js-yaml
  // does not preserve comments, so any comment lines living *inside* the
  // nav: block itself (e.g. "# --- Agile ---") are intentionally dropped on
  // save; the diff preview modal makes that visible before the user confirms.
  _extractNavBlock(yamlText) {
    const lines = yamlText.split('\n')
    let start = -1
    let end = lines.length
    for (let i = 0; i < lines.length; i++) {
      if (start === -1 && /^nav:\s*$/.test(lines[i])) {
        start = i
        continue
      }
      if (start !== -1 && i > start && /^[A-Za-z_][\w-]*:/.test(lines[i])) {
        end = i
        break
      }
    }
    if (start === -1) throw new Error('No se encontró la clave "nav:" en mkdocs.yml')
    return { start, end, text: lines.slice(start, end).join('\n') + '\n' }
  },

  _buildFullYaml(newNavBlockText) {
    const lines = this._rawYaml.split('\n')
    const newBlockLines = newNavBlockText.replace(/\n$/, '').split('\n')
    const result = [
      ...lines.slice(0, this._navRange.start),
      ...newBlockLines,
      ...lines.slice(this._navRange.end),
    ]
    return result.join('\n')
  },

  _nextId() {
    this._idCounter += 1
    return `n${Date.now().toString(36)}${this._idCounter}`
  },

  _parseList(list) {
    return (list || []).map(item => this._parseItem(item))
  },

  _parseItem(item) {
    if (typeof item === 'string') {
      return { id: this._nextId(), label: null, path: item, children: null }
    }
    const key = Object.keys(item)[0]
    const value = item[key]
    if (Array.isArray(value)) {
      return { id: this._nextId(), label: key, path: null, children: this._parseList(value) }
    }
    return { id: this._nextId(), label: key, path: value, children: null }
  },

  _serializeNav(tree) {
    const dumped = jsyaml.dump({ nav: this._toYamlList(tree) }, { lineWidth: -1, noRefs: true, indent: 2 })
    return dumped.trimEnd() + '\n'
  },

  _toYamlList(nodes) {
    return nodes.map(n => this._toYamlItem(n))
  },

  _toYamlItem(node) {
    if (node.children) {
      return { [node.label]: this._toYamlList(node.children) }
    }
    if (node.label) {
      return { [node.label]: node.path }
    }
    return node.path
  },

  _indexTree() {
    this._nodeMap = {}
    const walk = (list) => list.forEach(n => {
      this._nodeMap[n.id] = n
      if (n.children) walk(n.children)
    })
    walk(this._tree)
  },

  _findSiblings(id) {
    const search = (list) => {
      if (list.some(n => n.id === id)) return list
      for (const n of list) {
        if (n.children) {
          const found = search(n.children)
          if (found) return found
        }
      }
      return null
    }
    return search(this._tree) || this._tree
  },

  _labelError(label, siblings, excludeId) {
    if (!label || !label.trim()) return 'El label no puede estar vacío.'
    if (label.length > 80) return 'El label no puede superar los 80 caracteres.'
    const dup = siblings.some(n => n.id !== excludeId && n.label === label)
    if (dup) return `Ya existe un elemento con el label "${label}" en este nivel.`
    return null
  },

  _markDirty() {
    this._dirty = true
    this._errorSticky = false
  },

  // --- State machine ---------------------------------------------------
  // idle | dirty | saving | error | empty. Derived from a few flags rather
  // than tracked as an independent value, so render()/markDirty() can't drift
  // out of sync with what's actually on screen.

  _currentState() {
    if (this._saving) return 'saving'
    if (this._errorSticky) return 'error'
    if (this._tree.length === 0) return 'empty'
    if (this._dirty) return 'dirty'
    return 'idle'
  },

  _syncState() {
    const state = this._currentState()
    this.state = state
    document.body.dataset.navState = state

    const saveBtn = document.getElementById('save-btn')
    const badge = document.getElementById('dirty-badge')
    const discardBtn = document.getElementById('discard-btn')
    const overlay = document.getElementById('saving-overlay')

    overlay.style.display = state === 'saving' ? 'flex' : 'none'
    this._sortables.forEach(s => s.option('disabled', state === 'saving'))
    document.getElementById('nav-tree-container').classList.toggle('nav-tree-locked', state === 'saving')
    document.getElementById('add-root-btn').disabled = state === 'saving'

    saveBtn.disabled = !(state === 'dirty' || state === 'error')
    saveBtn.textContent = state === 'saving' ? 'Guardando...' : 'Guardar cambios'
    badge.style.display = (state === 'dirty' || state === 'saving' || state === 'error') ? 'inline-flex' : 'none'
    discardBtn.style.display = (state === 'dirty' || state === 'error') ? 'inline-block' : 'none'
  },

  // --- Rendering ---

  _render() {
    const container = document.getElementById('nav-tree-container')
    if (this._tree.length === 0) {
      container.innerHTML = `
        <div class="nav-empty-state">
          <p>No hay secciones de navegación.</p>
          <button class="btn btn-primary" id="empty-add-btn">Crear primera sección</button>
        </div>
      `
      document.getElementById('empty-add-btn').addEventListener('click', () => this._openAddModal(null))
      this._sortables.forEach(s => s.destroy())
      this._sortables = []
      this._syncState()
      return
    }
    container.innerHTML = `<ul class="nav-tree" id="nav-tree-root">${this._tree.map(n => this._renderNode(n)).join('')}</ul>`
    this._initSortables()
    this._syncState()
  },

  _pathWarning(node) {
    if (node.children || !this._knownPaths) return ''
    if (this._knownPaths.includes(node.path)) return ''
    return `<span class="nav-warning" title="El archivo aún no existe en el repo (docs/${escapeHtml(node.path || '')})">⚠</span>`
  },

  // Solo permite enlazar a archivos que ya existen en docs/: crear la
  // entrada de nav no crea el .md, y --strict falla si el archivo no existe.
  _pathExists(path) {
    if (!this._knownPaths) return true // aún no cargó el listado; no bloquear
    return this._knownPaths.includes(path)
  },

  _renderNode(node) {
    const isGroup = !!node.children
    const expanded = this._expanded.has(node.id)
    const labelText = node.label !== null ? node.label : `<em>(usa el título de la página)</em>`

    const toggle = isGroup
      ? `<button class="nav-toggle" data-action="toggle" title="${expanded ? 'Colapsar' : 'Expandir'}">${expanded ? '▾' : '▸'}</button>`
      : `<span class="nav-toggle-spacer"></span>`

    const pathHtml = !isGroup
      ? `<span class="nav-path" data-action="edit-path" title="docs/${escapeHtml(node.path || '')} — clic para editar">${escapeHtml(node.path || '(sin ruta)')}</span>`
      : ''

    const addBtn = isGroup
      ? `<button data-action="add-child" title="Agregar dentro de esta sección">+</button>`
      : ''

    const childrenHtml = isGroup && expanded
      ? `<ul class="nav-children" data-parent="${node.id}">${node.children.map(c => this._renderNode(c)).join('')}</ul>`
      : ''

    return `
      <li class="nav-node" data-id="${node.id}">
        <div class="nav-node-row">
          <span class="nav-drag-handle" title="Arrastrar para reordenar">⠿</span>
          ${toggle}
          <span class="nav-icon">${isGroup ? '📁' : '📄'}</span>
          <span class="nav-label" data-action="edit-label" title="Editar label">${labelText}</span>
          ${pathHtml}
          ${this._pathWarning(node)}
          <span class="nav-actions">
            ${addBtn}
            <button data-action="delete" title="Eliminar">🗑</button>
          </span>
        </div>
        ${childrenHtml}
      </li>
    `
  },

  _initSortables() {
    this._sortables.forEach(s => s.destroy())
    this._sortables = []
    document.querySelectorAll('#nav-tree-root, .nav-children').forEach(ul => {
      const s = new Sortable(ul, {
        group: 'nav',
        animation: 150,
        handle: '.nav-drag-handle',
        disabled: this._saving,
        onEnd: () => {
          this._collectTreeFromDom()
          this._markDirty()
          this._render()
        },
      })
      this._sortables.push(s)
    })
  },

  _collectTreeFromDom() {
    const buildFromUl = (ul) => Array.from(ul.children).map(li => {
      const node = this._nodeMap[li.dataset.id]
      const childUl = li.querySelector(':scope > ul.nav-children')
      if (childUl) node.children = buildFromUl(childUl)
      return node
    })
    this._tree = buildFromUl(document.getElementById('nav-tree-root'))
  },

  // --- Interaction ---

  _onTreeClick(e) {
    if (this._currentState() === 'saving') return
    const target = e.target.closest('[data-action]')
    if (!target) return
    const li = target.closest('.nav-node')
    const id = li && li.dataset.id
    const action = target.dataset.action

    if (action === 'toggle') {
      if (this._expanded.has(id)) this._expanded.delete(id)
      else this._expanded.add(id)
      this._render()
    } else if (action === 'add-child') {
      this._openAddModal(id)
    } else if (action === 'delete') {
      this._deleteNode(id)
    } else if (action === 'edit-label') {
      this._editInline(target, id, 'label')
    } else if (action === 'edit-path') {
      this._editInline(target, id, 'path')
    }
  },

  _editInline(el, id, field) {
    const node = this._nodeMap[id]
    if (!node) return
    const current = field === 'label' ? (node.label || '') : (node.path || '')
    const input = document.createElement('input')
    input.type = 'text'
    input.className = 'nav-inline-input'
    input.value = current
    if (field === 'path') input.setAttribute('list', 'known-paths-list')
    el.replaceWith(input)
    input.focus()
    input.select()

    const commit = () => {
      const value = input.value.trim()
      if (field === 'label') {
        if (value === '' && node.children) {
          this._toast('La sección necesita un nombre.', 'error')
          this._render()
          return
        }
        if (value !== '') {
          const err = this._labelError(value, this._findSiblings(id), id)
          if (err) {
            this._toast(err, 'error')
            this._render()
            return
          }
        }
        node.label = value === '' ? null : value
      } else {
        if (value && !this._pathExists(value)) {
          this._toast(`"${value}" no existe todavía en docs/. Creá el archivo desde el editor de contenido antes de enlazarlo.`, 'error')
          this._render()
          return
        }
        node.path = value
      }
      this._markDirty()
      this._render()
    }

    input.addEventListener('blur', commit)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') input.blur()
      if (e.key === 'Escape') { input.value = current; input.blur() }
    })
  },

  _deleteNode(id) {
    const node = this._nodeMap[id]
    if (!node) return
    const childCount = node.children ? node.children.length : 0
    const name = node.label || node.path || '(sin nombre)'
    const msg = childCount > 0
      ? `"${name}" contiene ${childCount} elemento(s) dentro. ¿Eliminar de todas formas?\n\nLos archivos .md referenciados NO se borrarán del repositorio, sólo se quitan del menú de navegación.`
      : `¿Eliminar "${name}" del menú de navegación?\n\nEl archivo .md (si lo tiene) NO se borrará del repositorio.`
    if (!confirm(msg)) return

    const removeFrom = (list) => {
      const idx = list.findIndex(n => n.id === id)
      if (idx !== -1) { list.splice(idx, 1); return true }
      for (const n of list) {
        if (n.children && removeFrom(n.children)) return true
      }
      return false
    }
    removeFrom(this._tree)
    this._indexTree()
    this._markDirty()
    this._render()
  },

  _discardChanges() {
    if (!confirm('¿Descartar todos los cambios sin guardar y volver a la última versión guardada?')) return
    this._load()
  },

  // --- Add node modal ---

  _openAddModal(parentId) {
    this._addModalParentId = parentId
    const form = document.getElementById('add-form')
    form.reset()
    document.querySelector('input[name="add-type"][value="group"]').checked = true
    this._updateAddModalFields()
    document.getElementById('add-modal-title').textContent = parentId
      ? `Agregar dentro de "${this._nodeMap[parentId].label || this._nodeMap[parentId].path}"`
      : 'Agregar sección en la raíz'
    document.getElementById('add-modal').style.display = 'flex'
    document.getElementById('add-label-input').focus()
  },

  _updateAddModalFields() {
    const type = document.querySelector('input[name="add-type"]:checked').value
    document.getElementById('add-path-field').style.display = type === 'page' ? 'block' : 'none'
  },

  _addModalSiblings() {
    return this._addModalParentId ? this._nodeMap[this._addModalParentId].children : this._tree
  },

  _submitAddModal(e) {
    e.preventDefault()
    const type = document.querySelector('input[name="add-type"]:checked').value
    const label = document.getElementById('add-label-input').value.trim()
    const path = document.getElementById('add-path-input').value.trim()
    const siblings = this._addModalSiblings()

    if (type === 'group') {
      const err = this._labelError(label, siblings, null)
      if (err) { this._toast(err, 'error'); return }
      this._insertNode({ id: this._nextId(), label, path: null, children: [] })
    } else {
      if (!path) { this._toast('Ingresá la ruta del archivo .md', 'error'); return }
      if (label) {
        const err = this._labelError(label, siblings, null)
        if (err) { this._toast(err, 'error'); return }
      }
      if (!this._pathExists(path)) {
        this._toast(`"${path}" no existe todavía en docs/. Creá el archivo desde el editor de contenido antes de agregarlo al menú.`, 'error')
        return
      }
      this._insertNode({ id: this._nextId(), label: label || null, path, children: null })
    }

    document.getElementById('add-modal').style.display = 'none'
  },

  _insertNode(node) {
    if (this._addModalParentId) {
      const parent = this._nodeMap[this._addModalParentId]
      parent.children.push(node)
      this._expanded.add(parent.id)
    } else {
      this._tree.push(node)
    }
    this._nodeMap[node.id] = node
    this._markDirty()
    this._render()
  },

  // --- Preview ---

  _openPreview() {
    const renderList = (nodes) => `<ul class="nav-preview-list">${nodes.map(n => `
      <li>
        ${n.children
          ? `<span class="nav-preview-section">${escapeHtml(n.label || '')}</span>${renderList(n.children)}`
          : `<a href="#" class="nav-preview-link" title="docs/${escapeHtml(n.path || '')}" onclick="return false">${escapeHtml(n.label || n.path || '')}</a>`
        }
      </li>
    `).join('')}</ul>`
    document.getElementById('preview-body').innerHTML = this._tree.length
      ? renderList(this._tree)
      : '<p class="nav-editor-loading">No hay secciones para mostrar.</p>'
    document.getElementById('preview-modal').style.display = 'flex'
  },

  // --- Validation ---

  _validateTree(nodes) {
    const errors = []
    const seenLabels = new Set()
    for (const n of nodes) {
      if (n.label) {
        if (n.label.length > 80) errors.push(`El label "${n.label}" supera los 80 caracteres.`)
        if (seenLabels.has(n.label)) errors.push(`Hay labels duplicados en el mismo nivel: "${n.label}".`)
        seenLabels.add(n.label)
      }
      if (n.children) {
        if (!n.label || !n.label.trim()) errors.push('Hay una sección sin nombre.')
        if (n.children.length === 0) errors.push(`La sección "${n.label}" está vacía (agregá una página o eliminala).`)
        else errors.push(...this._validateTree(n.children))
      } else if (!n.path || !n.path.trim()) {
        errors.push(`El nodo "${n.label || '(sin label)'}" no tiene una ruta de archivo.`)
      } else if (!this._pathExists(n.path)) {
        errors.push(`"${n.path}" no existe en docs/. Creá el archivo antes de guardar la navegación.`)
      }
    }
    return errors
  },

  // --- Diff preview (line-level LCS, so add/remove is highlighted rather
  // than just showing two flat blocks side by side) ---

  _diffLines(oldText, newText) {
    const a = oldText.replace(/\n$/, '').split('\n')
    const b = newText.replace(/\n$/, '').split('\n')
    const n = a.length
    const m = b.length
    const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
    for (let i = n - 1; i >= 0; i--) {
      for (let j = m - 1; j >= 0; j--) {
        dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
      }
    }
    const before = []
    const after = []
    let i = 0
    let j = 0
    while (i < n && j < m) {
      if (a[i] === b[j]) {
        before.push({ type: 'same', text: a[i] })
        after.push({ type: 'same', text: b[j] })
        i++; j++
      } else if (dp[i + 1][j] >= dp[i][j + 1]) {
        before.push({ type: 'del', text: a[i] })
        i++
      } else {
        after.push({ type: 'add', text: b[j] })
        j++
      }
    }
    while (i < n) { before.push({ type: 'del', text: a[i] }); i++ }
    while (j < m) { after.push({ type: 'add', text: b[j] }); j++ }
    return { before, after }
  },

  _diffHtml(oldText, newText) {
    const { before, after } = this._diffLines(oldText, newText)
    const render = (lines) => lines.map(l => `<span class="diff-line diff-${l.type}">${escapeHtml(l.text) || ' '}</span>`).join('\n')
    return { before: render(before), after: render(after) }
  },

  // --- Save flow ---

  _openSaveModal() {
    const errors = this._validateTree(this._tree)
    if (errors.length) {
      this._toast(errors[0], 'error')
      return
    }

    const newBlock = this._serializeNav(this._tree)

    let parsedCheck
    try {
      parsedCheck = jsyaml.load(newBlock)
    } catch (yamlErr) {
      const line = yamlErr.mark ? yamlErr.mark.line + 1 : '?'
      this._toast(`Error de YAML en línea ${line}: ${yamlErr.reason || yamlErr.message}`, 'error')
      return
    }
    if (!parsedCheck || !Array.isArray(parsedCheck.nav)) {
      this._toast('Estructura inválida: "nav" debe ser una lista.', 'error')
      return
    }

    const newYaml = this._buildFullYaml(newBlock)
    const diff = this._diffHtml(this._navRange.text, newBlock)
    document.getElementById('diff-before').innerHTML = diff.before
    document.getElementById('diff-after').innerHTML = diff.after
    this._pendingYaml = newYaml
    document.getElementById('save-modal').style.display = 'flex'
  },

  async _confirmSave() {
    const confirmBtn = document.getElementById('confirm-save-btn')
    confirmBtn.disabled = true
    this._saving = true
    this._syncState()
    try {
      const fresh = await this._withTimeout(API.getMkDocsYaml())
      if (fresh.sha !== this._sha) {
        document.getElementById('save-modal').style.display = 'none'
        document.getElementById('reload-banner').style.display = 'flex'
        this._saving = false
        this._errorSticky = true
        this._toast('mkdocs.yml cambió en GitHub mientras editabas. Recargá para traer la última versión.', 'error')
        this._syncState()
        confirmBtn.disabled = false
        return
      }
      await this._withTimeout(API.saveMkDocsYaml(this._pendingYaml, this._sha, 'chore: actualiza navegación (nav-editor)'))
      document.getElementById('save-modal').style.display = 'none'
      this._toast('Guardado exitosamente', 'success')
      confirmBtn.disabled = false
      await this._load()
    } catch (err) {
      this._saving = false
      this._errorSticky = true
      this._toast(this._classifyError(err), 'error')
      confirmBtn.disabled = false
      this._syncState()
    }
  },

  _toast(message, type = 'success') {
    const toast = document.getElementById('toast')
    if (!toast) return
    if (this._toastTimer) { clearTimeout(this._toastTimer); this._toastTimer = null }
    toast.innerHTML = `<span class="toast-msg"></span>`
    toast.querySelector('.toast-msg').textContent = message
    if (type === 'error') {
      const closeBtn = document.createElement('button')
      closeBtn.className = 'toast-close'
      closeBtn.textContent = '×'
      closeBtn.title = 'Descartar'
      closeBtn.addEventListener('click', () => this._dismissToast())
      toast.appendChild(closeBtn)
    }
    toast.className = `toast toast-${type} show`
    if (type !== 'error') {
      this._toastTimer = setTimeout(() => { toast.className = 'toast' }, 3500)
    }
  },

  _dismissToast() {
    const toast = document.getElementById('toast')
    toast.className = 'toast'
    if (this._errorSticky) {
      this._errorSticky = false
      this._syncState()
    }
  },
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

window.NavEditor = NavEditor
