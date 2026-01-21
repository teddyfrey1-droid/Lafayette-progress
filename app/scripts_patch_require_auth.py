import os
import re

ROOT = '/mnt/data/pulse_v0'

SKIP = {
    'app/page.tsx',
    'app/connexion/page.tsx',
    'app/inscription/page.tsx',
    'app/layout.tsx',
}

def should_skip(rel_path: str) -> bool:
    rel_path = rel_path.replace('\\', '/')
    return rel_path in SKIP

def insert_import(text: str) -> str:
    if 'from "@/components/auth/require-auth"' in text:
        return text

    lines = text.splitlines(True)
    # Find the import block (consecutive lines starting with 'import')
    idx = 0
    # Skip 'use client' pragma and following blank lines
    if idx < len(lines) and lines[idx].strip() in {'"use client"', "'use client'"}:
        idx += 1
        while idx < len(lines) and lines[idx].strip() == '':
            idx += 1

    import_end = idx
    while import_end < len(lines) and lines[import_end].lstrip().startswith('import'):
        import_end += 1
    # Insert after import block
    lines.insert(import_end, 'import { RequireAuth } from "@/components/auth/require-auth"\n')
    # Ensure a blank line after the inserted import if not already
    if import_end + 1 < len(lines) and lines[import_end + 1].strip() != '':
        lines.insert(import_end + 1, '\n')
    return ''.join(lines)

def wrap_return(text: str) -> str:
    if '<RequireAuth>' in text:
        return text

    # Find first 'return ('
    m = re.search(r'\breturn\s*\(\s*\n', text)
    if not m:
        return text
    start = m.end()

    # We will insert '<RequireAuth>' right after 'return (\n'
    insert_open = '    <RequireAuth>\n'

    # Find the closing '  )' corresponding to the return block.
    # Heuristic: the return block ends with a line containing only spaces + ')' before a line containing only spaces + '}'
    pattern = re.compile(r'\n(\s*)\)\s*\n\s*}\s*\n?\Z', re.MULTILINE)
    m_end = pattern.search(text)
    if not m_end:
        return text

    close_indent = m_end.group(1)
    close_pos = m_end.start()  # position of the '\n    )...'

    before = text[:start]
    middle = text[start:close_pos]
    after = text[close_pos:]

    # Determine indentation inside return
    # If the first non-empty char of middle starts with '<', we assume 4 spaces indent already.
    open_tag = insert_open
    close_tag = f"{close_indent}    </RequireAuth>"

    # Insert open tag
    before += open_tag

    # Ensure middle is indented correctly: it already is.
    # Insert close tag right before the closing ')'
    # Add a newline if needed.
    if not middle.endswith('\n'):
        middle += '\n'
    middle += close_tag + '\n'

    return before + middle + after


def main() -> int:
    changed = 0
    for dirpath, _, filenames in os.walk(os.path.join(ROOT, 'app')):
        for fn in filenames:
            if fn != 'page.tsx':
                continue
            path = os.path.join(dirpath, fn)
            rel = os.path.relpath(path, ROOT).replace('\\', '/')
            if should_skip(rel):
                continue

            with open(path, 'r', encoding='utf-8') as f:
                orig = f.read()

            updated = orig
            updated = insert_import(updated)
            updated = wrap_return(updated)

            if updated != orig:
                with open(path, 'w', encoding='utf-8') as f:
                    f.write(updated)
                changed += 1

    print(f"Patched {changed} page(s)")
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
