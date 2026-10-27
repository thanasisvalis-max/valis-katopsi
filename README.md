# Σχεδιαστής Κάτοψης Valis Frames

Εσωτερικό εργαλείο της VALIS Communication για σχεδίαση κατόψεων εκθεσιακών περιπτέρων με το σύστημα Valis Frames.
Αρχιτεκτονική, κανόνες και ιστορικό αποφάσεων: **[CLAUDE.md](CLAUDE.md)**.

## Τοπικά

Δεν χρειάζεται εγκατάσταση. Από τον φάκελο του project:

```bash
python3 -m http.server 8080
# άνοιξε http://localhost:8080
```

(Λειτουργεί και με διπλό κλικ στο `index.html`.)

## Ανέβασμα σε Cloudflare Pages

1. **GitHub:** δημιούργησε **private** repo `valis-katopsi` και ανέβασε αυτόν τον φάκελο:
   ```bash
   git remote add origin https://github.com/<user>/valis-katopsi.git
   git push -u origin main
   ```
2. **Cloudflare** → Workers & Pages → Create → Pages → *Connect to Git* → επίλεξε `valis-katopsi`.
   - Framework preset: **None**
   - Build command: *(κενό)*
   - Build output directory: `/`
3. **Custom domain:** Pages project → Custom domains → `katopsi.valisframes.gr` (ή όποιο subdomain θέλεις).
4. **Πρόσβαση μόνο για την ομάδα:** Cloudflare Zero Trust → Access → Applications → Add → Self-hosted
   → domain `katopsi.valisframes.gr` → Policy: *Allow* → *Emails* → τα emails της ομάδας.

Από εκεί και πέρα κάθε `git push` ανεβαίνει live σε περίπου 1 λεπτό.

## Ενημέρωση συμβόλων από Corel

```bash
pip install pymupdf
python3 tools/extract_symbols.py docs/reference/DOOR.pdf docs/reference/CONNECTION_FOR_PROFILES.pdf > js/symbols.js
```
