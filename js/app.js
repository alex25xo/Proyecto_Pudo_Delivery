import {parseAddresses} from './nlp.js';
import {
  geocode, suggestCoords,
  optimalOrder, routeGeo, durationMatrix
} from './geo.js';
import {optimize, multiStartOptimize, pathCost} from './tsp.js';

/* ---------- visual ---------- */
const COLORS=['#e41a1c','#377eb8','#4daf4a','#984ea3',
              '#ff7f00','#ffff33','#a65628','#f781bf','#999999'];
let map,legLines=[],markers=[];

/* ---------- init ---------- */
window.addEventListener('DOMContentLoaded',()=>{
  initMap(); initSpeech(); $('chooser').hidden=true; $('calc').onclick=run;
});
window.addEventListener('pageshow', () => {
  $('chooser').hidden = true;          // oculta si venimos de bfcache
});
/* ---------- Leaflet ---------- */
function initMap(){
  map=L.map('map').setView([-15.84,-70.02],13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{
    maxZoom:19,attribution:'&copy; OpenStreetMap contributors'
  }).addTo(map);
}

/* ---------- voz ---------- */
function initSpeech(){

  const b = $('mic');
  if(!b) return;                         // <-- botón ya no existe
 if(!('webkitSpeechRecognition' in window)){
   b.disabled = true;
   return;
 }
   const r = new webkitSpeechRecognition();
   r.lang = 'es-PE';
   b.onclick = () => r.start();
   r.onresult = e => { $('input').value = e.results[0][0].transcript; };
}


/* ---------- helpers ---------- */
const $=id=>document.getElementById(id);
const markerHtml=(l,c)=>`<div style="background:${c};color:#fff;width:24px;height:24px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:600">${l}</div>`;

/* chooser modal */
function chooseCandidate(dir, list){
  const clean = list.filter(c => c.name && c.name.trim().length > 0);
  if(!clean.length) return Promise.resolve(null);

  return new Promise(resolve=>{
    const box = $('chooser');
    $('chooser').querySelector('h3').innerHTML =
      `No se encontró <em>"${dir}"</em>.<br>¿Qué quisiste decir?`;          // ← NUEVO

    const ol = $('options');
    ol.innerHTML = clean.map((c,i)=>`<li data-i="${i}">${c.name}</li>`).join('');
    box.hidden = false;

    const pick = e=>{ if(e.target.tagName==='LI'){finish(clean[+e.target.dataset.i]);} };
    const skip = ()=>finish(null);

    function finish(val){
      box.hidden = true;
      ol.removeEventListener('click',pick);
      $('skip').removeEventListener('click',skip);
      resolve(val);
    }
    ol.addEventListener('click',pick);
    $('skip').addEventListener('click',skip);
  });
}


/* ---------- main ---------- */
async function run(){
  const text=$('input').value.trim();
  if(!text){alert('Ingrese direcciones.');return;}

  $('calc').disabled=true;
  $('stops').innerHTML=''; $('totals').textContent=''; $('metrics').textContent='';

  try{
    /* 1 NLP */
    const {origin,destinations}=await parseAddresses(text);
    const rawDirs=[origin,...destinations];
    if(rawDirs.length<2) throw 'Se necesitan al menos origen y un destino';

    /* 2 geocode con diálogo */
    const coords=[], dirs=[];
    for (const d of rawDirs){
  let loc = await geocode(d);
  let label = d;                         // por defecto, el texto original

  if(!loc){
    const cand = await suggestCoords(d);
    if(cand.length){
      const pick = await chooseCandidate(d, cand);
      if(pick){
        loc   = {lat: pick.lat, lon: pick.lon};
        label = pick.name;               // ← usa el nombre de la opción
      }
    }
  }
  if(loc){
    coords.push(loc);
    dirs.push(label);                    // ← guarda la versión final
  }else{
    alert(`Se omitió "${d}" por no ubicarse.`);
  }
}

    if(coords.length<2) throw 'Menos de dos puntos válidos.';

    /* 3 order inicial */
    let order;
    try{order=await optimalOrder(coords);}catch{order=[...coords.keys()];}

    /* 4 matrix */
    const matrix=await durationMatrix(coords);

    /* 5 hill-climb multi-start */
    const improved=multiStartOptimize(order,matrix,40);
    const base=pathCost(order,matrix)/60, best=pathCost(improved,matrix)/60;
    const gain=((base-best)/base)*100;
    $('metrics').textContent=`Hill-Climb: ${base.toFixed(2)} → ${best.toFixed(2)} min (−${gain.toFixed(1)} %)`;

    /* 6 pintar mapa */
    const ordCoords=improved.map(i=>coords[i]);
    const ordDirs  =improved.map(i=>dirs[i]);
    const {distance,duration}=await routeGeo(ordCoords);

 legLines.forEach(l=>l.remove()); legLines=[];
markers.forEach(m=>m.remove());  markers=[];

for(let i = 0; i < ordCoords.length - 1; i++){
  const {geometry} = await routeGeo([ordCoords[i], ordCoords[i+1]]);

  // halo blanco
  L.geoJSON(geometry,{style:{color:'#fff', weight:9, opacity:.9}}).addTo(map);

  // línea coloreada encima
  const colored = L.geoJSON(geometry,{
    style:{color:COLORS[i%COLORS.length], weight:5, opacity:.9}
  }).addTo(map);

  legLines.push(colored);                 // ← ¡ahora sí!
}

/* centra mapa solo si hay líneas */
if (legLines.length){
  map.fitBounds(L.featureGroup(legLines).getBounds());
}


    map.fitBounds(L.featureGroup(legLines).getBounds());

    markers.push(L.marker([ordCoords[0].lat,ordCoords[0].lon],{
      icon:L.divIcon({className:'',html:markerHtml('🚩','#000'),iconSize:[28,28]})
    }).addTo(map));
    ordCoords.slice(1).forEach((c,i)=>{
      const col=COLORS[i%COLORS.length];
      markers.push(L.marker([c.lat,c.lon],{
        icon:L.divIcon({className:'',html:markerHtml(i+1,col),iconSize:[24,24]})
      }).addTo(map));
    });

    $('stops').innerHTML=ordDirs.slice(1).map(d=>`<li>${d}</li>`).join('');
    $('totals').textContent=`≈ ${(distance/1000).toFixed(2)} km · ${(duration/60).toFixed(1)} min`;

  }catch(e){console.error(e);alert(e.message||e);}
  finally{$('calc').disabled=false;}
}
