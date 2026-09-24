#!/usr/bin/env python3
"""Quote plain YAML scalars on why:/prompt:/message:/hint lines that contain ': ' or start with a backtick.

Authoring helper: prose often contains colons, which YAML would read as nested mappings.
Usage: python3 scripts/yaml-quote-fix.py content/**/*.yaml
"""
import re
import sys

KEY_RE = re.compile(r'^(\s*(?:- )?(?:why|prompt|message|title|summary): )(.+)$')
ITEM_RE = re.compile(r'^(\s*- )(.+)$')


def needs_quote(v: str) -> bool:
    v = v.rstrip()
    if not v or v[0] in "\"'|>":
        return False
    return ": " in v or v.startswith("`") or v.startswith("@") or " #" in v or v.startswith("*") or v.startswith("&") or v.startswith("!") or v.startswith("%") or v.startswith("{") or v.startswith("[")


def quote(v: str) -> str:
    return '"' + v.rstrip().replace("\\", "\\\\").replace('"', '\\"') + '"'


for path in sys.argv[1:]:
    lines = open(path).read().split("\n")
    out = []
    in_hints = False
    hints_indent = -1
    changed = 0
    for line in lines:
        stripped = line.lstrip()
        indent = len(line) - len(stripped)
        if re.match(r'^\s*hints:\s*$', line):
            in_hints, hints_indent = True, indent
            out.append(line)
            continue
        if in_hints and stripped and indent <= hints_indent:
            in_hints = False
        m = KEY_RE.match(line)
        if m and needs_quote(m.group(2)):
            line = m.group(1) + quote(m.group(2))
            changed += 1
        elif in_hints:
            m2 = ITEM_RE.match(line)
            if m2 and needs_quote(m2.group(2)):
                line = m2.group(1) + quote(m2.group(2))
                changed += 1
        out.append(line)
    if changed:
        open(path, "w").write("\n".join(out))
        print(f"{path}: quoted {changed} line(s)")
