# Οδηγός εγκατάστασης για τον προγραμματιστή

> **Στόχος:** το εργαλείο «Σχεδιαστής Κάτοψης Valis» να τρέχει online στο
> **`https://boothdesigner.valiscreations.gr`**, **κλειδωμένο μόνο για την ομάδα VALIS**,
> και κάθε αλλαγή στο GitHub να ανεβαίνει αυτόματα.
>
> **Σημείο εκκίνησης:** υπάρχει μόνο το private repo `thanasisvalis-max/valis-katopsi` στο GitHub.
> Δεν έχει στηθεί τίποτα άλλο: ούτε hosting, ούτε DNS, ούτε κλείδωμα.
>
> **Χρόνος:** ~1–2 ώρες με τη Διαδρομή Α. Το DNS μπορεί να θέλει έως 24 ώρες για να διαδοθεί.

---

## 1. Σκεπτικό: τι είναι αυτό που ανεβάζουμε

### 1.1 Είναι ένα στατικό site, τίποτα παραπάνω

| Ερώτηση | Απάντηση |
|---|---|
| Έχει backend / βάση / API; | **Όχι.** Όλη η σχεδίαση, οι κανόνες, το PDF, το 3D και η εξαγωγή SketchUp τρέχουν **μέσα στον browser** του χρήστη. |
| Χρειάζεται build (npm, webpack κ.λπ.); | **Όχι.** Τα αρχεία του `public/` σερβίρονται όπως είναι. |
| Εξωτερικές εξαρτήσεις / CDN; | **Καμία.** Three.js 0.169 και fonts είναι τοπικά στο `public/` (και για GDPR). |
| Πού αποθηκεύονται τα έργα; | Στον browser του κάθε χρήστη (`localStorage` + `IndexedDB` για τις εικόνες). Μεταφορά έργου μέσω αρχείου `.valis.json`. |
| Κόστος hosting | Πρακτικά **0 €** (Cloudflare free) ή ό,τι ήδη πληρώνει το υπάρχον hosting. |

**Συνέπεια:** οποιοσδήποτε static host κάνει τη δουλειά. Το ζήτημα δεν είναι «πού τρέχει» αλλά:
1. **ποιος έχει πρόσβαση** (κλείδωμα), και
2. **πώς φτάνει κάθε αλλαγή live** (αυτόματο deploy από το GitHub).

### 1.2 Γιατί πρέπει να κλειδωθεί

Ο κώδικας σε browser είναι **πάντα αναγνώσιμος**: όποιος ανοίξει τη σελίδα μπορεί να κατεβάσει όλη τη λογική
(κανόνες στήσης, διαστάσεις συστήματος, σύμβολα από Corel). Αυτό είναι know-how της VALIS.
**Δεν το βάζουμε δημόσια όπως είναι.** Το κλείδωμα γίνεται **πριν** από τη σελίδα (σε επίπεδο server/edge),
ώστε ο ξένος να μην κατεβάζει ούτε ένα αρχείο JS.

Κανόνας για το μέλλον: **τιμές και κόστη δεν μπαίνουν ποτέ στη JavaScript του browser.** Όταν έρθει
η κοστολόγηση, θα υπολογίζεται σε server (Worker/Supabase).

### 1.3 Γιατί προτείνουμε Cloudflare (Διαδρομή Α)

| | **Α. Cloudflare Workers** (προτεινόμενο) | **Β. cPanel / υπάρχον hosting** |
|---|---|---|
| Αυτόματο deploy από GitHub | Ναι, ενσωματωμένο | Μόνο με GitHub Action (FTP) |
| Κλείδωμα | **Cloudflare Access**: login με email + κωδικό μιας χρήσης, δωρεάν έως 50 χρήστες | Basic Auth (κοινός κωδικός, `.htaccess`) |
| HTTPS | Αυτόματο | AutoSSL / Let's Encrypt του host |
| Επόμενες φάσεις (Supabase, AI βοηθός μέσω Worker) | Στο ίδιο μέρος | Χρειάζεται μεταφορά αργότερα |
| Αλλαγή DNS | Ναι, ή μόνο ένα CNAME (βλ. 3.4) | Όχι |

Το repo είναι **ήδη ρυθμισμένο** για Cloudflare (`wrangler.jsonc`). Η Διαδρομή Β υπάρχει για την περίπτωση που
δεν θέλουμε καθόλου να αγγίξουμε το DNS του `valiscreations.gr`.

---

## 2. Τι υπάρχει στο repo

```
public/                 ← ΜΟΝΟ αυτός ο φάκελος δημοσιεύεται
  index.html
  css/app.css
  js/config.js          κανόνες & στοιχεία συστήματος (η μόνη θέση για επιχειρησιακές τιμές)
  js/app.js             κάτοψη, κανόνες, μαγνήτης, PDF/SVG/CSV
  js/view3d.js          3D + εξαγωγή SketchUp .dae / .glb / .png (ES module)
  js/gfxstore.js        εικόνες γραφικών σε IndexedDB
  js/symbols.js         σύμβολα πόρτας/συνδέσμου (παράγεται από τα PDF)
  js/vendor/three/      Three.js 0.169 (τοπικά, μέσω import map)
  fonts/                Commissioner + JetBrains Mono (OFL)
docs/
  DEPLOY.md             αυτός ο οδηγός
  deploy/               έτοιμα αρχεία για τη Διαδρομή Β (.htaccess, GitHub Action)
  reference/            πρωτότυπα PDF από CorelDRAW (ΔΕΝ δημοσιεύονται)
tools/                  scripts (σύμβολα από PDF, έκδοση Claude.ai)
wrangler.jsonc          ρύθμιση Cloudflare: assets.directory = ./public
CLAUDE.md               αρχείο γνώσης: αρχιτεκτονική, κανόνες, ιστορικό αποφάσεων. ΔΙΑΒΑΣΕ ΤΟ.
README.md
```

> ⚠️ Ό,τι είναι έξω από το `public/` (PDF του Corel, CLAUDE.md, εργαλεία) **δεν πρέπει να ανέβει** στον server.

---

## 3. Βήματα, Διαδρομή Α: Cloudflare (προτεινόμενη)

### Βήμα 0: Πρόσβαση
- [ ] Ο Θανάσης σε προσθέτει στο GitHub: repo → **Settings → Collaborators → Add people** (ρόλος *Write*).
- [ ] Πρόσβαση στον λογαριασμό Cloudflare της VALIS (ο Θανάσης σε προσθέτει ως member: **Manage Account → Members**)
      ή δημιουργείται νέος με email της εταιρείας.
- [ ] Πρόσβαση στο σημείο όπου διαχειρίζεται σήμερα το DNS του `valiscreations.gr` (registrar ή cPanel του host).

### Βήμα 1: Τοπικός έλεγχος (5')
```bash
git clone git@github.com:thanasisvalis-max/valis-katopsi.git
cd valis-katopsi
python3 -m http.server 8080 -d public      # ή: npx serve public
# άνοιξε http://localhost:8080
```
Έλεγξε: πάτα **«Παράδειγμα»** → εμφανίζεται η κάτοψη ATHANASIADIS 1000×600 → **PDF** κατεβαίνει → **3D** ανοίγει.

> Με διπλό κλικ στο `index.html` (file://) η κάτοψη δουλεύει, αλλά το **3D όχι**, γιατί οι browsers δεν φορτώνουν
> ES modules από file://. Πάντα μέσω server.

### Βήμα 2: Δημιουργία Worker από το GitHub (10')
1. Cloudflare dashboard → **Workers & Pages → Create → Import a repository**.
2. Σύνδεση GitHub → επιλογή `thanasisvalis-max/valis-katopsi`.
3. Ρυθμίσεις:
   | Πεδίο | Τιμή |
   |---|---|
   | Project name | `valis-katopsi` |
   | Production branch | `main` |
   | Build command | *(κενό)* |
   | Deploy command | `npx wrangler deploy` |
   | Root directory | `/` |
4. **Deploy.** Σε ~1' το εργαλείο τρέχει στο `https://valis-katopsi.<account>.workers.dev`.
5. Άνοιξέ το και κάνε τον ίδιο έλεγχο με το Βήμα 1.

> Γιατί δουλεύει χωρίς build: το `wrangler.jsonc` λέει στο Cloudflare να σερβίρει **μόνο** τον φάκελο `public/` ως static assets.

### Βήμα 3: Κλείδωμα ΠΡΙΝ από το domain (15')
Το κλειδώνουμε **πριν** του δώσουμε όμορφο domain, ώστε να μην μείνει ποτέ ανοιχτό.

1. Cloudflare → **Zero Trust** (την πρώτη φορά ζητά όνομα ομάδας, π.χ. `valis`, και πλάνο **Free**).
2. **Access → Applications → Add an application → Self-hosted**.
3. Application domain: πρόσθεσε **και** τα δύο:
   - `valis-katopsi.<account>.workers.dev`
   - `boothdesigner.valiscreations.gr` (μπορεί να προστεθεί μετά το Βήμα 4)
4. **Policy**: Name `Ομάδα VALIS` → Action **Allow** → Include → **Emails** → τα email της ομάδας
   (ή **Emails ending in** `@valiscreations.gr`, αν όλοι έχουν εταιρικό email).
5. Login method: **One-time PIN** (κωδικός στο email, χωρίς passwords να θυμάται κανείς).
6. Session duration: π.χ. **1 μήνας**, για να μη ζητά κωδικό κάθε μέρα.
7. Εναλλακτικά (απλούστερο για το workers.dev): Worker → **Settings → Domains & Routes** → απενεργοποίηση του
   `workers.dev` αφού στηθεί το custom domain, ώστε να μένει μόνο ένα URL για κλείδωμα.

**Έλεγχος:** άνοιξε το URL σε ιδιωτικό παράθυρο → πρέπει να βγει η σελίδα login του Cloudflare,
**όχι** το εργαλείο. Δοκίμασε email εκτός λίστας → απορρίπτεται.

### Βήμα 4: Subdomain `boothdesigner.valiscreations.gr`
Το Cloudflare μπορεί να δώσει custom domain σε Worker **μόνο αν το DNS του `valiscreations.gr` διαχειρίζεται το Cloudflare**.
Πρώτα δες πού είναι σήμερα:
```bash
dig NS valiscreations.gr +short
```

**Περίπτωση 4α: τα NS είναι ήδη `*.ns.cloudflare.com`.** Απλά:
Worker → **Settings → Domains & Routes → Add → Custom domain** → `boothdesigner.valiscreations.gr`. Το Cloudflare φτιάχνει DNS και SSL μόνο του.

**Περίπτωση 4β: τα NS είναι του host/registrar (π.χ. Papaki, Top.Host, cPanel).** Μεταφορά του DNS στο Cloudflare.
Προσοχή, εδώ είναι το μόνο σημείο όπου κάτι μπορεί να «σπάσει»: **τα email της εταιρείας.**

1. **Πριν αλλάξεις οτιδήποτε**, κράτα αντίγραφο όλων των τρεχουσών εγγραφών DNS (screenshot ή export zone από cPanel → *Zone Editor*).
2. Cloudflare → **Add a domain** → `valiscreations.gr` → πλάνο **Free**. Το Cloudflare σαρώνει και αντιγράφει τις εγγραφές.
3. **Σύγκρινε μία-μία** με το αντίγραφο. Ειδικά (λείπουν συχνά):
   - [ ] **MX** (email)
   - [ ] **TXT SPF** (`v=spf1 ...`)
   - [ ] **DKIM** (TXT ή CNAME, π.χ. `default._domainkey`, `google._domainkey`)
   - [ ] **DMARC** (`_dmarc`)
   - [ ] `mail`, `webmail`, `cpanel`, `autodiscover`, `ftp` και ό,τι άλλο subdomain
   - [ ] Εγγραφές επιβεβαίωσης (Google, Facebook, Microsoft κ.λπ.)
4. Οι εγγραφές για **mail / MX / ftp / cpanel**: **DNS only (γκρι σύννεφο)**, όχι proxied.
   Το κεντρικό site (`@`, `www`) μπορεί να μείνει κι αυτό αρχικά γκρι, ώστε να μην αλλάξει τίποτα στη συμπεριφορά του.
5. Στον registrar (εκεί που αγοράστηκε το `.gr`): αλλαγή **nameservers** σε αυτούς που δίνει το Cloudflare.
   *Για `.gr` η αλλαγή γίνεται από τον registrar. Συνήθως ολοκληρώνεται σε λίγες ώρες.*
6. Όταν το Cloudflare δείξει **Active**: έλεγχος ότι **στέλνει και λαμβάνει email** κανονικά και ότι το site ανοίγει.
7. Μετά: Worker → **Custom domain** → `boothdesigner.valiscreations.gr` (όπως στο 4α).
8. Στο Access application (Βήμα 3) πρόσθεσε το `boothdesigner.valiscreations.gr`, αν δεν το έβαλες ήδη.

> **Δεν θέλουμε να μετακινηθεί το DNS;** Τότε η Διαδρομή Β (cPanel) είναι η σωστή επιλογή, όχι κάποιο workaround.

### Βήμα 5: Τελικός έλεγχος
- [ ] `https://boothdesigner.valiscreations.gr` → login Cloudflare → μετά το PIN ανοίγει το εργαλείο.
- [ ] Ιδιωτικό παράθυρο + email εκτός λίστας → **δεν** μπαίνει.
- [ ] «Παράδειγμα» → **PDF** βγαίνει σε **1100 × 700 mm** (κλίμακα 1:10).
- [ ] **3D** ανοίγει → «SketchUp» κατεβάζει `.dae` (όρια 1000 × 600 × 250 cm) → ανοίγει στο SketchUp (File → Import).
- [ ] Ανέβασμα εικόνας σε επιφάνεια στο 3D → παραμένει μετά από refresh.
- [ ] DevTools → Network: **κανένα** request εκτός του `boothdesigner.valiscreations.gr`.
- [ ] `https://boothdesigner.valiscreations.gr/CLAUDE.md` και `/docs/reference/` → **404** (δεν δημοσιεύονται).
- [ ] Email της εταιρείας λειτουργούν κανονικά (αν έγινε μεταφορά DNS).

### Βήμα 6: Ροή ενημερώσεων από εδώ και πέρα
```
αλλαγή κώδικα → git push στο main → Cloudflare κάνει deploy μόνο του (~1') → live
```
- Προαιρετικά: δούλευε σε branch. Το Cloudflare φτιάχνει **preview URL** ανά branch (κλείδωσέ το κι αυτό στο Access με `*.valis-katopsi.<account>.workers.dev`).
- Rollback: Worker → **Deployments** → επιλογή προηγούμενης έκδοσης → *Rollback*.

---

## 4. Βήματα, Διαδρομή Β: cPanel / υπάρχον hosting

Όταν το DNS μένει εκεί που είναι.

### Βήμα 1: Subdomain
cPanel → **Domains** (ή *Subdomains*) → Create → `boothdesigner.valiscreations.gr`,
document root π.χ. `public_html/boothdesigner` (ή `~/boothdesigner`, έξω από το public_html, αν ο host το επιτρέπει).

### Βήμα 2: SSL
cPanel → **SSL/TLS Status** → *Run AutoSSL* για το νέο subdomain. Έλεγξε ότι ανοίγει με `https://`.

### Βήμα 3: Ανέβασμα αρχείων
Ανέβασε το **περιεχόμενο** του φακέλου `public/` (όχι τον ίδιο τον φάκελο) στο document root:
```
boothdesigner/
  index.html
  css/  js/  fonts/
```
**Μόνο** το `public/`. Ποτέ τα `docs/`, `CLAUDE.md`, `tools/`.

### Βήμα 4: Κλείδωμα + σωστά headers
Αντέγραψε το `docs/deploy/htaccess-cpanel.txt` ως `.htaccess` στο document root. Αυτό:
- αναγκάζει HTTPS,
- δηλώνει σωστό MIME για `.js` / `.mjs` / `.woff2` (αλλιώς το 3D δεν φορτώνει σε κάποιους hosts),
- βάζει cache-control.

Μετά: cPanel → **Directory Privacy** → φάκελος `boothdesigner` → *Password protect* → δημιουργία χρήστη/κωδικού για την ομάδα.
(Γράφει μόνο του τις γραμμές `AuthType Basic` στο `.htaccess`.)

> Περιορισμός: κοινός κωδικός για όλους, χωρίς ατομικά logins και χωρίς ιστορικό ποιος μπήκε. Για εσωτερικό εργαλείο λίγων ατόμων είναι αποδεκτό.

### Βήμα 5: Αυτόματο deploy από GitHub (προαιρετικό, συνιστάται)
1. cPanel → **FTP Accounts** → νέος λογαριασμός με directory **μόνο** το `boothdesigner`.
2. GitHub repo → **Settings → Secrets and variables → Actions** → πρόσθεσε:
   `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`.
3. Αντέγραψε το `docs/deploy/github-action-ftp.yml` σε `.github/workflows/deploy-cpanel.yml` και κάνε push.
4. Από εκεί και πέρα κάθε push στο `main` ανεβάζει το `public/` μέσω FTPS.

> Το `.htaccess` το διαχειρίζεται ο host (Directory Privacy). Το Action **δεν** το σβήνει (εξαιρείται στο yml).

### Βήμα 6: Ίδιος τελικός έλεγχος με την ενότητα 3 / Βήμα 5.

---

## 5. Τι ΔΕΝ πρέπει να γίνει

| Μην… | Γιατί |
|---|---|
| ανεβάσεις όλο το repo στον server | εκθέτει τα PDF του Corel και το CLAUDE.md (know-how) |
| ενεργοποιήσεις build/minify/bundler | δεν χρειάζεται, και σπάει το import map του 3D και την έκδοση Claude.ai |
| φορτώσεις βιβλιοθήκες/fonts από CDN | GDPR (IP χρηστών σε τρίτους) και εξάρτηση. Όλα είναι ήδη τοπικά |
| αλλάξεις ονόματα globals στο `app.js` | το `view3d.js` τα διαβάζει (`S`, `PROF`, `SYM`, `D3`, `GFX`, `bbox`, `symMatrix`, `offer` …) |
| βάλεις τιμές/κόστη σε JS | ό,τι είναι στον browser το διαβάζει όποιος έχει πρόσβαση |
| αφήσεις το workers.dev URL ανοιχτό | παράκαμψη του κλειδώματος. Ή μπαίνει στο Access ή απενεργοποιείται |

---

## 6. Δύο εκδόσεις, ένας κώδικας

Το εργαλείο υπάρχει και ως **artifact στο Claude.ai** (ιδιωτικό, για τον Θανάση). Τρέχει **τα ίδια αρχεία** του `public/`.
Η μόνη διαφορά είναι στις λήψεις: η `offer()` στο `app.js` καταλαβαίνει μόνη της το περιβάλλον
(αυτόνομο = κανονικό download, Claude.ai = `downloads` capability, όπου `.dae`/`.glb` πηγαίνουν σε `.zip`).
**Δεν χρειάζεται τίποτα από τον προγραμματιστή γι' αυτό.** Την ενημέρωση του artifact την κάνει το Claude
(`tools/build_artifact.py`). Απλώς μην αφαιρέσεις αυτή τη λογική από την `offer()`.

---

## 7. Έλεγχοι πριν από κάθε commit

```bash
node --check public/js/config.js public/js/app.js public/js/gfxstore.js public/js/symbols.js
# το view3d.js είναι ES module, το node --check δεν πιάνει όλα τα λάθη:
node --input-type=module -e "$(sed 's/^import .*//; s/^export {.*//; s/^export //' public/js/view3d.js)"
```
Και χειροκίνητα: «Παράδειγμα» → PDF 1100×700 mm → 3D ανοίγει → `.dae` 1000×600×250 cm.

Κάθε απόφαση/αλλαγή κανόνα γράφεται στο `CLAUDE.md` (ενότητα «Ιστορικό αποφάσεων») **στο ίδιο commit**.

---

## 8. Τι ακολουθεί (για να ξέρεις πού πάει η αρχιτεκτονική)

| Φάση | Τι | Τεχνικά |
|---|---|---|
| **B** (τώρα) | Online, κλειδωμένο, auto-deploy | αυτός ο οδηγός |
| B2 | Έργα σε βάση αντί για τον browser + login | **Supabase** (Postgres + Auth + Storage για τις εικόνες). Το Access μένει ως εξωτερική πόρτα |
| B3 | Σελίδα «Ρυθμίσεις»: οι κανόνες του `config.js` επεξεργάσιμοι χωρίς κώδικα | πίνακας `settings` στο Supabase, το `config.js` γίνεται default |
| C | AI βοηθός μέσα στο εργαλείο | Claude API **μόνο μέσω Cloudflare Worker** (το API key δεν πάει ποτέ στον browser) |
| Μελλοντικά | Σύνδεση με κοστολόγηση Valis Frames | υπολογισμός τιμών **μόνο server-side** |

Γι' αυτό προτείνουμε Cloudflare από τώρα: οι Φάσεις B2–C προσθέτουν Workers δίπλα στο ίδιο project, χωρίς μετακόμιση.

---

## 9. Παραδοτέα: checklist ολοκλήρωσης

- [ ] Το εργαλείο ανοίγει στο `https://boothdesigner.valiscreations.gr`
- [ ] Κλειδωμένο (Access ή Directory Privacy). Ελέγχθηκε από ιδιωτικό παράθυρο
- [ ] Το `workers.dev` URL είτε κλειδωμένο είτε απενεργοποιημένο
- [ ] `git push` στο `main` → live χωρίς χειροκίνητη ενέργεια
- [ ] Τα email της εταιρείας δουλεύουν (αν άλλαξε DNS)
- [ ] Η ομάδα (λίστα emails) μπαίνει κανονικά
- [ ] Σημείωση στο `CLAUDE.md` → «Ιστορικό αποφάσεων»: πού φιλοξενείται, ποιος έχει πρόσβαση στο Cloudflare/cPanel

Απορίες για τη λογική του εργαλείου: `CLAUDE.md`. Για επιχειρησιακές αποφάσεις: Θανάσης.
