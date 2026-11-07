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

/* ---------- δάπεδα περιοχών: υφές (m = μέτρα που καλύπτει μία επανάληψη της υφής) ---------- */
const shade=(hex,t)=>{const c=new THREE.Color(hex); return '#'+c.offsetHSL(0,0,t).getHexString();};
const FLOOR_GEN={
  carpet:(c)=>({m:1,r:1,tex:(rnd=7,canvasTex(512,(x,s)=>{x.fillStyle=c; x.fillRect(0,0,s,s);
    for(let i=0;i<60000;i++){x.fillStyle=rand()<.5?'rgba(255,255,255,.10)':'rgba(0,0,0,.16)'; x.fillRect(rand()*s,rand()*s,1+rand()*2,1+rand()*2);}}))}),
  grass:()=>({m:1,r:.95,tex:(rnd=5,canvasTex(1024,(x,s)=>{x.fillStyle='#3F6B27'; x.fillRect(0,0,s,s);
    for(let i=0;i<45000;i++){const px=rand()*s, py=rand()*s, l=6+rand()*14, a=-Math.PI/2+(rand()-.5)*.9, g=90+rand()*90|0;
      x.strokeStyle=`rgba(${40+rand()*50|0},${g},${25+rand()*30|0},.85)`; x.lineWidth=1+rand()*1.3; x.beginPath(); x.moveTo(px,py); x.lineTo(px+Math.cos(a)*l,py+Math.sin(a)*l); x.stroke();}}))}),
  planks:(p)=>({m:2,r:.55,tex:(rnd=13,canvasTex(1024,(x,s)=>{const pw=s/10;
    for(let i=0;i<10;i++){let y=-rand()*s; while(y<s){const L=s*(.35+rand()*.45); x.fillStyle=p.c[(rand()*p.c.length)|0]; x.fillRect(i*pw,y,pw,L);
      for(let k=0;k<14;k++){x.strokeStyle=`rgba(0,0,0,${.04+rand()*.08})`; x.lineWidth=1+rand()*1.5; const gx=i*pw+rand()*pw; x.beginPath(); x.moveTo(gx,y); x.bezierCurveTo(gx+(rand()-.5)*8,y+L*.3,gx+(rand()-.5)*8,y+L*.7,gx+(rand()-.5)*6,y+L); x.stroke();}
      x.fillStyle='rgba(0,0,0,.35)'; x.fillRect(i*pw,y,pw,2); y+=L;}
      x.fillStyle='rgba(0,0,0,.35)'; x.fillRect(i*pw,0,2,s);}}))}),
  parquet:(p)=>({m:1,r:.5,tex:(rnd=17,canvasTex(1024,(x,s)=>{const q=s/4, st=q/5;
    for(let i=0;i<4;i++) for(let j=0;j<4;j++) for(let k=0;k<5;k++){x.fillStyle=shade(p.c[(i+j+k)%2],(rand()-.5)*.06);
      if((i+j)%2) x.fillRect(i*q+k*st,j*q,st-1,q-1); else x.fillRect(i*q,j*q+k*st,q-1,st-1);}}))}),
  marble:(p)=>({m:2,r:.18,tex:(rnd=23,canvasTex(1024,(x,s)=>{x.fillStyle=p.c[0]; x.fillRect(0,0,s,s);
    for(let i=0;i<26;i++){x.strokeStyle=p.c[1]; x.globalAlpha=.15+rand()*.35; x.lineWidth=.6+rand()*2.2; x.beginPath(); let px=rand()*s, py=rand()*s; x.moveTo(px,py);
      for(let k=0;k<8;k++){px+=(rand()-.3)*160; py+=(rand()-.5)*120; x.lineTo(px,py);} x.stroke();}
    x.globalAlpha=1; x.fillStyle='rgba(0,0,0,.25)'; x.fillRect(s/2,0,2,s); x.fillRect(0,s/2,s,2); x.fillRect(0,0,2,s); x.fillRect(0,0,s,2);}))}),
  concrete:(p)=>({m:3,r:.75,tex:(rnd=29,canvasTex(1024,(x,s)=>{x.fillStyle=p.c[0]; x.fillRect(0,0,s,s);
    for(let i=0;i<120;i++){const r=30+rand()*200, cx=rand()*s, cy=rand()*s, g=x.createRadialGradient(cx,cy,0,cx,cy,r), a=.04+rand()*.07;
      g.addColorStop(0,rand()<.5?`rgba(255,255,255,${a})`:`rgba(0,0,0,${a})`); g.addColorStop(1,'rgba(0,0,0,0)'); x.fillStyle=g; x.fillRect(cx-r,cy-r,2*r,2*r);}}))}),
  tiles:(p)=>({m:1,r:.6,tex:(rnd=31,canvasTex(1024,(x,s)=>{const n=Math.max(1,Math.round(100/(p.size||30))), t=s/n;
    x.fillStyle=p.c[1]; x.fillRect(0,0,s,s);
    for(let i=0;i<n;i++) for(let j=0;j<n;j++){x.fillStyle=shade(p.c[0],(rand()-.5)*.08); x.fillRect(i*t+3,j*t+3,t-6,t-6);}}))}),
  corten:(p)=>({m:2,r:.8,tex:(rnd=37,canvasTex(1024,(x,s)=>{x.fillStyle=p.c[0]; x.fillRect(0,0,s,s);
    for(let i=0;i<4000;i++){const r=2+rand()*14; x.fillStyle=rand()<.5?`rgba(60,25,8,${.08+rand()*.15})`:`rgba(200,110,50,${.05+rand()*.12})`; x.beginPath(); x.arc(rand()*s,rand()*s,r,0,7); x.fill();}
    x.fillStyle='rgba(0,0,0,.3)'; x.fillRect(s/2,0,2,s); x.fillRect(0,s/2,s,2);}))}),
  studs:(p)=>({m:.5,r:.85,tex:canvasTex(512,(x,s)=>{x.fillStyle=p.c[0]; x.fillRect(0,0,s,s); const n=8, t=s/n;
    for(let i=0;i<n;i++) for(let j=0;j<n;j++){x.fillStyle=p.c[1]; x.beginPath(); x.arc(i*t+t/2,j*t+t/2,t*.28,0,7); x.fill(); x.fillStyle='rgba(255,255,255,.12)'; x.beginPath(); x.arc(i*t+t/2-2,j*t+t/2-2,t*.12,0,7); x.fill();}})})};
const floorTexCache=new Map();
function floorMat(key){
  if(floorTexCache.has(key)) return floorTexCache.get(key);
  let g;
  if(key==='fl_grass') g=FLOOR_GEN.grass();
  else if(key.startsWith('fl_plate_')){const p=FLOOR.plates[key.slice(9)]||FLOOR.plates.lightwood; g=FLOOR_GEN[p.kind](p);}
  else g=FLOOR_GEN.carpet('#'+key.slice(10));
  const mat=new THREE.MeshStandardMaterial({map:g.tex,roughness:g.r,metalness:key.endsWith('corten')?.25:0});
  const o={mat,m:g.m}; floorTexCache.set(key,o); return o;
}

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
    spot:  std({color:'#1E1F22',metalness:.6,roughness:.35}),
    lens:  std({color:'#FFF4D6',emissive:'#FFF1CC',emissiveIntensity:2.2,roughness:.2}),
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
  if(key==='spot') return M.spot;
  if(key==='lens') return M.lens;
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
  const conc=new THREE.Mesh(new THREE.PlaneGeometry(span,span),new THREE.MeshStandardMaterial({map:concreteTex(),roughness:RD.floorRough,transparent:true,opacity:RD.floorOpacity}));
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
  R.model.children.filter(o=>o.isMesh&&o.userData.part&&!o.userData.part.floorZone).forEach(src=>{ // όχι τα περιγράμματα (LineSegments2 είναι κι αυτά Mesh)
    const p=src.userData.part, lit=isLitPart(p), keys=src.userData.keys||[];
    const mats=keys.map(k=>matFor(k,lit,M));
    const m=new THREE.Mesh(src.geometry,mats); m.castShadow=p.el!=='floor'; m.receiveShadow=true; g.add(m);
  });
  // δάπεδα περιοχών: επίπεδα με υφή σε πραγματική κλίμακα
  S.els.filter(e=>e.type==='floor').forEach((f,i)=>{
    const fm=floorMat(floorKey(f)), w=f.w/100, d=f.h/100, geo=new THREE.PlaneGeometry(w,d), uv=geo.attributes.uv;
    for(let k=0;k<uv.count;k++) uv.setXY(k,uv.getX(k)*w/fm.m+f.x/100/fm.m,uv.getY(k)*d/fm.m-f.y/100/fm.m); // συνεχής υφή μεταξύ γειτονικών περιοχών
    const m=new THREE.Mesh(geo,fm.mat); m.rotation.x=-Math.PI/2; m.position.set(f.x/100+w/2,(.4+i*.06)/100,f.y/100+d/2); m.receiveShadow=true; g.add(m);
  });
  // αλουμινένιο περιθώριο γύρω από τη μοκέτα
  const W=S.W/100, D=S.D/100, h=D3.floorH/100+.006, t=.025;
  [[W/2,-t/2,W+2*t,t],[W/2,D+t/2,W+2*t,t],[-t/2,D/2,t,D],[W+t/2,D/2,t,D]].forEach(([x,z,w,d])=>{
    const b=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),M.alu); b.position.set(x,h/2-D3.floorH/100,z); b.receiveShadow=true; g.add(b);});
  M.carpetTex.repeat.set(W*2.2,D*2.2);
  // γραφικά: σε φωτιζόμενες όψεις λάμπουν
  R.gfxGroup.children.filter(o=>o.isMesh&&o.userData.surface).forEach(src=>{
    const id=src.userData.surface.replace(/^span:/,'').split(':')[0], part=R.model.children.find(o=>o.userData.part&&o.userData.part.el===id);
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
    L.position.set(c[0]+n.x*.02,c[1]+n.y*.02,c[2]+n.z*.02);
    if(n.y<-.9) L.rotation.set(-Math.PI/2,0,0); else L.lookAt(c[0]+n.x,c[1],c[2]+n.z); // οροφή: φως προς τα κάτω
    g.add(L);
  });
  scene.add(g); return g;
}

// προβολείς: SpotLight από την κεφαλή προς το γραφικό του πλαισίου (χωρίς σκιές, για ταχύτητα)
function buildSpotLights(scene,aim){
  const g=new THREE.Group(); g.name='SPOT_LIGHTS';
  S.els.filter(e=>e.type==='spot').slice(0,RD.maxSpots).forEach(el=>{const a=aim(el), f=a.from.map(v=>v/100), t=a.to.map(v=>v/100);
    const L=new THREE.SpotLight('#FFF1D6',RD.spot,6,RD.spotAngle,RD.spotPenumbra,2);
    L.position.set(...f); L.target.position.set(...t); g.add(L,L.target);});
  scene.add(g); return g;
}

/* ---------- δημόσια API ---------- */
export function build(R,{surface,spotAim}){
  dispose(R);
  const scene=new THREE.Scene(), M=makeRMats(), ctr=R.center;
  scene.background=new THREE.Color(RD.bg); scene.fog=new THREE.Fog(RD.bg,RD.fogNear,RD.fogFar);
  const pm=new THREE.PMREMGenerator(R.renderer); scene.environment=pm.fromScene(new RoomEnvironment(),.04).texture; scene.environmentIntensity=RD.env; pm.dispose();
  scene.add(new THREE.HemisphereLight('#FFFFFF','#3A3A3A',RD.hemi));
  const sun=new THREE.DirectionalLight('#FFF3E2',RD.sun); sun.position.set(ctr.x-3,9,ctr.z+5); sun.target.position.copy(ctr);
  sun.castShadow=true; sun.shadow.mapSize.set(2048,2048); const sc=sun.shadow.camera, s=Math.max(S.W,S.D)/100/2+3;
  Object.assign(sc,{left:-s,right:s,top:s,bottom:-s,near:1,far:30}); sun.shadow.radius=4; sun.shadow.bias=-.0004; scene.add(sun,sun.target);
  buildHall(scene,ctr,M); scene.add(buildBooth(R,M)); buildPanelLights(scene,R,surface); if(spotAim) buildSpotLights(scene,spotAim);
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
