#!/usr/bin/env python3
"""Ξαναβγάζει το js/symbols.js από τα PDF του CorelDRAW (κλίμακα 1:10, 1 mm = 1 cm).

Χρήση:
    python3 tools/extract_symbols.py DOOR.pdf CONNECTION_FOR_PROFILES.pdf > js/symbols.js

Το πρώτο PDF γίνεται το σύμβολο 'door', το δεύτερο το 'conn'.
Στο DOOR.pdf το πρώτο path είναι το περίγραμμα της σελίδας και παραλείπεται.
"""
import json
import sys

import pymupdf

MM = 25.4 / 72  # PDF points -> mm (= cm πραγματικά, στο 1:10)


def hexc(c):
    return None if c is None else '#%02X%02X%02X' % tuple(round(v * 255) for v in c)


def symbol(path, skip_page_border):
    page = pymupdf.open(path)[0]
    out = []
    for i, g in enumerate(page.get_drawings()):
        if skip_page_border and i == 0 and g.get('fill') is None:
            continue
        d, pdf, cur = [], [], None

        def P(pt):
            return (round(pt.x * MM, 3), round(pt.y * MM, 3))

        for it in g['items']:
            kind = it[0]
            if kind == 're':
                r = it[1]
                x, y, w, h = r.x0 * MM, r.y0 * MM, r.width * MM, r.height * MM
                d.append(f"M{x:.3f} {y:.3f}h{w:.3f}v{h:.3f}h{-w:.3f}Z")
                pdf.append(f"{x:.3f} {y:.3f} {w:.3f} {h:.3f} re")
                cur = None
                continue
            if kind == 'qu':
                q = it[1]
                pts = [P(q.ul), P(q.ur), P(q.lr), P(q.ll)]
                d.append("M%s %sL%s %sL%s %sL%s %sZ" % (*pts[0], *pts[1], *pts[2], *pts[3]))
                pdf.append("%s %s m %s %s l %s %s l %s %s l h" % (*pts[0], *pts[1], *pts[2], *pts[3]))
                cur = None
                continue
            a = P(it[1])
            if cur != a:
                d.append(f"M{a[0]} {a[1]}")
                pdf.append(f"{a[0]} {a[1]} m")
            if kind == 'l':
                b = P(it[2])
                d.append(f"L{b[0]} {b[1]}")
                pdf.append(f"{b[0]} {b[1]} l")
                cur = b
            elif kind == 'c':
                c1, c2, b = P(it[2]), P(it[3]), P(it[4])
                d.append(f"C{c1[0]} {c1[1]} {c2[0]} {c2[1]} {b[0]} {b[1]}")
                pdf.append(f"{c1[0]} {c1[1]} {c2[0]} {c2[1]} {b[0]} {b[1]} c")
                cur = b
        if g.get('closePath'):
            d.append('Z')
            pdf.append('h')
        out.append({'d': ''.join(d), 'p': ' '.join(pdf), 'f': hexc(g.get('fill')),
                    's': hexc(g.get('color')), 'w': round((g.get('width') or 0) * MM, 3),
                    'eo': bool(g.get('even_odd'))})
    return out


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    data = {'door': symbol(sys.argv[1], True), 'conn': symbol(sys.argv[2], False)}
    print("// Σύμβολα πόρτας και συνδέσμου, εξαγμένα 1:1 από τα αρχεία Corel (DOOR.pdf, CONNECTION FOR PROFILES.pdf).")
    print("// Μονάδες: cm. d = SVG path, p = PDF path. ΜΗΝ τα επεξεργάζεσαι με το χέρι. Για αλλαγή σχήματος ξαναεξάγεις από το PDF (δες CLAUDE.md).")
    print("const SYM=" + json.dumps(data, separators=(',', ':'), ensure_ascii=False) + ";")
