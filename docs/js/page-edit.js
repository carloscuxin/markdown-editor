(function () {
  document.addEventListener('click', function (e) {
    var btn = e.target.closest('a.md-content__button[title="Edit this page"]')
    if (!btn) return

    var m = btn.href.match(/\/edit\/main\/docs\/(.+)$/)
    if (!m) return

    e.preventDefault()
    var url = new URL('/admin/editor.html', window.location.origin)
    url.searchParams.set('file', m[1])
    window.location = url.href
  })
})()
