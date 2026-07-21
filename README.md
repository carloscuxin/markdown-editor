# Enterprise Documentation

Space de documentación empresarial con editor integrado.

## Estructura

```
docs/
├── admin/
│   ├── editor.html       → Editor de contenido (Toast UI)
│   └── login.html        → Autenticación con token de GitHub
├── js/
│   ├── auth.js           → Manejo de token (localStorage)
│   ├── api.js            → Cliente para GitHub Contents API
│   └── editor.js         → Lógica del editor
├── stylesheets/
│   ├── admin.css         → Estilos del editor
│   └── extra.css         → Estilos del sitio
├── agile/                → Documentación ágil
├── technical/            → Documentación técnica
├── user-guides/          → Guías de usuario
└── doc-templates/        → Plantillas de documentos
```

## Uso

1. Clona el repo y activa GitHub Pages desde `main`.
2. Abre `https://<tu-user>.github.io/markdown-editor/admin/editor.html`.
3. Ingresa tu token de GitHub (clásico, permiso `repo`).
4. Selecciona dominio, escribe contenido y guarda.

## Editor

- WYSIWYG + Markdown (Toast UI Editor)
- Plantillas: Epic, User Story, BRD, Release Note, ADR, Meeting Notes
- Guardado directo en `docs/` vía GitHub API
- Borradores locales (localStorage)
- Preview integrado

## Tecnologías

- MkDocs + Material Theme
- Toast UI Editor
- GitHub Contents API

---

**Desarrollado por:** Carlos Cuxin
