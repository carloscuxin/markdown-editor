# Administrador de Wiki Scrum

Un editor visual ligero para gestionar documentación de proyectos Scrum usando [Decap CMS](https://decapcms.org/).

## Qué es esto

Este proyecto proporciona una interfaz web para crear y editar páginas de wiki en formato Markdown, almacenadas directamente en un repositorio de GitHub.

## Estructura

```
admin/
├── config.yaml   # Configuración de Decap CMS
└── index.html    # Punto de entrada del editor
```

## Uso

1. Clona el repositorio.
2. Abre `admin/index.html` en tu navegador.
3. Autentícate con GitHub.
4. Crea o edita páginas de la wiki.

## Configuración

- **Backend:** GitHub (`carloscuxin/markdown-editor`, rama `main`)
- **Media:** Archivos adjuntos se guardan en `assets/uploads/`
- **Contenido:** Páginas Markdown se guardan en la carpeta `wiki/`

## Requisitos previos

- Repositorio habilitado para GitHub Pages o alojamiento estático.
- OAuth App configurada en GitHub para autenticación con Decap CMS.

## Tecnologías

- [Decap CMS 3.x](https://decapcms.org/)
- HTML5
- YAML

---
