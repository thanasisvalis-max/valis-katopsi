// ============================================================
// ΚΑΝΟΝΕΣ & ΣΤΟΙΧΕΙΑ VALIS FRAMES
// Όλες οι επιχειρησιακές τιμές ζουν εδώ. Άλλαξε εδώ, όχι στο app.js.
// Μονάδες: εκατοστά (cm). Κάθε αλλαγή καταγράφεται και στο CLAUDE.md.
// ============================================================

// Χρώματα σχεδίου (ίδια με τα αρχεία Corel)
const C={L:'#9B9796',Dk:'#5F5C5B',S:'#2B2A29',grid:'#2B2A29',acc:'#1F4FD1',warn:'#D9822B',err:'#C8382C',store:'#5C6773'};

// Προφίλ. t = πάχος σχεδίου (cm), strips = στρώσεις [από, έως, σκούρο]
// ΣΗΜ: το PRF0068 λέγεται 4,5 cm αλλά το αρχείο Corel το σχεδιάζει 5 cm (ανοιχτό ερώτημα)
const PROF={
  p67:{t:15,code:'PRF0067',name:'Προφίλ 15 cm',strips:[[0,2.1,0],[2.1,2.9,1],[2.9,12.1,0],[12.1,12.9,1],[12.9,15,0]]},
  p68:{t:5,code:'PRF0068',name:'Προφίλ 4,5 cm',strips:[[0,2.1,0],[2.1,2.9,1],[2.9,5,0]]}};

// Κατάσταση πλαισίου / πόρτας (χρώμα στην κάτοψη/PDF, στήλη στη λίστα υλικών). Χωρίς el.st = υπάρχον (γκρι).
//  for = σε ποια στοιχεία εμφανίζεται: prof = PRF0067/PRF0068, door = πόρτα, prod = προϊόντα LED (cube, pylon, pylon300, desk, banner).
//  new = καινούργιο πλαίσιο (πράσινο) · mod = μετατροπή υπάρχοντος (κίτρινο) · size = αλλαγή διάστασης (γαλάζιο). L/Dk = ανοιχτή/σκούρα στρώση του προφίλ.
const STATUS={
  new:{name:'Καινούργιο', doorName:'Καινούργια', label:'ΚΑΙΝΟΥΡΓΙΟ', L:'#8CCB7E', Dk:'#3E8E3A', for:['prof','door','prod']},
  mod:{name:'Μετατροπή',  label:'ΜΕΤΑΤΡΟΠΗ',          L:'#F4D35E', Dk:'#B8960C', for:['prof','door']},
  size:{name:'Αλλαγή διάστασης', label:'ΑΛΛΑΓΗ ΔΙΑΣΤΑΣΗΣ', L:'#8FD3F4', Dk:'#2B88C2', for:['prof']},
  rent:{name:'Ενοίκιο', label:'ΕΝΟΙΚΙΟ', L:'#F6B072', Dk:'#C9661A', for:['prof','prod']},
  swap:{name:'Αλλαγή φοράς πόρτας', short:'Αλλαγή φοράς', label:'ΑΛΛΑΓΗ ΦΟΡΑΣ ΠΟΡΤΑΣ', L:'#C9A6E4', Dk:'#7D3C98', for:['door']}};
const stKind=el=>!el?null:el.type==='door'?'door':(el.type==='p67'||el.type==='p68')?'prof':pdef(el)?'prod':null;

// Σταθερά σύμβολα: πόρτα 105×62, σύνδεσμος 5×5
const SYMBOX={door:[105,62],conn:[5,5]};

// MAX67  = μήκος για πρόταση χωρισμού (π.χ. 600 → 2 × 300)
// WARN67 = πάνω από αυτό το PRF0067 εμφανίζει πρόταση χωρισμού (400 και 500 είναι εντάξει)
// RET    = μήκος γυρίσματος στις ελεύθερες άκρες
// SHORT  = τοίχοι μέχρι τόσο δεν ζητούν γύρισμα (θεωρούνται ήδη γυρίσματα)
const MAX67=300, WARN67=500, RET=50, SHORT=60;

// Τυποποιημένα ύψη περιπτέρου (cm)
const HEIGHTS=[250,300,350];

// 3D μοντέλο (cm). Το ύψος των πλαισίων είναι το ύψος περιπτέρου (S.H).
// personH   = ύψος ανθρώπου κλίμακας (δεν μπαίνει στις εξαγωγές).
// graphic   = default χρώμα γραφικού. Ο χρήστης το αλλάζει στο 3D (αποθηκεύεται στο S.gfx3d).
// floorH    = πάχος δαπέδου/πλατφόρμας στο 3D.
// Πόρτα (από τα σχέδια ΠΟΡΤΑ 100x250 / 100x300 του Θανάση), cm. Πλάτος 100 = πλαϊνό 20 + κενό 1,5 + φύλλο 78,5.
// Τυπώνονται 3 κομμάτια: φύλλο 78,5×198,5 · πλαϊνό 20×200 · κορωνίδα 100×(ύψος−200)  (250→100×50, 300→100×100, 350→100×150)
const DOOR={w:100, side:20, sideH:200, gap:1.5, leafW:78.5, leafH:198.5, t:5, leafT:4, openDeg:45};
const D3={floorH:2, personH:175,
  // Στυλ SketchUp: έγχρωμη η εσωτερική όψη (γραφικό), λευκά τα πλαϊνά/κορυφή του προφίλ, μαύρα περιγράμματα
  colors:{graphic:'#F2C75C', melamine:'#D8D3C8', frame:'#F7F7F5', alu:'#A6A4A1', door:'#E9E8E4', floor:'#EDEDEB', bg:'#CDCDC9', edge:'#151515', person:'#5B6B80'},
  edgePx:1.6,
  // Render (φωτορεαλιστικό): φωτεινότητα πάνελ, λάμψη, αίθουσα. Μετρήσεις σε m.
  render:{glow:.92, panelLight:.5, maxPanelLights:16, bloom:.13, bloomThreshold:.93, exposure:.92, env:.45, hemi:.25, sun:.9,
    carpet:'#5E6064', concrete:'#7C7975', floorOpacity:.92, reflect:0x3a3a3a, floorRough:.6, bg:'#17191C', fogNear:14, fogFar:48,
    hall:90, ceiling:8.5, colStep:13, exportPx:3200}};

// Προϊόντα LED (σταθερές διαστάσεις, cm). w = πλάτος, d = βάθος (αποτύπωμα κάτοψης), h = ύψος.
// Στην κάτοψη: γκρι παραλληλόγραμμο με ετικέτα, όπως τα σύμβολα του Θανάση.
// LED BANNER: πάνελ 100 × 8 (πάχος προφίλ) × 200 ύψος, με 2 πόδια 5 × 35 στα 5 και 90 cm (αποτύπωμα 100 × 35).
const PRODUCTS={
  cube:  {code:'LED CUBE',      dims:'50X50X50',  w:50, d:50, h:50,  fill:'#9B9796', key:'6', print:['s0','s1','s2','s3'], topOption:true},
  pylon: {code:'LED PYLON',     dims:'50X50X100', w:50, d:50, h:100, fill:'#9B9796', key:'7', print:['s0','s1','s2','s3'], topOption:true},
  pylon300:{code:'LED PYLON',   dims:'70X70X300', w:70, d:70, h:300, fill:'#C4C4C4', key:'P', print:['s0','s1','s2','s3'], topOption:true},
  desk:  {code:'LED INFO DESK', dims:'90X90X47',  w:90, d:47, h:90,  fill:'#C4C4C4', key:'8', print:['s1','s2','s3']},
  banner:{code:'LED BANNER',    dims:'100X200',   w:100,d:35, h:200, fill:'#C4C4C4', key:'9', print:['s0','s2'], bar:8, foot:{w:5, at:[5,90], h:3}}
};
// Όψεις εκτύπωσης (τοπικά, πριν την περιστροφή): s0 = πίσω (y=0), s1 = δεξιά, s2 = ΜΠΡΟΣΤΑ (y=βάθος), s3 = αριστερά, top = πάνω.
//  desk: μπροστά + 2 πλαϊνά (πίσω και πάνω δεν τυπώνονται) · banner: οι 2 μεγάλες όψεις
//  cube/pylon/pylon300: επιλογή ανά τεμάχιο el.top = 'print' (α: 5 πλευρές, default) ή 'melamine' (β: 4 πλευρές + μελαμίνη πάνω)
// Δάπεδα περιοχών (εργαλείο «Δάπεδο»): {type:'floor', x, y, w, h, mat:'carpet'|'plate'|'grass', color?, plate?}
//  Μοκέτα σε χρώματα, πλάκες κάλυψης (κατηγορίες όπως στον κατάλογο stand-on cover plates, με δικές μας υφές) και γκαζόν.
//  kind = γεννήτρια υφής στο render (render3d.js), c = χρώματα, size = μέγεθος πλακιδίου (cm).
const FLOOR={
  carpetColors:[['#5E6064','Γκρι'],['#2F3236','Ανθρακί'],['#1C1D20','Μαύρο'],['#B9AE9C','Μπεζ'],['#9A1F2B','Μπορντό'],['#C8102E','Κόκκινο'],['#1F4E8C','Μπλε'],['#3D6B35','Πράσινο']],
  grass:'#5E8C3A',
  plates:{
    lightwood:{name:'Ανοιχτό ξύλο', kind:'planks', c:['#D9B98C','#C9A576','#E3C79E']},
    brownwood:{name:'Καφέ ξύλο', kind:'planks', c:['#8A5A35','#7A4E2D','#9A6840']},
    darkwood:{name:'Σκούρο ξύλο', kind:'planks', c:['#4A2E1E','#3C2418','#56372A']},
    barnwood:{name:'Παλιό ξύλο', kind:'planks', c:['#8F8579','#6F665C','#A39A8D']},
    parquet:{name:'Ξύλο σε τετράγωνα', kind:'parquet', c:['#C9A06E','#B48A5A']},
    whitemarble:{name:'Λευκό μάρμαρο', kind:'marble', c:['#ECEAE6','#B4B1AB']},
    blackmarble:{name:'Μαύρο μάρμαρο', kind:'marble', c:['#1E1F22','#8C8F95']},
    lightconcrete:{name:'Ανοιχτό τσιμέντο', kind:'concrete', c:['#B9B6B0']},
    darkconcrete:{name:'Σκούρο τσιμέντο', kind:'concrete', c:['#5C5B59']},
    flagstone:{name:'Γκρι πλακόστρωτο', kind:'tiles', c:['#8E8C88','#55544F'], size:40},
    terracotta:{name:'Τερακότα', kind:'tiles', c:['#B8643E','#D9C8B4'], size:30},
    corten:{name:'Corten', kind:'corten', c:['#8A4A24','#5E2F16']},
    studs:{name:'Ανάγλυφο λάστιχο', kind:'studs', c:['#3A3B3E','#55565A']}},
  min:20};
const FLOOR_MAT={carpet:'Μοκέτα', plate:'Πλάκες κάλυψης', grass:'Γκαζόν'};
// κλειδί υλικού 3D και βασικό χρώμα ενός δαπέδου
const floorKey=el=>el.mat==='grass'?'fl_grass':el.mat==='plate'?'fl_plate_'+(el.plate||'lightwood'):'fl_carpet_'+(el.color||FLOOR.carpetColors[0][0]).replace('#','');
function floorColor(key){
  if(key==='fl_grass') return FLOOR.grass;
  if(key.startsWith('fl_plate_')) return (FLOOR.plates[key.slice(9)]||FLOOR.plates.lightwood).c[0];
  return '#'+key.slice(10);
}
function floorName(el){
  if(el.mat==='grass') return 'Γκαζόν';
  if(el.mat==='plate') return 'Πλάκες · '+(FLOOR.plates[el.plate]||FLOOR.plates.lightwood).name;
  const c=FLOOR.carpetColors.find(x=>x[0]===(el.color||FLOOR.carpetColors[0][0])); return 'Μοκέτα '+(c?c[1].toLowerCase():el.color);
}

// Ηλεκτρολογικά (μόνο κάτοψη/PDF και λίστα υλικών, όχι 3D). w × d = μέγεθος συμβόλου στην κάτοψη (cm), col = χρώμα συμβόλου.
const ELEC={
  socket:{name:'Πρίζα', code:'ΠΡΙΖΑ', w:14, d:14, key:'E'},
  strip: {name:'Πολύπριζο', code:'ΠΟΛΥΠΡΙΖΟ', w:44, d:12, outlets:4, key:'M'},
  panel: {name:'Ηλεκτρολογικός πίνακας', code:'Η/Π ΠΙΝΑΚΑΣ', w:40, d:20, key:'B', supply:true},
  // Προβολέας: μπαίνει πάνω σε πλαίσιο (σφιγκτήρας στο προφίλ) με τον βραχίονα προς το εσωτερικό του περιπτέρου
  spot:  {name:'Προβολέας', code:'ΠΡΟΒΟΛΕΑΣ', w:16, d:40, key:'L', watt:50, mount:[8,4], reach:35}};
// Ετικέτες Watt: «Κατανάλωση» για ό,τι καταναλώνει, «Παροχή» για τον πίνακα (η διαθέσιμη ισχύς της έκθεσης)
const elecLoad=()=>S.els.filter(e=>isElec(e)&&!ELEC[e.type].supply).reduce((t,e)=>t+(+e.watt||0),0);
const elecSupply=()=>S.els.filter(e=>isElec(e)&&ELEC[e.type].supply).reduce((t,e)=>t+(+e.watt||0),0);
const fmtW=v=>Math.round(v).toLocaleString('el-GR')+' W';
const ELEC_COL='#C8382C';
Object.entries(ELEC).forEach(([k,e])=>{SYMBOX[k]=[e.w,e.d];});
const isElec=e=>!!(e&&ELEC[e.type]);

// Custom στοιχείο (π.χ. πάγκος): ορθογώνιο με όνομα και δικές του διαστάσεις. {type:'custom', x, y, w, d, h, rot, name, fill?, top?, st?}
//  Συμπεριφέρεται όπως ένα προϊόν LED (περιστροφή, μαγνήτης, 3D, γραφικά στις 4 πλευρές + πάνω, λίστα υλικών).
const CUSTOM={name:'ΠΑΓΚΟΣ', w:200, d:60, h:100, fill:'#D9D2C3', min:10,
  colors:['#D9D2C3','#C4C4C4','#9B9796','#FFFFFF','#B7C9D6','#D7B9A3','#2B2A29']};
const dimS=v=>String(Math.round(v*10)/10).replace('.',',');
// Ορισμός «προϊόντος» για οποιοδήποτε στοιχείο: τα LED από τον κατάλογο, το custom από τα δικά του πεδία
function pdef(el){
  if(!el) return null;
  if(el.type==='custom') return {code:(el.name||CUSTOM.name).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase(), dims:`${dimS(el.w)}X${dimS(el.d)}X${dimS(el.h)}`,
    w:el.w, d:el.d, h:el.h, fill:el.fill||CUSTOM.fill, print:['s0','s1','s2','s3'], topOption:true, custom:true};
  return PRODUCTS[el.type]||null;
}
//  desk: επιλογή ανά τεμάχιο el.print = 'front3' (μπροστά + 2 πλαϊνά, default) ή 'front' (μόνο μπροστά)
function printFaces(el){const p=pdef(el); if(!p) return [];
  if(el.type==='desk'&&el.print==='front') return ['s2'];
  return p.topOption&&el.top!=='melamine'?[...p.print,'top']:p.print;}
Object.entries(PRODUCTS).forEach(([k,p])=>{SYMBOX[k]=[p.w,p.d];});
