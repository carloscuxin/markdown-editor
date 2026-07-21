# Spec: Adaptación Enterprise de agile-docs-demo

**Fecha:** 2026-07-21
**Objetivo:** Tomar el demo `agile-docs-demo` y adaptarlo como documentación real para una empresa a escala grande, con docs mixtas (agile + técnico + usuario), en GitHub Pages.

---

## 1. Arquitectura y Estructura

### 1.1 Estructura de carpetas

```
docs/
├── agile/
│   ├── epics/
│   ├── stories/
│   ├── brds/
│   ├── release-notes/
│   ├── reports/
│   ├── meeting-notes/
│   └── index.md
├── technical/
│   ├── api/
│   ├── architecture/
│   ├── adrs/
│   ├── runbooks/
│   └── index.md
├── user-guides/
│   ├── getting-started/
│   ├── features/
│   ├── faq/
│   └── index.md
├── templates/
│   ├── epic-template.md
│   ├── user-story-template.md
│   ├── brd-template.md
│   ├── release-note-template.md
│   ├── adr-template.md          # Architecture Decision Record
│   └── meeting-notes-template.md
├── stylesheets/
│   └── extra.css
├── assets/
│   ├── logo.svg
│   └── favicon.ico
└── index.md
```

### 1.2 Nav modular

Opción A (recomendada): Un solo `mkdocs.yml` con el nav completo, organizado por comentarios:

```yaml
# mkdocs.yml
nav:
  - Home: index.md
  # --- Agile ---
  - Agile:
    - Overview: agile/index.md
    - Epics:
      - agile/epics/index.md
      - "EPIC-001": agile/epics/epic-001.md
    - Stories:
      - agile/stories/index.md
      # ... más stories
  # --- Technical ---
  - Technical:
    - Overview: technical/index.md
    - API: technical/api/index.md
    - Architecture: technical/architecture/index.md
    # ... más secciones
  # --- User Guides ---
  - User Guides:
    - Overview: user-guides/index.md
    # ... más guías
```

Opción B (avanzada): Usar `mkdocs-macros` con un script `main.py` que inyecte navs parciales desde archivos separados. Más complejo pero permite que cada equipo mantenga su propio `nav.yml`.

**Decisión:** Empezar con Opción A. Migrar a B solo si el nav crece por encima de 200 entradas.

### 1.3 Plugins nuevos

| Plugin | Versión | Propósito |
|--------|---------|-----------|
| `mkdocs-macros` | 1.3+ | Variables, includes de nav, lógica Jinja2 |
| `mkdocs-git-revision-date-localized` | 1.3+ | "Última actualización" por página |
| `mkdocs-tags` | 0.6+ | Tags transversales (#api, #fraude, #sprint-42) |
| `mkdocs-redirects` | 1.3+ | Redirects al reorganizar URLs |

### 1.4 CODEOWNERS

```
/docs/agile/       @equipo-agile
/docs/technical/   @equipo-platform
/docs/user-guides/ @equipo-product
/docs/templates/   @equipo-agile @equipo-platform
```

---

## 2. Experiencia No-Técnicos

### 2.1 Script `scripts/new-doc.py`

CLI interactivo que:
1. Pregunta tipo de documento
2. Pide campos obligatorios (ID, título, epic padre)
3. Copia el template correspondiente
4. Rellena campos automáticamente
5. Sugiere la línea para `nav/*.yml`

### 2.2 GitHub Issue Forms

Templates en `.github/ISSUE_TEMPLATE/`:
- `new-story.yml` — Crear nueva user story
- `new-epic.yml` — Crear nuevo epic
- `new-brd.yml` — Crear nuevo BRD

GitHub Action `new-doc.yml` convierte el issue en PR con el `.md` generado.

### 2.3 Plantillas mejoradas

Campos adicionales en templates:
- "Preguntas abiertas" (para BAs)
- "Impacto en otros equipos"
- "Revisión legal/compliance" (para BRDs)
- "Notas de stakeholder"

### 2.4 Búsqueda multilenguaje

Agregar configuración de search al plugin existente (no reemplazar):

```yaml
plugins:
  - search:
      separator: '[\s\-\.]+'
      lang: es
```

---

## 3. Integración GitHub

### 3.1 Project Board

Campos custom en GitHub Projects:
- `Epic` (single select)
- `Sprint` (iteration)
- `Doc Status`: Draft → In Review → Published
- `Doc Link` (text): URL al `.md`

### 3.2 Workflows

| Workflow | Trigger | Acción |
|----------|---------|--------|
| `deploy-docs.yml` | push main | Build + deploy (existente, mejorado) |
| `doc-notify.yml` | PR a docs/ | Labels, menciones a CODEOWNERS |
| `new-doc.yml` | Issue con template | Genera PR desde template |
| `sync-status.yml` | Issue cerrado | Actualiza Status en el .md |
| `broken-links.yml` | cron semanal | MkDocs build --strict |

### 3.3 Release → Release Note

Cuando se crea un GitHub Release:
1. Toma el body del release
2. Genera `docs/agile/release-notes/vX.Y.Z.md`
3. Abre PR automático

---

## 4. Personalización Visual

### 4.1 Tema corporativo

```yaml
theme:
  name: material
  palette:
    - media: "(prefers-color-scheme: light)"
      scheme: default
      primary: custom
      accent: custom
    - media: "(prefers-color-scheme: dark)"
      scheme: slate
      primary: custom
      accent: custom
  logo: assets/logo.svg
  favicon: assets/favicon.ico
```

### 4.2 CSS extra

`docs/stylesheets/extra.css`:
- Variables CSS corporativas (`--md-primary-fg-color`, etc.)
- Colores de acento por dominio (agile=verde, technical=azul, user=amarillo)
- Estilo para cards del home

### 4.3 Home page

Landing page con:
- Grid cards por dominio (agile, technical, user-guides)
- Bloque de "Últimas actualizaciones" (macro `git-revision-date`)
- Búsqueda prominente

---

## 5. Dependencias

```requirements.txt
mkdocs-material==9.5.39
pymdown-extensions==10.11.2
mkdocs-macros==1.3.7
mkdocs-git-revision-date-localized==1.3.0
mkdocs-tags==0.6.0
mkdocs-redirects==1.3.0
```

---

## 6. Orden de Implementación

1. **Fase 1 — Estructura base** (prioridad alta)
   - Reorganizar carpetas
   - Modularizar nav
   - Agregar plugins
   - Actualizar mkdocs.yml

2. **Fase 2 — No-técnicos** (prioridad alta)
   - Script new-doc.py
   - Issue Forms
   - Templates mejorados

3. **Fase 3 — GitHub Integration** (prioridad media)
   - Workflows (notify, sync, broken-links)
   - Release → Release Note
   - Project Board config

4. **Fase 4 — Visual** (prioridad media)
   - Tema corporativo
   - CSS extra
   - Home page
