// Αποθήκευση εικόνων γραφικών (artwork) σε IndexedDB, με μνήμη ως εφεδρεία.
// Οι εικόνες είναι μεγάλες για το localStorage. Στο S κρατάμε μόνο το id: S.gfx[επιφάνεια] = {img, name, iw, ih, fit}.
// Αν το IndexedDB δεν είναι διαθέσιμο (ιδιωτικό παράθυρο, προεπισκόπηση), οι εικόνες ζουν μόνο ως το κλείσιμο της σελίδας.
const GFX=(()=>{
  let dbp=null; const mem=new Map();
  function db(){
    if(!dbp) dbp=new Promise(res=>{
      try{const r=indexedDB.open('valis-katopsi',1);
        r.onupgradeneeded=()=>r.result.createObjectStore('img');
        r.onsuccess=()=>res(r.result); r.onerror=()=>res(null); r.onblocked=()=>res(null);}
      catch(e){res(null);}
    });
    return dbp;
  }
  async function put(id,dataURL){
    mem.set(id,dataURL); const d=await db(); if(!d) return;
    await new Promise(r=>{try{const tx=d.transaction('img','readwrite'); tx.objectStore('img').put(dataURL,id); tx.oncomplete=r; tx.onerror=r; tx.onabort=r;}catch(e){r();}});
  }
  async function get(id){
    if(mem.has(id)) return mem.get(id); const d=await db(); if(!d) return null;
    return new Promise(r=>{try{const q=d.transaction('img').objectStore('img').get(id);
      q.onsuccess=()=>{if(q.result) mem.set(id,q.result); r(q.result||null);}; q.onerror=()=>r(null);}catch(e){r(null);}});
  }
  // Εικόνα από αρχείο → JPEG έως 2048 px (λευκό φόντο για διαφάνειες) + αρχικές διαστάσεις σε px
  async function fromFile(file){
    if(!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error('type');
    const url=URL.createObjectURL(file);
    try{
      const img=new Image(); img.src=url; await img.decode();
      const iw=img.naturalWidth, ih=img.naturalHeight, k=Math.min(1,2048/Math.max(iw,ih));
      const c=document.createElement('canvas'); c.width=Math.max(1,Math.round(iw*k)); c.height=Math.max(1,Math.round(ih*k));
      const x=c.getContext('2d'); x.fillStyle='#FFFFFF'; x.fillRect(0,0,c.width,c.height); x.drawImage(img,0,0,c.width,c.height);
      return {dataURL:c.toDataURL('image/jpeg',.88), iw, ih};
    } finally { URL.revokeObjectURL(url); }
  }
  const newId=()=>'g'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
  return {put,get,fromFile,newId};
})();
