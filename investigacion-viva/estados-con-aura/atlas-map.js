// Atlas de las soberanías · mapa editorial de referencia.
// Los puntos representan capitales o yacimientos representativos, nunca fronteras.
// Los polígonos son zonas regionales ESQUEMÁTICAS, no reconstrucciones históricas.
// GeoJSON georreferenciado por fecha deberá sustituir estas zonas cuando se disponga de fuentes apropiadas.
const CENTRES={
1:[41.01,28.97],2:[48.21,16.37],3:[59.94,30.32],4:[41.01,28.97],5:[50.78,6.08],
6:[40.42,-3.70],7:[41.90,12.50],8:[33.10,44.60],9:[27.18,78.02],10:[38.72,-9.14],
11:[51.51,-0.13],12:[47.20,102.84],13:[50.78,6.08],14:[52.52,13.40],15:[48.86,2.35],
16:[33.31,44.36],17:[32.65,51.68],18:[39.90,116.41],19:[29.94,52.89],20:[-13.52,-71.97],
21:[31.78,35.23],22:[41.90,12.50],23:[45.44,12.33],24:[37.89,-4.78],25:[54.04,19.03],
26:[36.21,36.16],27:[37.45,35.82],28:[50.06,19.94],29:[41.99,21.43],30:[38.12,13.36],
31:[41.00,39.72],32:[51.21,3.22],33:[45.07,7.69],34:[35.90,14.51],35:[47.17,27.58],
36:[-38.73,-72.59],37:[42.64,18.11],38:[54.35,18.65],39:[45.33,14.44],40:[43.52,12.12],
41:[56.65,23.73],42:[37.75,26.97],43:[45.65,13.77],44:[58.52,31.28],45:[44.60,33.80],
46:[49.84,24.03],47:[29.65,91.13],48:[39.77,64.42],49:[42.39,18.92],50:[50.71,6.01],
51:[-9.90,-39.32],52:[42.92,-76.10],53:[40.76,22.53],54:[36.46,50.59],55:[46.32,47.99],
56:[49.08,32.67],57:[1.55,110.35],58:[43.88,125.32],59:[64.25,-21.13],60:[32.06,118.80],
61:[27.33,88.62],62:[31.55,74.35],63:[40.76,-111.89],64:[39.03,125.75],65:[42.81,10.33],
66:[40.25,24.22],67:[30.05,31.24],68:[15.64,32.50],69:[22.93,57.53],70:[34.05,-6.80],
71:[-0.03,109.34],72:[14.35,108.00],73:[41.77,140.73],74:[50.64,5.58],75:[50.06,19.94],
76:[43.92,81.31],77:[27.47,89.64],78:[30.05,31.24],79:[36.77,45.73],80:[48.86,2.35],
81:[46.30,19.00],82:[47.90,106.90],83:[47.50,105.00],84:[47.50,101.20],85:[46.50,19.00],
86:[36.80,66.90],87:[47.43,102.65],88:[47.50,37.50],89:[26.22,127.72],90:[15.77,108.10],
91:[6.05,121.00],92:[-6.27,14.24],93:[20.60,93.19],94:[37.10,79.93],95:[0.80,127.39],
96:[13.83,20.83],97:[27.33,68.13],98:[35.30,25.16],99:[-10.89,-77.52],100:[26.06,50.53],
101:[35.61,35.79],102:[-16.56,-68.68],103:[-8.10,-79.00],104:[37.65,62.17]
};
// Regiones orientativas seleccionadas: no restituyen fronteras ni fases de conquista.
// La etiqueta de época precisa sólo el período que motiva el esquema editorial.
const ZONES=[
 {n:2,period:'Europa central, etapa final (ca. 1914)',p:[[51,10],[50.8,18],[50.1,24.5],[46.6,26.3],[43.6,21.5],[44.1,14],[46.1,9],[49.5,9]]},
 {n:12,period:'Eurasia continental, máxima expansión general (siglo XIII)',p:[[55,54],[62,100],[56,122],[43,130],[32,119],[30,89],[35,68],[43,53]]},
 {n:20,period:'Andes centrales y meridionales (siglo XV–XVI)',p:[[1,-80],[-3,-74],[-15,-67],[-30,-65],[-36,-70],[-24,-73],[-7,-80]]},
 {n:81,period:'Hegemonía huna en Europa (siglo V)',p:[[51,8],[55,18],[51,30],[44,28],[42,17],[45,9]]},
 {n:82,period:'Estepa oriental xiongnu (siglos III–I a. C.)',p:[[52,87],[56,104],[49,117],[39,112],[38,100],[43,86]]},
 {n:84,period:'Primer Kaganato túrquico (siglo VI)',p:[[55,75],[54,116],[42,121],[36,96],[42,73]]},
 {n:85,period:'Cuenca panónica de los ávaros (siglos VI–VIII)',p:[[49.5,13],[50,21],[47,25],[44,22],[44,14]]},
 {n:86,period:'Ámbito heftalita en Asia central (siglos V–VI)',p:[[41,60],[41,73],[35,75],[32,66],[36,59]]},
 {n:87,period:'Kaganato uigur en Mongolia (siglos VIII–IX)',p:[[52,95],[53,113],[44,115],[42,98]]},
 {n:88,period:'Estepas cumano-kipchaks (siglos XI–XIII)',p:[[53,25],[54,50],[47,58],[43,50],[45,30]]},
 {n:92,period:'Cuenca del Kongo, espacio regional (siglos XV–XVII)',p:[[0,12],[-2,18],[-8,19],[-9,12]]},
 {n:97,period:'Núcleo urbano del Indo maduro (ca. 2600–1900 a. C.)',p:[[32,67],[32,74],[25,73],[23,67]]},
 {n:98,period:'Creta palacial (Edad del Bronce)',p:[[36,23],[36,27],[34.4,27],[34.4,23]]},
 {n:99,period:'Costa norcentral del Perú; Caral-Supe',p:[[-10,-79],[-10,-76],[-12,-76],[-12,-79]]},
 {n:102,period:'Ámbito centroandino de Tiwanaku (ca. 500–1000)',p:[[-14,-71],[-13,-65],[-20,-64],[-21,-70]]},
 {n:103,period:'Costa norte peruana; ámbito moche (ca. 100–800)',p:[[-6,-81],[-6,-77],[-10,-77],[-10,-81]]},
 {n:104,period:'Oasis de Bactria-Margiana, Edad del Bronce',p:[[40,58],[40,67],[34,69],[34,58]]}
];
const LAYERS=[
 {id:'canon',label:'Canon histórico original',color:'#5e716a',test:r=>Number(r.n)<=80},
 {id:'nomadas',label:'Imperios nómadas',color:'#987043',test:r=>r.grupo==='Imperio nómada'},
 {id:'desconocidos',label:'Países casi desconocidos',color:'#667e89',test:r=>r.grupo==='País casi desconocido'},
 {id:'perdidas',label:'Civilizaciones perdidas',color:'#99736e',test:r=>r.grupo==='Civilización perdida'}
];
const el=(tag,cls,text)=>{const x=document.createElement(tag);if(cls)x.className=cls;if(text!==undefined)x.textContent=String(text);return x};
const fold=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
const url=r=>'./ficha.html?e='+encodeURIComponent(r.n);
export function renderAtlasMap({records}){
 const mapElement=document.getElementById('atlas-world-map');
 const numberOfCenters=records.filter(r=>CENTRES[r.n]&&r.grupo!=='País ficticio').length;
 const fictitious=records.filter(r=>r.grupo==='País ficticio');
 document.getElementById('map-layer-total').textContent=numberOfCenters+' puntos · '+ZONES.length+' áreas';
 const fictionRoot=document.getElementById('map-fiction-list');fictionRoot.replaceChildren();
 for(const r of fictitious){const a=el('a');a.href=url(r);a.append(el('strong','',r.entidad),el('small','',r.ficcion?.autor||'Mundo imaginario'));fictionRoot.append(a)}
 if(!window.L){mapElement.replaceChildren(el('p','map-map-error','No se pudo cargar el mapa interactivo. Revisá la conexión para acceder a Leaflet y a la cartografía de OpenStreetMap.'));return}
 const map=window.L.map(mapElement,{worldCopyJump:true,minZoom:2,maxZoom:10,zoomControl:true}).setView([22,15],2);
 window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:18,attribution:'© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>'}).addTo(map);
 window.L.control.scale({imperial:false,metric:true}).addTo(map);
 const dots=new Map(),areas=new Map(),grouped=new Map();
 for(const category of LAYERS){dots.set(category.id,window.L.layerGroup());areas.set(category.id,window.L.layerGroup())}
 const getGroup=r=>LAYERS.find(x=>x.test(r));
 const markers=new Map();
 for(const r of records){
  const pos=CENTRES[r.n],category=getGroup(r);if(!pos||!category)continue;
  const marker=window.L.circleMarker(pos,{radius:6,weight:1,color:'#fff9ed',opacity:1,fillColor:category.color,fillOpacity:.95});
  const popup=el('div');popup.append(el('small','',r.grupo),el('div','map-popup-title',r.entidad));
  const date=el('div','',r.fechas||'');date.style.fontSize='10px';date.style.color='#666';popup.append(date);
  const visit=el('a','map-popup-link','Abrir ficha →');visit.href=url(r);popup.append(visit);
  marker.bindPopup(popup);markers.set(r.n,marker);
  const list=grouped.get(category.id)||[];list.push(r);grouped.set(category.id,list);
 }
 const polygonList=[];
 for(const area of ZONES){const r=records.find(x=>x.n===area.n),category=r&&getGroup(r);if(!category)continue;
  const shape=window.L.polygon(area.p,{color:category.color,weight:1.4,opacity:.70,fillColor:category.color,fillOpacity:.11,dashArray:'5 5'});
  const popup=el('div');popup.append(el('strong','',r.entidad),el('div','',area.period),el('small','','Región ilustrativa; no delimita fronteras históricas.'));
  const a=el('a','map-popup-link','Abrir ficha →');a.href=url(r);popup.append(a);shape.bindPopup(popup);
  polygonList.push({area,shape,category});
 }
 const controls=document.getElementById('map-layer-controls');controls.replaceChildren();
 const state={canon:true,nomadas:true,desconocidos:true,perdidas:true};
 for(const group of LAYERS){
  const label=el('label','map-layer'),check=el('input');check.type='checkbox';check.checked=true;check.dataset.layer=group.id;
  const dot=el('span','map-color-dot');dot.style.background=group.color;
  label.append(check,dot,el('strong','',group.label),el('span','',(grouped.get(group.id)||[]).length));controls.append(label);
  check.addEventListener('change',()=>{state[group.id]=check.checked;refresh()});
 }
 const showAreas=document.getElementById('map-areas'),showCentres=document.getElementById('map-centres'),search=document.getElementById('map-search');
 showAreas.addEventListener('change',refresh);showCentres.addEventListener('change',refresh);search.addEventListener('input',refresh);
 function refresh(){
  for(const group of LAYERS){dots.get(group.id).clearLayers();areas.get(group.id).clearLayers()}
  const q=fold(search.value.trim());
  const matches=records.filter(r=>{const cat=getGroup(r);return cat&&state[cat.id]&&CENTRES[r.n]&&(!q||fold([r.entidad,r.geografia,r.tipo,r.grupo].join(' ')).includes(q))});
  for(const r of matches){const cat=getGroup(r);if(showCentres.checked)dots.get(cat.id).addLayer(markers.get(r.n))}
  const accepted=new Set(matches.map(x=>x.n));
  for(const x of polygonList){if(showAreas.checked&&accepted.has(x.area.n))areas.get(x.category.id).addLayer(x.shape)}
  for(const group of LAYERS){
   if(state[group.id]){if(!map.hasLayer(dots.get(group.id)))dots.get(group.id).addTo(map);if(!map.hasLayer(areas.get(group.id)))areas.get(group.id).addTo(map)}
   else {map.removeLayer(dots.get(group.id));map.removeLayer(areas.get(group.id))}
  }
  const list=document.getElementById('map-entity-list');list.replaceChildren();
  matches.sort((a,b)=>a.n-b.n);
  for(const r of matches){const btn=el('button','map-entity-item');btn.type='button';btn.append(el('strong','',r.entidad),el('small','',r.fechas+' · '+r.grupo));btn.addEventListener('click',()=>{map.flyTo(CENTRES[r.n],Math.max(map.getZoom(),5),{duration:.5});markers.get(r.n).openPopup()});list.append(btn)}
  const count=document.getElementById('map-count');count.textContent=matches.length+' localizaciones de referencia'+(showAreas.checked?' · '+polygonList.filter(x=>accepted.has(x.area.n)).length+' regiones esquemáticas':'');
 }
 refresh();
 setTimeout(()=>map.invalidateSize(),120);
}