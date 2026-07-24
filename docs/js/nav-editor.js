const NavEditor = {
  _rawYaml: '',
  _sha: null,
  _navRange: null,
  _tree: [],
  _nodeMap: {},
  _expanded: new Set(),
  _knownPaths: null,
  _dirty: false,
  _sortables: [],
  _idCounter: 0,
  _pendingYaml: null,
  _addModalParentId: null,

  async init() {
    document.getElementById('add-root-btn').addEventListener('click', () => this._openAddModal(null))
    document.getElementById('save-btn').addEventListener('click', () => this._openSaveModal())
    document.getElementById('reload-btn').addEventListener('click', () => this._load())
    document.getElementById('confirm-save-btn').addEventListener('click', () => this._confirmSave())
    document.getElementById('cancel-save-btn').addEventListener('click', () => {
      document.getElementById('save-modal').style.display = 'none'
    })
    document.getElementById('add-form').addEventListener('submit', (e) => this._submitAddModal(e))
    document.getElementById('cancel-add-btn').addEventListener('click', () => {
      document.getElementById('add-modal').style.display = 'none'
    })
    document.querySelectorAll('input[name="add-type"]').forEach(r => {
      r.addEventListener('change', () => this._updateAddModalFields())
    })

    document.getElementById('nav-tree-container').addEventListener('click', (e) => this._onTreeClick(e))

    await this._load()
    this._loadKnownPaths()
  },

  async _load() {
    const container = document.getElementById('nav-tree-container')
    try {
      const { content, sha } = await API.getMkDocsYaml()
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
      container.innerHTML = `<p class="nav-editor-error">Error al cargar mkdocs.yml: ${escapeHtml(err.message)}</p>`
    }
  },

  async _loadKnownPaths() {
    try {
      this._knownPaths = await API.listAllDocPaths()
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

  _markDirty() {
    this._dirty = true
    document.getElementById('save-btn').classList.add('nav-btn-attention')
  },

  // --- Rendering ---

  _render() {
    const container = document.getElementById('nav-tree-container')
    container.innerHTML = `<ul class="nav-tree" id="nav-tree-root">${this._tree.map(n => this._renderNode(n)).join('')}</ul>`
    this._initSortables()
  },

  _pathWarning(node) {
    if (node.children || !this._knownPaths) return ''
    if (this._knownPaths.includes(node.path)) return ''
    return `<span class="nav-warning" title="El archivo aún no existe en el repo (docs/${escapeHtml(node.path || '')})">⚠</span>`
  },

  _renderNode(node) {
    const isGroup = !!node.children
    const expanded = this._expanded.has(node.id)
    const labelText = node.label !== null ? node.label : `<em>(usa el título de la página)</em>`

    const toggle = isGroup
      ? `<button class="nav-toggle" data-action="toggle" title="${expanded ? 'Colapsar' : 'Expandir'}">${expanded ? '▾' : '▸'}</button>`
      : `<span class="nav-toggle-spacer"></span>`

    const pathHtml = !isGroup
      ? `<span class="nav-path" data-action="edit-path" title="Editar ruta">${escapeHtml(node.path || '(sin ruta)')}</span>`
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
        node.label = value === '' ? null : value
      } else {
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

  _submitAddModal(e) {
    e.preventDefault()
    const type = document.querySelector('input[name="add-type"]:checked').value
    const label = document.getElementById('add-label-input').value.trim()
    const path = document.getElementById('add-path-input').value.trim()

    if (type === 'group') {
      if (!label) { this._toast('La sección necesita un nombre', 'error'); return }
      this._insertNode({ id: this._nextId(), label, path: null, children: [] })
    } else {
      if (!path) { this._toast('Ingresá la ruta del archivo .md', 'error'); return }
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

  // --- Validation ---

  _validateTree(nodes) {
    const errors = []
    for (const n of nodes) {
      if (n.children) {
        if (!n.label || !n.label.trim()) errors.push('Hay una sección sin nombre.')
        if (n.children.length === 0) errors.push(`La sección "${n.label}" está vacía (agregá una página o eliminala).`)
        else errors.push(...this._validateTree(n.children))
      } else if (!n.path || !n.path.trim()) {
        errors.push(`El nodo "${n.label || '(sin label)'}" no tiene una ruta de archivo.`)
      }
    }
    return errors
  },

  // --- Save flow ---

  _openSaveModal() {
    const errors = this._validateTree(this._tree)
    if (errors.length) {
      this._toast(errors[0], 'error')
      return
    }
    const newBlock = this._serializeNav(this._tree)
    const newYaml = this._buildFullYaml(newBlock)
    document.getElementById('diff-before').textContent = this._navRange.text
    document.getElementById('diff-after').textContent = newBlock
    this._pendingYaml = newYaml
    document.getElementById('save-modal').style.display = 'flex'
  },

  async _confirmSave() {
    const status = document.getElementById('nav-status')
    const confirmBtn = document.getElementById('confirm-save-btn')
    confirmBtn.disabled = true
    status.textContent = 'Guardando...'
    try {
      const fresh = await API.getMkDocsYaml()
      if (fresh.sha !== this._sha) {
        status.textContent = ''
        confirmBtn.disabled = false
        document.getElementById('save-modal').style.display = 'none'
        document.getElementById('reload-banner').style.display = 'flex'
        this._toast('mkdocs.yml cambió en GitHub mientras editabas. Recargá para traer la última versión.', 'error')
        return
      }
      await API.saveMkDocsYaml(this._pendingYaml, this._sha, 'chore: actualiza navegación (nav-editor)')
      this._dirty = false
      document.getElementById('save-btn').classList.remove('nav-btn-attention')
      document.getElementById('save-modal').style.display = 'none'
      this._toast('Navegación guardada correctamente', 'success')
      status.textContent = '✓ Guardado'
      setTimeout(() => { status.textContent = '' }, 2000)
      confirmBtn.disabled = false
      await this._load()
    } catch (err) {
      this._toast(`Error al guardar: ${err.message}`, 'error')
      status.textContent = ''
      confirmBtn.disabled = false
    }
  },

  _toast(message, type = 'success') {
    const toast = document.getElementById('toast')
    if (!toast) return
    toast.textContent = message
    toast.className = `toast toast-${type} show`
    setTimeout(() => { toast.className = 'toast' }, 3500)
  },
}

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}

window.NavEditor = NavEditor
