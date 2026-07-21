(function () {
  'use strict'

  var curPage = window.location.pathname.split('/').pop() || ''
  var sidebar = document.getElementById('wiki-sidebar')
  var treeEl = document.getElementById('wiki-tree')
  var searchInput = document.getElementById('wiki-search')
  var meta = { pages: [] }

  function navigateTo(href, replace) {
    if (!href || href === curPage) return
    var pageName = href.split('/').pop()
    fetch(pageName)
      .then(function (r) { return r.text() })
      .then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html')
        var newContent = doc.querySelector('.wiki-content')
        if (!newContent) return
        document.querySelector('.wiki-content').innerHTML = newContent.innerHTML
        curPage = pageName
        if (!replace) history.pushState({ page: curPage }, '', curPage)
        renderTree()
        renderBreadcrumb()
        renderPrevNext()
        initTOC()
        initMermaid()
      })
      .catch(function () { window.location.href = href })
  }

  document.addEventListener('click', function (e) {
    var link = e.target.closest('a')
    if (!link) return
    var href = link.getAttribute('href')
    if (!href || href.startsWith('#') || href.startsWith('http') || href.startsWith('//')) return
    if (href.startsWith('../') || href.startsWith('/')) return
    e.preventDefault()
    navigateTo(href)
  })

  window.addEventListener('popstate', function (e) {
    var page = e.state ? e.state.page : window.location.pathname.split('/').pop() || ''
    if (page) navigateTo(page, true)
  })

  // Tabs
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.tab-btn')
    if (!btn) return
    var group = btn.closest('.tab-group')
    var tab = btn.dataset.tab
    group.querySelectorAll('.tab-btn').forEach(function (b) { b.classList.remove('active') })
    group.querySelectorAll('.tab-content').forEach(function (c) { c.classList.remove('active') })
    btn.classList.add('active')
    var content = group.querySelector('.tab-content[data-tab="' + tab + '"]') ||
                  group.querySelector('#' + tab)
    if (content) content.classList.add('active')
  })

  // Page tree
  function findChildren(parentName) {
    return (meta.pages || []).filter(function (p) { return p.parent === parentName })
      .sort(function (a, b) { return (a.order || 0) - (b.order || 0) })
  }

  function renderTree() {
    if (!treeEl) return
    var pages = meta.pages || []

    function renderNode(page) {
      var children = findChildren(page.name)
      var isActive = curPage === page.name
      if (children.length === 0) {
        return '<a href="' + page.name + '"' +
          (isActive ? ' class="active"' : '') +
          '>' + (page.title || page.name.replace('.html', '')) + '</a>'
      }

      var hasActiveChild = children.some(function (c) { return curPage === c.name })
      var open = isActive || hasActiveChild
      var html = '<div class="wiki-tree-folder' + (open ? ' open' : '') + '">'
      html += '<div class="wiki-tree-toggle">' + (page.title || page.name.replace('.html', '')) + '</div>'
      html += '<div class="wiki-tree-children">'
      children.forEach(function (child) { html += renderNode(child) })
      html += '</div></div>'
      return html
    }

    treeEl.addEventListener('click', function (e) {
      var toggle = e.target.closest('.wiki-tree-toggle')
      if (!toggle) return
      toggle.parentElement.classList.toggle('open')
    })

    var roots = pages.filter(function (p) { return !p.parent })
    if (roots.length === 0 && pages.length > 0) {
      treeEl.innerHTML = pages.map(function (p) {
        var isActive = curPage === p.name
        return '<a href="' + p.name + '"' +
          (isActive ? ' class="active"' : '') +
          '>' + (p.title || p.name.replace('.html', '')) + '</a>'
      }).join('')
    } else {
      treeEl.innerHTML = roots.map(function (r) { return renderNode(r) }).join('')
    }
  }

  // Breadcrumb
  function renderBreadcrumb() {
    var pages = meta.pages || []
    var bc = document.getElementById('wiki-breadcrumb')
    if (!bc || pages.length === 0) return

    function findPage(name) { return pages.find(function (p) { return p.name === name }) }

    var crumbs = []
    var current = findPage(curPage)
    while (current) {
      crumbs.unshift(current)
      current = current.parent ? findPage(current.parent) : null
    }

    bc.innerHTML = crumbs.map(function (p, i) {
      var title = p.title || p.name.replace('.html', '')
      if (i === crumbs.length - 1) return '<span class="bc-current">' + title + '</span>'
      return '<a href="' + p.name + '">' + title + '</a>'
    }).join(' <span class="bc-sep">&rsaquo;</span> ')
  }

  // Prev/Next
  function renderPrevNext() {
    var pages = meta.pages || []
    var nav = document.getElementById('wiki-prevnext')
    if (!nav || pages.length === 0) return

    var current = pages.find(function (p) { return p.name === curPage })
    if (!current) return
    var siblings = findChildren(current.parent || null)
    var idx = -1
    for (var i = 0; i < siblings.length; i++) {
      if (siblings[i].name === curPage) { idx = i; break }
    }
    if (idx < 0) return

    var html = ''
    if (idx > 0) {
      var prev = siblings[idx - 1]
      html += '<a class="pn-link pn-prev" href="' + prev.name + '">&larr; ' + (prev.title || prev.name.replace('.html', '')) + '</a>'
    } else {
      html += '<span class="pn-link pn-empty"></span>'
    }
    if (idx < siblings.length - 1) {
      var next = siblings[idx + 1]
      html += '<a class="pn-link pn-next" href="' + next.name + '">' + (next.title || next.name.replace('.html', '')) + ' &rarr;</a>'
    } else {
      html += '<span class="pn-link pn-empty"></span>'
    }
    nav.innerHTML = html
  }

  // Search
  if (searchInput) {
    var searchTimeout
    searchInput.addEventListener('input', function () {
      clearTimeout(searchTimeout)
      searchTimeout = setTimeout(doSearch, 300)
    })
  }

  function doSearch() {
    var q = searchInput.value.trim().toLowerCase()
    if (!q) { renderTree(); return }

    var pages = meta.pages || []
    var results = pages.filter(function (p) {
      return (p.title || p.name).toLowerCase().includes(q)
    })
    treeEl.innerHTML = results.map(function (p) {
      return '<a href="' + p.name + '">' + (p.title || p.name.replace('.html', '')) + '</a>'
    }).join('') || '<div class="wiki-no-results">Sin resultados</div>'
  }

  // Mermaid
  function initMermaid() {
    // Convert <pre><code class="language-mermaid"> to <div class="mermaid">
    var codes = document.querySelectorAll('pre > code.language-mermaid')
    if (codes.length > 0) {
      codes.forEach(function (code) {
        var pre = code.parentElement
        var div = document.createElement('div')
        div.className = 'mermaid'
        div.textContent = code.textContent
        pre.replaceWith(div)
      })
    }

    if (typeof mermaid === 'undefined') return
    try {
      mermaid.initialize({ startOnLoad: false, theme: 'default' })
      var els = document.querySelectorAll('.mermaid')
      if (els.length) mermaid.run({ nodes: els }).catch(function () {})
    } catch (e) {}
  }

  // TOC
  function initTOC() {
    document.querySelectorAll('nav.toc').forEach(function (nav) {
      if (nav.children.length > 1) return
      var headings = document.querySelectorAll('.wiki-content h2, .wiki-content h3, .wiki-content h4')
      if (headings.length === 0) return

      var list = document.createElement('div')
      headings.forEach(function (h) {
        var id = h.id || h.textContent.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
        h.id = id
        var a = document.createElement('a')
        a.href = '#' + id
        a.textContent = h.textContent
        a.className = 'toc-' + h.tagName.toLowerCase()
        list.appendChild(a)
      })
      nav.appendChild(list)
    })
  }

  // Mobile sidebar
  function initMobileSidebar() {
    var overlay = document.createElement('div')
    overlay.className = 'wiki-sidebar-overlay'
    document.body.appendChild(overlay)

    function close() {
      sidebar.classList.remove('open')
      overlay.classList.remove('open')
    }

    overlay.addEventListener('click', close)
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') close()
    })

    var toggle = document.querySelector('.wiki-sidebar-toggle')
    if (toggle) {
      toggle.addEventListener('click', function () {
        var isOpen = sidebar.classList.toggle('open')
        overlay.classList.toggle('open', isOpen)
      })
    }
  }

  // Index page
  function renderIndex() {
    var el = document.getElementById('wiki-index')
    if (!el) return
    var pages = (meta.pages || []).filter(function (p) { return p.name !== 'index.html' })
    if (pages.length === 0) {
      el.innerHTML = '<p class="wiki-index-desc">No hay p&aacute;ginas en la documentaci&oacute;n</p>'
      return
    }
    pages.sort(function (a, b) { return (a.title || a.name).localeCompare(b.title || b.name) })
    var html = '<p class="wiki-index-desc">' + pages.length + ' p&aacute;ginas en la documentaci&oacute;n</p><ul class="index-list" style="padding-left:16px">'
    pages.forEach(function (p) {
      html += '<li class="index-item"><a href="' + p.name + '" class="index-link">' + (p.title || p.name.replace('.html', '')) + '</a></li>'
    })
    html += '</ul>'
    el.innerHTML = html
  }

  // Init
  initMobileSidebar()

  fetch('_meta.json')
    .then(function (r) { return r.json() })
    .then(function (data) { meta = data })
    .catch(function () { meta = { pages: [] } })
    .finally(function () {
      renderTree()
      renderBreadcrumb()
      renderPrevNext()
      renderIndex()
      initTOC()
      initMermaid()
    })
})()
