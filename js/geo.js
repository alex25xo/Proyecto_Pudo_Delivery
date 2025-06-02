// js/geo.js
const NOM_BASE = 'https://nominatim.openstreetmap.org/search';
const OSRM     = 'https://router.project-osrm.org';

const params = o => new URLSearchParams(o).toString();

/* ---------- geocodificación (exacta) ---------- */
export async function geocode(query){
  // city filter
  let url = NOM_BASE+'?'+params({
    q: query,
    city:'Puno',
    country:'Peru',
    format:'json',
    limit:1,
    addressdetails:0,
    countrycodes:'pe'
  });
  let res = await (await fetch(url,{headers:{'User-Agent':'pudo-web/1.0'}})).json();
  if(res.length) return {lat:+res[0].lat, lon:+res[0].lon};

  // bounding-box
  const VIEWBOX={left:-70.0707,right:-70.0000,top:-15.7960,bottom:-15.8840};
  url = NOM_BASE+'?'+params({
    q: query,
    format:'json',
    limit:1,
    viewbox:`${VIEWBOX.left},${VIEWBOX.top},${VIEWBOX.right},${VIEWBOX.bottom}`,
    bounded:1,
    addressdetails:0,
    countrycodes:'pe'
  });
  res = await (await fetch(url,{headers:{'User-Agent':'pudo-web/1.0'}})).json();
  if(res.length) return {lat:+res[0].lat, lon:+res[0].lon};

  return null;
}

/* ---------- helper de tokens ---------- */
function tokens(str){
  return str
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'') // quita acentos
    .replace(/[^\p{L}\p{N}\s]+/gu,'')               // limpia símbolos
    .split(/\s+/)
    .filter(w=>!['la','el','de','del','los','las','y','n','no','nº','num'].includes(w));
}

/* ---------- sugerencias inteligentes ---------- */
export async function suggestCoords(query){
  const seen = new Set();
  const add  = arr => arr.forEach(x=>{ if(x && !seen.has(x.place_id)){ seen.add(x.place_id); out.push(x); }});
  const out  = [];

  /* 1) cadena completa */
  let url = NOM_BASE+'?'+params({ q: query+' Puno Peru', format:'json', limit:5, addressdetails:0, countrycodes:'pe' });
  add(await (await fetch(url,{headers:{'User-Agent':'pudo-web/1.0'}})).json());

  if(out.length >= 5) return format(out);

  /* 2) primeras 3 palabras significativas */
  const kw = tokens(query).slice(0,3).join(' ');
  if(kw){
    url = NOM_BASE+'?'+params({ q: kw+' Puno Peru', format:'json', limit:5, addressdetails:0, countrycodes:'pe' });
    add(await (await fetch(url,{headers:{'User-Agent':'pudo-web/1.0'}})).json());
  }

  if(out.length >= 5) return format(out);

  /* 3) búsqueda por tokens individuales (universidad, pecca…) */
  for(const t of tokens(query)){
    if(t.length < 4) continue;                     // ignora “ie”, “gas”
    url = NOM_BASE+'?'+params({ q: `${t} Puno Peru`, format:'json', limit:3, addressdetails:0, countrycodes:'pe' });
    add(await (await fetch(url,{headers:{'User-Agent':'pudo-web/1.0'}})).json());
    if(out.length >= 5) break;
  }

  return format(out);

  /* --- formateo final --- */
  function format(arr){
    return arr.slice(0,5).map(x=>({
      name: (x.display_name||'').trim(),
      lat : +x.lat,
      lon : +x.lon
    }));
  }
}

/* ---------- OSRM helpers ---------- */
export async function optimalOrder(coords){
  const str = coords.map(c=>`${c.lon},${c.lat}`).join(';');
  const url = `${OSRM}/trip/v1/driving/${str}?source=first&roundtrip=false`;
  const data = await (await fetch(url)).json();
  return data.waypoints.map(wp=>wp.waypoint_index);
}

export async function durationMatrix(coords){
  const str = coords.map(c=>`${c.lon},${c.lat}`).join(';');
  const url = `${OSRM}/table/v1/driving/${str}?annotations=duration`;
  const {durations} = await (await fetch(url)).json();
  return durations;
}

export async function routeGeo(coords){
  const str = coords.map(c=>`${c.lon},${c.lat}`).join(';');
  const url = `${OSRM}/route/v1/driving/${str}?overview=full&geometries=geojson`;
  const {routes:[r]} = await (await fetch(url)).json();
  return {geometry:r.geometry,distance:r.distance,duration:r.duration};
}
