(function () {
  'use strict'

  var curPage = (window.location.pathname.split('/').pop() || '').replace('.html', '')
  var sidebar = document.getElementById('wiki-sidebar')
  var treeEl = document.getElementById('wiki-tree')
  var searchInput = document.getElementById('wiki-search')

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
  function renderTree(meta) {
    if (!treeEl) return
    var pages = meta.pages || []

    function findChildren(parentName) {
      return pages.filter(function (p) { return p.parent === parentName }).sort(function (a, b) {
        return (a.order || 0) - (b.order || 0)
      })
    }

    function renderNode(page) {
      var children = findChildren(page.name)
      var isActive = curPage === page.name.replace('.html', '')
      if (children.length === 0) {
        return '<a href="' + page.name + '"' +
          (isActive ? ' class="active"' : '') +
          '>' + (page.title || page.name.replace('.html', '')) + '</a>'
      }

      var open = true
      var html = '<div class="wiki-tree-folder' + (open ? ' open' : '') + '">'
      html += '<div class="wiki-tree-toggle">' + (page.title || page.name.replace('.html', '')) + '</div>'
      html += '<div class="wiki-tree-children">'
      children.forEach(function (child) {
        html += renderNode(child)
      })
      html += '</div></div>'
      return html
    }

    // Toggle folders
    treeEl.addEventListener('click', function (e) {
      var toggle = e.target.closest('.wiki-tree-toggle')
      if (!toggle) return
      toggle.parentElement.classList.toggle('open')
    })

    // Build tree
    var roots = pages.filter(function (p) { return !p.parent })
    if (roots.length === 0 && pages.length > 0) {
      // No hierarchy defined, show flat list
      treeEl.innerHTML = pages.map(function (p) {
        var isActive = curPage === p.name.replace('.html', '')
        return '<a href="' + p.name + '"' +
          (isActive ? ' class="active"' : '') +
          '>' + (p.title || p.name.replace('.html', '')) + '</a>'
      }).join('')
    } else {
      treeEl.innerHTML = roots.map(function (r) { return renderNode(r) }).join('')
    }
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
    if (!q) {
      // Restore tree
      renderTree(window._wikiMeta || { pages: [] })
      return
    }

    fetch('../wiki/_meta.json')
      .then(function (r) { return r.json() })
      .then(function (meta) {
        var pages = meta.pages || []
        var results = pages.filter(function (p) {
          var title = (p.title || p.name).toLowerCase()
          return title.includes(q)
        })
        treeEl.innerHTML = results.map(function (p) {
          return '<a href="' + p.name + '">' + (p.title || p.name.replace('.html', '')) + '</a>'
        }).join('')
        if (results.length === 0) {
          treeEl.innerHTML = '<div class="wiki-no-results">Sin resultados</div>'
        }
      })
      .catch(function () {
        treeEl.innerHTML = '<div class="wiki-no-results">Búsqueda no disponible</div>'
      })
  }

  // Mermaid
  if (typeof mermaid !== 'undefined') {
    mermaid.initialize({ startOnLoad: true, theme: 'default' })
  }

  // Sidebar toggle for mobile
  var toggleBtn = document.querySelector('.wiki-sidebar-toggle')
  if (toggleBtn) {
    toggleBtn.addEventListener('click', function () {
      sidebar.classList.toggle('open')
    })
  }

  // Load meta and render tree
  fetch('_meta.json')
    .then(function (r) { return r.json() })
    .then(function (meta) {
      window._wikiMeta = meta
      renderTree(meta)
    })
    .catch(function () {
      if (treeEl) treeEl.innerHTML = ''
    })
})()
