// Προβολή 3D σε στυλ SketchUp, γραφικά (artwork) στις επιφάνειες και εξαγωγές (SketchUp .dae, .glb, εικόνα .png).
// ES module: φορτώνει μόνο όταν πατηθεί το κουμπί «3D» (dynamic import από app.js).
// Χρησιμοποιεί τα globals: S, PROF, SYM, D3, GFX, isProf, lit, bbox, symMatrix, offer, fname, toast, commit, zipFiles.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';

const $=id=>document.getElementById(id);
const gfxColor=()=>S.gfx3d||D3.colors.graphic;
const fmt=v=>(Math.round(v*10)/10).toString().replace('.',',');

/* ---------- 1. Μοντέλο: λίστα από πρίσματα (τετράπλευρο κάτοψης × ύψος) ----------
   Συντεταγμένες κάτοψης σε cm: x δεξιά, y προς τα κάτω (προς τον διάδρομο). Ύψος h προς τα πάνω.
   Κάθε πρίσμα έχει face(tag, n) → υλικό ανά έδρα. Η εσωτερική όψη ενός πλαισίου είναι «graphic». */
const innOf=(el,b)=>el.dir==='h'?[0,(b.y+b.h/2)<=S.D/2?1:-1]:[(b.x+b.w/2)<=S.W/2?1:-1,0];
function parts(){
  const out=[], H=S.H;
  const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
  const all=m=>()=>m;
  out.push({name:'DAPEDO',el:'floor',quad:rect(0,0,S.W,S.D),z0:-D3.floorH,z1:0,face:all('floor')});
  S.els.forEach(el=>{
    if(isProf(el)){
      const b=bbox(el), code=PROF[el.type].code, inn=innOf(el,b);
      out.push({name:`${code}_${Math.round(el.len)}x${H}${lit(el)?'_LED':''}`,el:el.id,inn,quad:rect(b.x,b.y,b.w,b.h),z0:0,z1:H,
        face:(tag,n)=>tag==='side'&&n[0]*inn[0]+n[2]*inn[1]>.9?'graphic':'frame'});
    } else if(el.type==='conn'){
      const b=bbox(el); out.push({name:'CONN',quad:rect(b.x,b.y,b.w,b.h),z0:0,z1:H,face:all('alu')});
    } else if(el.type==='door') out.push(...doorPieces(el));
    else if(isProd(el)){
      const pr=PRODUCTS[el.type], tf=tfOf(el);
      prodRects(el).forEach(([x,y,w,d,role])=>{
        const q=[[x,y],[x+w,y],[x+w,y+d],[x,y+d]].map(tf);
        if(role==='foot') out.push({name:`${pr.code.replace(/ /g,'_')}_PODI`,quad:q,z0:0,z1:pr.foot.h,face:all('alu')});
        else out.push({name:`${pr.code.replace(/ /g,'_')}_${pr.dims}`,el:el.id,prod:true,quad:q,z0:0,z1:pr.h,
          face:tag=>tag==='side'?'graphic':'frame'});
      });
    }
  });
  return out;
}

/* Πόρτα 3D (όψη: πλαϊνό 20 | φύλλο 78,5 · από πάνω κορωνίδα). Τοπικές συντεταγμένες του συμβόλου Corel:
   x κατά μήκος της πόρτας (0..100), y κάθετα στον τοίχο, η μπάρα στο y 0,17..5,17. Το tf εφαρμόζει περιστροφή / αλλαγή πλευράς / αναστροφή.
   Κλειστή by default· ανοιχτή (S.doorOpen3d) = το φύλλο γυρίζει 45° γύρω από τον μεντεσέ, όπως στο σύμβολο της κάτοψης. */
const PIECE_LABEL={leaf:'Φύλλο πόρτας',side:'Πλαϊνό πόρτας',crown:'Κορωνίδα πόρτας'};
function doorPieces(el){
  const m=symMatrix(el).m, tf=([x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
  const H=S.H, d=DOOR, y0=0.17, yc=y0+d.t/2, out=[];
  const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
  const piece=(piece,name,loc,z0,z1)=>{const q=loc.map(tf), ax=[q[3][0]-q[0][0],q[3][1]-q[0][1]], L=Math.hypot(...ax)||1, a=[ax[0]/L,ax[1]/L];
    out.push({name,el:el.id,piece,ax:a,quad:q,z0,z1,face:(tag,n)=>tag==='side'&&Math.abs(n[0]*a[0]+n[2]*a[1])>.9?'door':'frame'});};
  piece('side','DOOR_PLAINO',rect(0,y0,d.side,d.t),0,Math.min(d.sideH,H));
  if(H>d.sideH+1) piece('crown','DOOR_KORONIDA',rect(0,y0,d.w,d.t),d.sideH,H);
  const hx=d.side+d.gap, leaf=rect(hx,yc-d.leafT/2,d.leafW,d.leafT);
  const th=(S.doorOpen3d?d.openDeg:0)*Math.PI/180, c=Math.cos(th), s=Math.sin(th);
  piece('leaf','DOOR_FYLLO',leaf.map(([x,y])=>{const dx=x-hx, dy=y-yc; return [hx+dx*c-dy*s, yc+dx*s+dy*c];}),0,Math.min(d.leafH,H));
  out.push({name:'DOOR_CONN',quad:rect(100.33,0.29,4.56,4.56).map(tf),z0:0,z1:H,face:()=>'alu'});
  return out;
}
// σώμα προϊόντος LED (χωρίς πόδια) και οι 4 κάθετες όψεις του
const parts1=el=>{const pr=PRODUCTS[el.type], tf=tfOf(el), r=prodRects(el).find(o=>o[4]==='body'); if(!r) return null;
  const [x,y,w,d]=r; return {quad:[[x,y],[x+w,y],[x+w,y+d],[x,y+d]].map(tf),z0:0,z1:pr.h};};
function prodFace(p,i){
  const q=p.quad, e1=q[i], e2=q[(i+1)%4], cx=q.reduce((s,v)=>s+v[0],0)/4, cy=q.reduce((s,v)=>s+v[1],0)/4;
  let n=[e2[1]-e1[1],-(e2[0]-e1[0])]; const L=Math.hypot(...n)||1; n=[n[0]/L,n[1]/L];
  const mx=(e1[0]+e2[0])/2-cx, my=(e1[1]+e2[1])/2-cy; if(n[0]*mx+n[1]*my<0) n=[-n[0],-n[1]];
  return {e1,e2,n};
}
// οι δύο μεγάλες όψεις ενός κομματιού πόρτας, με το ποια κοιτάει προς το εσωτερικό του περιπτέρου
function pieceFaces(p){
  const q=p.quad, a=p.ax, cx=S.W/2, cy=S.D/2;
  return [[q[0],q[1],[-a[0],-a[1]]],[q[3],q[2],[a[0],a[1]]]].map(([e1,e2,n])=>{
    const mid=[(e1[0]+e2[0])/2,(e1[1]+e2[1])/2];
    return {e1,e2,n,inward:n[0]*(cx-mid[0])+n[1]*(cy-mid[1])>0};
  });
}
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

/* ---------- 2. Επιφάνειες για γραφικά ----------
   Κλειδί επιφάνειας: '<id στοιχείου>:in' (εσωτερική όψη), '<id>:out' (εξωτερική), 'floor' (δάπεδο),
   για πόρτες '<id>:leaf|side|crown:in|out' (φύλλο / πλαϊνό / κορωνίδα),
   για προϊόντα LED '<id>:s0..s3' (πλευρές) και '<id>:top' (πάνω όψη, όχι στο banner).
   surface(key) → γωνίες [κάτω-αριστ, κάτω-δεξ, πάνω-δεξ, πάνω-αριστ] σε (x,h,y) cm όπως τις βλέπει κάποιος μπροστά από την όψη. */
const OFF=0.3; // cm: το γραφικό «κάθεται» λίγο πάνω από την όψη του πλαισίου
function surface(key){
  if(key==='floor') return {key,w:S.W,h:S.D,label:`Δάπεδο · ${fmt(S.W)} × ${fmt(S.D)} cm`,
    c:[[0,OFF,S.D],[S.W,OFF,S.D],[S.W,OFF,0],[0,OFF,0]],n:[0,1,0]};
  const [id,side,dside]=key.split(':'), el=S.els.find(e=>e.id===id); if(!el) return null;
  if(isProd(el)){
    const p=parts1(el), pr=PRODUCTS[el.type]; if(!p) return null;
    const xs=p.quad.map(q=>q[0]), ys=p.quad.map(q=>q[1]), x0=Math.min(...xs), x1=Math.max(...xs), y0=Math.min(...ys), y1=Math.max(...ys);
    if(side==='top'){ if(el.type==='banner') return null; const z=p.z1+OFF;
      return {key,w:x1-x0,h:y1-y0,label:`${pr.code} · πάνω όψη · ${fmt(x1-x0)} × ${fmt(y1-y0)} cm`,c:[[x0,z,y1],[x1,z,y1],[x1,z,y0],[x0,z,y0]],n:[0,1,0]};}
    const i=+String(side).slice(1); if(!(i>=0&&i<4)) return null;
    const f=prodFace(p,i), [nx,ny]=f.n, r=[ny,-nx], o=[nx*OFF,ny*OFF];
    let [L,Rt]=[f.e1,f.e2]; if(L[0]*r[0]+L[1]*r[1]>Rt[0]*r[0]+Rt[1]*r[1]) [L,Rt]=[Rt,L];
    const w=Math.hypot(Rt[0]-L[0],Rt[1]-L[1]), h=p.z1-p.z0;
    const nm=Math.abs(nx)>Math.abs(ny)?(nx>0?'δεξιά':'αριστερή'):(ny>0?'μπροστινή':'πίσω');
    return {key,w,h,label:`${pr.code} · ${nm} όψη · ${fmt(w)} × ${fmt(h)} cm`,
      c:[[L[0]+o[0],p.z0,L[1]+o[1]],[Rt[0]+o[0],p.z0,Rt[1]+o[1]],[Rt[0]+o[0],p.z1,Rt[1]+o[1]],[L[0]+o[0],p.z1,L[1]+o[1]]],n:[nx,0,ny]};
  }
  if(el.type==='door'){
    const p=doorPieces(el).find(o=>o.piece===side); if(!p) return null;
    const F=pieceFaces(p), want=dside==='in', f=F.find(o=>o.inward===want)||F[want?1:0];
    const [nx,ny]=f.n, r=[ny,-nx], o=[nx*OFF,ny*OFF];
    let [L,Rt]=[f.e1,f.e2]; if(L[0]*r[0]+L[1]*r[1]>Rt[0]*r[0]+Rt[1]*r[1]) [L,Rt]=[Rt,L];
    const w=Math.hypot(Rt[0]-L[0],Rt[1]-L[1]), h=p.z1-p.z0;
    return {key,w,h,label:`${PIECE_LABEL[side]} · ${fmt(w)} × ${fmt(h)} cm · ${want?'εσωτερική':'εξωτερική'} όψη`,
      c:[[L[0]+o[0],p.z0,L[1]+o[1]],[Rt[0]+o[0],p.z0,Rt[1]+o[1]],[Rt[0]+o[0],p.z1,Rt[1]+o[1]],[L[0]+o[0],p.z1,L[1]+o[1]]],n:[nx,0,ny]};
  }
  if(!isProf(el)) return null;
  const b=bbox(el), inn=innOf(el,b), s=side==='in'?1:-1, H=S.H, code=PROF[el.type].code;
  const label=`${code} · ${fmt(el.len)} × ${fmt(H)} cm · ${side==='in'?'εσωτερική':'εξωτερική'} όψη`;
  if(el.dir==='h'){
    const dir=inn[1]*s, y=dir>0?b.y+b.h+OFF:b.y-OFF; // κοιτάει προς +y (μπροστά) ή −y (πίσω)
    const [xl,xr]=dir>0?[b.x,b.x+b.w]:[b.x+b.w,b.x];
    return {key,w:b.w,h:H,label,c:[[xl,0,y],[xr,0,y],[xr,H,y],[xl,H,y]],n:[0,0,dir]};
  }
  const dir=inn[0]*s, x=dir>0?b.x+b.w+OFF:b.x-OFF;      // κοιτάει προς +x ή −x
  const [yl,yr]=dir>0?[b.y+b.h,b.y]:[b.y,b.y+b.h];
  return {key,w:b.h,h:H,label,c:[[x,0,yl],[x,0,yr],[x,H,yr],[x,H,yl]],n:[dir,0,0]};
}
// UV με «γέμισμα» (κρατά αναλογία, κόβει περιμετρικά) ή «τέντωμα»
function uvs(sf,g){
  let u0=0,v0=0,ur=1,vr=1;
  if(g.fit!=='stretch'){const ai=g.iw/g.ih, af=sf.w/sf.h;
    if(ai>af){ur=af/ai; u0=(1-ur)/2;} else {vr=ai/af; v0=(1-vr)/2;}}
  return [[u0,v0],[u0+ur,v0],[u0+ur,v0+vr],[u0,v0+vr]];
}
const ratioInfo=(sf,g)=>{const ai=g.iw/g.ih, af=sf.w/sf.h, d=Math.abs(ai-af)/af; return {ai,af,ok:d<.02,d};};
function validGfx(){ return Object.entries(S.gfx||{}).map(([k,g])=>({k,g,sf:surface(k)})).filter(o=>o.sf); }

/* ---------- 3. COLLADA (.dae) για SketchUp ----------
   Z πάνω, μονάδα cm, κάθε πλαίσιο ξεχωριστό node. Γραφικά = ξεχωριστά nodes με υφή από textures/. */
const DAE_NAME={graphic:'GRAFIKO',frame:'PLAISIO',alu:'ALOUMINIO',door:'PORTA',floor:'DAPEDO'};
function toDAE(list,gfx){
  const hex=h=>[1,3,5].map(i=>(parseInt(h.substr(i,2),16)/255).toFixed(4)).join(' ');
  const esc=s=>String(s).replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
  const sk=([x,h,y])=>[x,-y,h].map(v=>+v.toFixed(3)); // (x,h,y) → SketchUp (X=x, Y=-y, Z=h)
  const used=new Set(); let geo='',nodes='',imgs='',fxT='',mlT='';
  list.forEach((p,i)=>{
    const tris=prismTris(p), groups={};
    tris.forEach(o=>(groups[o.mat]=groups[o.mat]||[]).push(o.t));
    const pts=Object.values(groups).flat(2).map(sk), f=pts.flat();
    let off=0, tri='', bind='';
    Object.entries(groups).forEach(([m,ts])=>{used.add(m);
      const n3=ts.length*3; tri+=`<triangles material="${m}" count="${ts.length}"><input semantic="VERTEX" source="#g${i}-v" offset="0"/><p>${Array.from({length:n3},(_,k)=>off+k).join(' ')}</p></triangles>`; off+=n3;
      bind+=`<instance_material symbol="${m}" target="#mat-${m}"/>`;});
    geo+=`<geometry id="g${i}" name="${esc(p.name)}"><mesh><source id="g${i}-pos"><float_array id="g${i}-arr" count="${f.length}">${f.join(' ')}</float_array><technique_common><accessor source="#g${i}-arr" count="${pts.length}" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common></source><vertices id="g${i}-v"><input semantic="POSITION" source="#g${i}-pos"/></vertices>${tri}</mesh></geometry>`;
    nodes+=`<node id="n${i}" name="${esc(p.name)}"><instance_geometry url="#g${i}"><bind_material><technique_common>${bind}</technique_common></bind_material></instance_geometry></node>`;
  });
  gfx.forEach((o,i)=>{
    const id=`t${i}`, pos=o.sf.c.map(sk).flat(), uv=uvs(o.sf,o.g).flat().map(v=>+v.toFixed(5));
    imgs+=`<image id="${id}-img" name="${id}"><init_from>${o.file}</init_from></image>`;
    fxT+=`<effect id="fx-${id}"><profile_COMMON><newparam sid="${id}-surf"><surface type="2D"><init_from>${id}-img</init_from></surface></newparam><newparam sid="${id}-samp"><sampler2D><source>${id}-surf</source></sampler2D></newparam><technique sid="common"><lambert><diffuse><texture texture="${id}-samp" texcoord="UV0"/></diffuse></lambert></technique></profile_COMMON></effect>`;
    mlT+=`<material id="mat-${id}" name="GRAFIKO_${i+1}"><instance_effect url="#fx-${id}"/></material>`;
    geo+=`<geometry id="${id}" name="GRAFIKO_${i+1}"><mesh><source id="${id}-pos"><float_array id="${id}-pa" count="12">${pos.join(' ')}</float_array><technique_common><accessor source="#${id}-pa" count="4" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common></source><source id="${id}-uv"><float_array id="${id}-ua" count="8">${uv.join(' ')}</float_array><technique_common><accessor source="#${id}-ua" count="4" stride="2"><param name="S" type="float"/><param name="T" type="float"/></accessor></technique_common></source><vertices id="${id}-v"><input semantic="POSITION" source="#${id}-pos"/></vertices><triangles material="m" count="2"><input semantic="VERTEX" source="#${id}-v" offset="0"/><input semantic="TEXCOORD" source="#${id}-uv" offset="0" set="0"/><p>0 1 2 0 2 3</p></triangles></mesh></geometry>`;
    nodes+=`<node id="n${id}" name="GRAFIKO_${i+1} ${esc(o.sf.label)}"><instance_geometry url="#${id}"><bind_material><technique_common><instance_material symbol="m" target="#mat-${id}"><bind_vertex_input semantic="UV0" input_semantic="TEXCOORD" input_set="0"/></instance_material></technique_common></bind_material></instance_geometry></node>`;
  });
  const mats=[...used];
  const fx=mats.map(m=>`<effect id="fx-${m}"><profile_COMMON><technique sid="common"><lambert><diffuse><color>${hex(colorOf(m))} 1</color></diffuse></lambert></technique></profile_COMMON></effect>`).join('')+fxT;
  const ml=mats.map(m=>`<material id="mat-${m}" name="${DAE_NAME[m]||m}"><instance_effect url="#fx-${m}"/></material>`).join('')+mlT;
  const now=new Date().toISOString();
  return `<?xml version="1.0" encoding="utf-8"?>
<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1"><asset><contributor><authoring_tool>Valis Frames Katopsi</authoring_tool></contributor><created>${now}</created><modified>${now}</modified><unit name="centimeter" meter="0.01"/><up_axis>Z_UP</up_axis></asset>
${imgs?`<library_images>${imgs}</library_images>`:''}<library_effects>${fx}</library_effects><library_materials>${ml}</library_materials><library_geometries>${geo}</library_geometries>
<library_visual_scenes><visual_scene id="scene" name="${esc(S.name||'Katopsi')}"><node id="booth" name="${esc(S.name||'Katopsi')}">${nodes}</node></visual_scene></library_visual_scenes><scene><instance_visual_scene url="#scene"/></scene></COLLADA>`;
}

/* ---------- 4. Three.js σκηνή σε στυλ SketchUp ---------- */
let R=null; // ενεργή προβολή
function makeMats(){
  const m={};
  ['graphic','frame','alu','door','floor','person'].forEach(k=>{m[k]=new THREE.MeshLambertMaterial({color:colorOf(k),polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:1});});
  m.line=new LineMaterial({color:D3.colors.edge,linewidth:D3.edgePx,worldUnits:false});
  m.sel=new LineMaterial({color:'#1F4FD1',linewidth:3.5,worldUnits:false,depthTest:false,transparent:true});
  return m;
}
function outline(geo,mat,angle=20){
  const g=new LineSegmentsGeometry().fromEdgesGeometry(new THREE.EdgesGeometry(geo,angle));
  return new LineSegments2(g,mat);
}
function buildModel(list,mats){
  const g=new THREE.Group(), order=['graphic','frame','alu','door','floor'];
  list.forEach(p=>{
    const tris=prismTris(p).sort((a,b)=>order.indexOf(a.mat)-order.indexOf(b.mat));
    const pos=tris.flatMap(o=>o.t.flat()).map(v=>v/100); // cm → m
    const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); geo.computeVertexNormals();
    const used=[]; let start=0;
    order.forEach(m=>{const n=tris.filter(o=>o.mat===m).length*3; if(n){geo.addGroup(start,n,used.length); used.push(mats[m]); start+=n;}});
    const mesh=new THREE.Mesh(geo,used); mesh.name=p.name; mesh.userData.part=p; g.add(mesh);
    g.add(outline(geo,mats.line));
  });
  return g;
}
function buildPerson(mats){
  const g=new THREE.Group(), k=D3.personH/175;
  const box=(w,hh,d,x,y,z)=>{const geo=new THREE.BoxGeometry(w*k,hh*k,d*k); const m=new THREE.Mesh(geo,mats.person); m.position.set(x*k,y*k,z*k); g.add(m); const o=outline(geo,mats.line,30); o.position.copy(m.position); g.add(o);};
  box(.13,.86,.16,-.08,.43,0); box(.13,.86,.16,.08,.43,0);
  box(.40,.60,.22,0,1.16,0);
  box(.09,.58,.12,-.25,1.15,0); box(.09,.58,.12,.25,1.15,0);
  box(.18,.24,.20,0,1.62,0);
  g.name='KLIMAKA_ANTHROPOS'; return g;
}
const quadGeo=(c,uv)=>{const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute([0,1,2,0,2,3].flatMap(i=>c[i].map(v=>v/100)),3));
  if(uv) g.setAttribute('uv',new THREE.Float32BufferAttribute([0,1,2,0,2,3].flatMap(i=>uv[i]),2));
  g.computeVertexNormals(); return g;};
const texCache=new Map();
async function texFor(imgId){
  if(texCache.has(imgId)) return texCache.get(imgId);
  const url=await GFX.get(imgId); if(!url) return null;
  const t=await new THREE.TextureLoader().loadAsync(url); t.colorSpace=THREE.SRGBColorSpace; t.anisotropy=8;
  texCache.set(imgId,t); return t;
}
async function refreshGraphics(){
  if(!R) return; const grp=R.gfxGroup;
  grp.children.slice().forEach(o=>{grp.remove(o); o.geometry&&o.geometry.dispose(); if(o.material&&o.material!==R.mats.sel) o.material.dispose();});
  for(const {k,g,sf} of validGfx()){
    const tex=await texFor(g.img); if(!tex||!R) continue;
    const m=new THREE.Mesh(quadGeo(sf.c,uvs(sf,g)),new THREE.MeshLambertMaterial({map:tex}));
    m.userData.surface=k; m.name='GRAFIKO'; grp.add(m);
  }
  drawSelection();
}
function drawSelection(){
  if(!R) return;
  if(R.selLine){R.scene.remove(R.selLine); R.selLine.geometry.dispose(); R.selLine=null;}
  const sf=R.selKey&&surface(R.selKey); if(!sf) return;
  const c=sf.c.map(p=>p.map(v=>v/100)), seg=[0,1,1,2,2,3,3,0].flatMap(i=>c[i]);
  const g=new LineSegmentsGeometry(); g.setPositions(seg);
  R.selLine=new LineSegments2(g,R.mats.sel); R.selLine.renderOrder=10; R.scene.add(R.selLine);
}

/* ---------- 5. Επιλογή επιφάνειας + πάνελ γραφικών ---------- */
const ray=new THREE.Raycaster(), ndc=new THREE.Vector2();
function pick(clientX,clientY){
  const r=R.renderer.domElement.getBoundingClientRect();
  ndc.set((clientX-r.left)/r.width*2-1,-((clientY-r.top)/r.height)*2+1); ray.setFromCamera(ndc,R.camera);
  const hits=ray.intersectObjects([...R.gfxGroup.children,...R.model.children.filter(o=>o.isMesh)],false);
  for(const h of hits){
    if(h.object.userData.surface) return h.object.userData.surface;
    const p=h.object.userData.part; if(!p||!p.el) continue;
    if(p.el==='floor') return h.face.normal.y>.9?'floor':null;
    if(p.prod){const n=h.face.normal; if(n.y>.9) return `${p.el}:top`; if(Math.abs(n.y)>.1) return null;
      for(let i=0;i<4;i++){const f=prodFace(p,i); if(n.x*f.n[0]+n.z*f.n[1]>.9) return `${p.el}:s${i}`;} return null;}
    if(p.piece){const n=h.face.normal, d=n.x*p.ax[0]+n.z*p.ax[1]; if(Math.abs(d)<.9) return null;
      const f=pieceFaces(p)[d>0?1:0]; return `${p.el}:${p.piece}:${f.inward?'in':'out'}`;}
    const n=h.face.normal, d=n.x*p.inn[0]+n.z*p.inn[1];
    if(Math.abs(d)>.9) return `${p.el}:${d>0?'in':'out'}`;
    return null; // κορυφή ή άκρη προφίλ
  }
  return null;
}
function select(key){ if(!R) return; R.selKey=key; drawSelection(); renderPanel(); }
function renderPanel(){
  const box=$('v3d-panel'), key=R&&R.selKey, sf=key&&surface(key);
  if(!sf){box.innerHTML=`<div class="lbl">Γραφικά</div><div class="empty">Πάτα μια επιφάνεια στο 3D (όψη πλαισίου ή δάπεδο) για να βάλεις γραφικό. Μπορείς και να σύρεις μια εικόνα πάνω στην επιφάνεια.</div>${listHTML()}`;return;}
  const g=(S.gfx||{})[key], ratio=(sf.w/sf.h);
  let h=`<div class="lbl">Επιλεγμένη επιφάνεια</div><b class="v3d-sf">${sf.label}</b>
    <div class="v3d-print">Διάσταση εκτύπωσης <b>${fmt(sf.w)} × ${fmt(sf.h)} cm</b> · αναλογία ${fmt(ratio)}:1</div>`;
  if(g){
    const ri=ratioInfo(sf,g);
    h+=`<div class="v3d-thumb"><img id="v3d-th" alt="Γραφικό ${g.name||''}"></div>
      <div class="frame">${g.name||'εικόνα'} · ${g.iw} × ${g.ih} px · αναλογία ${fmt(ri.ai)}:1</div>
      ${ri.ok?`<div class="v3d-ok">Η αναλογία ταιριάζει με την επιφάνεια.</div>`
        :`<div class="warn">Η αναλογία του αρχείου (${fmt(ri.ai)}:1) δεν ταιριάζει με την επιφάνεια (${fmt(ri.af)}:1). ${g.fit==='stretch'?'Το γραφικό τεντώνεται και παραμορφώνεται.':'Το γραφικό κόβεται περιμετρικά.'} Για την εκτύπωση ζήτα αρχείο ${fmt(sf.w)} × ${fmt(sf.h)} cm.</div>`}
      <div class="lbl">Προσαρμογή</div>
      <div class="seg"><button data-gfx="fit" data-v="cover" aria-pressed="${g.fit!=='stretch'}">Γέμισμα</button><button data-gfx="fit" data-v="stretch" aria-pressed="${g.fit==='stretch'}">Τέντωμα</button></div>
      <div class="seg"><button data-gfx="upload">Αλλαγή εικόνας</button><button data-gfx="remove">Αφαίρεση</button></div>`;
  } else {
    h+=`<button class="pri v3d-up" data-gfx="upload">Ανέβασμα γραφικού (JPG / PNG)</button>
      <p class="note">Ή σύρε την εικόνα πάνω στην επιφάνεια. Τα PDF εκτύπωσης κάνε τα πρώτα JPG.</p>`;
  }
  box.innerHTML=h+listHTML();
  if(g) GFX.get(g.img).then(u=>{const im=$('v3d-th'); if(im&&u) im.src=u;});
}
function listHTML(){
  const L=validGfx(); if(!L.length) return '';
  return `<div class="lbl" style="margin-top:6px">Γραφικά στο περίπτερο (${L.length})</div><ul class="v3d-list">`+
    L.map(o=>{const ri=ratioInfo(o.sf,o.g); return `<li><button data-gfx="go" data-k="${o.k}">${o.sf.label}</button>${ri.ok?'':'<span class="pill">ΑΝΑΛΟΓΙΑ</span>'}</li>`;}).join('')+'</ul>';
}
async function setGraphic(key,file){
  if(!surface(key)) return;
  let r; try{r=await GFX.fromFile(file);}catch(e){toast('Μόνο εικόνες JPG, PNG ή WEBP. Τα PDF μετέτρεψέ τα πρώτα σε JPG.'); return;}
  const id=GFX.newId(); await GFX.put(id,r.dataURL);
  S.gfx=S.gfx||{}; S.gfx[key]={img:id,name:file.name||'εικόνα',iw:r.iw,ih:r.ih,fit:(S.gfx[key]&&S.gfx[key].fit)||'cover'};
  commit(); if(R&&R.selKey===key) renderPanel(); await refreshGraphics();
  const ri=ratioInfo(surface(key),S.gfx[key]); toast(ri.ok?'Το γραφικό μπήκε.':'Το γραφικό μπήκε. Η αναλογία δεν ταιριάζει, δες το πάνελ.');
}

/* ---------- 6. Άνοιγμα / κλείσιμο ---------- */
const VIEWS={
  iso:(c,s)=>[c.x+s*.5,s*.6,c.z+s*1.0],
  front:(c,s)=>[c.x,s*.32,c.z+s*1.3],
  top:(c,s)=>[c.x,s*1.45,c.z+.001]};
function setView(v){
  if(!R) return; const c=R.center, s=R.size;
  R.camera.position.set(...VIEWS[v](c,s)); R.controls.target.set(c.x,v==='top'?0:S.H/100*.4,c.z); R.controls.update();
}
export function open3D(){
  const box=$('v3d'), host=$('v3d-canvas');
  box.hidden=false; document.body.classList.add('v3d-open');
  $('v3d-title').textContent=`${S.name||'Κάτοψη'} · ${S.W/100} × ${S.D/100} m · ύψος ${S.H} cm`;
  $('v3d-color').value=gfxColor(); $('v3d-person').checked=S.person3d!==false; $('v3d-door').checked=!!S.doorOpen3d;
  if(R) close3D(true);
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(2,devicePixelRatio)); renderer.outputColorSpace=THREE.SRGBColorSpace;
  host.innerHTML=''; host.appendChild(renderer.domElement);
  const scene=new THREE.Scene(); scene.background=new THREE.Color(D3.colors.bg);
  const mats=makeMats(), list=parts(), model=buildModel(list,mats); scene.add(model);
  const gfxGroup=new THREE.Group(); gfxGroup.name='GRAFIKA'; scene.add(gfxGroup);
  const person=buildPerson(mats); person.position.set(-.7,0,S.D/100+.2); person.visible=S.person3d!==false; scene.add(person);
  scene.add(new THREE.AmbientLight(0xffffff,2.1));
  const sun=new THREE.DirectionalLight(0xffffff,1.15); sun.position.set(1.0,2.4,1.8); scene.add(sun);
  const W=S.W/100, D=S.D/100, size=Math.max(W,D,S.H/100)+2.5, center=new THREE.Vector3(W/2,0,D/2);
  const camera=new THREE.PerspectiveCamera(35,1,.05,200);
  const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.maxPolarAngle=Math.PI/2-.02; controls.minDistance=1; controls.maxDistance=60;
  R={renderer,scene,camera,controls,model,gfxGroup,person,mats,list,center,size,run:true,selKey:null,selLine:null};
  const fit=()=>{const r=host.getBoundingClientRect(); renderer.setSize(r.width,r.height); camera.aspect=r.width/Math.max(1,r.height); camera.updateProjectionMatrix(); mats.line.resolution.set(r.width,r.height); mats.sel.resolution.set(r.width,r.height);};
  R.ro=new ResizeObserver(fit); R.ro.observe(host); fit(); setView('iso');
  // κλικ (χωρίς σύρσιμο) = επιλογή επιφάνειας
  let down=null;
  renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
  renderer.domElement.addEventListener('pointerup',e=>{if(down&&Math.hypot(e.clientX-down[0],e.clientY-down[1])<5) select(pick(e.clientX,e.clientY)); down=null;});
  renderPanel(); refreshGraphics();
  const loop=()=>{if(!R||!R.run) return; controls.update(); renderer.render(scene,camera); R.raf=requestAnimationFrame(loop);}; loop();
}
export function close3D(keepOpen){
  if(R){R.run=false; cancelAnimationFrame(R.raf); R.ro.disconnect(); R.controls.dispose();
    R.scene.traverse(o=>{o.geometry&&o.geometry.dispose(); if(o.material&&o.material.isMaterial&&o.material.map) o.material.dispose();});
    Object.values(R.mats).forEach(m=>m.dispose());
    R.renderer.dispose(); R.renderer.domElement.remove(); R=null;}
  if(!keepOpen){$('v3d').hidden=true; document.body.classList.remove('v3d-open');}
}

function rebuildModel(){
  if(!R) return;
  R.scene.remove(R.model); R.model.traverse(o=>o.geometry&&o.geometry.dispose());
  R.list=parts(); R.model=buildModel(R.list,R.mats); R.scene.add(R.model);
  if(R.selKey&&!surface(R.selKey)) R.selKey=null;
  refreshGraphics(); renderPanel();
}

/* ---------- 7. Εξαγωγές ---------- */
async function exportDAE(){
  const L=validGfx(), list=R?R.list:parts(), base=`${fname()}_SKETCHUP`;
  if(!L.length){ offer(`${base}.dae`,toDAE(list,[])); return; }
  // με γραφικά: zip με το .dae και τον φάκελο textures/
  const files=[], gfx=[];
  for(let i=0;i<L.length;i++){
    const url=await GFX.get(L[i].g.img); if(!url) continue;
    const file=`textures/grafiko_${i+1}.jpg`, bin=atob(url.split(',')[1]);
    files.push({name:file,bytes:Uint8Array.from(bin,c=>c.charCodeAt(0))}); gfx.push({...L[i],file});
  }
  files.unshift({name:`${base}.dae`,bytes:new TextEncoder().encode(toDAE(list,gfx))});
  offer(`${base}.zip`,zipFiles(files));
}
function exportGLB(){
  const g=new THREE.Group();
  R.model.children.filter(o=>o.isMesh).forEach(m=>g.add(m.clone()));
  R.gfxGroup.children.forEach(m=>g.add(m.clone()));
  new GLTFExporter().parse(g,buf=>offer(`${fname()}_3D.glb`,buf),err=>toast('Δεν βγήκε το GLB: '+err.message),{binary:true});
}
function exportPNG(){
  const sl=R.selLine; if(sl) sl.visible=false;
  R.renderer.render(R.scene,R.camera);
  R.renderer.domElement.toBlob(b=>{offer(`${fname()}_3D.png`,b); if(sl) sl.visible=true;},'image/png');
}

/* ---------- 8. Σύνδεση κουμπιών (μία φορά) ---------- */
$('v3d').addEventListener('click',e=>{
  const b=e.target.closest('button[data-v3d]'); if(!b) return; const a=b.dataset.v3d;
  if(a==='close') close3D();
  else if(a==='dae') exportDAE();
  else if(a==='glb') exportGLB();
  else if(a==='png') exportPNG();
  else setView(a);
});
$('v3d-panel').addEventListener('click',e=>{
  const b=e.target.closest('button[data-gfx]'); if(!b||!R) return; const a=b.dataset.gfx, key=R.selKey;
  if(a==='go'){select(b.dataset.k); return;}
  if(a==='upload'){$('v3d-file').click(); return;}
  if(!key||!(S.gfx||{})[key]) return;
  if(a==='remove'){delete S.gfx[key]; commit(); toast('Το γραφικό αφαιρέθηκε.');}
  if(a==='fit'){S.gfx[key].fit=b.dataset.v; commit();}
  renderPanel(); refreshGraphics();
});
$('v3d-file').addEventListener('change',async e=>{
  const f=e.target.files[0]; e.target.value=''; if(f&&R&&R.selKey) await setGraphic(R.selKey,f);
});
const host=$('v3d-canvas');
host.addEventListener('dragover',e=>{e.preventDefault(); host.classList.add('drop');});
host.addEventListener('dragleave',()=>host.classList.remove('drop'));
host.addEventListener('drop',async e=>{
  e.preventDefault(); host.classList.remove('drop'); if(!R) return;
  const f=e.dataTransfer.files[0]; if(!f) return;
  const key=pick(e.clientX,e.clientY)||R.selKey;
  if(!key){toast('Άφησε την εικόνα πάνω σε όψη πλαισίου ή στο δάπεδο.'); return;}
  select(key); await setGraphic(key,f);
});
$('v3d-color').addEventListener('input',e=>{S.gfx3d=e.target.value; if(R) R.mats.graphic.color.set(S.gfx3d);});
$('v3d-color').addEventListener('change',()=>commit());
$('v3d-door').addEventListener('change',e=>{S.doorOpen3d=e.target.checked; commit(); rebuildModel();});
$('v3d-person').addEventListener('change',e=>{S.person3d=e.target.checked; if(R) R.person.visible=S.person3d; commit();});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&R) close3D();});
export {parts,toDAE,prismTris,surface,setGraphic,select,exportDAE};
