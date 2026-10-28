// Σχεδιαστής Κάτοψης Valis Frames: λογική εφαρμογής.
// Οι κανόνες και τα στοιχεία βρίσκονται στο js/config.js. Δες CLAUDE.md για την αρχιτεκτονική.
let K=1, DC='#2E73A8'; const FS0=7.5;
const isProf=e=>e&&(e.type==='p67'||e.type==='p68');
const $=id=>document.getElementById(id);
const n=v=>Math.round(v*1000)/1000;
const fmtDim=v=>v.toFixed(2).replace('.',',')+' cm';
const fmt=v=>(Math.round(v*10)/10).toString().replace('.',',');
const lit=e=>e.type==='p67'&&e.led!==false;

/* ---------- project state ---------- */
const LS='valis-booth-v2';
function blank(){return {name:'Νέα κάτοψη',W:600,D:400,H:250,mod:100,mode:'end',snap:5,magnet:true,overall:true,scale:10,els:[],nid:1};}
function sample(){
  const P=(type,x,y,len,dir,dim,led=true,role)=>({type,x,y,len,dir,dim,led,role});
  const els=[
    {type:'store',x:0,y:0,w:200,h:130},
    P('p68',0,5,125,'v','a',false), P('p68',5,0,195,'h','a',false),
    P('p67',200,0,400,'h','b'), P('p67',600,0,395,'h','b'),
    P('p67',15,115,185,'h','b'), P('p67',0,130,265,'v','b'), P('p67',0,395,200,'v','b'),
    P('p68',0,595,50,'h','b',false,'return'), P('p68',995,0,50,'v','b',false,'return'),
    {type:'door',x:195,y:10,rot:270,flip:false}];
  els.forEach((e,i)=>e.id='e'+(i+1));
  return {name:'ATHANASIADIS · Thessaloniki Tuning Show',W:1000,D:600,H:250,mod:100,mode:'end',snap:5,magnet:true,overall:false,scale:10,els,nid:els.length+1};
}
let S=null; try{S=JSON.parse(localStorage.getItem(LS)||localStorage.getItem('valis-booth-v1'))}catch(e){S=null}
S=(S&&Array.isArray(S.els))?{...blank(),...S}:sample();
let sel=null, tool='select', hist=[], last=JSON.stringify(S), drag=null, drawing=null, pan=null, guides=null, ISS=[];
function persist(){try{localStorage.setItem(LS,JSON.stringify(S))}catch(e){}}
function commit(){const now=JSON.stringify(S); if(now!==last){hist.push(last); if(hist.length>80)hist.shift(); last=now;} persist();}
function undo(){if(!hist.length)return; S=JSON.parse(hist.pop()); last=JSON.stringify(S); if(!S.els.some(e=>e.id===sel))sel=null; persist(); renderAll();}
const newId=()=>'e'+(S.nid++);
const snapV=v=>Math.round(v/S.snap)*S.snap;
const byId=id=>S.els.find(e=>e.id===id);

function segs(total,mod,mode){
  const k=Math.floor(total/mod), r=Math.round((total-k*mod)*10)/10;
  let a=Array(k).fill(mod);
  if(r>0){ if(mode==='start') a.unshift(r); else if(mode==='split'&&k>0) a=[r/2,...a,r/2]; else a.push(r); }
  return a.length?a:[total];
}

/* ---------- geometry ---------- */
const mul=(A,B)=>[A[0]*B[0]+A[2]*B[1],A[1]*B[0]+A[3]*B[1],A[0]*B[2]+A[2]*B[3],A[1]*B[2]+A[3]*B[3],A[0]*B[4]+A[2]*B[5]+A[4],A[1]*B[4]+A[3]*B[5]+A[5]];
const ROT={0:[1,0,0,1,0,0],90:[0,1,-1,0,0,0],180:[-1,0,0,-1,0,0],270:[0,-1,1,0,0,0]};
function symMatrix(el){
  const [w,h]=SYMBOX[el.type];
  let m=el.flip?[-1,0,0,1,w,0]:[1,0,0,1,0,0];
  m=mul(ROT[el.rot||0],m);
  const pts=[[0,0],[w,0],[0,h],[w,h]].map(([x,y])=>[m[0]*x+m[2]*y+m[4],m[1]*x+m[3]*y+m[5]]);
  const mx=Math.min(...pts.map(p=>p[0])), my=Math.min(...pts.map(p=>p[1]));
  m[4]+=el.x-mx; m[5]+=el.y-my;
  return {m,w:Math.max(...pts.map(p=>p[0]))-mx,h:Math.max(...pts.map(p=>p[1]))-my};
}
function bbox(el){
  if(isProf(el)){const t=PROF[el.type].t; return el.dir==='h'?{x:el.x,y:el.y,w:el.len,h:t}:{x:el.x,y:el.y,w:t,h:el.len};}
  if(el.type==='store') return {x:el.x,y:el.y,w:el.w,h:el.h};
  const s=symMatrix(el); return {x:el.x,y:el.y,w:s.w,h:s.h};
}
const hit=(a,b)=>a.x<b.x+b.w&&b.x<a.x+a.w&&a.y<b.y+b.h&&b.y<a.y+a.h;
const solids=ex=>S.els.filter(e=>e.type!=='store'&&e.id!==ex);
function rotateEl(el){
  const b=bbox(el), cx=b.x+b.w/2, cy=b.y+b.h/2;
  if(isProf(el)) el.dir=el.dir==='h'?'v':'h';
  else if(el.type==='store') [el.w,el.h]=[el.h,el.w];
  else el.rot=((el.rot||0)+90)%360;
  const nb=bbox(el); el.x=n(cx-nb.w/2); el.y=n(cy-nb.h/2);
}

/* ---------- rules ---------- */
function endRegion(el,end){
  const t=PROF[el.type].t;
  if(el.dir==='h'){const x=end==='start'?el.x:el.x+el.len; return {x:x-1,y:el.y-1,w:2,h:t+2};}
  const y=end==='start'?el.y:el.y+el.len; return {x:el.x-1,y:y-1,w:t+2,h:2};
}
function freeEnds(el){
  if(!isProf(el)||el.role==='return'||el.len<=SHORT) return [];
  const others=solids(el.id).map(bbox);
  return ['start','end'].filter(end=>!(el.okEnds&&el.okEnds[end])&&!others.some(b=>hit(endRegion(el,end),b)));
}
function storeBackSides(st){
  const s=[], tol=2;
  if(st.y<=tol) s.push({ax:'h',c:0,a:st.x,b:st.x+st.w,in:1});
  if(st.y+st.h>=S.D-tol) s.push({ax:'h',c:S.D,a:st.x,b:st.x+st.w,in:-1});
  if(st.x<=tol) s.push({ax:'v',c:0,a:st.y,b:st.y+st.h,in:1});
  if(st.x+st.w>=S.W-tol) s.push({ax:'v',c:S.W,a:st.y,b:st.y+st.h,in:-1});
  return s;
}
function onStoreBack(p){
  if(!isProf(p)) return false;
  const b=bbox(p);
  return S.els.filter(e=>e.type==='store').some(st=>storeBackSides(st).some(sd=>{
    if(sd.ax==='h'){ if(p.dir!=='h') return false;
      const inBand=sd.in>0?(b.y>=sd.c-2&&b.y<=sd.c+20):(b.y+b.h<=sd.c+2&&b.y+b.h>=sd.c-20);
      return inBand&&Math.min(b.x+b.w,sd.b)-Math.max(b.x,sd.a)>10; }
    if(p.dir!=='v') return false;
    const inBand=sd.in>0?(b.x>=sd.c-2&&b.x<=sd.c+20):(b.x+b.w<=sd.c+2&&b.x+b.w>=sd.c-20);
    return inBand&&Math.min(b.y+b.h,sd.b)-Math.max(b.y,sd.a)>10;}));
}
const endName=(el,end)=>el.dir==='h'?(end==='start'?'αριστερή':'δεξιά'):(end==='start'?'πάνω':'κάτω');
function computeIssues(){
  const out=[];
  S.els.filter(isProf).forEach(el=>{
    const code=PROF[el.type].code;
    if(el.type==='p67'&&el.len>WARN67&&!el.keepWhole){const k=Math.ceil(el.len/MAX67), part=fmt(el.len/k);
      out.push({sev:'warn',id:el.id,kind:'long',msg:`Μονοκόμματο πλαίσιο ${code} ${fmt(el.len)} cm. Προτείνεται χωρισμός σε ${k} × ${part} cm, γιατί στήνεται πιο εύκολα.`,fixes:[[`Χωρισμός σε ${k} × ${part}`,'split'],['Κράτα μονοκόμματο','keep']]});}
    if(lit(el)&&onStoreBack(el))
      out.push({sev:'err',id:el.id,kind:'back',msg:`Πίσω πλευρά αποθήκης με φωτιζόμενο πλαίσιο (${code} ${fmt(el.len)} cm). Η πίσω πλευρά της αποθήκης γίνεται πάντα με μη φωτιζόμενα πλαίσια.`,fixes:[['Αλλαγή σε 4,5 cm','to68'],['Κράτα 15 cm χωρίς LED','unlit']]});
    freeEnds(el).forEach(end=>out.push({sev:'warn',id:el.id,end,kind:'free',msg:`Ελεύθερη ${endName(el,end)} άκρη στο ${code} ${fmt(el.len)} cm. Για καλύτερη στήριξη βάλε γύρισμα.`,fixes:[['Γύρισμα 15 cm','ret67'],['Γύρισμα 4,5 cm','ret68'],['Δεν χρειάζεται','okend']]}));
  });
  return out;
}
function splitEl(el){
  const k=Math.ceil(el.len/MAX67); if(k<2) return [el.id];
  const base=Math.floor(el.len/k/S.snap)*S.snap, ids=[el.id], total=el.len;
  el.len=base; let off=base;
  for(let i=1;i<k;i++){const len=i===k-1?n(total-base*(k-1)):base;
    const c={...el,id:newId(),len,okEnds:undefined}; if(el.dir==='h')c.x=n(el.x+off); else c.y=n(el.y+off);
    S.els.push(c); ids.push(c.id); off+=len;}
  return ids;
}
function enforce(el){
  // rule 1: storage back side never lit; rule 2: suggest splitting one-piece PRF0067 over 500 cm
  const msgs=[];
  if(isProf(el)&&onStoreBack(el)&&lit(el)){el.type='p68';el.led=false;msgs.push('Πίσω πλευρά αποθήκης: μπήκε μη φωτιζόμενο προφίλ 4,5 cm.');}
  if(el.type==='p67'&&el.len>WARN67&&!el.keepWhole){const k=Math.ceil(el.len/MAX67); msgs.push(`Μονοκόμματο ${fmt(el.len)} cm: προτείνεται χωρισμός σε ${k} πλαίσια για πιο εύκολο στήσιμο. Δες τον Έλεγχο κανόνων.`);}
  if(msgs.length) toast(msgs.join(' '));
}
function addReturn(el,end,type){
  const t=PROF[el.type].t, tr=PROF[type].t, r={id:newId(),type,len:RET,led:false,role:'return'};
  if(el.dir==='v'){
    const inward=(el.x+t/2)<S.W/2?1:-1;
    if(end==='end'){ if(el.y+el.len+tr>S.D+.01) el.len=n(el.len-tr); r.y=n(el.y+el.len); r.dim='b'; }
    else { if(el.y-tr<-.01){el.y=n(el.y+tr);el.len=n(el.len-tr);} r.y=n(el.y-tr); r.dim='a'; }
    r.dir='h'; r.x=inward>0?el.x:n(el.x+t-RET);
  } else {
    const inward=(el.y+t/2)<S.D/2?1:-1;
    if(end==='end'){ if(el.x+el.len+tr>S.W+.01) el.len=n(el.len-tr); r.x=n(el.x+el.len); r.dim='b'; }
    else { if(el.x-tr<-.01){el.x=n(el.x+tr);el.len=n(el.len-tr);} r.x=n(el.x-tr); r.dim='a'; }
    r.dir='v'; r.y=inward>0?el.y:n(el.y+t-RET);
  }
  S.els.push(r); return r;
}
function applyFix(i){
  const is=ISS[i]; if(!is) return; const el=byId(is.id); if(!el) return; const f=is.fixes[is.pick][1];
  if(f==='split'){const ids=splitEl(el); toast(`Χωρίστηκε σε ${ids.length} πλαίσια.`);}
  if(f==='to68'){el.type='p68';el.led=false;}
  if(f==='unlit') el.led=false;
  if(f==='ret67'||f==='ret68'){const r=addReturn(el,is.end,f==='ret67'?'p67':'p68'); sel=r.id; toast('Μπήκε γύρισμα 50 cm. Μπορείς να αλλάξεις μήκος από τα στοιχεία.');}
  if(f==='keep'){el.keepWhole=true; toast(`Το πλαίσιο ${fmt(el.len)} cm μένει μονοκόμματο.`);}
  if(f==='okend'){el.okEnds={...(el.okEnds||{}),[is.end]:true};}
  commit(); renderAll();
}

/* ---------- painters ---------- */
function svgPainter(inline){
  let o='';
  const a=(f,s,w)=>`fill="${f||'none'}" stroke="${s||'none'}" stroke-width="${s?n(w):0}"`;
  return {
    rect(x,y,w,h,f,s,sw,ex=''){o+=`<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}" ${a(f,s,sw)}${ex}/>`;},
    line(x1,y1,x2,y2,s,sw){o+=`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" ${a(null,s,sw)}/>`;},
    pline(p,s,sw){o+=`<polyline points="${p.map(q=>n(q[0])+','+n(q[1])).join(' ')}" fill="none" stroke="${s}" stroke-width="${n(sw)}" stroke-linecap="round" stroke-linejoin="round"/>`;},
    poly(p,f){o+=`<polygon points="${p.map(q=>n(q[0])+','+n(q[1])).join(' ')}" fill="${f}"/>`;},
    sym(name,m){
      if(inline) o+=`<g transform="matrix(${m.map(n).join(' ')})">`+SYM[name].map(p=>`<path d="${p.d}" ${a(p.f,p.s,p.w)}/>`).join('')+'</g>';
      else o+=`<use href="#sym-${name}" transform="matrix(${m.map(n).join(' ')})"/>`;},
    text(x,y,t,size,f,rot){o+=`<text x="${n(x)}" y="${n(y)}" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${n(size)}" fill="${f}" text-anchor="middle" dominant-baseline="central"${rot?` transform="rotate(-90 ${n(x)} ${n(y)})"`:''}>${t}</text>`;},
    raw(s){o+=s;},
    begin(id,b){o+=`<g data-id="${id}" class="el"><rect x="${n(b.x-3)}" y="${n(b.y-3)}" width="${n(b.w+6)}" height="${n(b.h+6)}" fill="transparent"/>`;},
    end(){o+='</g>';},
    out:()=>o};
}
const HW={'0':.556,'1':.556,'2':.556,'3':.556,'4':.556,'5':.556,'6':.556,'7':.556,'8':.556,'9':.556,',':.278,' ':.278,'c':.556,'m':.889};
const textW=(t,size)=>[...t].reduce((s,ch)=>s+(HW[ch]||.6),0)*size;
function pdfPainter(){
  let o='';
  const rgb=h=>{h=h.replace('#','');return [0,2,4].map(i=>(parseInt(h.substr(i,2),16)/255).toFixed(3)).join(' ');};
  const paint=(f,s,sw)=>{let c='';if(f&&f!=='none')c+=rgb(f)+' rg ';if(s)c+=rgb(s)+' RG '+n(sw)+' w ';return [c,(f&&f!=='none')?(s?'B':'f'):'S'];};
  return {
    rect(x,y,w,h,f,s,sw){const [c,op]=paint(f,s,sw);o+=`${c}${n(x)} ${n(y)} ${n(w)} ${n(h)} re ${op}\n`;},
    line(x1,y1,x2,y2,s,sw){o+=`${rgb(s)} RG ${n(sw)} w ${n(x1)} ${n(y1)} m ${n(x2)} ${n(y2)} l S\n`;},
    pline(p,s,sw){o+=`${rgb(s)} RG ${n(sw)} w 1 J ${p.map((q,i)=>`${n(q[0])} ${n(q[1])} ${i?'l':'m'}`).join(' ')} S 0 J\n`;},
    poly(p,f){o+=`${rgb(f)} rg ${p.map((q,i)=>`${n(q[0])} ${n(q[1])} ${i?'l':'m'}`).join(' ')} h f\n`;},
    sym(name,m){o+=`q ${m.map(n).join(' ')} cm\n`;SYM[name].forEach(p=>{const [c,op]=paint(p.f,p.s,p.w);o+=`${c}${p.p} ${op}\n`;});o+='Q\n';},
    text(x,y,t,size,f,rot){const w=textW(t,size);
      o+=rot?`BT /F1 ${n(size)} Tf ${rgb(f)} rg 0 -1 -1 0 ${n(x+size*.35)} ${n(y+w/2)} Tm (${t}) Tj ET\n`
            :`BT /F1 ${n(size)} Tf ${rgb(f)} rg 1 0 0 -1 ${n(x-w/2)} ${n(y+size*.35)} Tm (${t}) Tj ET\n`;},
    raw(){},begin(){},end(){},out:()=>o};
}
/* stroke lettering so the Greek label prints in any PDF viewer */
const ell=(cx,cy,rx,ry)=>Array.from({length:25},(_,i)=>[cx+rx*Math.cos(i/24*2*Math.PI),cy+ry*Math.sin(i/24*2*Math.PI)]);
const GL={'Α':[[[0,1],[.35,0],[.7,1]],[[.13,.62],[.57,.62]]],'Π':[[[0,1],[0,0],[.7,0],[.7,1]]],'Ο':[ell(.35,.5,.35,.5)],
  'Θ':[ell(.35,.5,.35,.5),[[.17,.5],[.53,.5]]],'Η':[[[0,0],[0,1]],[[.7,0],[.7,1]],[[0,.5],[.7,.5]]],'Κ':[[[0,0],[0,1]],[[.68,0],[.03,.58]],[[.25,.4],[.7,1]]]};
function strokeText(P,cx,cy,str,h,col){
  const adv=.98, tw=(str.length*adv-.28)*h; let x0=cx-tw/2; const y0=cy-h/2;
  [...str].forEach((ch,i)=>(GL[ch]||[]).forEach(s=>P.pline(s.map(([x,y])=>[x0+i*adv*h+x*h,y0+y*h]),col,h*.1)));
}

/* ---------- drawing ---------- */
function drawProfile(P,el){
  PROF[el.type].strips.forEach(([a,b,dark])=>{
    const ins=dark?1:0;
    if(el.dir==='h') P.rect(el.x+ins,el.y+a,el.len-2*ins,b-a,dark?C.Dk:C.L,C.S,.25);
    else P.rect(el.x+a,el.y+ins,b-a,el.len-2*ins,dark?C.Dk:C.L,C.S,.25);
  });
}
function drawEl(P,el){ if(isProf(el)) drawProfile(P,el); else P.sym(el.type,symMatrix(el).m); }
function drawStore(P,st,preview){
  if(preview) P.rect(st.x,st.y,st.w,st.h,'#EEF3FB','#8C98A6',.6,' stroke-dasharray="4 3" vector-effect="non-scaling-stroke"');
  const h=Math.max(6,Math.min(14,st.w/7.5,st.h/2.5));
  strokeText(P,st.x+st.w/2,st.y+st.h/2,'ΑΠΟΘΗΚΗ',h,C.store);
}
const arrow=(P,tx,ty,dx,dy)=>{const L=3.7*K,A=1*K;P.poly([[tx,ty],[tx+dx*L-dy*A,ty+dy*L-dx*A],[tx+dx*L+dy*A,ty+dy*L+dx*A]],DC);};
function dimH(P,xa,xb,dl,e0,out,label){
  const FS=FS0*K, sw=.15*K, e1=dl+out*2.5*K, w=textW(label,FS), cx=(xa+xb)/2, fits=xb-xa>w+12*K;
  P.line(xa,e0,xa,e1,DC,sw); P.line(xb,e0,xb,e1,DC,sw);
  if(fits){P.line(xa,dl,cx-w/2-1.5*K,dl,DC,sw);P.line(cx+w/2+1.5*K,dl,xb,dl,DC,sw);P.text(cx,dl,label,FS,DC,false);}
  else{P.line(xa,dl,xb,dl,DC,sw);P.text(cx,dl+out*FS*.95,label,FS,DC,false);}
  arrow(P,xa,dl,1,0); arrow(P,xb,dl,-1,0);
}
function dimV(P,ya,yb,dl,e0,out,label){
  const FS=FS0*K, sw=.15*K, e1=dl+out*2.5*K, w=textW(label,FS), cy=(ya+yb)/2, fits=yb-ya>w+12*K;
  P.line(e0,ya,e1,ya,DC,sw); P.line(e0,yb,e1,yb,DC,sw);
  if(fits){P.line(dl,ya,dl,cy-w/2-1.5*K,DC,sw);P.line(dl,cy+w/2+1.5*K,dl,yb,DC,sw);P.text(dl,cy,label,FS,DC,true);}
  else{P.line(dl,ya,dl,yb,DC,sw);P.text(dl+out*FS*.95,cy,label,FS,DC,true);}
  arrow(P,dl,ya,0,1); arrow(P,dl,yb,0,-1);
}
function drawDim(P,el){
  if(!isProf(el)||el.dim==='none') return;
  const t=PROF[el.type].t, out=el.dim==='a'?-1:1, lab=fmtDim(el.len), off=8*K, ins=3;
  if(el.dir==='h'){const edge=out<0?el.y:el.y+t; dimH(P,el.x,el.x+el.len,edge+out*off,edge-out*ins,out,lab);}
  else{const edge=out<0?el.x:el.x+t; dimV(P,el.y,el.y+el.len,edge+out*off,edge-out*ins,out,lab);}
}
function drawPlan(P,o){
  const {W,D,mod,mode}=S, cols=segs(W,mod,mode), rows=segs(D,mod,mode);
  let y=0; rows.forEach(rh=>{let x=0; cols.forEach(cw=>{
    const part=o.preview&&(cw!==mod||rh!==mod);
    P.rect(x,y,cw,rh,part?'#F6F1E2':null,C.grid,.2); x+=cw;}); y+=rh;});
  S.els.filter(e=>e.type==='store').forEach(st=>{P.begin(st.id,bbox(st));drawStore(P,st,o.preview);P.end();});
  if(S.overall){dimH(P,0,W,-34*K,-3,-1,fmtDim(W)); dimV(P,0,D,-34*K,-3,-1,fmtDim(D));}
  const order={p67:0,p68:1,door:2,conn:3};
  S.els.filter(e=>e.type!=='store').sort((a,b)=>order[a.type]-order[b.type]).forEach(el=>{P.begin(el.id,bbox(el));drawEl(P,el);P.end();});
  S.els.forEach(el=>drawDim(P,el));
  if(o.ghost){P.raw('<g opacity=".55" pointer-events="none">'); if(o.ghost.type==='store')drawStore(P,o.ghost,true); else {drawEl(P,o.ghost);drawDim(P,o.ghost);} P.raw('</g>');}
  if(!o.preview) return;
  // rule markers
  computeIssues().forEach(is=>{const el=byId(is.id); if(!el)return; const b=bbox(el);
    if(is.kind==='free'){const r=endRegion(el,is.end); P.raw(`<circle cx="${n(r.x+r.w/2)}" cy="${n(r.y+r.h/2)}" r="${n(5*K)}" fill="none" stroke="${C.warn}" stroke-width="2.5" vector-effect="non-scaling-stroke" pointer-events="none"/>`);}
    else P.raw(`<rect x="${n(b.x-2)}" y="${n(b.y-2)}" width="${n(b.w+4)}" height="${n(b.h+4)}" fill="none" stroke="${C.err}" stroke-width="2" stroke-dasharray="3 3" vector-effect="non-scaling-stroke" pointer-events="none"/>`);});
  if(guides){const g='stroke="#E0457B" stroke-width="1.2" stroke-dasharray="5 4" vector-effect="non-scaling-stroke" pointer-events="none"';
    if(guides.x!=null) P.raw(`<line x1="${n(guides.x)}" y1="-40" x2="${n(guides.x)}" y2="${S.D+40}" ${g}/>`);
    if(guides.y!=null) P.raw(`<line x1="-40" y1="${n(guides.y)}" x2="${S.W+40}" y2="${n(guides.y)}" ${g}/>`);}
  const el=byId(sel); if(el){const b=bbox(el), r=6*K, hx=b.x+b.w+r*1.4, hy=b.y-r*1.4;
    P.raw(`<rect x="${n(b.x-4)}" y="${n(b.y-4)}" width="${n(b.w+8)}" height="${n(b.h+8)}" fill="none" stroke="${C.acc}" stroke-width="2" stroke-dasharray="6 4" vector-effect="non-scaling-stroke" pointer-events="none"/>`);
    P.raw(`<g data-handle="rot" style="cursor:pointer"><title>Περιστροφή 90°</title><circle cx="${n(hx)}" cy="${n(hy)}" r="${n(r)}" fill="#FFFFFF" stroke="${C.acc}" stroke-width="2" vector-effect="non-scaling-stroke"/><path d="M${n(hx+r*.5)} ${n(hy-r*.05)} A ${n(r*.5)} ${n(r*.5)} 0 1 1 ${n(hx+r*.15)} ${n(hy-r*.47)}" fill="none" stroke="${C.acc}" stroke-width="2" vector-effect="non-scaling-stroke"/><path d="M${n(hx+r*.1)} ${n(hy-r*.75)} L${n(hx+r*.42)} ${n(hy-r*.45)} L${n(hx+r*.02)} ${n(hy-r*.2)}" fill="none" stroke="${C.acc}" stroke-width="2" vector-effect="non-scaling-stroke"/></g>`);}
}

$('hset').innerHTML=HEIGHTS.map(v=>`<button data-v="${v}">${v}</button>`).join('');

/* ---------- render ---------- */
const svg=$('plan');
const DEFS='<defs>'+['door','conn'].map(k=>`<g id="sym-${k}">`+SYM[k].map(p=>`<path d="${p.d}" fill="${p.f||'none'}" stroke="${p.s||'none'}" stroke-width="${p.s?p.w:0}"/>`).join('')+'</g>').join('')+'</defs>';
let Z={z:1,cx:null,cy:null};
function fitBox(){const m=(S.overall?62:42)*K; return {x:-m,y:-m,w:S.W+2*m,h:S.D+2*m};}
function renderPlan(ghost){
  const cw=svg.clientWidth||900, ch=svg.clientHeight||600;
  const base=Math.min(cw/(S.W+100),ch/(S.D+100));
  K=Math.max(1,14/(FS0*base)); DC='#1C5C93';
  const f=fitBox(), sc=Math.min(cw/f.w,ch/f.h)*Z.z, vw=cw/sc, vh=ch/sc;
  if(Z.cx===null||Z.z===1){Z.cx=f.x+f.w/2;Z.cy=f.y+f.h/2;}
  svg.setAttribute('viewBox',`${n(Z.cx-vw/2)} ${n(Z.cy-vh/2)} ${n(vw)} ${n(vh)}`);
  const P=svgPainter(false); drawPlan(P,{preview:true,ghost}); svg.innerHTML=DEFS+P.out();
  K=1; DC='#2E73A8';
  svg.classList.toggle('draw',tool!=='select');
}
const HINTS={select:'Πάτα ένα στοιχείο για να το επιλέξεις, σύρε για μετακίνηση. Το κυκλάκι πάνω δεξιά το περιστρέφει.',
  p67:'Σύρε για να σχεδιάσεις τοίχο. Πλαίσια έως 500 cm είναι εντάξει. Για μονοκόμματο 600 cm θα σου προταθεί χωρισμός σε 2 × 300.',
  p68:'Σύρε για να σχεδιάσεις τοίχο. Οι άκρες κολλάνε με μαγνήτη στα διπλανά πλαίσια.',
  door:'Κλικ στο σημείο της πόρτας. Γύρισέ τη με R ή άλλαξε πλευρά με F.',
  conn:'Κλικ στο σημείο ένωσης των προφίλ.',
  store:'Σύρε ένα ορθογώνιο πάνω στην περιοχή της αποθήκης. Οι πλευρές της που πέφτουν στο όριο του περιπτέρου είναι η πίσω πλευρά.'};
function renderTools(){
  document.querySelectorAll('#tools .tool').forEach(b=>b.setAttribute('aria-pressed',b.dataset.t===tool));
  $('hint').textContent=HINTS[tool];
}
function renderBooth(){
  $('name').value=S.name; $('W').value=S.W; $('D').value=S.D; $('H').value=S.H;
  $('overall').checked=!!S.overall; $('magnet').checked=S.magnet!==false; $('scale').value=S.scale||10;
  [['mod',S.mod],['mode',S.mode],['snap',S.snap],['hset',S.H]].forEach(([id,v])=>document.querySelectorAll(`#${id} button`).forEach(b=>b.setAttribute('aria-pressed',b.dataset.v==String(v))));
  $('undo').disabled=!hist.length;
}
function bomRows(){
  const g={};
  S.els.forEach(e=>{let key,code,desc,len='';
    if(e.type==='store') return;
    if(isProf(e)){code=PROF[e.type].code; len=e.len;
      desc=e.type==='p67'?(lit(e)?'15 cm με LED':'15 cm χωρίς LED'):'4,5 cm χωρίς LED'; key=code+desc+len;}
    else if(e.type==='door'){code='DOOR';desc='Πόρτα';key='door';}
    else {code='CONN';desc='Σύνδεσμος προφίλ';key='conn';}
    g[key]=g[key]||{code,desc,len,qty:0}; g[key].qty++;});
  return Object.values(g).sort((a,b)=>a.code.localeCompare(b.code)||a.desc.localeCompare(b.desc)||(b.len||0)-(a.len||0));
}
function renderBom(){
  const rows=bomRows();
  if(!rows.length){$('bom').innerHTML='<div class="empty">Δεν υπάρχουν ακόμη στοιχεία στην κάτοψη.</div>';return;}
  const m=t=>fmt(S.els.filter(e=>e.type===t).reduce((s,e)=>s+e.len,0)/100);
  $('bom').innerHTML=`<p class="note">Ύψος πλαισίων: <b>${fmt(S.H)} cm</b></p><table><thead><tr><th>Κωδικός</th><th class="n">Πλαίσιο</th><th class="n">Τεμ.</th></tr></thead><tbody>`+
    rows.map(r=>`<tr><td><span class="code">${r.code}</span>${r.code==='PRF0067'?`<span class="pill${r.desc.includes('χωρίς')?' off':''}">${r.desc.includes('χωρίς')?'ΧΩΡΙΣ LED':'LED'}</span>`:''}<br><small style="color:var(--mute)">${r.desc}</small></td><td class="n">${r.len!==''?`${fmt(r.len)} × ${fmt(S.H)}`:'–'}</td><td class="n">${r.qty}</td></tr>`).join('')+
    `<tr class="tot"><td>Σύνολο PRF0067</td><td class="n">${m('p67')} m</td><td></td></tr><tr class="tot"><td>Σύνολο PRF0068</td><td class="n">${m('p68')} m</td><td></td></tr></tbody></table>`;
}
function renderRules(){
  ISS=computeIssues(); ISS.forEach(i=>i.pick=0);
  $('icount').textContent=ISS.length; $('icount').classList.toggle('zero',!ISS.length);
  $('rules').innerHTML=ISS.length?ISS.map((is,i)=>`<div class="issue ${is.sev}"><p data-goto="${is.id}">${is.msg}</p><div class="seg">${is.fixes.map((f,j)=>`<button data-fix="${i}" data-pick="${j}">${f[0]}</button>`).join('')}</div></div>`).join('')
    :'<div class="ok">Όλα εντάξει: γυρίσματα στις άκρες, μη φωτιζόμενη πίσω πλευρά αποθήκης, κανένα μονοκόμματο πλαίσιο πάνω από 500 cm χωρίς έγκριση.</div>';
}
function renderInspector(){
  const el=byId(sel), box=$('insp');
  if(!el){box.innerHTML=`<div class="lbl">Επιλεγμένο στοιχείο</div><div class="empty">Τίποτα επιλεγμένο. Πάτα ένα πλαίσιο, πόρτα, σύνδεσμο ή αποθήκη για να αλλάξεις μήκος, θέση και διάσταση.</div>`;return;}
  const xy=`<div class="row"><label class="field"><span>X (cm)</span><input id="i-x" type="number" step="${S.snap}" value="${n(el.x)}"></label><label class="field"><span>Y (cm)</span><input id="i-y" type="number" step="${S.snap}" value="${n(el.y)}"></label></div>`;
  const acts=`<div class="seg"><button data-act="rot">Περιστροφή 90°</button><button data-act="dup">Αντίγραφο</button><button data-act="del">Διαγραφή</button></div>`;
  let h='';
  if(isProf(el)){
    const pr=PROF[el.type], H=el.dir==='h', back=onStoreBack(el);
    h=`<div class="selhead"><b>${pr.name}${el.role==='return'?' · γύρισμα':''}</b><span class="code">${pr.code}</span></div>
    <div class="frame">Πλαίσιο ${fmt(el.len)} × ${fmt(S.H)} cm</div>
    <div class="row"><label class="field"><span>Μήκος πλαισίου (cm)</span><input id="i-len" type="number" min="5" step="${S.snap}" value="${n(el.len)}"></label>
    <label class="field"><span>Τύπος</span><select id="i-type"><option value="p67"${el.type==='p67'?' selected':''}>PRF0067 · 15 cm</option><option value="p68"${el.type==='p68'?' selected':''}>PRF0068 · 4,5 cm</option></select></label></div>
    ${el.type==='p67'&&el.len>WARN67?`<label class="check"><input type="checkbox" id="i-keep"${el.keepWhole?' checked':''}> Μονοκόμματο πλαίσιο (χωρίς πρόταση χωρισμού)</label>`:''}
    ${xy}
    <div class="lbl">Διάσταση</div><div class="seg"><button data-act="dim" data-v="a" aria-pressed="${el.dim==='a'}">${H?'Πάνω':'Αριστερά'}</button><button data-act="dim" data-v="b" aria-pressed="${el.dim==='b'}">${H?'Κάτω':'Δεξιά'}</button><button data-act="dim" data-v="none" aria-pressed="${el.dim==='none'}">Καμία</button></div>
    ${el.type==='p67'?`<label class="check"><input type="checkbox" id="i-led"${lit(el)?' checked':''}${back?' disabled':''}> Με φωτισμό LED</label>${back?'<p class="note">Πίσω πλευρά αποθήκης: μόνο μη φωτιζόμενο.</p>':''}`:''}
    ${acts}`;
  } else if(el.type==='store'){
    h=`<div class="selhead"><b>Αποθήκη</b><span class="code">ΠΕΡΙΟΧΗ</span></div>
    ${xy}
    <div class="row"><label class="field"><span>Πλάτος (cm)</span><input id="i-w" type="number" min="20" step="${S.snap}" value="${n(el.w)}"></label><label class="field"><span>Βάθος (cm)</span><input id="i-h" type="number" min="20" step="${S.snap}" value="${n(el.h)}"></label></div>
    <p class="note">Οι πλευρές της αποθήκης πάνω στο όριο του περιπτέρου είναι η πίσω πλευρά. Εκεί μπαίνουν πάντα μη φωτιζόμενα πλαίσια.</p>
    ${acts}`;
  } else {
    const door=el.type==='door';
    h=`<div class="selhead"><b>${door?'Πόρτα':'Σύνδεσμος'}</b><span class="code">${door?'DOOR':'CONN'}</span></div>
    ${xy}
    ${door?`<div class="seg"><button data-act="flip">Αλλαγή πλευράς</button></div><p class="note">Σταθερή διάσταση. Γύρισέ την ώστε να ανοίγει προς το εσωτερικό.</p>`:''}
    ${acts}`;
  }
  box.innerHTML=`<div class="lbl">Επιλεγμένο στοιχείο</div>`+h;
}
function renderStat(){
  const k=S.els.filter(isProf).length;
  $('stat').textContent=`${fmt(S.W)} × ${fmt(S.D)} cm · ύψος ${fmt(S.H)} cm · ${fmt(S.W*S.D/10000)} m² · ${k} πλαίσια`;
}
function renderAll(){renderBooth();renderTools();renderPlan();renderInspector();renderRules();renderBom();renderStat();}

/* ---------- magnet + snapping ---------- */
const thr=()=>12/(svg.getScreenCTM()?.a||1);
function axisCands(axis,lo,hi,ex){
  // edges of nearby elements along one axis, plus the booth outline
  const c=axis==='x'?[0,S.W]:[0,S.D];
  solids(ex).forEach(e=>{const b=bbox(e);
    const near=axis==='x'?(b.y-60<hi&&lo<b.y+b.h+60):(b.x-60<hi&&lo<b.x+b.w+60);
    if(near) c.push(...(axis==='x'?[b.x,b.x+b.w]:[b.y,b.y+b.h]));});
  return c;
}
function bestSnap(edges,cands){let best=null;edges.forEach((e,i)=>cands.forEach(c=>{const d=c-e;if(Math.abs(d)<=thr()&&(!best||Math.abs(d)<Math.abs(best.d)))best={d,g:c,i};}));return best;}
function snapPoint(x,y,ex,free){
  if(free||S.magnet===false) return {x:snapV(x),y:snapV(y),gx:null,gy:null};
  const bx=bestSnap([x],axisCands('x',y,y,ex)), by=bestSnap([y],axisCands('y',x,x,ex));
  return {x:bx?bx.g:snapV(x),y:by?by.g:snapV(y),gx:bx?bx.g:null,gy:by?by.g:null};
}
function snapBox(b,ex,free){
  if(free||S.magnet===false) return {x:snapV(b.x),y:snapV(b.y),gx:null,gy:null};
  const bx=bestSnap([b.x,b.x+b.w],axisCands('x',b.y,b.y+b.h,ex)), by=bestSnap([b.y,b.y+b.h],axisCands('y',b.x,b.x+b.w,ex));
  return {x:bx?n(b.x+bx.d):snapV(b.x),y:by?n(b.y+by.d):snapV(b.y),gx:bx?bx.g:null,gy:by?by.g:null};
}
function profFromDrag(type,x0,y0,x1,y1,free){
  const dx=x1-x0, dy=y1-y0, H=Math.abs(dx)>=Math.abs(dy), led=type==='p67', t=PROF[type].t;
  if(Math.max(Math.abs(dx),Math.abs(dy))<S.snap) return {type,x:x0,y:y0,len:100,dir:'h',dim:'b',led};
  if(H){let ex=x1; const s=(free||S.magnet===false)?null:bestSnap([x1],axisCands('x',y0,y0+t));
    ex=s?s.g:x0+Math.sign(dx)*snapV(Math.abs(dx)); guides={x:s?s.g:null,y:guides&&guides.y};
    const len=Math.max(S.snap,n(Math.abs(ex-x0))); return {type,x:ex<x0?ex:x0,y:y0,len,dir:'h',dim:'b',led};}
  let ey=y1; const s=(free||S.magnet===false)?null:bestSnap([y1],axisCands('y',x0,x0+t));
  ey=s?s.g:y0+Math.sign(dy)*snapV(Math.abs(dy)); guides={x:guides&&guides.x,y:s?s.g:null};
  const len=Math.max(S.snap,n(Math.abs(ey-y0))); return {type,x:x0,y:ey<y0?ey:y0,len,dir:'v',dim:'b',led};
}

/* ---------- interaction ---------- */
function toCm(e){const p=svg.createSVGPoint();p.x=e.clientX;p.y=e.clientY;const q=p.matrixTransform(svg.getScreenCTM().inverse());return {x:q.x,y:q.y};}
svg.addEventListener('pointerdown',e=>{
  if(e.button>0) return;
  const p=toCm(e);
  if(e.target.closest('[data-handle="rot"]')){act('rot');return;}
  if(tool==='select'){
    const g=e.target.closest('[data-id]');
    if(g){sel=g.dataset.id; const el=byId(sel), b=bbox(el); drag={sx:p.x,sy:p.y,ox:el.x,oy:el.y,bw:b.w,bh:b.h,moved:false}; svg.setPointerCapture(e.pointerId);}
    else {sel=null; pan={x:e.clientX,y:e.clientY,cx:Z.cx,cy:Z.cy}; svg.setPointerCapture(e.pointerId);}
    renderPlan(); renderInspector(); return;
  }
  if(isProf({type:tool})||tool==='store'){
    const s=snapPoint(p.x,p.y,null,e.altKey); guides={x:s.gx,y:s.gy};
    drawing={type:tool,x0:s.x,y0:s.y}; svg.setPointerCapture(e.pointerId);
    renderPlan(tool==='store'?{type:'store',x:s.x,y:s.y,w:1,h:1}:profFromDrag(tool,s.x,s.y,s.x,s.y,e.altKey)); return;
  }
  const [w,h]=SYMBOX[tool], s=snapPoint(p.x-(tool==='conn'?w/2:0),p.y-(tool==='conn'?h/2:0),null,e.altKey);
  const el={id:newId(),type:tool,x:s.x,y:s.y,rot:0,flip:false};
  S.els.push(el); sel=el.id; tool='select'; commit(); renderAll();
});
function storeFromDrag(x0,y0,p,free){
  const s=snapPoint(p.x,p.y,null,free); guides={x:s.gx,y:s.gy};
  const w=Math.abs(s.x-x0), h=Math.abs(s.y-y0);
  if(w<20||h<20) return {type:'store',x:x0,y:y0,w:200,h:130};
  return {type:'store',x:Math.min(x0,s.x),y:Math.min(y0,s.y),w:n(w),h:n(h)};
}
svg.addEventListener('pointermove',e=>{
  if(pan){const ctm=svg.getScreenCTM(); Z.cx=pan.cx-(e.clientX-pan.x)/ctm.a; Z.cy=pan.cy-(e.clientY-pan.y)/ctm.d; if(Z.z===1)Z.z=1.0001; svg.classList.add('pan'); renderPlan(); return;}
  const p=toCm(e); $('pos').textContent=`${fmt(snapV(p.x))}, ${fmt(snapV(p.y))} cm`;
  if(drag){const el=byId(sel); if(!el)return;
    const s=snapBox({x:drag.ox+p.x-drag.sx,y:drag.oy+p.y-drag.sy,w:drag.bw,h:drag.bh},el.id,e.altKey);
    el.x=s.x; el.y=s.y; guides={x:s.gx,y:s.gy}; drag.moved=true; renderPlan();
    const ix=$('i-x'),iy=$('i-y'); if(ix){ix.value=n(el.x);iy.value=n(el.y);} }
  else if(drawing){
    if(drawing.type==='store'){const g=storeFromDrag(drawing.x0,drawing.y0,p,e.altKey); renderPlan(g); $('pos').textContent=`${fmt(g.w)} × ${fmt(g.h)} cm`;}
    else {const g=profFromDrag(drawing.type,drawing.x0,drawing.y0,p.x,p.y,e.altKey); renderPlan(g);
      $('pos').textContent=`μήκος ${fmt(g.len)} cm`+(g.type==='p67'&&g.len>WARN67?` · προτείνεται ${Math.ceil(g.len/MAX67)} × ${fmt(g.len/Math.ceil(g.len/MAX67))}`:'');}
  }
});
function endPointer(e){
  if(pan){pan=null; svg.classList.remove('pan');}
  if(drag){const m=drag.moved, el=byId(sel); drag=null; guides=null; if(m){if(el)enforce(el); commit(); renderAll();} else renderPlan();}
  if(drawing){const p=toCm(e);
    const el=drawing.type==='store'?storeFromDrag(drawing.x0,drawing.y0,p,e.altKey):profFromDrag(drawing.type,drawing.x0,drawing.y0,p.x,p.y,e.altKey);
    el.id=newId(); drawing=null; guides=null; S.els.push(el); sel=el.id;
    if(el.type==='store') tool='select'; else enforce(el);
    commit(); renderAll();}
}
svg.addEventListener('pointerup',endPointer);
svg.addEventListener('pointercancel',()=>{drag=null;drawing=null;pan=null;guides=null;renderPlan();});
function zoomAt(f,px,py){
  const z=Math.min(12,Math.max(1,Z.z*f));
  if(px!==undefined){const k=1-Z.z/z; Z.cx+=(px-Z.cx)*k; Z.cy+=(py-Z.cy)*k;}
  Z.z=z; if(z===1)Z.cx=null; renderPlan();
}
svg.addEventListener('wheel',e=>{e.preventDefault(); const p=toCm(e); zoomAt(e.deltaY<0?1.15:1/1.15,p.x,p.y);},{passive:false});
$('zin').onclick=()=>zoomAt(1.3); $('zout').onclick=()=>zoomAt(1/1.3); $('zfit').onclick=()=>{Z={z:1,cx:null,cy:null};renderPlan();};
window.addEventListener('resize',()=>renderPlan());

/* ---------- inspector + controls ---------- */
function act(a,v){
  const el=byId(sel); if(!el) return;
  if(a==='dim') el.dim=v;
  if(a==='rot') rotateEl(el);
  if(a==='flip'&&el.type==='door') el.flip=!el.flip;
  if(a==='del'){S.els=S.els.filter(e=>e!==el); sel=null;}
  if(a==='dup'){const c={...el,id:newId(),x:el.x+20,y:el.y+20}; S.els.push(c); sel=c.id;}
  if(a==='rot') enforce(el);
  commit(); renderAll();
}
$('insp').addEventListener('click',e=>{const b=e.target.closest('button[data-act]'); if(b) act(b.dataset.act,b.dataset.v);});
$('insp').addEventListener('change',e=>{
  const el=byId(sel); if(!el) return; const t=e.target;
  if(t.id==='i-len') el.len=Math.max(1,Math.round(+t.value*10)/10||el.len);
  if(t.id==='i-x') el.x=+t.value||0;
  if(t.id==='i-y') el.y=+t.value||0;
  if(t.id==='i-w') el.w=Math.max(20,+t.value||el.w);
  if(t.id==='i-h') el.h=Math.max(20,+t.value||el.h);
  if(t.id==='i-type'){el.type=t.value; el.led=el.type==='p67';}
  if(t.id==='i-led') el.led=t.checked;
  if(t.id==='i-keep') el.keepWhole=t.checked;
  enforce(el); commit(); renderAll();
});
$('rules').addEventListener('click',e=>{
  const b=e.target.closest('button[data-fix]'); if(b){const is=ISS[+b.dataset.fix]; is.pick=+b.dataset.pick; applyFix(+b.dataset.fix); return;}
  const g=e.target.closest('[data-goto]'); if(g){sel=g.dataset.goto; renderPlan(); renderInspector();}
});
$('tools').addEventListener('click',e=>{const b=e.target.closest('.tool'); if(b){tool=b.dataset.t; renderTools(); renderPlan();}});
const segBind=(id,fn)=>$(id).addEventListener('click',e=>{const b=e.target.closest('button'); if(b){fn(b.dataset.v); commit(); renderAll();}});
segBind('mod',v=>S.mod=+v); segBind('mode',v=>S.mode=v); segBind('snap',v=>S.snap=+v); segBind('hset',v=>S.H=+v);
const clamp=v=>Math.min(3000,Math.max(50,Math.round(+v*10)/10||50));
$('W').addEventListener('change',e=>{S.W=clamp(e.target.value);commit();renderAll();});
$('D').addEventListener('change',e=>{S.D=clamp(e.target.value);commit();renderAll();});
$('H').addEventListener('change',e=>{S.H=Math.min(600,Math.max(100,+e.target.value||250));commit();renderAll();});
$('overall').addEventListener('change',e=>{S.overall=e.target.checked;commit();renderAll();});
$('magnet').addEventListener('change',e=>{S.magnet=e.target.checked;commit();});
$('scale').addEventListener('change',e=>{S.scale=+e.target.value;commit();});
$('name').addEventListener('change',e=>{S.name=e.target.value.trim()||'Κάτοψη';commit();});
$('undo').onclick=undo;
// 3D: το module φορτώνει μόνο την πρώτη φορά που πατιέται το κουμπί
$('open3d').onclick=async()=>{
  const b=$('open3d'); b.disabled=true; b.textContent='3D…';
  try{const m=await import('./view3d.js'); m.open3D();}
  catch(err){console.error(err); toast('Η προβολή 3D δεν άνοιξε σε αυτόν τον browser. Δοκίμασε Chrome ή Edge.');}
  finally{b.disabled=false; b.textContent='3D';}
};
$('new').onclick=()=>{S=blank();sel=null;commit();renderAll();toast('Νέα κενή κάτοψη. Η προηγούμενη γυρίζει με Αναίρεση.');};
$('sample').onclick=()=>{S=sample();sel=null;commit();renderAll();toast('Φορτώθηκε η κάτοψη Athanasiadis ως παράδειγμα.');};

document.addEventListener('keydown',e=>{
  if(e.target.matches('input,select,textarea')||document.body.classList.contains('v3d-open')) return;
  const k=e.key, mod=e.ctrlKey||e.metaKey;
  if(mod&&k.toLowerCase()==='z'){e.preventDefault();undo();return;}
  if(mod&&k.toLowerCase()==='d'){e.preventDefault();act('dup');return;}
  const tk={v:'select',1:'p67',2:'p68',3:'door',4:'conn',5:'store'}[k.toLowerCase()];
  if(tk&&!mod){tool=tk;renderTools();renderPlan();return;}
  if(k==='+'||k==='='){zoomAt(1.3);return;}
  if(k==='-'){zoomAt(1/1.3);return;}
  if(k==='0'){Z={z:1,cx:null,cy:null};renderPlan();return;}
  if(k==='Escape'){tool='select';sel=null;drawing=null;guides=null;renderAll();return;}
  const el=byId(sel); if(!el) return;
  if(k==='Delete'||k==='Backspace'){e.preventDefault();act('del');return;}
  if(k==='r'||k==='R'){act('rot');return;}
  if(k==='f'||k==='F'){act('flip');return;}
  const st=S.snap*(e.shiftKey?10:1), mv={ArrowLeft:[-st,0],ArrowRight:[st,0],ArrowUp:[0,-st],ArrowDown:[0,st]}[k];
  if(mv){e.preventDefault();el.x=n(el.x+mv[0]);el.y=n(el.y+mv[1]);commit();renderAll();}
});

/* ---------- exports ---------- */
function pdfDoc(wPt,hPt,content){
  const objs=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt.toFixed(2)} ${hPt.toFixed(2)}] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`];
  let out='%PDF-1.4\n'; const offs=[];
  objs.forEach((b,i)=>{offs.push(out.length);out+=`${i+1} 0 obj\n${b}\nendobj\n`;});
  const x=out.length;
  return out+`xref\n0 ${objs.length+1}\n0000000000 65535 f \n`+offs.map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size ${objs.length+1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
}
function exportPDF(){
  const sc=S.scale||10, k=72/25.4*10/sc, pw=(S.W+100)*k, ph=(S.D+100)*k;
  const P=pdfPainter(); P.rect(-50,-50,S.W+100,S.D+100,'#FFFFFF',null,0); drawPlan(P,{preview:false});
  return pdfDoc(pw,ph,`q ${n(k)} 0 0 ${n(-k)} ${n(50*k)} ${n(ph-50*k)} cm\n1 j\n${P.out()}Q`);
}
function exportSVG(){
  const sc=S.scale||10, P=svgPainter(true); drawPlan(P,{preview:false});
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-50 -50 ${S.W+100} ${S.D+100}" width="${(S.W+100)*10/sc}mm" height="${(S.D+100)*10/sc}mm"><rect x="-50" y="-50" width="${S.W+100}" height="${S.D+100}" fill="#FFFFFF"/>${P.out()}</svg>`;
}
function exportCSV(){
  return '﻿Κωδικός;Περιγραφή;Πλάτος πλαισίου (cm);Ύψος (cm);Τεμάχια\n'+bomRows().map(r=>[r.code,r.desc,r.len===''?'':String(r.len).replace('.',','),r.len===''?'':S.H,r.qty].join(';')).join('\n');
}
// Ονόματα αρχείων σε λατινικά κεφαλαία (όπως τα αρχεία Corel: ATHANASIADIS_KATOPSI). Κάποιοι browsers χαλάνε ελληνικά ονόματα.
const GR2L={α:'a',ά:'a',β:'v',γ:'g',δ:'d',ε:'e',έ:'e',ζ:'z',η:'i',ή:'i',θ:'th',ι:'i',ί:'i',ϊ:'i',ΐ:'i',κ:'k',λ:'l',μ:'m',ν:'n',ξ:'x',ο:'o',ό:'o',π:'p',ρ:'r',σ:'s',ς:'s',τ:'t',υ:'y',ύ:'y',ϋ:'y',ΰ:'y',φ:'f',χ:'ch',ψ:'ps',ω:'o',ώ:'o'};
const fname=()=>[...(S.name||'Katopsi').toLowerCase()].map(c=>GR2L[c]??c).join('').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[^a-z0-9]+/g,'_').replace(/^_+|_+$/g,'').toUpperCase().slice(0,80)||'KATOPSI';
function toast(t){$('toast').textContent=t;}
const MIME={pdf:'application/pdf',svg:'image/svg+xml',csv:'text/csv;charset=utf-8',json:'application/json',dae:'model/vnd.collada+xml',glb:'model/gltf-binary',png:'image/png',zip:'application/zip'};
// Λήψη αρχείων σε δύο περιβάλλοντα:
//  - αυτόνομο site: κανονικό download του browser
//  - μέσα στο Claude.ai (artifact): μέσω της δυνατότητας «downloads», που δέχεται μόνο ορισμένους τύπους.
//    Τύποι εκτός λίστας (.dae, .glb) μπαίνουν αυτόματα μέσα σε .zip.
let DL=null;
(async()=>{try{if(window.claude&&window.claude.use) DL=await window.claude.use('downloads');}catch(e){DL=null}})();
const DL_OK=new Set(['png','svg','pdf','csv','json','zip','txt']);
const CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function zipFiles(files){ // ZIP χωρίς συμπίεση (store). files = [{name, bytes:Uint8Array}]
  const d=new Date(), dt=((d.getFullYear()-1980)<<9|(d.getMonth()+1)<<5|d.getDate()), tm=(d.getHours()<<11|d.getMinutes()<<5|(d.getSeconds()>>1));
  const W=(dv,list)=>list.forEach(([o,v,z])=>z===4?dv.setUint32(o,v,true):dv.setUint16(o,v,true));
  const parts=[], central=[]; let off=0;
  files.forEach(f=>{
    let crc=0xFFFFFFFF; for(let i=0;i<f.bytes.length;i++) crc=CRC[(crc^f.bytes[i])&255]^(crc>>>8); crc=(crc^0xFFFFFFFF)>>>0;
    const nm=new TextEncoder().encode(f.name), L=f.bytes.length;
    const loc=new DataView(new ArrayBuffer(30)), cen=new DataView(new ArrayBuffer(46));
    W(loc,[[0,0x04034b50,4],[4,20,2],[6,0x0800,2],[8,0,2],[10,tm,2],[12,dt,2],[14,crc,4],[18,L,4],[22,L,4],[26,nm.length,2],[28,0,2]]);
    W(cen,[[0,0x02014b50,4],[4,20,2],[6,20,2],[8,0x0800,2],[10,0,2],[12,tm,2],[14,dt,2],[16,crc,4],[20,L,4],[24,L,4],[28,nm.length,2],[30,0,2],[32,0,2],[34,0,2],[36,0,2],[38,0,4],[42,off,4]]);
    parts.push(loc,nm,f.bytes); central.push(cen,nm); off+=30+nm.length+L;
  });
  const cenSize=central.reduce((s,x)=>s+(x.byteLength??x.length),0), end=new DataView(new ArrayBuffer(22));
  W(end,[[0,0x06054b50,4],[4,0,2],[6,0,2],[8,files.length,2],[10,files.length,2],[12,cenSize,4],[16,off,4],[20,0,2]]);
  return new Blob([...parts,...central,end],{type:'application/zip'});
}
const zipOne=(name,bytes)=>zipFiles([{name,bytes}]);
async function toBytes(data,ext){
  if(typeof data==='string') return ext==='pdf'?Uint8Array.from(data,c=>c.charCodeAt(0)&255):new TextEncoder().encode(data);
  if(data instanceof Blob) return new Uint8Array(await data.arrayBuffer());
  return new Uint8Array(data instanceof ArrayBuffer?data:data.buffer);
}
async function offer(filename,data){
  let ext=filename.split('.').pop().toLowerCase(), bytes=await toBytes(data,ext);
  if(DL){
    let blob;
    if(DL_OK.has(ext)) blob=new Blob([bytes],{type:MIME[ext]});
    else {blob=zipOne(filename,bytes); filename=filename.replace(/\.[^.]+$/,'')+'.zip';}
    try{await DL.save({filename,data:blob}); toast('Αποθηκεύτηκε: '+filename);}
    catch(err){toast(err&&err.code==='declined'?'Η αποθήκευση ακυρώθηκε.':'Δεν έγινε αποθήκευση. Δοκίμασε ξανά σε λίγο.');}
    return;
  }
  const blob=new Blob([bytes],{type:MIME[ext]||'application/octet-stream'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename;
  document.body.appendChild(a); a.click(); setTimeout(()=>{URL.revokeObjectURL(a.href); a.remove();},4000);
  toast('Αποθηκεύτηκε: '+filename);
}
$('xpdf').onclick=()=>offer(`${fname()}_KATOPSI_1-${S.scale||10}.pdf`,exportPDF());
$('xsvg').onclick=()=>offer(`${fname()}_KATOPSI_1-${S.scale||10}.svg`,exportSVG());
$('xcsv').onclick=()=>offer(`${fname()}_LISTA_YLIKON.csv`,exportCSV());
// το έργο .valis.json περιέχει και τις εικόνες γραφικών (για μεταφορά σε άλλον υπολογιστή)
$('xjson').onclick=async()=>{
  const images={}; for(const g of Object.values(S.gfx||{})){const u=await GFX.get(g.img); if(u) images[g.img]=u;}
  offer(`${fname()}.valis.json`,JSON.stringify({...S,images},null,1));
};
$('ojson').onclick=()=>$('fjson').click();
$('fjson').addEventListener('change',e=>{
  const f=e.target.files[0]; if(!f) return; const r=new FileReader();
  r.onload=()=>{try{const d=JSON.parse(r.result); if(!Array.isArray(d.els)||!d.W||!d.D) throw 0;
      const imgs=d.images||{}; delete d.images; for(const [id,u] of Object.entries(imgs)) GFX.put(id,u);
      S={...blank(),...d}; sel=null; commit(); renderAll(); toast('Άνοιξε το έργο '+(S.name||f.name)+'.');}
    catch(err){toast('Το αρχείο δεν είναι έργο του σχεδιαστή κάτοψης.');}
    e.target.value='';};
  r.readAsText(f);
});

renderAll();
