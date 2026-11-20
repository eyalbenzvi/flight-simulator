#!/usr/bin/env python3
"""Inline every src/*.js into one self-contained dist/index.html (the form that can be published as a single file)."""
import re, pathlib
root = pathlib.Path(__file__).resolve().parent.parent
html = (root / 'index.html').read_text(encoding='utf8')
parts = re.findall(r'<script src="(src/[^"]+)"></script>\n?', html)
code = "'use strict';\n" + '\n'.join((root / p).read_text(encoding='utf8').replace("'use strict';\n", '', 1) for p in parts)
first = html.index('<script src="src/'); last = html.rindex('<script src="src/'); end = html.index('</script>', last) + len('</script>')
out = html[:first] + '<script>\n' + code + '</script>' + html[end:]
(root / 'dist').mkdir(exist_ok=True); (root / 'dist' / 'index.html').write_text(out, encoding='utf8')
print('dist/index.html', len(out) // 1024, 'KB from', len(parts), 'source files')
