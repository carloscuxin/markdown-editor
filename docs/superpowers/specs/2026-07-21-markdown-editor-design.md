# Design Spec: Markdown Editor embebido en MkDocs

**Fecha:** 2026-07-21
**Estado:** Aprobado
**Contexto:** El sitio MkDocs actual es solo visualizador. Los usuarios deben ir a GitHub para crear/editar documentos. Se necesita un editor Markdown client-side integrado en el sitio.

## Problema

- MkDocs es estático: no permite editar desde el browser
- La única opción actual es ir a GitHub y editar `.md` manualmente
- El admin existente (`admin/`) apunta a `/wiki/`, genera `.html`, y está separado de MkDocs

## Solución

Editor Markdown client-side embebido como páginas dentro de `docs/admin/`, usando GitHub API para leer/escribir directamente a `docs/` en `main`.

## Arquitectura

```
docs/
  admin/
    index.html      → Redirect (check auth)
    login.html      → GitHub PAT login form
    editor.html     → Markdown editor page
  js/
    auth.js         → Token management (reuse from admin/)
    api.js          → GitHub API for docs/ (adapted)
    editor.js       → Editor logic (init, save, drafts)
```

### Flujo de datos

```
Browser → GitHub API (PAT auth) → docs/*.md files → main branch
                ↓
        MkDocs rebuild (GitHub Action) → Site updated
```

## Componentes

### 1. auth.js (reutilizado del admin existente)

- `getToken()` / `setToken()` / `clearToken()` — localStorage
- `validateToken()` — GET /user
- `login(token)` — set + validate
- `logout()` — clear + redirect
- **Sin cambios** — funciona tal cual

### 2. api.js (adaptado para docs/)

```javascript
const API = {
  _repoURL(path) → `/repos/{owner}/{repo}/contents${path}`,

  listDocs()           → GET /contents/docs (filter .md)
  getDoc(path)         → GET /contents/docs/{path} (decode base64)
  saveDoc(path, md, sha) → PUT /contents/docs/{path} (encode base64)
  deleteDoc(path, sha)   → DELETE /contents/docs/{path}
}
```

- Solo archivos `.md` en `docs/`
- Branch: `main` (direct commit, como solicitado)
- Commit messages: `docs: actualiza {filename}`
- SHA tracking para updates (optimistic locking)

### 3. editor.js (nuevo)

- Init EasyMDE con contenido Markdown
- Guardar → `API.saveDoc()` → GitHub API
- Draft persistence en localStorage
-Dirty tracking (beforeunload warning)
- Status indicators (saving/saved/error)

### 4. login.html

- Formulario PAT con instrucciones
- Mismo patrón que `admin/login.html` existente
- Redirect a `editor.html` on success

### 5. editor.html

- EasyMDE via CDN (~40KB)
- Toolbar: heading, bold, italic, strike, quote, code, codeblock, link, image, table, preview
- Title field (for new docs)
- Domain selector (agile/technical/user-guides)
- Save + cancel buttons
- Draft status indicator

## Editor: EasyMDE

Por qué EasyMDE:
- ~40KB vs Toast UI ~200KB
- Markdown-first (no WYSIWYG intermedio)
- Preview en tiempo real
- Toolbar customizable
- Syntax highlighting con CodeMirror

CDN: `https://cdn.jsdelivr.net/npm/easy-markdown-editor/dist/easymde.min.css` + `.js`

## Seguridad

- PAT en localStorage (mismo patrón que admin existente)
- Validación de paths: solo `.md`, sin `..`, sin `/` al inicio
- Commit messages con prefijo `docs:`
- No expone PAT en URLs o logs

## Lo que NO se incluye (YAGNI)

- **No PR workflow** — edit direct to main
- **No tree/drag-and-drop** — nav se maneja en `mkdocs.yml`
- **No image upload** — se puede agregar después
- **No multi-branch** — solo main
- **No WYSIWYG** — Markdown puro con preview
- **No authentication server-side** — todo client-side con PAT

## Archivos a crear/modificar

| Archivo | Acción |
|---------|--------|
| `docs/admin/index.html` | Crear |
| `docs/admin/login.html` | Crear |
| `docs/admin/editor.html` | Crear |
| `docs/js/auth.js` | Crear (copiar de `admin/js/auth.js`) |
| `docs/js/api.js` | Crear (adaptar de `admin/js/api.js`) |
| `docs/js/editor.js` | Crear |
| `docs/stylesheets/admin.css` | Crear (estilos del editor) |
| `mkdocs.yml` | Modificar (agregar nav a /admin/) |

## Estimación

~250-300 líneas de código nuevo (HTML + JS + CSS).
Reutiliza auth.js existente sin cambios.
