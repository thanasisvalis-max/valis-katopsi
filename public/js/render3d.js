// Φωτορεαλιστικό render του 3D (κουμπί «Render» στην προβολή 3D).
// Φορτώνει μόνο όταν ζητηθεί. Ίδια γεωμετρία με το 3D (R.model), άλλα υλικά και άλλη σκηνή:
// φωτιζόμενα πλαίσια που «ανάβουν», αλουμίνιο, μοκέτα, γυαλιστερό τσιμέντο με αντανάκλαση,
// σκιές, αίθουσα έκθεσης (κολόνες, φώτα οροφής, μαύρα περίπτερα γύρω). Όλα τοπικά, χωρίς AI/υπηρεσίες.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { RectAreaLightUniformsLib } from 'three/addons/lights/RectAreaLightUniformsLib.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

RectAreaLightUniformsLib.init();
const RD=D3.render; // ρυθμίσεις στο config.js

/* ---------- υφές από canvas (χωρίς εξωτερικές εικόνες) ---------- */
let rnd=1; const rand=()=>((rnd=(rnd*16807)%2147483647)/2147483647);
function canvasTex(size,draw,repeat){
  const c=document.createElement('canvas'); c.width=c.height=size; draw(c.getContext('2d'),size);
  const t=new THREE.CanvasTexture(c); t.colorSpace=THREE.SRGBColorSpace; t.wrapS=t.wrapT=THREE.RepeatWrapping;
  t.anisotropy=8; if(repeat) t.repeat.set(repeat,repeat); return t;
}
const carpetTex=()=>{rnd=7; return canvasTex(512,(x,s)=>{
  x.fillStyle=RD.carpet; x.fillRect(0,0,s,s);
  for(let i=0;i<60000;i++){const v=rand(); x.fillStyle=v<.5?'rgba(255,255,255,.13)':'rgba(0,0,0,.18)'; x.fillRect(rand()*s,rand()*s,1+rand()*2,1+rand()*2);}
});};
const concreteTex=()=>{rnd=11; return canvasTex(1024,(x,s)=>{
  x.fillStyle=RD.concrete; x.fillRect(0,0,s,s);
  for(let i=0;i<90;i++){const r=40+rand()*220, cx=rand()*s, cy=rand()*s, g=x.createRadialGradient(cx,cy,0,cx,cy,r);
    const a=.05+rand()*.07; g.addColorStop(0,rand()<.5?`rgba(255,255,255,${a})`:`rgba(0,0,0,${a})`); g.addColorStop(1,'rgba(0,0,0,0)');
    x.fillStyle=g; x.fillRect(cx-r,cy-r,2*r,2*r);}
  x.strokeStyle='rgba(0,0,0,.18)'; x.lineWidth=1.2; // αρμοί πλακών
  for(let k=0;k<=s;k+=s/2){x.beginPath(); x.moveTo(k,0); x.lineTo(k,s); x.moveTo(0,k); x.lineTo(s,k); x.stroke();}
},8);};

/* ---------- υλικά ---------- */
function makeRMats(){
  const std=(o)=>new THREE.MeshStandardMaterial(o);
  const carpet=carpetTex();
  return {
    glow:  std({color:'#FFFFFF',emissive:'#FFFFFF',emissiveIntensity:RD.glow,roughness:.9}),
    white: std({color:'#F4F4F2',roughness:.85}),
    alu:   std({color:'#D3D6D9',metalness:.75,roughness:.32}),
    door:  std({color:'#EDEDEA',roughness:.6}),
    melamine: std({color:'#CFCAC0',roughness:.55}),
    floor: std({map:carpet,roughness:1}),
    person:std({color:'#4A5160',roughness:.8}),
    carpetTex:carpet, extra:{}};
}
// ποια υλικά παίρνει κάθε έδρα: lit = φωτιζόμενο στοιχείο (PRF0067 με LED, προϊόντα LED)
function matFor(key,lit,M){
  if(key==='graphic') return lit?M.glow:M.white;
  if(key==='frame'||key==='alu') return M.alu;
  if(key==='door') return M.door;
  if(key==='melamine') return M.melamine;
  if(key==='floor') return M.floor;
  if(String(key).startsWith('c_')) return M.extra[key]||(M.extra[key]=new THREE.MeshStandardMaterial({color:'#'+key.slice(2),roughness:.55}));
  return M.white;
}
const isLitPart=p=>{
  if(!p||!p.el) return false;
  if(/_LED$/.test(p.name||'')) return true;
  if(p.prod){const el=S.els.find(e=>e.id===p.el); const d=el&&pdef(el); return !!(d&&!d.custom);}
  return false;
};

/* ---------- αίθουσα έκθεσης ---------- */
function buildHall(scene,ctr,M){
  const g=new THREE.Group(); g.name='HALL'; const span=RD.hall;
  // δάπεδο: αντανάκλαση (Reflector) + ημιδιάφανο τσιμέντο από πάνω
  const refl=new Reflector(new THREE.PlaneGeometry(span,span),{textureWidth:1024,textureHeight:1024,color:RD.reflect});
  refl.rotation.x=-Math.PI/2; refl.position.set(ctr.x,-D3.floorH/100-.04,ctr.z); // 4 cm κάτω: χωρίς z-fighting με το τσιμέντο g.add(refl);
  const conc=new THREE.Mesh(new THREE.PlaneGeometry(span,span),new THREE.MeshStandardMaterial({map:concreteTex(),roughness:.35,transparent:true,opacity:RD.floorOpacity}));
  conc.rotation.x=-Math.PI/2; conc.position.set(ctr.x,-D3.floorH/100-.001,ctr.z); conc.receiveShadow=true; g.add(conc);
  const ob=refl.onBeforeRender; refl.onBeforeRender=function(...a){conc.visible=false; ob.apply(this,a); conc.visible=true;};
  // οροφή με σειρές φώτων
  const ceilY=RD.ceiling;
  const ceil=new THREE.Mesh(new THREE.PlaneGeometry(span,span),new THREE.MeshStandardMaterial({color:'#2B2D30',roughness:1}));
  ceil.rotation.x=Math.PI/2; ceil.position.set(ctr.x,ceilY,ctr.z); g.add(ceil);
  const step=2.4, n=Math.floor(span/step), lamp=new THREE.InstancedMesh(new THREE.CircleGeometry(.16,16),new THREE.MeshBasicMaterial({color:'#E9E3D6'}),n*n), m4=new THREE.Matrix4(), q=new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.PI/2,0,0));
  let k=0; for(let i=0;i<n;i++) for(let j=0;j<n;j++){m4.compose(new THREE.Vector3(ctr.x-span/2+i*step,ceilY-.01,ctr.z-span/2+j*step),q,new THREE.Vector3(1,1,1)); lamp.setMatrixAt(k++,m4);}
  g.add(lamp);
  // κολόνες (όχι κοντά στο περίπτερο)
  const W=S.W/100, D=S.D/100, colGeo=new THREE.BoxGeometry(.9,ceilY,.9), colMat=new THREE.MeshStandardMaterial({color:'#D9D6CF',roughness:.75});
  const cols=[]; for(let x=-30;x<=30;x+=RD.colStep) for(let z=-30;z<=30;z+=RD.colStep){const px=ctr.x+x+RD.colStep/2, pz=ctr.z+z-RD.colStep/2;
    if(px>-4&&px<W+4&&pz>-4&&pz<D+5) continue; cols.push([px,pz]);}
  const col=new THREE.InstancedMesh(colGeo,colMat,cols.length); cols.forEach(([x,z],i)=>{m4.makeTranslation(x,ceilY/2,z); col.setMatrixAt(i,m4);}); col.castShadow=true; g.add(col);
  // μαύρα περίπτερα (pipe & drape) πίσω και στα πλάγια
  rnd=3; const booths=[]; for(let i=0;i<40&&booths.length<22;i++){const x=ctr.x+(rand()-.5)*40, z=-4-rand()*22+D*.3;
    const dx=Math.max(-4-x,0,x-W-4), dz=Math.max(-5-z,0,z-D); if(Math.hypot(dx,dz)<3||z>D*.6) continue; // μόνο πίσω/πλάγια, μακριά από το περίπτερο
    booths.push([x,z,2+rand()*3,rand()<.5]);}
  const bGeo=new THREE.BoxGeometry(1,2.5,1), bMat=new THREE.MeshStandardMaterial({color:'#121314',roughness:.9});
  const bm=new THREE.InstancedMesh(bGeo,bMat,booths.length);
  booths.forEach(([x,z,w,rot],i)=>{m4.compose(new THREE.Vector3(x,1.25,z),new THREE.Quaternion().setFromEuler(new THREE.Euler(0,rot?Math.PI/2:0,0)),new THREE.Vector3(w,1,.06)); bm.setMatrixAt(i,m4);});
  g.add(bm);
  scene.add(g); return g;
}

/* ---------- περίπτερο ---------- */
function buildBooth(R,M){
  const g=new THREE.Group(); g.name='BOOTH';
  R.model.children.filter(o=>o.isMesh&&o.userData.part).forEach(src=>{ // όχι τα περιγράμματα (LineSegments2 είναι κι αυτά Mesh)
    const p=src.userData.part, lit=isLitPart(p), keys=src.userData.keys||[];
    const mats=keys.map(k=>matFor(k,lit,M));
    const m=new THREE.Mesh(src.geometry,mats); m.castShadow=p.el!=='floor'; m.receiveShadow=true; g.add(m);
  });
  // αλουμινένιο περιθώριο γύρω από τη μοκέτα
  const W=S.W/100, D=S.D/100, h=D3.floorH/100+.006, t=.025;
  [[W/2,-t/2,W+2*t,t],[W/2,D+t/2,W+2*t,t],[-t/2,D/2,t,D],[W+t/2,D/2,t,D]].forEach(([x,z,w,d])=>{
    const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),M.alu); b.position.set(x,h/2-D3.floorH/100,z); b.receiveShadow=true; g.add(b);});
  M.carpetTex.repeat.set(W*2.2,D*2.2);
  // γραφικά: σε φωτιζόμενες όψεις λάμπουν
  R.gfxGroup.children.filter(o=>o.isMesh&&o.userData.surface).forEach(src=>{
    const id=src.userData.surface.split(':')[0], part=R.model.children.find(o=>o.userData.part&&o.userData.part.el===id);
    const lit=part&&isLitPart(part.userData.part), map=src.material.map;
    const mat=new THREE.MeshStandardMaterial({map,roughness:.85,emissive:lit?'#FFFFFF':'#000000',emissiveMap:lit?map:null,emissiveIntensity:lit?RD.glow*.85:0});
    const m=new THREE.Mesh(src.geometry,mat); m.receiveShadow=true; g.add(m); M.extra['g'+m.id]=mat;
  });
  if(R.person&&R.person.visible){const pc=R.person.clone(); pc.traverse(o=>{if(o.isLineSegments2||o.isLine) o.visible=false; else if(o.isMesh){o.material=M.person; o.castShadow=true;}}); /* πρώτα τα περιγράμματα: είναι κι αυτά Mesh */ g.add(pc);}
  return g;
}
// φως από τα φωτιζόμενα πάνελ προς τη μοκέτα (RectAreaLight στην εσωτερική όψη)
function buildPanelLights(scene,R,surface){
  const g=new THREE.Group(); g.name='PANEL_LIGHTS';
  const lits=R.model.children.filter(o=>o.isMesh&&o.userData.part&&isLitPart(o.userData.part)&&!o.userData.part.prod).map(o=>o.userData.part);
  lits.sort((a,b)=>b.len-a.len).slice(0,RD.maxPanelLights).forEach(p=>{
    const sf=surface(`${p.el}:in`); if(!sf) return;
    const c=sf.c.reduce((a,v)=>[a[0]+v[0]/4,a[1]+v[1]/4,a[2]+v[2]/4],[0,0,0]).map(v=>v/100), n=new THREE.Vector3(...sf.n).normalize();
    const L=new THREE.RectAreaLight('#FFFFFF',RD.panelLight,sf.w/100,sf.h/100*.9);
    L.position.set(c[0]+n.x*.02,c[1],c[2]+n.z*.02); L.lookAt(c[0]+n.x,c[1],c[2]+n.z); g.add(L);
  });
  scene.add(g); return g;
}

/* ---------- δημόσια API ---------- */
export function build(R,{surface}){
  dispose(R);
  const scene=new THREE.Scene(), M=makeRMats(), ctr=R.center;
  scene.background=new THREE.Color(RD.bg); scene.fog=new THREE.Fog(RD.bg,RD.fogNear,RD.fogFar);
  const pm=new THREE.PMREMGenerator(R.renderer); scene.environment=pm.fromScene(new RoomEnvironment(),.04).texture; scene.environmentIntensity=RD.env; pm.dispose();
  scene.add(new THREE.HemisphereLight('#FFFFFF','#3A3A3A',RD.hemi));
  const sun=new THREE.DirectionalLight('#FFF3E2',RD.sun); sun.position.set(ctr.x-3,9,ctr.z+5); sun.target.position.copy(ctr);
  sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); const sc=sun.shadow.camera, s=Math.max(S.W,S.D)/100/2+3;
  Object.assign(sc,{left:-s,right:s,top:s,bottom:-s,near:1,far:30}); sun.shadow.radius=4; sun.shadow.bias=-.0004; scene.add(sun,sun.target);
  buildHall(scene,ctr,M); scene.add(buildBooth(R,M)); buildPanelLights(scene,R,surface);
  const r=R.renderer, sz=r.getSize(new THREE.Vector2());
  r.shadowMap.enabled=true; r.shadowMap.type=THREE.PCFSoftShadowMap; r.toneMapping=THREE.ACESFilmicToneMapping; r.toneMappingExposure=RD.exposure;
  const composer=new EffectComposer(r); composer.setPixelRatio(r.getPixelRatio()); composer.setSize(sz.x,sz.y);
  composer.addPass(new RenderPass(scene,R.camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(sz.x,sz.y),RD.bloom,.35,RD.bloomThreshold));
  composer.addPass(new OutputPass());
  R.rs={scene,composer,M};
}
export function resize(R,w,h){ if(R.rs){R.rs.composer.setPixelRatio(R.renderer.getPixelRatio()); R.rs.composer.setSize(w,h);} }
export function render(R){ R.rs.composer.render(); }
export function dispose(R){
  if(!R.rs) return;
  R.rs.scene.traverse(o=>{ if(o.geometry&&!R.model.children.includes(o)&&o.parent&&o.parent.name!=='BOOTH') o.geometry.dispose(); });
  Object.values(R.rs.M).forEach(m=>m&&m.isMaterial&&m.dispose()); Object.values(R.rs.M.extra).forEach(m=>m.dispose());
  R.rs.composer.dispose&&R.rs.composer.dispose(); R.rs=null;
  R.renderer.toneMapping=THREE.NoToneMapping; R.renderer.toneMappingExposure=1;
}
// εικόνα υψηλής ανάλυσης: μεγαλύτερη πλευρά ≈ RD.exportPx
export function snapshot(R){
  return new Promise(res=>{
    const r=R.renderer, sz=r.getSize(new THREE.Vector2()), pr0=r.getPixelRatio(), pr=Math.min(4,RD.exportPx/Math.max(sz.x,sz.y));
    r.setPixelRatio(pr); resize(R,sz.x,sz.y); R.rs.composer.render();
    r.domElement.toBlob(b=>{r.setPixelRatio(pr0); resize(R,sz.x,sz.y); res(b);},'image/png');
  });
}
