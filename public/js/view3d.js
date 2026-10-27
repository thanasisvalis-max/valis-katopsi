// Προβολή 3D και εξαγωγές (SketchUp .dae, .glb, εικόνα .png).
// ES module: φορτώνει μόνο όταν πατηθεί το κουμπί «3D» (dynamic import από app.js).
// Χρησιμοποιεί τα globals του app.js / config.js: S, PROF, SYM, D3, isProf, lit, bbox, symMatrix, offer, fname, toast.
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

/* ---------- 1. Μοντέλο: λίστα από πρίσματα (τετράπλευρο κάτοψης × ύψος) ----------
   Συντεταγμένες κάτοψης σε cm: x δεξιά, y προς τα κάτω (προς τον διάδρομο). Ύψος h προς τα πάνω. */
function parts(){
  const out=[], H=S.H;
  const rect=(x,y,w,h)=>[[x,y],[x+w,y],[x+w,y+h],[x,y+h]];
  out.push({name:'DAPEDO',mat:'floor',quad:rect(0,0,S.W,S.D),z0:-D3.floorH,z1:0});
  S.els.forEach(el=>{
    if(isProf(el)){
      const b=bbox(el), code=PROF[el.type].code;
      out.push({name:`${code}_${Math.round(el.len)}x${H}${lit(el)?'_LED':''}`,mat:lit(el)?'frameLed':'frame',quad:rect(b.x,b.y,b.w,b.h),z0:0,z1:H});
    } else if(el.type==='conn'){
      const b=bbox(el); out.push({name:'CONN',mat:'alu',quad:rect(b.x,b.y,b.w,b.h),z0:0,z1:H});
    } else if(el.type==='door'){
      const m=symMatrix(el).m, tf=([x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]];
      const leafH=Math.min(D3.doorLeafH,H);
      // πρέκι πάνω από το άνοιγμα (στη γραμμή 100 cm του συμβόλου)
      if(H>leafH+2) out.push({name:'DOOR_PREKI',mat:'frame',quad:rect(0.11,0.17,100,5).map(tf),z0:leafH,z1:H});
      // φύλλο πόρτας: τα δύο τετράπλευρα του συμβόλου Corel, όπως είναι σχεδιασμένα (ανοιχτό 45°)
      [0,1].forEach(i=>{const nums=SYM.door[i].d.match(/-?\d+(\.\d+)?/g).map(Number);
        out.push({name:'DOOR_FYLLO',mat:'door',quad:[0,2,4,6].map(k=>tf([nums[k],nums[k+1]])),z0:0,z1:leafH});});
      // σύνδεσμος της πόρτας (κολόνα σε όλο το ύψος)
      out.push({name:'DOOR_CONN',mat:'alu',quad:rect(100.33,0.29,4.56,4.56).map(tf),z0:0,z1:H});
    }
  });
  return out;
}
// Τρίγωνα πρίσματος σε χώρο (x, h, y), με κάθετα διανύσματα προς τα έξω
function prismTris(p){
  const q=p.quad, B=q.map(([x,y])=>[x,p.z0,y]), T=q.map(([x,y])=>[x,p.z1,y]);
  const c=[0,1,2].map(i=>(B.reduce((s,v)=>s+v[i],0)+T.reduce((s,v)=>s+v[i],0))/8);
  const tris=[[T[0],T[1],T[2]],[T[0],T[2],T[3]],[B[0],B[2],B[1]],[B[0],B[3],B[2]]];
  for(let i=0;i<4;i++){const j=(i+1)%4; tris.push([B[i],B[j],T[j]],[B[i],T[j],T[i]]);}
  return tris.map(t=>{
    const u=t[1].map((v,k)=>v-t[0][k]), w=t[2].map((v,k)=>v-t[0][k]);
    const nrm=[u[1]*w[2]-u[2]*w[1],u[2]*w[0]-u[0]*w[2],u[0]*w[1]-u[1]*w[0]];
    const fc=[0,1,2].map(k=>(t[0][k]+t[1][k]+t[2][k])/3-c[k]);
    return nrm[0]*fc[0]+nrm[1]*fc[1]+nrm[2]*fc[2]<0?[t[0],t[2],t[1]]:t;
  });
}

/* ---------- 2. COLLADA (.dae) για SketchUp: Z πάνω, μονάδα cm, κάθε πλαίσιο ξεχωριστό group ---------- */
function toDAE(list){
  const hex=h=>[1,3,5].map(i=>(parseInt(h.substr(i,2),16)/255).toFixed(4)).join(' ');
  const mats=[...new Set(list.map(p=>p.mat))];
  const esc=s=>s.replace(/[<>&"]/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;'}[c]));
  let geo='',nodes='';
  list.forEach((p,i)=>{
    // (x, h, y) → SketchUp (X=x, Y=-y, Z=h): η πρόσοψη (διάδρομος) κοιτάει στην όψη «Front»
    const pts=prismTris(p).flat().map(([x,h,y])=>[x,-y,h]);
    const f=pts.flat().map(v=>+v.toFixed(3));
    geo+=`<geometry id="g${i}" name="${esc(p.name)}"><mesh><source id="g${i}-pos"><float_array id="g${i}-arr" count="${f.length}">${f.join(' ')}</float_array><technique_common><accessor source="#g${i}-arr" count="${pts.length}" stride="3"><param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/></accessor></technique_common></source><vertices id="g${i}-v"><input semantic="POSITION" source="#g${i}-pos"/></vertices><triangles material="m" count="${pts.length/3}"><input semantic="VERTEX" source="#g${i}-v" offset="0"/><p>${pts.map((_,k)=>k).join(' ')}</p></triangles></mesh></geometry>`;
    nodes+=`<node id="n${i}" name="${esc(p.name)}"><instance_geometry url="#g${i}"><bind_material><technique_common><instance_material symbol="m" target="#mat-${p.mat}"/></technique_common></bind_material></instance_geometry></node>`;
  });
  const fx=mats.map(m=>`<effect id="fx-${m}"><profile_COMMON><technique sid="common"><lambert><diffuse><color>${hex(D3.colors[m])} 1</color></diffuse></lambert></technique></profile_COMMON></effect>`).join('');
  const ml=mats.map(m=>`<material id="mat-${m}" name="${m}"><instance_effect url="#fx-${m}"/></material>`).join('');
  return `<?xml version="1.0" encoding="utf-8"?>
<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1"><asset><contributor><authoring_tool>Valis Frames Katopsi</authoring_tool></contributor><created>${new Date().toISOString()}</created><modified>${new Date().toISOString()}</modified><unit name="centimeter" meter="0.01"/><up_axis>Z_UP</up_axis></asset>
<library_effects>${fx}</library_effects><library_materials>${ml}</library_materials><library_geometries>${geo}</library_geometries>
<library_visual_scenes><visual_scene id="scene" name="${esc(S.name||'Katopsi')}"><node id="booth" name="${esc(S.name||'Katopsi')}">${nodes}</node></visual_scene></library_visual_scenes><scene><instance_visual_scene url="#scene"/></scene></COLLADA>`;
}

/* ---------- 3. Three.js σκηνή ---------- */
let R=null; // ενεργή προβολή
function buildModel(list){
  const g=new THREE.Group(), mats={};
  Object.entries(D3.colors).forEach(([k,c])=>{mats[k]=new THREE.MeshStandardMaterial({color:c,roughness:k==='alu'?.45:.85,metalness:k==='alu'?.5:0,
    emissive:k==='frameLed'?new THREE.Color('#FFF3D6'):new THREE.Color(0),emissiveIntensity:k==='frameLed'?.28:0});});
  const edgeMat=new THREE.LineBasicMaterial({color:D3.colors.edge,transparent:true,opacity:.45});
  list.forEach(p=>{
    const pos=prismTris(p).flat().flat().map(v=>v/100); // cm → m
    const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3)); geo.computeVertexNormals();
    const mesh=new THREE.Mesh(geo,mats[p.mat]); mesh.name=p.name; mesh.castShadow=p.mat!=='floor'; mesh.receiveShadow=true; g.add(mesh);
    if(p.mat!=='floor'){const e=new THREE.LineSegments(new THREE.EdgesGeometry(geo,20),edgeMat); e.userData.edge=true; g.add(e);}
  });
  return g;
}
const VIEWS={
  iso:(c,s)=>[c.x-s*.55,s*.62,c.z+s*.95],
  front:(c,s)=>[c.x,s*.28,c.z+s*1.25],
  top:(c,s)=>[c.x,s*1.45,c.z+.001]};
function setView(v){
  if(!R) return; const c=R.center, s=R.size;
  R.camera.position.set(...VIEWS[v](c,s)); R.controls.target.set(c.x,v==='top'?0:S.H/100*.35,c.z); R.controls.update();
}
export function open3D(){
  const box=document.getElementById('v3d'), host=document.getElementById('v3d-canvas');
  box.hidden=false; document.body.classList.add('v3d-open');
  document.getElementById('v3d-title').textContent=`${S.name||'Κάτοψη'} · ${S.W/100} × ${S.D/100} m · ύψος ${S.H} cm`;
  if(R) close3D(true);
  const renderer=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});
  renderer.setPixelRatio(Math.min(2,devicePixelRatio)); renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
  renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.05;
  host.innerHTML=''; host.appendChild(renderer.domElement);
  const scene=new THREE.Scene(); scene.background=new THREE.Color('#E9ECEF');
  const list=parts(), model=buildModel(list); scene.add(model);
  const W=S.W/100, D=S.D/100, size=Math.max(W,D,S.H/100)+2.5, center=new THREE.Vector3(W/2,0,D/2);
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(W+8,D+8),new THREE.MeshStandardMaterial({color:D3.colors.ground,roughness:1}));
  ground.rotation.x=-Math.PI/2; ground.position.set(W/2,-D3.floorH/100-.001,D/2); ground.receiveShadow=true; scene.add(ground);
  scene.add(new THREE.HemisphereLight(0xffffff,0xbfb8ad,1.25));
  const sun=new THREE.DirectionalLight(0xffffff,1.9); sun.position.set(W*.15-2,6,D+4); sun.target.position.copy(center);
  sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); const sc=sun.shadow.camera; sc.left=-size;sc.right=size;sc.top=size;sc.bottom=-size;sc.far=30; sun.shadow.bias=-.0005;
  scene.add(sun,sun.target);
  const camera=new THREE.PerspectiveCamera(38,1,.05,200);
  const controls=new OrbitControls(camera,renderer.domElement); controls.enableDamping=true; controls.maxPolarAngle=Math.PI/2-.02; controls.minDistance=1; controls.maxDistance=60;
  R={renderer,scene,camera,controls,model,list,center,size,run:true};
  const fit=()=>{const r=host.getBoundingClientRect(); renderer.setSize(r.width,r.height); camera.aspect=r.width/Math.max(1,r.height); camera.updateProjectionMatrix();};
  R.ro=new ResizeObserver(fit); R.ro.observe(host); fit(); setView('iso');
  const loop=()=>{if(!R||!R.run) return; controls.update(); renderer.render(scene,camera); R.raf=requestAnimationFrame(loop);}; loop();
}
export function close3D(keepOpen){
  if(R){R.run=false; cancelAnimationFrame(R.raf); R.ro.disconnect(); R.controls.dispose();
    R.scene.traverse(o=>{o.geometry&&o.geometry.dispose(); if(o.material)(Array.isArray(o.material)?o.material:[o.material]).forEach(m=>m.dispose());});
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
document.getElementById('v3d').addEventListener('click',e=>{
  const b=e.target.closest('button[data-v3d]'); if(!b) return; const a=b.dataset.v3d;
  if(a==='close') close3D();
  else if(a==='dae') offer(`${fname()}_SKETCHUP.dae`,toDAE(R?R.list:parts()));
  else if(a==='glb') exportGLB();
  else if(a==='png') exportPNG();
  else setView(a);
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&R) close3D();});
export {parts,toDAE};
