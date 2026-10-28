#!/usr/bin/env python3
"""Φτιάχνει τη σελίδα του artifact στο Claude.ai από το public/index.html.

Το artifact του Claude τυλίγει μόνο του τη σελίδα σε <html><head><body>, οπότε κρατάμε μόνο
<title>, stylesheet, import map, markup και scripts. Τα υπόλοιπα αρχεία (css, js, fonts, vendor)
δημοσιεύονται δίπλα στη σελίδα με την ίδια διαδρομή. Έτσι η έκδοση Claude και η αυτόνομη
τρέχουν ΑΚΡΙΒΩΣ τον ίδιο κώδικα.

Χρήση:
    python3 tools/build_artifact.py [έξοδος.html]      (default: build/artifact.html)
Τυπώνει και τη λίστα αρχείων που πρέπει να ανέβουν μαζί (σχετικά με το public/).
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PUB = os.path.join(ROOT, 'public')

html = open(os.path.join(PUB, 'index.html'), encoding='utf-8').read()
title = re.search(r'<title>.*?</title>', html, re.S).group(0)
css = '<link rel="stylesheet" href="css/app.css">'
imap = re.search(r'<script type="importmap">.*?</script>', html, re.S).group(0)
body = re.search(r'<body>(.*)</body>', html, re.S).group(1).strip()

page = f"{title}\n{css}\n{imap}\n{body}\n"
out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'build', 'artifact.html')
os.makedirs(os.path.dirname(out), exist_ok=True)
open(out, 'w', encoding='utf-8').write(page)

files = []
for d, _, fs in os.walk(PUB):
    for f in fs:
        rel = os.path.relpath(os.path.join(d, f), PUB)
        if rel != 'index.html' and not f.endswith('.txt'):
            files.append(rel)
print(out)
print('\n'.join(sorted(files)))
