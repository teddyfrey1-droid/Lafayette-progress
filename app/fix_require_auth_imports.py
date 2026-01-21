import os
import re

ROOT = '/mnt/data/pulse_v0'

REQ_LINE = 'import { RequireAuth } from "@/components/auth/require-auth"\n'

def fix_file(path: str) -> bool:
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()

    if 'RequireAuth' not in text:
        return False

    changed = False

    # Remove accidental insertion inside a multiline import block
    # Case: a line 'import {' followed immediately by RequireAuth import.
    text2 = re.sub(r'(^import \{\s*\n)'+re.escape(REQ_LINE), r'\1', text, flags=re.MULTILINE)
    if text2 != text:
        text = text2
        changed = True

    # Ensure exactly one RequireAuth import exists
    occurrences = text.count(REQ_LINE)
    if occurrences == 0:
        # Insert after the first lucide-react import, preferably after its closing line.
        lines = text.splitlines(True)
        insert_at = None

        # Prefer insertion after a completed lucide-react import line
        for i, line in enumerate(lines):
            if 'from "lucide-react"' in line or "from 'lucide-react'" in line:
                insert_at = i + 1
                break

        if insert_at is None:
            # Fallback: after the last import statement (including multiline imports)
            # Find the last line that starts with import, then move forward until we hit a blank line.
            last_import_start = None
            for i, line in enumerate(lines):
                if line.lstrip().startswith('import'):
                    last_import_start = i
            if last_import_start is not None:
                insert_at = last_import_start + 1
            else:
                insert_at = 0

        lines.insert(insert_at, REQ_LINE)
        # Add a blank line after if needed
        if insert_at + 1 < len(lines) and lines[insert_at + 1].strip() != '':
            lines.insert(insert_at + 1, '\n')
        text = ''.join(lines)
        changed = True
    elif occurrences > 1:
        # Keep the first, remove others
        parts = text.split(REQ_LINE)
        text = parts[0] + REQ_LINE + ''.join(parts[1:]).replace(REQ_LINE, '')
        changed = True

    if changed:
        with open(path, 'w', encoding='utf-8') as f:
            f.write(text)
    return changed


def main() -> int:
    changed = 0
    for dirpath, _, filenames in os.walk(os.path.join(ROOT, 'app')):
        for fn in filenames:
            if fn != 'page.tsx':
                continue
            path = os.path.join(dirpath, fn)
            if fix_file(path):
                changed += 1
    print(f'Fixed {changed} file(s)')
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
