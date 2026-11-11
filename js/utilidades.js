/* Cuentas Claras · js/utilidades.js
   Funciones chicas que usa todo el resto: fechas, formato de plata y porcentajes, selectores, ids.

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

/* ============================================================
   utilidades
   ============================================================ */
/* ---------- sacar la intro ----------
   Va acá arriba de todo para que el reloj arranque lo antes posible: la intro
   se dibuja sola con CSS y este temporizador es lo único que la saca. Aunque la
   pestaña quede en segundo plano —donde las animaciones se pausan— el
   temporizador corre igual, así que nunca queda pegada.

   `window.SIN_INTRO` la saltea. Lo usan las pruebas y los scripts de capturas,
   que no tienen por qué esperar un segundo y pico cada vez. */
(function(){
  var e = document.getElementById('intro');
  if(!e) return;
  function sacar(){ if(e.parentNode) e.parentNode.removeChild(e); }
  if(window.SIN_INTRO){ sacar(); return; }
  setTimeout(sacar, 1500);
})();

/* v227: como una app de celular, la pantalla no se agranda: ni al tocar un
   campo (Safari lo hacía con letra de menos de 16 px y quedaba así), ni con
   dos dedos, ni con doble toque. En la compu el zoom del navegador (Ctrl +)
   sigue andando. */
(function(){
  var ms = document.querySelectorAll('meta[name="viewport"]');
  if(!ms.length){ var m = document.createElement('meta'); m.name = 'viewport'; m.content = 'width=device-width,initial-scale=1,viewport-fit=cover'; (document.head || document.documentElement).appendChild(m); ms = [m]; }
  [].forEach.call(ms, function(m){
    var c = (m.getAttribute('content') || 'width=device-width,initial-scale=1').replace(/,?\s*(maximum-scale|minimum-scale|user-scalable)=[^,]*/g, '');
    m.setAttribute('content', c + ',minimum-scale=1,maximum-scale=1,user-scalable=no');
  });
  // iOS no hace caso a user-scalable=no para los dos dedos: se frena acá
  var tactil = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if(!tactil) return;
  ['gesturestart', 'gesturechange', 'gestureend'].forEach(function(ev){
    document.addEventListener(ev, function(e){ e.preventDefault(); }, { passive:false });
  });
})();
var $ = function(s,r){ return (r||document).querySelector(s); };
var $$ = function(s,r){ return Array.prototype.slice.call((r||document).querySelectorAll(s)); };
var uid = function(){ return Math.random().toString(36).slice(2,9)+Date.now().toString(36).slice(-4); };
function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){
  return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }

var MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
var DIAS_SEM = ['lunes','martes','miércoles','jueves','viernes','sábado','domingo'];

var nfFull = new Intl.NumberFormat('es-AR',{minimumFractionDigits:2,maximumFractionDigits:2});
var nfInt  = new Intl.NumberFormat('es-AR',{maximumFractionDigits:0});
function money(n){
  n = Number(n)||0;
  var s = (Math.abs(n % 1) < 0.005) ? nfInt.format(Math.round(n)) : nfFull.format(n);
  return (n<0? '-$ ' : '$ ') + s.replace('-','');
}
/* Para tablas: el mismo número pero sin el "$", que ahí se repite en cada celda
   y hace que no entre en un celular. El símbolo se aclara una vez al pie. */
function numTabla(n){
  n = Number(n)||0;
  var s = (Math.abs(n % 1) < 0.005) ? nfInt.format(Math.round(n)) : nfFull.format(n);
  return (n<0 ? '−' : '') + s.replace('-','');
}
function usd(n){
  n = Number(n)||0;
  var s = (Math.abs(n % 1) < 0.005) ? nfInt.format(Math.round(n)) : nfFull.format(n);
  return (n<0? '-U$S ' : 'U$S ') + s.replace('-','');
}
function enMoneda(n, moneda){ return moneda === 'USD' ? usd(n) : money(n); }
function cotDolar(){ return Math.max(0, Number(S.dolar && S.dolar.venta) || 0); }
function aPesos(monto, moneda, cot){
  monto = Number(monto)||0;
  if(moneda !== 'USD') return monto;
  var c = Number(cot) > 0 ? Number(cot) : cotDolar();
  return c > 0 ? monto * c : 0;
}
/* Un movimiento en dólares guarda `mon:'USD'` y `cot`, el blue del día en que se
   cargó. Se convierte SIEMPRE con esa cotización, no con la de hoy: así un mes
   ya cerrado no se reescribe solo cada vez que se mueve el dólar. */
function esUSD(x){ return !!(x && x.mon === 'USD'); }
function montoPesos(x){
  if(!x) return 0;
  var m = Number(x.monto)||0;
  if(!esUSD(x)) return m;
  var c = Number(x.cot) > 0 ? Number(x.cot) : cotDolar();
  return c > 0 ? m * c : 0;
}
function montoUSD(x){ return esUSD(x) ? (Number(x.monto)||0) : 0; }
function moneyShort(n){
  n = Number(n)||0; var a = Math.abs(n);
  if(a >= 1000000) return (n<0?'-':'')+'$ '+nfFull.format(a/1000000).replace(/,?0+$/,'')+' M';
  if(a >= 10000) return (n<0?'-':'')+'$ '+nfInt.format(Math.round(a/1000))+' mil';
  return money(n);
}
/* Cómo se escribe un número DENTRO de un campo editable. Va aparte de money()
   porque acá no hay que redondear nunca al peso: si escribiste 45.000,56, el
   campo tiene que decir 45.000,56. Redondear no era sólo feo de ver —el próximo
   guardado se llevaba puesto el número de verdad y te comía los centavos—. */
function enCampo(n){
  n = Number(n);
  if(!isFinite(n) || n === 0) return n === 0 ? '0' : '';
  var r = Math.round(n * 100) / 100;
  return (Math.abs(r % 1) < 0.005) ? nfInt.format(Math.round(r)) : nfFull.format(r);
}
function parseMoney(v){
  if(v==null) return 0;
  var s = String(v).replace(/[^0-9.,-]/g,'').trim();
  if(!s) return 0;
  var hasC = s.indexOf(',')>-1, hasD = s.indexOf('.')>-1;
  if(hasC && hasD){ s = s.replace(/\./g,'').replace(',','.'); }
  else if(hasC){ s = s.replace(',','.'); }
  else if(hasD){
    var parts = s.split('.');
    var last = parts[parts.length-1];
    if(parts.length>2 || last.length===3) s = parts.join('');
  }
  var n = parseFloat(s);
  return isFinite(n) ? n : 0;
}
/* ---------- puntos de miles mientras se escribe ---------- */
function separarMiles(entero){
  return entero.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}
function formatearPlata(el){
  var antes = el.value;
  var desdeElFinal = antes.length - (el.selectionEnd == null ? antes.length : el.selectionEnd);
  // los puntos los pone la app: del texto sólo me quedo con dígitos y la coma decimal
  var limpio = antes.replace(/[^\d,]/g, '');
  var partes = limpio.split(',');
  var ent = partes[0].replace(/^0+(?=\d)/, '').slice(0, 15);
  var dec = partes.length > 1 ? ',' + partes.slice(1).join('').slice(0, 2) : '';
  var salida = (ent ? separarMiles(ent) : (dec ? '0' : '')) + dec;
  if(salida === antes) return;
  el.value = salida;
  var pos = Math.max(0, salida.length - desdeElFinal);
  try{ el.setSelectionRange(pos, pos); }catch(e){}
}
document.addEventListener('input', function(e){
  var el = e.target;
  if(el && el.matches && el.matches('.money-in, [data-money]')) formatearPlata(el);
}, true);

function today(){ var d=new Date(); return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
function fechaISO(d){ return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate()); }
function pad(n){ return (n<10?'0':'')+n; }
function ymOf(fecha){ return String(fecha||'').slice(0,7); }
function ymNow(){ return today().slice(0,7); }
function ymAdd(ym,k){
  var y = parseInt(ym.slice(0,4),10), m = parseInt(ym.slice(5,7),10)-1 + k;
  y += Math.floor(m/12); m = ((m%12)+12)%12;
  return y+'-'+pad(m+1);
}
function ymDiff(a,b){ // b - a en meses
  return (parseInt(b.slice(0,4),10)-parseInt(a.slice(0,4),10))*12 + (parseInt(b.slice(5,7),10)-parseInt(a.slice(5,7),10));
}
function ymLabel(ym,short){
  var m = MESES[parseInt(ym.slice(5,7),10)-1] || '';
  if(short === 'mini') return m.slice(0,3);
  if(short) return m.slice(0,3)+' '+ym.slice(2,4);
  return m+' '+ym.slice(0,4);
}
function fechaLabel(f){
  var d = parseInt(f.slice(8,10),10), m = MESES[parseInt(f.slice(5,7),10)-1]||'';
  return d+' '+m.slice(0,3);
}
