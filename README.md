# Σχεδιαστής Κάτοψης Valis Frames

Εσωτερικό εργαλείο της VALIS Communication για σχεδίαση κατόψεων εκθεσιακών περιπτέρων με το σύστημα Valis Frames.
Αρχιτεκτονική, κανόνες και ιστορικό αποφάσεων: **[CLAUDE.md](CLAUDE.md)**.
**Εγκατάσταση online (για τον προγραμματιστή): [docs/DEPLOY.md](docs/DEPLOY.md)**.

## Τοπικά

Δεν χρειάζεται εγκατάσταση. Από τον φάκελο του project:

```bash
python3 -m http.server 8080 -d public
# άνοιξε http://localhost:8080
```

(Με διπλό κλικ στο `public/index.html` δουλεύει η κάτοψη, αλλά όχι το 3D: τα ES modules θέλουν server.)

## Ανέβασμα σε Cloudflare

Το repo είναι συνδεδεμένο με Cloudflare Workers (static assets). Ρύθμιση στο `wrangler.jsonc`:
δημοσιεύεται **μόνο** ο φάκελος `public/`.

- Build command: *(κενό)*
- Deploy command: `npx wrangler deploy`
- Κάθε `git push` στο `main` ανεβαίνει live σε περίπου 1 λεπτό.

**Πρόσβαση μόνο για την ομάδα:** Cloudflare Zero Trust → Access → Applications → Add → Self-hosted
→ το domain του εργαλείου → Policy: *Allow* → *Emails* → τα emails της ομάδας.

## Ενημέρωση συμβόλων από Corel

```bash
pip install pymupdf
python3 tools/extract_symbols.py docs/reference/DOOR.pdf docs/reference/CONNECTION_FOR_PROFILES.pdf > public/js/symbols.js
```
