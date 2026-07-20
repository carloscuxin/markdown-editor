# Admin SPA para gestión de documentación via GitHub API

## Stack
- **Sin dependencias de build.** HTML, CSS, JS vanilla servidos estáticamente.
- **Editor WYSIWYG:** Quill.js v2 (CDN)
- **Markdown bridge:** Showdown (MD→HTML visual) + Turndown (HTML→MD commit)
- **API:** GitHub REST API v3, autenticación via PAT (Personal Access Token) en localStorage

## Estructura
```
admin/
├── login.html       → formulario de ingreso de PAT con instrucciones
├── dashboard.html   → lista de páginas wiki con acciones
├── editor.html      → editor Quill.js WYSIWYG
├── css/
│   └── style.css    → estilos compartidos
└── js/
    ├── auth.js      → manejo de PAT (guardar/recuperar/validar)
    ├── api.js       → wrapper GitHub API (CRUD contenido, commits)
    └── pages.js     → lógica de dashboard y editor
```

## Flujo de usuario
1. **login.html** → ingresa PAT → se valida contra `GET /user` → redirect a dashboard
2. **dashboard.html** → lista archivos de `wiki/` con título, fecha, acciones
3. **Nueva página / Editar** → **editor.html** con Quill.js cargado
4. **Guardar** → Turndown convierte HTML→MD → commit via API → redirect a dashboard + toast

## GitHub API endpoints usados
- `GET /user` → validar token
- `GET /repos/:owner/:repo/contents/wiki` → listar páginas
- `GET /repos/:owner/:repo/contents/wiki/:file` → leer contenido
- `PUT /repos/:owner/:repo/contents/wiki/:file` → crear/actualizar (commit)
- `DELETE /repos/:owner/:repo/contents/wiki/:file` → eliminar

## UX
- Sin recarga de página entre vistas (cambio de sección controlado por `window.location`)
- Toasts para feedback (guardado exitoso, error, eliminación)
- Estados skeleton/loading en dashboard
- Botón "Cerrar sesión" → limpia PAT de localStorage
