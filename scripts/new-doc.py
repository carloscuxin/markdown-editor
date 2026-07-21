#!/usr/bin/env python3
"""Interactive scaffolder for enterprise docs. Stdlib only."""
import glob
import os
import re
import sys

TEMPLATES = {
    "1": ("Epic", "docs/doc-templates/epic-template.md", "docs/agile/epics"),
    "2": ("User Story", "docs/doc-templates/user-story-template.md", "docs/agile/stories"),
    "3": ("BRD", "docs/doc-templates/brd-template.md", "docs/agile/brds"),
    "4": ("Release Note", "docs/doc-templates/release-note-template.md", "docs/agile/release-notes"),
    "5": ("ADR", "docs/doc-templates/adr-template.md", "docs/technical/adrs"),
    "6": ("Meeting Notes", "docs/doc-templates/meeting-notes-template.md", "docs/agile/meeting-notes"),
}

# ponytail: lambdas over classes — label style varies per nav section
NAV_LABEL = {
    "Epic": lambda i, t: f"{i} \u00b7 {t}",
    "User Story": lambda i, t: f"{i} \u00b7 {t}",
    "BRD": lambda i, t: f"BRD \u00b7 {t}",
    "Release Note": lambda i, t: i,
    "ADR": lambda i, t: f"{i} \u00b7 {t}",
    "Meeting Notes": lambda i, t: t,
}


def slugify(title):
    s = title.lower().strip()
    s = re.sub(r"[^a-z0-9\s-]", "", s)
    s = re.sub(r"[\s_-]+", "-", s)
    return s[:50].strip("-")


def epic_link(epic_id, root):
    pat = f"{epic_id.lower().replace(' ', '-')}-*.md"
    hits = glob.glob(os.path.join(root, "docs", "agile", "epics", pat))
    return "../epics/" + os.path.basename(hits[0]) if hits else "../epics/"


def fill(text, doc_type, doc_id, title, parent_epic, root):
    if doc_type == "Epic":
        text = text.replace("EPIC-00X", doc_id).replace("<Epic title>", title)
    elif doc_type == "User Story":
        text = text.replace("HEL-###", doc_id).replace("<Story title>", title)
        if parent_epic:
            link = epic_link(parent_epic, root)
            text = text.replace("<link to epic>", f"[{parent_epic}]({link})")
    elif doc_type == "BRD":
        text = text.replace("BRD-YYYY-###", doc_id).replace("<Title>", title)
    elif doc_type == "Release Note":
        text = text.replace("v<x.y.z>", doc_id)
    elif doc_type == "ADR":
        text = text.replace("ADR-00X", doc_id).replace("<Decision title>", title)
    elif doc_type == "Meeting Notes":
        date = doc_id.split("-", 1)[1] if doc_id.startswith("MTG-") else doc_id
        text = (text.replace("MTG-YYYY-MM-DD", doc_id)
                    .replace("<Meeting name>", title)
                    .replace("<date>", date))
    return text


def main():
    root = os.getcwd()
    print("What kind of document do you want to create?")
    for k, (name, _, _) in TEMPLATES.items():
        print(f"  {k}. {name}")
    choice = input("Choice [1-6]: ").strip()
    if choice not in TEMPLATES:
        sys.exit("Invalid choice.")
    doc_type, tpl_path, target_dir = TEMPLATES[choice]
    if not os.path.isfile(tpl_path):
        sys.exit(f"Template not found: {tpl_path}")

    doc_id = input("ID (e.g. HEL-200): ").strip()
    if not doc_id:
        sys.exit("ID is required.")
    title = input("Title (optional for release note): ").strip()

    parent_epic = ""
    if doc_type == "User Story":
        parent_epic = input("Parent epic (e.g. EPIC-001, blank to skip): ").strip()

    slug = slugify(title)
    name = doc_id.lower().replace(" ", "-")
    if slug:
        name = f"{name}-{slug}"
    filename = name + ".md"

    with open(tpl_path, encoding="utf-8") as fh:
        text = fh.read()
    text = fill(text, doc_type, doc_id, title, parent_epic, root)

    os.makedirs(target_dir, exist_ok=True)
    out_path = os.path.join(target_dir, filename)
    if os.path.exists(out_path):
        sys.exit(f"File already exists: {out_path}")
    with open(out_path, "w", encoding="utf-8") as fh:
        fh.write(text)

    rel = out_path[len("docs/"):] if out_path.startswith("docs/") else out_path
    label = NAV_LABEL[doc_type](doc_id, title)
    print(f"\nCreated: {out_path}")
    print("\nAdd this line to mkdocs.yml nav (under the matching section):")
    print(f'      - "{label}": {rel}')
    print("\nThen commit:")
    print(f'  git add {out_path} mkdocs.yml && git commit -m "docs: add {doc_type.lower()} {doc_id}"')


if __name__ == "__main__":
    main()