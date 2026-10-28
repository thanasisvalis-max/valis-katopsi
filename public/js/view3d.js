// Προβολή 3D σε στυλ SketchUp και εξαγωγές (SketchUp .dae, .glb, εικόνα .png).
// ES module: φορτώνει μόνο όταν πατηθεί το κουμπί «3D» (dynamic import από app.js).
// Χρησιμοποιεί τα globals του app.js / config.js: S, PROF, SYM, D3, isProf, lit, bbox, symMatrix, offer, fname, toast, commit.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

const gfxColor=()=>S.gfx3d||D3.colors.graphic;

/* ---------- 1. Μοντέλο: λίστα από πρίσματα (τετράπλευρο κάτοψης × ύψος) ----------
   Συντεταγμένες κάτοψης σε cm: x δεξιά, y προς τα κάτω (προς τον διάδρομο). Ύψος h προς τα πάνω.
   Κάθε πρίσμα έχει face(tag, n) → υλικό ανά έδρα. Έτσι η εσωτερική όψη ενός πλαισίου γίνεται «graphic». */
function parts(){
  const out=[], H=S.H;
  const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
  const all=m=>()=>m;
  out.push({name:'DAPEDO',quad:rect(0,0,S.W,S.D),z0:-D3.floorH,z1:0,face:all('floor')});
  S.els.forEach(el=>{
    if(isProf(el)){
      const b=bbox(el), code=PROF[el.type].code;
      // εσωτερική όψη = η πλευρά που κοιτάει προς το κέντρο του περιπτέρου
      const inn=el.dir==='h'?[0,(b.y+b.h/2)<=S.D/2?1:-1]:[(b.x+b.w/2)<=S.W/2?1:-1,0];
      out.push({name:`${code}_${Math.round(el.len)}x${H}${lit(el)?'_LED':''}`,quad:rect(b.x,b.y,b.w,b.h),z0:0,z1:H,
        face:(tag,n)=>tag==='side'&&n[0]*inn[0]+n[2]*inn[1]>.9?'graphic':'frame'});
    } else if(el.type==='conn'){
      const b=bbox(el); out.push({name:'CONN',quad:rect(b.x,b.y,b.w,b.h),z0:0,z1:H,face:all('alu')});
    } else if(el.type==='door'){
      const m=symMatrix(el).m, tf=([x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
      const leafH=Math.min(D3.doorLeafH,H);
      // πρέκι πάνω από το άνοιγμα (στη γραμμή 100 cm του συμβόλου)
      if(H>leafH+2) out.push({name:'DOOR_PREKI',quad:rect(0.11,0.17,100,5).map(tf),z0:leafH,z1:H,face:all('frame')});
      // φύλλο πόρτας: τα δύο τετράπλευρα του συμβόλου Corel, όπως είναι σχεδιασμένα (ανοιχτό 45°)
      [0,1].forEach(i=>{const nums=SYM.door[i].d.match(/-?\d+(\.\d+)?/g).map(Number);
        out.push({name:'DOOR_FYLLO',quad:[0,2,4,6].map(k=>tf([nums[k],nums[k+1]])),z0:0,z1:leafH,face:all('door')});});
      // σύνδεσμος της πόρτας (κολόνα σε όλο το ύψος)
      out.push({name:'DOOR_CONN',quad:rect(100.33,0.29,4.56,4.56).map(tf),z0:0,z1:H,face:all('alu')});
    }
  });
  return out;
}
// Τρίγωνα πρίσματος σε χώρο (x, h, y): [{t:[a,b,c], mat}] με κάθετα διανύσματα προς τα έξω
function prismTris(p){
  const q=p.quad, B=q.map(([x,y])=>[x,p.z0,y]), T=q.map(([x,y])=>[x,p.z1,y]);
  const c=[0,1,2].map(i=>(B.reduce((s,v)=>s+v[i],0)+T.reduce((s,v)=>s+v[i],0))/8);
  const raw=[['top',[T[0],T[1],T[2]]],['top',[T[0],T[2],T[3]]],['bottom',[B[0],B[2],B[1]]],['bottom',[B[0],B[3],B[2]]]];
  for(let i=0;i<4;i++){const j=(i+1)%4; raw.push(['side',[B[i],B[j],T[j]]],['side',[B[i],T[j],T[i]]]);}
  return raw.map(([tag,t])=>{
    const u=t[1].map((v,k)=>v-t[0][k]), w=t[2].map((v,k)=>v-t[0][k]);
    let n=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
    const fc=[0,1,2].map(k=>(t[0][k]+t[1][k]+t[2][k])/3-c[k]);
    if(n[0]*fc[0]+n[1]*fc[1]+n[2]*fc[2]<0){t=[t[0],t[2],t[1]]; n=n.map(v=>-v);}
    const L=Math.hypot(...n)||1; n=n.map(v=>v/L);
    return {t,mat:p.face(tag,n)};
  });
}
const colorOf=m=>m==='graphic'?gfxColor():D3.colors[m];

/* ---------- 2. COLLADA (.dae) για SketchUp: Z πάνω, μονάδα cm, κάθε πλαίσιο ξεχωριστό group ----------
   Η εσωτερική όψη κάθε πλαισίου έχει υλικό «GRAFIKO»: στο SketchUp βάζεις εκεί το artwork με τον κουβά. */
const DAE_NAME={graphic:'GRAFIKO',frame:'PLAISIO',alu:'ALOUMINIO',door:'PORTA',floor:'DAPEDO'};
function toDAE(list){
  const hex=h=>[1,3,5].map(i=>(parseInt(h.substr(i,2),16)/255).toFixed(4)).join(' ');
  const esc=s=>String(s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
  const used=new Set(); let geo='',nodes='';
  list.forEach((p,i)=>{
    const tris=prismTris(p), groups={};
    tris.forEach(o=>(groups[o.mat]=groups[o.mat]||[]).push(o.t));
    // (x, h, y) → SketchUp (X=x, Y=-y, Z=h): η πρόσοψη (διάδρομος) κοιτάει στην όψη «Front»
    const pts=tris.length?Object.values(groups).flat(2).map(([x,h,y])=>[x,-y,h]):[];
    const f=pts.flat().map(v=>+v.toFixed(3));
    let off=0, tri='', bind='';
    Object.entries(groups).forEach(([m,ts])=>{used.add(m);
      const n3=ts.length*3; tri+=`<triangles material="${m}" count="${ts.length}"><input semantic="VERTEX" source="#g${i}-v" offset="0"/><p>${Array.from({length:n3},(_,k)=>off+k).join(' ')}</p></triangles>`; off+=n3;
      bind+=`<instance_material symbol="${m}" target="#mat-${m}"/>`;});
    geo+=`<geometry id="g${i}" name="${esc(p.name)}"><mesh><source id="g${i}-pos"><float_array id="g${i}-arr" count="${f.length}">${f.join(' ')}</float_array><technique_common><accessor source="#g${i}-arr" count="${pts.length}" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common></source><vertices id="g${i}-v"><input semantic="POSITION" source="#g${i}-pos"/></vertices>${tri}</mesh></geometry>`;
    nodes+=`<node id="n${i}" name="${esc(p.name)}"><instance_geometry url="#g${i}"><bind_material><technique_common>${bind}</technique_common></bind_material></instance_geometry></node>`;
  });
  const mats=[...used];
  const fx=mats.map(m=>`<effect id="fx-${m}"><profile_COMMON><technique sid="common"><lambert><diffuse><color>${hex(colorOf(m))} 1</color></diffuse></lambert></technique></profile_COMMON></effect>`).join('');
  const ml=mats.map(m=>`<material id="mat-${m}" name="${DAE_NAME[m]||m}"><instance_effect url="#fx-${m}"/></material>`).join('');
  const now=new Date().toISOString();
  return `<?xml version="1.0" encoding="utf-8"?>
<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1"><asset><contributor><authoring_tool>Valis Frames Katopsi</authoring_tool></contributor><created>${now}</created><modified>${now}</modified><unit name="centimeter" meter="0.01"/><up_axis>Z_UP</up_axis></asset>
<library_effects>${fx}</library_effects><library_materials>${ml}</library_materials><library_geometries>${geo}</library_geometries>
<library_visual_scenes><visual_scene id="scene" name="${esc(S.name||'Katopsi')}"><node id="booth" name="${esc(S.name||'Katopsi')}">${nodes}</node></visual_scene></library_visual_scenes><scene><instance_visual_scene url="#scene"/></scene></COLLADA>`;
}

/* ---------- 3. Three.js σκηνή σε στυλ SketchUp ---------- */
let R=null; // ενεργή προβολή
function makeMats(){
  const m={};
  ['graphic','frame','alu','door','floor','person'].forEach(k=>{m[k]=new THREE.MeshLambertMaterial({color:colorOf(k),polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});});
  m.line=new LineMaterial({color:D3.colors.edge,linewidth:D3.edgePx,worldUnits:false});
  return m;
}
function outline(geo,mats,angle=20){
  const g=new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(geo,angle));
  const l=new LineSegments2(g,mats.line); l.userData.edge=true; return l;
}
function buildModel(list,mats){
  const g=new THREE.Group(), order=['graphic','frame','alu','door','floor'];
  list.forEach(p=>{
    const tris=prismTris(p).sort((a,b)=>order.indexOf(a.mat)-order.indexOf(b.mat));
    const pos=tris.flatMap(o=>o.t.flat()).map(v=>v/100); // cm → m
    const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); geo.computeVertexNormals();
    const used=[]; let start=0;
    order.forEach(m=>{const n=tris.filter(o=>o.mat===m).length*3; if(n){geo.addGroup(start,n,used.length); used.push(mats[m]); start+=n;}});
    const mesh=new THREE.Mesh(geo,used); mesh.name=p.name; g.add(mesh);
    g.add(outline(geo,mats));
  });
  return g;
}
// Απλή φιγούρα ανθρώπου για αίσθηση κλίμακας (δεν μπαίνει στις εξαγωγές)
function buildPerson(mats){
  const g=new THREE.Group(), h=D3.personH/100, k=h/1.75;
  const box=(w,hh,d,x,y,z)=>{const geo=new THREE.BoxGeometry(w*k,hh*k,d*k); const m=new THREE.Mesh(geo,mats.person); m.position.set(x*k,y*k,z*k); g.add(m); const o=outline(geo,mats,30); o.position.copy(m.position); g.add(o);};
  box(.13,.86,.16,-.08,.43,0); box(.13,.86,.16,.08,.43,0);   // πόδια
  box(.40,.60,.22,0,1.16,0);                                 // κορμός
  box(.09,.58,.12,-.25,1.15,0); box(.09,.58,.12,.25,1.15,0); // χέρια
  box(.18,.24,.20,0,1.62,0);                                 // κεφάλι
  g.name='KLIMAKA_ANTHROPOS'; return g;
}
const VIEWS={
  iso:(c,s)=>[c.x+s*.5,s*.6,c.z+s*1.0],
  front:(c,s)=>[c.x,s*.32,c.z+s*1.3],
  top:(c,s)=>[c.x,s*1.45,c.z+.001]};
function setView(v){
  if(!R) return; const c=R.center, s=R.size;
  R.camera.position.set(...VIEWS[v](c,s)); R.controls.target.set(c.x,v==='top'?0:S.H/100*.4,c.z); R.controls.update();
}
function syncToolbar(){
  const col=document.getElementById('v3d-color'), per=document.getElementById('v3d-person');
  col.value=gfxColor(); per.checked=S.person3d!==false;
}
export function open3D(){
  const box=document.getElementById('v3d'), host=document.getElementById('v3d-canvas');
  box.hidden=false; document.body.classList.add('v3d-open');
  document.getElementById('v3d-title').textContent=`${S.name||'Κάτοψη'} · ${S.W/100} × ${S.D/100} m · ύψος ${S.H} cm`;
  syncToolbar();
  if(R) close3D(true);
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(2,devicePixelRatio)); renderer.outputColorSpace=THREE.SRGBColorSpace;
  host.innerHTML=''; host.appendChild(renderer.domElement);
  const scene=new THREE.Scene(); scene.background=new THREE.Color(D3.colors.bg);
  const mats=makeMats(), list=parts(), model=buildModel(list,mats); scene.add(model);
  const person=buildPerson(mats); person.position.set(-.7,0,S.D/100+.2); person.visible=S.person3d!==false; scene.add(person);
  // φωτισμός SketchUp: ομοιόμορφος, οι κάθετες έδρες σκουραίνουν ανάλογα με τον προσανατολισμό, χωρίς σκιές
  scene.add(new THREE.AmbientLight(0xffffff,2.1));
  const sun=new THREE.DirectionalLight(0xffffff,1.15); sun.position.set(1.0,2.4,1.8); scene.add(sun);
  const W=S.W/100, D=S.D/100, size=Math.max(W,D,S.H/100)+2.5, center=new THREE.Vector3(W/2,0,D/2);
  const camera=new THREE.PerspectiveCamera(35,1,.05,200);
  const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.maxPolarAngle=Math.PI/2-.02; controls.minDistance=1; controls.maxDistance=60;
  R={renderer,scene,camera,controls,model,person,mats,list,center,size,run:true};
  const fit=()=>{const r=host.getBoundingClientRect(); renderer.setSize(r.width,r.height); camera.aspect=r.width/Math.max(1,r.height); camera.updateProjectionMatrix(); mats.line.resolution.set(r.width,r.height);};
  R.ro=new ResizeObserver(fit); R.ro.observe(host); fit(); setView('iso');
  const loop=()=>{if(!R||!R.run) return; controls.update(); renderer.render(scene,camera); R.raf=requestAnimationFrame(loop);}; loop();
}
export function close3D(keepOpen){
  if(R){R.run=false; cancelAnimationFrame(R.raf); R.ro.disconnect(); R.controls.dispose();
    R.scene.traverse(o=>{o.geometry&&o.geometry.dispose();});
    Object.values(R.mats).forEach(m=>m.dispose());
    R.renderer.dispose(); R.renderer.domElement.remove(); R=null;}
  if(!keepOpen){document.getElementById('v3d').hidden=true; document.body.classList.remove('v3d-open');}
}
function exportGLB(){
  const g=new THREE.Group(); R.model.children.filter(o=>o.isMesh).forEach(m=>g.add(m.clone()));
  new GLTFExporter().parse(g,buf=>offer(`${fname()}_3D.glb`,buf),err=>toast('Δεν βγήκε το GLB: '+err.message),{binary:true});
}
function exportPNG(){
  R.renderer.render(R.scene,R.camera);
  R.renderer.domElement.toBlob(b=>offer(`${fname()}_3D.png`,b),'image/png');
}
// σύνδεση κουμπιών (μία φορά)
const box=document.getElementById('v3d');
box.addEventListener('click',e=>{
  const b=e.target.closest('button[data-v3d]'); if(!b) return; const a=b.dataset.v3d;
  if(a==='close') close3D();
  else if(a==='dae') offer(`${fname()}_SKETCHUP.dae`,toDAE(R?R.list:parts()));
  else if(a==='glb') exportGLB();
  else if(a==='png') exportPNG();
  else setView(a);
});
document.getElementById('v3d-color').addEventListener('input',e=>{
  S.gfx3d=e.target.value; if(R) R.mats.graphic.color.set(S.gfx3d);
});
document.getElementById('v3d-color').addEventListener('change',()=>commit());
document.getElementById('v3d-person').addEventListener('change',e=>{
  S.person3d=e.target.checked; if(R) R.person.visible=S.person3d; commit();
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&R) close3D();});
export {parts,toDAE,prismTris};
