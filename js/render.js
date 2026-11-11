/* Cuentas Claras · js/render.js
   Dibujar la pantalla: la función render() y lo general (paneles, fondo, herramientas favoritas).

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

/* ============================================================
   render
   ============================================================ */
/* Los montos de los tiles se achican lo justo para entrar en su recuadro. El
   CSS ya los ajusta al ancho del tile, pero un número muy largo
   ("$ 12.713.316,74") igual se pasaba del borde: acá se mide el texto de verdad
   y, si no entra, se le baja la letra hasta que quede adentro con un poco de
   aire. Primero se limpian todos, después se mide y al final se escribe, así el
   navegador no recalcula la página una vez por tile. */
function ajustarNums(){
  var els = $$('.tile .num');
  els.forEach(function(el){ el.style.fontSize = ''; });
  var med = els.map(function(el){
    var w = el.clientWidth;
    return (w > 0 && el.scrollWidth > w) ? { el:el, f:parseFloat(getComputedStyle(el).fontSize) * w / el.scrollWidth * 0.97 } : null;
  });
  med.forEach(function(m){ if(m) m.el.style.fontSize = Math.max(11, Math.floor(m.f * 10) / 10) + 'px'; });
}
/* v186: cuántas columnas usa cada formulario y cada fila de recuadros, según lo
   que se ve (ver el CSS de v186). Se escribe sólo si cambió, para que el
   observador de atributos no entre en un ciclo. */
function _vis(c){ return !c.hidden && getComputedStyle(c).display !== 'none'; }
function _ponN(el, n){ var v = String(Math.max(1, n)); if(el.style.getPropertyValue('--n') !== v) el.style.setProperty('--n', v); }
function ajustarAnchos(){
  $$('.form2').forEach(function(f){
      // la tanda más larga de campos seguidos (un campo a lo ancho corta la tanda)
    var n = 0, run = 0;
    [].forEach.call(f.children, function(c){
      if(!_vis(c)) return;
      if(c.matches('.full,.par')){ run = 0; return; }
      run++; if(run > n) n = run;
    });
    var w = f.clientWidth; if(!w) return;               // vista oculta: se mide cuando aparezca
    var g = parseFloat(getComputedStyle(f).columnGap) || 10;
    var entran = Math.max(1, Math.floor((w + g) / (158 + g)));
    // si no entran todos en un renglón, se reparten parejo (5 en 4 lugares = 3 y 2, no 4 y 1 solo)
    var por = n <= entran ? n : Math.ceil(n / Math.ceil(n / entran));
    _ponN(f, por);
  });
  $$('.grid.g4').forEach(function(g){ _ponN(g, [].filter.call(g.children, _vis).length); });
  $$('.panels').forEach(function(p){
    // mientras arrastrás un panel, su lugar lo ocupa el hueco punteado
    var vs = [].filter.call(p.children, function(c){ return _vis(c) && !c.classList.contains('dragging'); });
    [].forEach.call(p.children, function(c){
      var solo = !p.classList.contains('mas') && vs.length % 2 === 1 && c === vs[vs.length - 1];
      if(c.classList.contains('solo') !== solo) c.classList.toggle('solo', solo);
    });
  });
}
var _ajNums = 0;
function ajustarNumsPronto(){ if(_ajNums) return; _ajNums = requestAnimationFrame(function(){ _ajNums = 0; try{ ajustarAnchos(); }catch(e){} ajustarNums(); }); }
/* ---- los paneles del Resumen, apilados ----
   Con dos columnas o más, cada panel ocupa el alto de lo que muestra (no el del
   más alto de su fila) y se ubica en la columna que va más corta, en el orden
   que elegiste. Así, al lado de "Últimos movimientos" entran "En qué se te va"
   y "Con qué pagás", uno abajo del otro. Nada se achica: cada columna tiene el
   ancho de siempre. La grilla tiene renglones de 1px y cada panel abarca tantos
   como mide. En el celular (una columna) queda como siempre. */
var PANEL_GAP = 14, _apilar = 0, _apilarFirma = '';
function apilarPaneles(){
  var p = document.getElementById('panels'); if(!p) return;
  // cuántas columnas pide el CSS (no las que tiene la grilla: una columna puesta a
  // mano de más crearía una nueva y se iría sumando sola)
  var cols = Math.max(1, Math.min(4, parseInt(getComputedStyle(p).getPropertyValue('--cols'), 10) || 1));
  var hijos = [].filter.call(p.children, function(c){ return _vis(c) && !c.classList.contains('dragging'); });
  if(!p.clientWidth) return;                       // Resumen oculto: se apila cuando aparezca
  if(cols < 2){
    if(p.classList.contains('mas')){
      p.classList.remove('mas');
      [].forEach.call(p.children, function(c){ c.style.gridColumn = ''; c.style.gridRow = ''; });
    }
    _apilarFirma = '';
    return;
  }
  if(!p.classList.contains('mas')) p.classList.add('mas');
  // lo que mide cada uno ya con el ancho de una columna (antes de mover nada)
  var altos = hijos.map(function(c){ return Math.max(1, Math.ceil(c.offsetHeight)); });
  var col = [], k, j, firma = cols + ':';
  for(k = 0; k < cols; k++) col.push(0);
  hijos.forEach(function(c, i){
    // la columna más corta; si dos empatan (por unos pocos px), la de la izquierda
    for(k = 0, j = 1; j < cols; j++) if(col[j] < col[k] - 2) k = j;
    var gc = String(k + 1), gr = (col[k] + 1) + ' / span ' + altos[i];
    if(c.style.gridColumn !== gc) c.style.gridColumn = gc;
    if(c.style.gridRow !== gr) c.style.gridRow = gr;
    col[k] += altos[i] + PANEL_GAP;
    firma += gc + '@' + gr + ',';
  });
  _apilarFirma = firma;
}
function apilarPronto(){ if(_apilar) return; _apilar = requestAnimationFrame(function(){ _apilar = 0; try{ apilarPaneles(); }catch(e){} }); }
(function(){
  var p = document.getElementById('panels'); if(!p) return;
  // cambió lo que muestra un panel (o el ancho de la ventana): se vuelve a apilar
  try{
    var ro = new ResizeObserver(apilarPronto);
    ro.observe(p);
    [].forEach.call(p.children, function(c){ ro.observe(c); });
    // un panel que entra o sale (el hueco punteado al arrastrar, un reordenamiento)
    new MutationObserver(function(ms){
      ms.forEach(function(m){ [].forEach.call(m.addedNodes, function(n){ if(n.nodeType === 1) ro.observe(n); }); });
      apilarPronto();
    }).observe(p, { childList:true });
  }catch(e){}
  window.addEventListener('resize', apilarPronto);
})();
try{
  new MutationObserver(ajustarNumsPronto).observe(document.body, { attributes:true, attributeFilter:['hidden','class'], subtree:true });
}catch(e){}
try{
  new MutationObserver(ajustarNumsPronto).observe(document.body, { childList:true, characterData:true, subtree:true });
  if(document.fonts && document.fonts.ready) document.fonts.ready.then(ajustarNumsPronto);
}catch(e){}
window.addEventListener('resize', ajustarNumsPronto);
/* v291: ¿entra el mes al lado del nombre? Se prueba el largo, después el medio
   ("Nov 2026") y por último el corto ("nov 26"). */
function ajustarTopbar(){
  var tb = document.querySelector('.topbar'); if(!tb) return;
  var br = tb.querySelector('.brand'), mo = tb.querySelector('.month');
  if(!br || !mo || !tb.offsetWidth) return;
  var entra = function(){
    if(br.offsetParent === null) return true;              // en la compu el nombre va en el costado
    var b = br.querySelector('b');
    return tb.scrollWidth <= tb.clientWidth + 1 && (!b || b.scrollWidth <= b.clientWidth + 1)
      && br.getBoundingClientRect().right <= mo.getBoundingClientRect().left - 6;
  };
  tb.classList.remove('corto', 'mini');
  if(entra()) return;
  tb.classList.add('corto');
  if(entra()) return;
  tb.classList.remove('corto'); tb.classList.add('mini');
}
var _tbT = null;
window.addEventListener('resize', function(){ clearTimeout(_tbT); _tbT = setTimeout(ajustarTopbar, 60); });
try{ if(document.fonts && document.fonts.ready) document.fonts.ready.then(function(){ ajustarTopbar(); }); }catch(e){}
window.addEventListener('load', function(){ ajustarTopbar(); });
window.__ajustarTopbar = ajustarTopbar;
/* ---- el fondo, después de agrandar o achicar la ventana ----
   En Chrome con aceleración por hardware el fondo de manchas (fijo, desenfocado
   y animado) a veces queda pintado a medias después de un cambio de tamaño. Al
   terminar el cambio se rehace (las manchas siguen en el punto de su movimiento
   en que estaban, así no saltan). Lo importante del arreglo del corte está en el
   CSS (v190: las tarjetas ya no usan backdrop-filter); esto es por las dudas. */
var _fondoT = null;
function repintarFondo(){
  var a = document.querySelector('.ambiente');
  if(!a || !a.parentNode) return;
  var tiempos = [].map.call(a.children, function(i){
    var an = i.getAnimations ? i.getAnimations()[0] : null; return an ? an.currentTime : null;
  });
  var n = a.cloneNode(true);
  a.parentNode.replaceChild(n, a);
  [].forEach.call(n.children, function(i, k){
    var an = i.getAnimations ? i.getAnimations()[0] : null;
    if(an && tiempos[k] != null) try{ an.currentTime = tiempos[k]; }catch(e){}
  });
}
window.addEventListener('resize', function(){ clearTimeout(_fondoT); _fondoT = setTimeout(repintarFondo, 180); });
var _scrollT = null;
window.addEventListener('scroll', function(){
  var h = document.documentElement;
  if(!_scrollT) h.classList.add('scrolleando');
  clearTimeout(_scrollT);
  _scrollT = setTimeout(function(){ _scrollT = null; h.classList.remove('scrolleando'); }, 450);
}, { passive:true, capture:true });
window.addEventListener('orientationchange', function(){ setTimeout(repintarFondo, 300); });
/* ---- v289: herramientas favoritas ----
   Cada herramienta tiene una estrella; las marcadas suben a "Tus favoritas",
   arriba de Herramientas. Se guardan en este dispositivo (cada uno elige las suyas). */
var FAV_KEY = 'plata-clara-favs';
var FAV_ICO = {
  dividir:'<circle cx="8" cy="8" r="3"/><circle cx="16" cy="16" r="3"/><path d="M5 19L19 5"/>',
  fijos:'<path d="M4 7h16M4 12h16M4 17h10"/><circle cx="18" cy="17" r="2.2"/>',
  cyc:'<rect x="4" y="3" width="16" height="18" rx="2.5"/><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"/>',
  conv:'<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  hext:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
  familia:'<circle cx="9" cy="8" r="3"/><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="9" r="2.3"/><path d="M16.5 13.6c2.6.2 4.5 2.1 4.5 5"/>',
  viaje:'<path d="M3 13l18-7-7 18-2.5-8.5L3 13z"/>'
};
var FAV_NOM = { dividir:'Dividir gastos', fijos:'Gastos fijos', cyc:'¿Cuotas o contado?', conv:'Conversor', hext:'Horas extras', familia:'Grupo familiar', viaje:'Viaje' };
function favsLeer(){
  try{ var a = JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); return Array.isArray(a) ? a.filter(function(k){ return FAV_NOM[k]; }) : []; }catch(e){ return []; }
}
function favsGuardar(a){ try{ localStorage.setItem(FAV_KEY, JSON.stringify(a)); }catch(e){} }
function estrellaSvg(on){
  return '<svg viewBox="0 0 24 24" fill="'+(on ? 'currentColor' : 'none')+'" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.9z"/></svg>';
}
function pintarFavs(){
  var v = $('#v-tools'); if(!v) return;
  var favs = favsLeer();
  [].slice.call(v.querySelectorAll('.tool')).forEach(function(t){
    var b = t.querySelector(':scope > [data-go]'), w = t.querySelector('.tool-acc');
    if(b && !w){
      w = document.createElement('div'); w.className = 'tool-acc';
      b.parentNode.insertBefore(w, b);
      var e = document.createElement('button');
      e.type = 'button'; e.className = 'estr'; e.setAttribute('data-fav', b.getAttribute('data-go'));
      w.appendChild(e); w.appendChild(b);
    }
    var st = t.querySelector('[data-fav]'); if(!st) return;
    var k = st.getAttribute('data-fav'), on = favs.indexOf(k) >= 0;
    st.classList.toggle('on', on);
    st.setAttribute('aria-pressed', on ? 'true' : 'false');
    st.setAttribute('aria-label', (on ? 'Sacar de favoritas: ' : 'Marcar como favorita: ') + (FAV_NOM[k] || k));
    st.title = on ? 'Sacar de favoritas' : 'Marcar como favorita';
    st.innerHTML = estrellaSvg(on);
  });
  var card = $('#favCard'), lst = $('#favList');
  if(!card || !lst) return;
  card.hidden = !favs.length;
  lst.innerHTML = favs.map(function(k){
    return '<button class="fav" type="button" data-go="'+k+'"><i><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
      + FAV_ICO[k] + '</svg></i><b>'+esc(FAV_NOM[k])+'</b></button>';
  }).join('');
}
document.addEventListener('click', function(e){
  var st = e.target.closest && e.target.closest('[data-fav]'); if(!st) return;
  var k = st.getAttribute('data-fav'), a = favsLeer(), i = a.indexOf(k);
  if(i >= 0) a.splice(i, 1); else a.push(k);
  favsGuardar(a); pintarFavs();
  toast(i >= 0 ? FAV_NOM[k] + ': fuera de favoritas' : FAV_NOM[k] + ': en tus favoritas, arriba de todo');
});

function render(){
  arrOlvidar();
  pintarFavs();
  $('#mesLab').textContent = ymLabel(mes);
  $('#mesLabSm').textContent = ymLabel(mes, true);
  $('#mesLabMd').textContent = ymLabel(mes, 'mini') + ' ' + mes.slice(0, 4);
  ajustarTopbar();
  renderResumen();
  renderMov();
  renderCuotas();
  renderAhorro();
  renderFijos();
  renderDolar();
  pintarCarga();
  renderCuentas();
  renderArr();
  renderAviso();
  pintarMoneda();
  renderAjustes();
  renderCats();
  renderMedios();
  renderPresuEdit();
  pintarQuienForms();
  pintarVerQuien();
  // la pantalla del viaje se redibuja sola cuando la tocás: redibujarla acá
  // (llega el dólar, se actualizan las tasas) borraría el gasto a medio escribir
  if(vista !== 'viaje' && !vjEnCarga()) renderViaje();
  if(vista === 'conv') renderConv();     // llegó el dólar nuevo
  if(vista === 'hext') renderHx();      // cambió el mes, o llegó algo de otro dispositivo
  pintarFechas();
}

function renderAjustes(){
  pintarEspacio();
  renderDisp();
  var d = $('#dondeGuarda'); if(!d) return;
  cuentaPintarAjustes();
  d.textContent = (modo === 'base' && dbSes.usuario)
    ? 'Tus datos están en tu cuenta. Igual podés bajarte una copia en un archivo, o subir una.'
    : (modo === 'archivo')
    ? 'Se guardan en el teléfono. Al abrir, dejo una copia en Descargas.'
    : (modo === 'nube')
      ? 'Se guardan solos: los tenés en cualquier navegador donde abras la app.'
      : 'Se guardan en este navegador. Exportá una copia cada tanto.';
  var nAp = S.metas.reduce(function(a,m){ return a + (m.aportes||[]).length; },0);
  $('#resumenDatos').textContent = S.tx.length+' movimientos · '+S.planes.length+(S.planes.length===1?' compra en cuotas':' compras en cuotas')
    + ' · '+S.metas.length+(S.metas.length===1?' meta':' metas')+' con '+nAp+(nAp===1?' aporte':' aportes')
    + ' · '+gruposConTope(mes).length+' grupos con tope.';
}

function iconFor(kind){
  if(kind==='in') return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 19V5m0 0l-6 6m6-6l6 6"/></svg>';
  if(kind==='out') return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14m0 0l6-6m-6 6l-6-6"/></svg>';
  if(kind==='cuota') return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><path d="M2.5 10h19"/></svg>';
  if(kind==='fijo') return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.85" stroke-linecap="round"><path d="M12 7v5l3 2"/><circle cx="12" cy="12" r="8.5"/></svg>';
  if(kind==='saca') return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 3v18m0 0l6-6m-6 6l-6-6"/><path d="M4 3h16" stroke-linecap="round"/></svg>';
  if(kind==='tasa') return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M4 19L20 5"/><circle cx="7.5" cy="8" r="2.6"/><circle cx="16.5" cy="16" r="2.6"/></svg>';
  if(kind==='pase') return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h14m0 0l-4-4m4 4l-4 4M20 16H6m0 0l4-4m-4 4l4 4"/></svg>';
  if(kind==='carry') return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h11m0 0l-4-4m4 4l-4 4"/><path d="M19 5v14"/></svg>';
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><path d="M12 3v18M5 8l7-5 7 5M5 8v8l7 5 7-5V8"/></svg>';
}
/* El recuadrito del ícono de un renglón. `cat` llega sólo cuando el renglón es
   un gasto que se tiene que pintar con el color de su grupo —el mismo tinte
   suave con el que se pinta ese día en el calendario, así el renglón se ata de
   un vistazo con la franja y con la leyenda de arriba—. Sin `cat` y con
   `llena`, el ícono va en bloque pleno; sin ninguna de las dos, queda el
   recuadrito de siempre. */
function marcaFila(kind, cat, llena){
  if(cat){
    var hex = colorGrupo(grupoDeCat(cat || 'Otros'));
    return '<span class="mark" style="background:' + colorSuave(hex) + ';color:' + hex + '">'
      + iconFor(kind) + '</span>';
  }
  return '<span class="mark' + (llena ? ' llena ' : ' ') + kind + '">' + iconFor(kind) + '</span>';
}
function emptyBox(txt){
  return '<div class="empty"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="9"/><path d="M8 13h8"/></svg><div>'+esc(txt)+'</div></div>';
}
