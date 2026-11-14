/* Cuentas Claras · js/estado.js
   El estado de la app (S): las listas de fábrica (categorías, medios, grupos) y el estado vacío.

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

/* ============================================================
   estado
   ============================================================ */
var CAT_GASTO = ['Súper','Comida afuera','Alquiler','Servicios','Transporte','Salud','Deporte','Ocio','Ropa','Educación','Impuestos','Regalos','Otros'];
var CAT_ING   = ['Sueldo','Freelance','Ventas','Alquileres','Intereses','Regalo','Otros'];
var MEDIOS    = ['Efectivo','Débito','Crédito','Transferencia','Billetera virtual'];
var GRUPOS_DEF = [
  { id:'casa',   nombre:'Casa' },
  { id:'dia',    nombre:'Día a día' },
  { id:'gustos', nombre:'Gustos' },
  { id:'crecer', nombre:'Crecimiento' },
  { id:'otros',  nombre:'Otros' }
];
var MAX_GRUPOS = 8;
var PANELES = ['cats','cal','medios','meses','cuotas','movs','presu'];
var GRUPO_CAT = {
  'Alquiler':'casa','Servicios':'casa','Impuestos':'casa',
  'Súper':'dia','Transporte':'dia','Salud':'dia',
  'Comida afuera':'gustos','Ocio':'gustos','Deporte':'gustos','Ropa':'gustos','Regalos':'gustos',
  'Educación':'crecer',
  'Otros':'otros'
};
function esGrupo(id){ return !!grupoPorId(id); }
function grupoPorId(id){
  var l = (S && S.grupos) || [];
  for(var i=0;i<l.length;i++) if(l[i].id === id) return l[i];
  return null;
}
/* ---------- los colores de los grupos ----------
   El color de un grupo es un código común y corriente ("#C0392B"): podés usar
   uno de los básicos o inventarte el que quieras con la rueda. Antes eran ocho
   números fijos, cada uno atado a una variable de CSS; los datos viejos se
   traducen al abrir y no se pierde nada.

   Lo único que la app se reserva es la LEGIBILIDAD. El mismo color tiene que
   verse sobre un fondo casi blanco y sobre uno casi negro, así que al dibujarlo
   —sólo al dibujarlo: lo que se guarda es tu color, tal cual— se aclara o se
   oscurece lo mínimo indispensable para que no se pierda contra el fondo. */
var COLORES_BASE = [
  { n:'Rojo',     v:'#C0392B' },
  { n:'Naranja',  v:'#C2691C' },
  { n:'Amarillo', v:'#B08A12' },
  { n:'Verde',    v:'#4F8A2E' },
  { n:'Turquesa', v:'#0E8C7C' },
  { n:'Azul',     v:'#3563AE' },
  { n:'Violeta',  v:'#7B4FBF' },
  { n:'Rosa',     v:'#B93B84' }
];
var MAX_COLORES = 12;          // cuántos colores propios se guardan
function esHex(v){ return typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v); }
function normHex(v){ return esHex(v) ? ('#' + v.slice(1).toUpperCase()) : ''; }
function esBasico(hex){
  for(var i=0;i<COLORES_BASE.length;i++) if(COLORES_BASE[i].v === hex) return true;
  return false;
}
function hexRgb(h){ return [parseInt(h.slice(1,3),16), parseInt(h.slice(3,5),16), parseInt(h.slice(5,7),16)]; }
function dosDig(n){
  var s = Math.max(0, Math.min(255, Math.round(n))).toString(16).toUpperCase();
  return s.length < 2 ? '0' + s : s;
}
function rgbHex(r,g,b){ return '#' + dosDig(r) + dosDig(g) + dosDig(b); }
function hslRgb(h, s, l){
  h = (((h % 360) + 360) % 360) / 360;
  if(s <= 0){ var v = l * 255; return [v, v, v]; }
  function f(p, q, t){
    if(t < 0) t += 1;
    if(t > 1) t -= 1;
    if(t < 1/6) return p + (q - p) * 6 * t;
    if(t < 1/2) return q;
    if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  }
  var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  var p = 2 * l - q;
  return [f(p,q,h+1/3)*255, f(p,q,h)*255, f(p,q,h-1/3)*255];
}
function rgbHsl(r, g, b){
  r /= 255; g /= 255; b /= 255;
  var mx = Math.max(r,g,b), mn = Math.min(r,g,b), l = (mx+mn)/2, h = 0, s = 0;
  if(mx !== mn){
    var d = mx - mn;
    s = l > 0.5 ? d/(2-mx-mn) : d/(mx+mn);
    if(mx === r) h = (g-b)/d + (g < b ? 6 : 0);
    else if(mx === g) h = (b-r)/d + 2;
    else h = (r-g)/d + 4;
    h *= 60;
  }
  return { h:h, s:s, l:l };
}
function hslHex(h, s, l){ var c = hslRgb(h, s, l); return rgbHex(c[0], c[1], c[2]); }
function hslDeHex(hex){ var c = hexRgb(hex); return rgbHsl(c[0], c[1], c[2]); }
/* Luminancia relativa, la de las normas de contraste: cuánta luz manda un color
   de verdad, no cuán "claro" se escribe. Un amarillo puro tiene L 50% y sin
   embargo encandila sobre blanco. */
function luzDe(hex){
  var c = hexRgb(hex).map(function(v){
    v = v / 255;
    return v <= 0.03928 ? v/12.92 : Math.pow((v + 0.055)/1.055, 2.4);
  });
  return 0.2126*c[0] + 0.7152*c[1] + 0.0722*c[2];
}
function temaOscuro(){
  var t = document.documentElement.getAttribute('data-theme');
  if(t === 'dark') return true;
  if(t === 'light') return false;
  try{ return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); }
  catch(e){ return false; }
}
function colorVisible(hex){
  hex = normHex(hex) || COLORES_BASE[0].v;
  var osc = temaOscuro(), c = hslDeHex(hex), out = hex, vueltas = 0;
  while(vueltas++ < 40){
    var y = luzDe(out);
    if(osc ? y >= 0.16 : y <= 0.42) break;
    c.l = osc ? Math.min(0.97, c.l + 0.025) : Math.max(0.03, c.l - 0.025);
    out = hslHex(c.h, c.s, c.l);
  }
  return out;
}
function colorGrupo(id){
  var g = grupoPorId(id);
  return colorVisible(g ? g.color : COLORES_BASE[0].v);
}
function colorLibre(){
  var usados = {};
  (S.grupos||[]).forEach(function(g){ usados[normHex(g.color)] = true; });
  for(var i=0;i<COLORES_BASE.length;i++) if(!usados[COLORES_BASE[i].v]) return COLORES_BASE[i].v;
  var mios = (S && S.colores) || [];
  for(var k=0;k<mios.length;k++) if(!usados[mios[k]]) return mios[k];
  return COLORES_BASE[(S.grupos||[]).length % COLORES_BASE.length].v;
}
function grupoConColor(hex, salvo){
  hex = normHex(hex);
  if(!hex) return null;
  for(var i=0;i<S.grupos.length;i++){
    if(S.grupos[i].id !== salvo && normHex(S.grupos[i].color) === hex) return S.grupos[i];
  }
  return null;
}
/* Al abrir: el color guardado puede ser un código o, en los datos de antes, un
   número del 0 al 7 —una posición en la paleta vieja—, que se traduce al básico
   que le corresponde. */
function colorDeGuardado(v, i){
  if(esHex(v)) return normHex(v);
  var n = parseInt(v, 10);
  if(isFinite(n) && n >= 0) return COLORES_BASE[n % COLORES_BASE.length].v;
  return COLORES_BASE[i % COLORES_BASE.length].v;
}

function ingresoUltimoMes(tx){
  if(!Array.isArray(tx)) return 0;
  var ult = '';
  tx.forEach(function(t){ if(t && t.tipo==='ingreso' && ymOf(t.fecha) > ult) ult = ymOf(t.fecha); });
  if(!ult) return 0;
  return tx.reduce(function(a,t){ return a + ((t && t.tipo==='ingreso' && ymOf(t.fecha)===ult) ? montoPesos(t) : 0); }, 0);
}
function sumarFaltantes(lista, defaults, quitadas){
  defaults.forEach(function(c){
    if(lista.indexOf(c) > -1) return;
    if(quitadas && quitadas.indexOf(c) > -1) return;   // el usuario la borró o le cambió el nombre
    var i = lista.indexOf('Otros');
    if(i > -1) lista.splice(i, 0, c); else lista.push(c);
  });
}

function emptyState(){
  var gr = GRUPOS_DEF.map(function(g, i){ return { id:g.id, nombre:g.nombre, color:COLORES_BASE[i % COLORES_BASE.length].v }; });
  var gd = {};
  CAT_GASTO.forEach(function(c){ gd[c] = GRUPO_CAT[c] || 'otros'; });
  return { v:4, updatedAt:0, tx:[], planes:[], metas:[], presuGrupo:{}, presuFijo:{}, grupoDe:gd, grupos:gr, colores:[],
           baseIngreso:0, catGasto:CAT_GASTO.slice(), catIng:CAT_ING.slice(), catQuitadas:[],
           medios:MEDIOS.slice(), mediosQuitados:[],
           orden:PANELES.slice(), dolar:{ venta:0, fecha:'' },
           fijos:[], reparto:{ modo:'partes', pct:{} }, famCero:{}, arrastre:{}, arrastreModo:'preguntar', diaMedio:{}, pases:[], personas:[],
           aviso:{ on:false, hora:21, min:0, dias:'todos', saltar:true } };
}
var S = emptyState();
var mes = ymNow();
var vista = 'resumen';
var filtroMov = 'todo';
var catFiltro = '';      // 'gasto|Ocio', 'ingreso|Sueldo' o '' (todas)
var medFiltro = '';      // v289: un medio de pago ('Mercado Pago') o '' (todos)
var rangoMeses = (function(){ try{ var v = parseInt(localStorage.getItem('plata-clara-rango'),10); return (v===12?12:6); }catch(e){ return 6; } })();
var tipoMov = 'gasto';
var confirmId = null;
var HOST_THEME = document.documentElement.getAttribute('data-theme');
var tema = (function(){ try{ var t = localStorage.getItem('plata-clara-tema'); return (t==='claro'||t==='oscuro') ? t : 'sistema'; }catch(e){ return 'sistema'; } })();
function aplicarTema(t){
  var r = document.documentElement;
  if(t==='claro') r.setAttribute('data-theme','light');
  else if(t==='oscuro') r.setAttribute('data-theme','dark');
  else if(HOST_THEME) r.setAttribute('data-theme', HOST_THEME);
  else r.removeAttribute('data-theme');
  $$('#segTema button').forEach(function(b){ b.setAttribute('aria-pressed', b.getAttribute('data-v')===t ? 'true':'false'); });
}

/* Si el tema lo pone el sistema y el sistema cambia, los colores de los grupos
   tienen que volver a ajustarse solos. */
try{
  var _mqOscuro = window.matchMedia('(prefers-color-scheme: dark)');
  var _alCambiarSistema = function(){ if(tema === 'sistema') render(); };
  if(_mqOscuro.addEventListener) _mqOscuro.addEventListener('change', _alCambiarSistema);
  else if(_mqOscuro.addListener) _mqOscuro.addListener(_alCambiarSistema);
}catch(e){}
