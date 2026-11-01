#!/usr/bin/env python3
"""Baut standalone.html: alle Module, CSS und CSV in EINER Datei, die per Doppelklick (file://) läuft.
Nur zum schnellen Ausprobieren – Installation als App und Offline-Modus brauchen weiterhin einen Webserver.
Aufruf im Projektordner:  python3 tools/build_standalone.py
"""
import json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
JS = os.path.join(ROOT, 'js')
IMPORT_RE = re.compile(r"^import\s+(.+?)\s+from\s+'([^']+)';?[ \t]*$", re.M | re.S)

def read(path):
    with open(path, encoding='utf-8') as f:
        return f.read()

def module_id(path):
    return os.path.relpath(path, JS).replace(os.sep, '/')

def transform(mid, src):
    base = os.path.dirname(mid)
    deps, exports = [], []

    def repl_import(m):
        clause, spec = m.group(1).strip(), m.group(2)
        dep = os.path.normpath(os.path.join(base, spec)).replace(os.sep, '/')
        deps.append(dep)
        ref = f'__m["{dep}"]'
        if clause.startswith('* as '):
            return f'const {clause[5:].strip()} = {ref};'
        if clause.startswith('{'):
            inner = re.sub(r'\s+as\s+', ': ', clause.strip('{} \n'))
            return f'const {{ {inner} }} = {ref};'
        return f'const {clause} = {ref}.default;'

    src = IMPORT_RE.sub(repl_import, src)
    src = src.replace('export default', '__exports.default =')

    def repl_export(m):
        exports.append(m.group(2))
        return m.group(1) + m.group(2)
    src = re.sub(r'^export\s+((?:async\s+)?function\s+|const\s+|class\s+)(\w+)', repl_export, src, flags=re.M)
    assert not re.search(r'^\s*(import|export)\s', src, re.M), f'Nicht umgewandelter import/export in {mid}'
    return deps, exports, src

def collect(mid, seen, order, mods):
    if mid in seen:
        return
    seen.add(mid)
    deps, exports, src = transform(mid, read(os.path.join(JS, mid)))
    for d in deps:
        collect(d, seen, order, mods)
    mods[mid] = (exports, src)
    order.append(mid)

order, mods = [], {}
collect('main.js', set(), order, mods)

parts = ['const __m = {};']
for mid in order:
    exports, src = mods[mid]
    tail = ''.join(f'__exports.{n} = {n};\n' for n in exports)
    if mid == 'main.js':  # Top-Level-await -> async-Funktion
        parts.append(f'(async () => {{\n{src}\n}})();')
    else:
        parts.append(f'__m["{mid}"] = (() => {{\nconst __exports = {{}};\n{src}\n{tail}return __exports;\n}})();')
bundle = '\n'.join(parts).replace('</script', '<\\/script')

css = read(os.path.join(ROOT, 'css', 'app.css'))
def embed(name):
    path = os.path.join(ROOT, 'data', name)
    return json.dumps(read(path)).replace('</', '<\\/') if os.path.exists(path) else 'null'
EMBED = {'__EMBEDDED_PLAN__': 'plan.csv', '__EMBEDDED_IST__': 'ist.csv', '__EMBEDDED_BASIS__': 'basisdaten.csv',
         '__EMBEDDED_WK__': 'wk-kalender.csv', '__EMBEDDED_HIST__': 'vorjahre.csv'}
embedded_js = '\n'.join(f'globalThis.{k} = {embed(v)};' for k, v in EMBED.items())

html = read(os.path.join(ROOT, 'index.html'))
html = re.sub(r'\s*<link rel="(?:manifest|icon|apple-touch-icon)"[^>]*>', '', html)
html = re.sub(r'\s*<link rel="stylesheet"[^>]*>', f'\n  <style>\n{css}\n  </style>', html)
html = re.sub(r'\s*<script>.*?</script>', '', html, flags=re.S)  # file://-Hinweis nicht nötig
html = html.replace('<script type="module" src="js/main.js"></script>',
                    f'<script>\n{embedded_js}\n</script>\n  <script>\n{bundle}\n  </script>')
with open(os.path.join(ROOT, 'standalone.html'), 'w', encoding='utf-8') as f:
    f.write(html)
print('standalone.html:', len(html) // 1024, 'KB,', len(order), 'Module')
