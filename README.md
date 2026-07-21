# Markdown Wiki Editor

Editor visual para gestionar documentación técnica directamente en un repositorio GitHub.

## Cómo funciona

El panel admin (`admin/`) se conecta a la API de GitHub con un token personal. Cada página se guarda como `.html` renderizado en `wiki/` y su correspondiente `.md` raw para visualización en GitHub. El contenido se edita con [Toast UI Editor](https://ui.toast.com/tui-editor) (WYSIWYG + Markdown).

## Estructura

```
admin/
├── index.html        → Redirige a dashboard o login
├── dashboard.html    → Panel con árbol de páginas y administración
├── editor.html       → Editor de contenido
├── login.html        → Autenticación con token de GitHub
├── js/
│   ├── auth.js       → Manejo de token (localStorage + validación con API)
│   ├── api.js        → Cliente para GitHub Contents API
│   └── pages.js      → Lógica del editor, renderizado y persistencia
├── css/
│   └── style.css
```

```
wiki/                 → Páginas publicadas (.html + .md)
assets/
├── css/wiki.css      → Estilos de la wiki pública
├── js/wiki.js        → Sidebar, árbol, búsqueda, TOC, Mermaid
└── uploads/          → Imágenes y archivos subidos
```

## Uso

1. Clona el repo y activa GitHub Pages desde `main`.
2. Abre `https://<tu-user>.github.io/markdown-editor/`.
3. Si hay token guardado → redirige a la wiki. Si no → al login.
4. Genera un [token clásico](https://github.com/settings/tokens) con permiso `repo`.
5. En el panel admin puedes crear, editar, reordenar y eliminar páginas.

## Funcionalidades

- Editor WYSIWYG con Toast UI
- Tablas, listas, blockquotes, código, imágenes
- Callouts (info/warning/danger/success)
- Pestañas (tabs)
- Diagramas Mermaid
- Tabla de contenido automática (TOC)
- Búsqueda en el sidebar
- Breadcrumb y navegación prev/next
- Árbol jerárquico drag & drop
- Preservación de markdown original en el HTML
- Archivos `.md` para visualización en GitHub
- Validación de sesión en cada página y en cada llamada API

## Tecnologías

- HTML5 / CSS3 / JavaScript vanilla
- [Toast UI Editor](https://ui.toast.com/tui-editor)
- [markdown-it](https://github.com/markdown-it/markdown-it)
- [Mermaid](https://mermaid.js.org/)
- GitHub Contents API

---

