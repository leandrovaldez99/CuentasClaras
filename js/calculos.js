/* Cuentas Claras · js/calculos.js
   Las cuentas: gastos fijos, días hábiles y feriados, inflación, cuotas, metas de ahorro y resumen del mes.

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

/* ============================================================
   cálculos
   ============================================================ */
function cuotaMonto(p){ return (Number(p.total)||0) / Math.max(1, Number(p.n)||1); }
/* La cuota no se debita el 1: cae cuando vence el resumen de la tarjeta, y ese
   día cambia de tarjeta en tarjeta. `p.dia` lo guarda; en los meses cortos se
   clampea al último día, igual que en los movimientos fijos. */
function diaCuota(p, ym){ return Math.min(Math.max(1, Number(p.dia)||1), finDeMes(ym)); }
function fechaCuota(p, ym){ return ym + '-' + pad(diaCuota(p, ym)); }
function cuotasDe(ym){
  var out = [];
  S.planes.forEach(function(p){
    var i = ymDiff(p.desde, ym);
    if(i < 0 || i >= (Number(p.n)||0)) return;
    var fe = fechaCuota(p, ym), w = pesoDe(p, ym);
    if(!(w > 0)) return;
    out.push({ plan:p, i:i, monto:cuotaMonto(p) * w, fecha:fe, pend:todaviaNoLlego(fe, ym), parte:w < 1 ? w : 0 });
  });
  return out;
}
// las que ya se debitaron: son las que entran en los totales del mes
function cuotasVal(ym){ return yaOcurrio(cuotasDe(ym)); }
/* Cuántas cuotas van pagadas mirando desde el mes `ym`. La del mes que estás
   mirando cuenta apenas llega su día de débito: antes la barra se empezaba a
   llenar recién al mes siguiente de la primera cuota. */
function cuotasPagadas(p, ym){
  var n = Math.max(1, Number(p.n)||1), i = ymDiff(p.desde, ym);
  if(i < 0) return 0;
  var k = Math.min(n, i);
  if(i < n && !todaviaNoLlego(fechaCuota(p, ym), ym)) k++;
  return Math.min(n, k);
}
/* ---- gastos fijos y suscripciones ----
   Igual que las cuotas, no se guardan como movimientos: se guarda la regla (cada
   cuánto, cuánto y desde cuándo) y el gasto de cada mes se deriva de ahí.
   El precio es una lista de cambios: cuando aumenta, se agrega un tramo nuevo y
   los meses anteriores siguen valiendo lo que valían. */
function finDeMes(ym){
  var y = parseInt(ym.slice(0,4),10), m = parseInt(ym.slice(5,7),10);
  return new Date(y, m, 0).getDate();
}
/* ---- días hábiles y feriados de Argentina ----
   Día hábil = de lunes a viernes y que no sea feriado. Los feriados salen del
   calendario oficial que publica api.argentinadatos.com (inamovibles,
   trasladables ya corridos a su lunes y días puente). La app trae 2025 y 2026
   adentro; los otros años los pide a esa API cuando hay internet y los guarda
   en este dispositivo (no viajan con tus datos: son iguales para todos). Si un
   año todavía no se pudo bajar, se arma con las reglas de la ley 27.399: los
   inamovibles, Carnaval y Viernes Santo según la Pascua, y los trasladables
   corridos al lunes. Los puentes no se pueden adivinar: aparecen cuando se baja
   la lista oficial de ese año. */
var FERIADOS_KEY = 'plata-clara-feriados';
var FERIADOS_URL = 'https://api.argentinadatos.com/v1/feriados/';
var FERIADOS_BASE = {
  '2025': '01-01 03-03 03-04 03-24 04-02 04-18 05-01 05-02 05-25 06-16 06-20 07-09 08-15 08-17 10-10 10-12 11-21 11-24 12-08 12-25',
  '2026': '01-01 02-16 02-17 03-23 03-24 04-02 04-03 05-01 05-25 06-15 06-20 07-09 07-10 08-17 10-12 11-09 11-23 12-07 12-08 12-25'
};
var feriadosBajados = (function(){
  try{ var o = JSON.parse(localStorage.getItem(FERIADOS_KEY) || '{}'); return (o && typeof o === 'object' && !Array.isArray(o)) ? o : {}; }
  catch(e){ return {}; }
})();
var _ferCache = {};
function mmdd(dt){ return pad(dt.getMonth()+1) + '-' + pad(dt.getDate()); }
// domingo de Pascua (algoritmo de Meeus/Jones/Butcher, calendario gregoriano)
function pascua(y){
  var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4,
      f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19*a + b - d - g + 15) % 30,
      i = Math.floor(c / 4), k = c % 4, l = (32 + 2*e + 2*i - h - k) % 7, m = Math.floor((a + 11*h + 22*l) / 451),
      n = h + l - 7*m + 114;
  return new Date(y, Math.floor(n / 31) - 1, (n % 31) + 1);
}
function feriadosPorRegla(y){
  var l = ['01-01','03-24','04-02','05-01','05-25','06-20','07-09','12-08','12-25'], p = pascua(y);
  [-48, -47, -2].forEach(function(n){ l.push(mmdd(new Date(y, p.getMonth(), p.getDate() + n))); });
  // trasladables: si caen martes o miércoles pasan al lunes anterior; jueves o viernes, al lunes siguiente
  ['06-17','08-17','10-12','11-20'].forEach(function(s){
    var dt = new Date(y, parseInt(s.slice(0,2),10) - 1, parseInt(s.slice(3),10)), w = dt.getDay();
    if(w === 2 || w === 3) dt.setDate(dt.getDate() - (w - 1));
    else if(w === 4 || w === 5) dt.setDate(dt.getDate() + (8 - w));
    l.push(mmdd(dt));
  });
  return l;
}
function feriadosDe(y){
  var k = String(y);
  if(_ferCache[k]) return _ferCache[k];
  var l = Array.isArray(feriadosBajados[k]) ? feriadosBajados[k]
        : FERIADOS_BASE[k] ? FERIADOS_BASE[k].split(' ') : feriadosPorRegla(y);
  var o = {}; l.forEach(function(x){ o[x] = 1; });
  return (_ferCache[k] = o);
}
function esFeriado(y, m, d){ return !!feriadosDe(y)[pad(m) + '-' + pad(d)]; }
function esDiaDeSemana(y, m, d){ var w = new Date(y, m-1, d).getDay(); return w >= 1 && w <= 5; }
function esHabil(y, m, d){ return esDiaDeSemana(y, m, d) && !esFeriado(y, m, d); }
/* La lista oficial se pide una vez por día como mucho, del año en curso y del
   que viene (que se publica a fin de año: mientras tanto vale la regla). */
window.__feriadosListo = function(anio, txt){
  var l = null;
  try{ l = (typeof txt === 'string') ? JSON.parse(txt) : txt; }catch(e){ return; }
  if(!Array.isArray(l)) return;
  var k = String(anio), out = [];
  l.forEach(function(x){
    var f = String(x && x.fecha || '');
    if(f.slice(0,4) === k && /^\d{4}-\d{2}-\d{2}$/.test(f) && out.indexOf(f.slice(5)) < 0) out.push(f.slice(5));
  });
  if(out.length < 8 || out.length > 40) return;    // vacía o rara: no me la creo
  out.sort();
  var antes = JSON.stringify(feriadosBajados[k] || null);
  feriadosBajados[k] = out;
  feriadosBajados._dia = feriadosBajados._dia || {};
  feriadosBajados._dia[k] = today();
  try{ localStorage.setItem(FERIADOS_KEY, JSON.stringify(feriadosBajados)); }catch(e){}
  if(antes !== JSON.stringify(out)){ _ferCache = {}; try{ render(); }catch(e){} }
};
function traerFeriados(){
  var y = new Date().getFullYear(), hoyF = today();
  [y, y + 1].forEach(function(a){
    var k = String(a);
    if(feriadosBajados._dia && feriadosBajados._dia[k] === hoyF) return;
    try{
      fetch(FERIADOS_URL + k, {cache:'no-store'})
        .then(function(r){ return r.ok ? r.text() : ''; })
        .then(function(t){ if(t) window.__feriadosListo(a, t); })
        .catch(function(){});
    }catch(e){}
  });
}
/* ---- la inflación ----
   El IPC mensual del INDEC, para la calculadora de cuotas o contado. Fuente:
   api.argentinadatos.com (la misma de los feriados y los plazos fijos). Se pide
   una vez por día y queda guardado en este dispositivo; si no hay internet, se
   usa el último que se bajó o, la primera vez, el que viene con la app. */
var IPC_URL = 'https://api.argentinadatos.com/v1/finanzas/indices/inflacion';
var IPC_KEY = 'plata-clara-ipc';
var IPC_FABRICA = { ym:'2026-09', v:1.9, dia:'' };
var ipcDato = (function(){
  try{ var o = JSON.parse(localStorage.getItem(IPC_KEY) || 'null');
       if(o && /^\d{4}-\d{2}$/.test(o.ym) && typeof o.v === 'number' && o.ym >= IPC_FABRICA.ym) return o; }catch(e){}
  return { ym:IPC_FABRICA.ym, v:IPC_FABRICA.v, dia:'' };
})();
window.__ipcListo = function(txt){
  var l; try{ l = typeof txt === 'string' ? JSON.parse(txt) : txt; }catch(e){ return; }
  if(!Array.isArray(l)) return;
  var ult = null;
  l.forEach(function(x){
    var f = String(x && x.fecha || ''), v = Number(x && x.valor);
    if(!/^\d{4}-\d{2}-\d{2}$/.test(f) || !isFinite(v) || v < -10 || v > 60) return;
    if(!ult || f > ult.f) ult = { f:f, v:v };
  });
  if(!ult || ult.f.slice(0, 7) < ipcDato.ym) return;      // más viejo que el que tengo: no me lo creo
  var antes = ipcDato.ym + '|' + ipcDato.v;
  ipcDato = { ym:ult.f.slice(0, 7), v:Math.round(ult.v * 100) / 100, dia:today() };
  try{ localStorage.setItem(IPC_KEY, JSON.stringify(ipcDato)); }catch(e){}
  if(antes !== ipcDato.ym + '|' + ipcDato.v && vista === 'cyc'){ cycPrepararInf(); cycCalcular(); }
};
function traerIpc(){
  if(ipcDato.dia === today()) return;
  try{
    fetch(IPC_URL, {cache:'no-store'})
      .then(function(r){ return r.ok ? r.text() : ''; })
      .then(function(t){ if(t) window.__ipcListo(t); })
      .catch(function(){});
  }catch(e){}
}
function primerHabil(ym){
  var y = parseInt(ym.slice(0,4),10), m = parseInt(ym.slice(5,7),10);
  for(var d = 1; d <= 12; d++) if(esHabil(y, m, d)) return d;
  return 1;
}
/* v252: el n-ésimo día hábil del mes (el 4.º, por ejemplo): los feriados y los
   fines de semana no cuentan, así que se corre solo. */
function nHabil(ym, n){
  var y = parseInt(ym.slice(0,4),10), m = parseInt(ym.slice(5,7),10), fin = finDeMes(ym), k = 0, ult = 1;
  for(var d = 1; d <= fin; d++) if(esHabil(y, m, d)){ k++; ult = d; if(k >= n) return d; }
  return ult;
}
function nhabDe(f){ var n = parseInt(f && f.nhab, 10); return (n >= 1 && n <= 20) ? n : 4; }
function ultimoHabil(ym){
  var y = parseInt(ym.slice(0,4),10), m = parseInt(ym.slice(5,7),10), fin = finDeMes(ym);
  for(var d = fin; d > fin - 12; d--) if(esHabil(y, m, d)) return d;
  return fin;
}
/* El sueldo que entra el ÚLTIMO día hábil del mes es, en realidad, el del mes
   siguiente: te lo pagan por adelantado, para que arranques el mes con la plata.
   Por eso se cuenta ahí (en los totales, en la lista y en el aguinaldo), pero la
   FECHA no se toca: la plata entró ese día, y los saldos por medio, los
   intereses y el calendario siguen yendo por la fecha real.
   Vale para los movimientos de categoría Sueldo (menos el aguinaldo y las horas
   extras, que no son el sueldo del mes) y para un ingreso fijo de categoría
   Sueldo que cobrás "el último día hábil". */
function esUltimoHabilFecha(fecha){
  var s = String(fecha || '');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return parseInt(s.slice(8,10), 10) === ultimoHabil(s.slice(0,7));
}
function mesDeTx(t){
  var ym = ymOf(t.fecha);
  if(t.tipo === 'ingreso' && t.cat === 'Sueldo' && !t.sac && !t.hx && esUltimoHabilFecha(t.fecha)) return ymAdd(ym, 1);
  return ym;
}
function esSueldoAdelantado(f){
  return !!(f && f.tipo === 'ingreso' && f.cat === 'Sueldo' && f.dia === 'ultimoHabil');
}
/* Lo que cuenta en el mes `ym`: para un sueldo adelantado, lo que se cobró el
   último día hábil del mes anterior. Los demás fijos, lo de su propio mes. */
function ocurrenciasImp(f, ym){
  return ocurrenciasFijo(f, esSueldoAdelantado(f) ? ymAdd(ym, -1) : ym);
}
// el n-ésimo día hábil después de una fecha (n = 0: esa misma fecha)
function sumarHabiles(fecha, n){
  var dt = new Date(parseInt(fecha.slice(0,4),10), parseInt(fecha.slice(5,7),10) - 1, parseInt(fecha.slice(8,10),10));
  for(var k = 0, vueltas = 0; k < n && vueltas < 80; vueltas++){
    dt.setDate(dt.getDate() + 1);
    if(esHabil(dt.getFullYear(), dt.getMonth() + 1, dt.getDate())) k++;
  }
  return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate());
}
/* Por quincena: la 1.ª va del 1 al 15 y la 2.ª del 16 a fin de mes, y cada
   una se cobra `qhab` días hábiles después de cerrar (la ley 20.744 da hasta 4).
   La 2.ª casi siempre cae en el mes siguiente. El monto es el de cada quincena. */
function qhabDe(f){ var n = parseInt(f && f.qhab, 10); return (n >= 0 && n <= 15) ? n : 4; }
function esQuincena(f){ return !!(f && f.dia === 'quincena'); }
function pagoQuincena(f, per, q){
  return sumarHabiles(per + '-' + (q === 1 ? '15' : pad(finDeMes(per))), qhabDe(f));
}
function diaFijo(f, ym){
  if(f.dia === 'primerHabil') return primerHabil(ym);
  if(f.dia === 'ultimoHabil') return ultimoHabil(ym);
  if(f.dia === 'nHabil') return nHabil(ym, nhabDe(f));
  if(esQuincena(f)) return parseInt(pagoQuincena(f, ym, 1).slice(8), 10);
  return Math.min(Number(f.dia)||1, finDeMes(ym));
}
// sólo los gastos llevan hora; un ingreso entra en el día
function horaFijo(f){ return (f && (f.tipo || 'gasto') === 'gasto') ? vjHoraOk(f.hora) : ''; }
function diaFijoTexto(f){
  if(f.dia === 'primerHabil') return 'todos los meses el primer día hábil';
  if(f.dia === 'ultimoHabil') return 'todos los meses el último día hábil';
  if(f.dia === 'nHabil') return 'todos los meses el ' + nhabDe(f) + '.º día hábil';
  if(esQuincena(f)){ var n = qhabDe(f); return 'por quincena, ' + (n ? 'a los ' + n + ' día' + (n === 1 ? '' : 's') + ' hábil' + (n === 1 ? '' : 'es') : 'el día que cierra'); }
  var h = horaFijo(f);
  return 'todos los meses el ' + (Number(f.dia)||1) + (h ? ' a las ' + h : '');
}
var MESES_CORTOS = ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function quincenaTexto(oc){
  return (oc.q === 1 ? '1.ª' : '2.ª') + ' quincena de ' + MESES_CORTOS[parseInt(oc.per.slice(5,7),10) - 1];
}
/* Devuelve el tramo de precio vigente en ese mes: {monto, cot}. En dólares, cada
   tramo se guarda con la cotización de cuando se cargó, así los meses viejos no
   se recalculan solos. */
function tramoFijo(f, ym){
  var t = null;
  (f.precios||[]).forEach(function(x){ if(x.desde <= ym) t = x; });
  return t;
}
function precioFijo(f, ym){
  var t = tramoFijo(f, ym);
  return t ? (Number(t.monto)||0) : 0;
}
function montoFijoPesos(f, ym){
  var t = tramoFijo(f, ym);
  if(!t) return 0;
  return montoPesos({ monto:t.monto, mon:f.mon, cot:t.cot });
}
/* La fecha de un fijo en un mes es su día de siempre, salvo que lo hayas pagado
   antes: ahí cuenta el día en que lo tachaste (`f.adel[ym]`). Como todo lo demás
   —los totales, Movimientos, el calendario, los saldos por medio y los
   intereses— sale de esta fecha, alcanza con cambiarla acá. */
function fechaFijo(f, ym){
  var l = ocurrenciasFijo(f, ym);
  return l.length ? l[0].fecha : ym + '-' + pad(diaFijo(f, ym));
}
/* v204: "lo tacho yo". Desde el mes `f.man`, el fijo no se suma solo el día que
   vence: queda esperando en Pagos del mes hasta que lo tachás. Los meses de
   antes de activarlo quedan como estaban; los que vienen se siguen viendo como
   lo que está comprometido. */
function manualEn(f, per){ return !!(f && f.man && per >= f.man); }
function fijoVigente(f, per){ return per >= f.desde && (!f.hasta || per <= f.hasta); }
/* Cada vez que un fijo cae en un mes: casi siempre una, pero uno por quincena
   puede caer dos veces (la 2.ª del mes anterior y la 1.ª de éste) y hasta
   ninguna. `per` es el mes al que corresponde (manda el precio y el alta/baja),
   `clave` es con la que se guarda si lo tachaste antes, `vence` su día de
   siempre y `fecha` la que cuenta (la de vence, o el día que lo tachaste). */
function ocurrenciasFijo(f, ym){
  var out = [];
  function una(per, vence, clave, q){
    // v204: uno que tachás vos puede tacharse también después de su día
    var man = manualEn(f, per), a = adelantoDe(f, clave), aMano = !!(a && (man || a <= vence) && ymOf(a) === ym);
    out.push({ per:per, vence:vence, clave:clave, q:q || 0, fecha:aMano ? a : vence, aMano:aMano,
               man:man ? 1 : 0, falta:(man && !aMano && ymOf(vence) <= ymNow()) ? 1 : 0 });
  }
  if(esQuincena(f)){
    [ymAdd(ym, -1), ym].forEach(function(per){
      if(!fijoVigente(f, per)) return;
      [1, 2].forEach(function(q){
        var v = pagoQuincena(f, per, q);
        if(ymOf(v) === ym) una(per, v, per + '-q' + q, q);
      });
    });
    return out;
  }
  if(fijoVigente(f, ym)) una(ym, ym + '-' + pad(diaFijo(f, ym)), ym);
  return out;
}
// todo lo que entra (o sale) por un fijo en un mes, en pesos
function montoFijoMes(f, ym){
  return ocurrenciasImp(f, ym).reduce(function(a, oc){ return a + montoFijoPesos(f, oc.per); }, 0);
}
/* v226: lo que un fijo vale por mes, más allá del día en que cae la plata. Uno
   por quincena son dos quincenas por mes, aunque el primer mes sólo se cobre la
   1.ª (la 2.ª cae al mes siguiente). Es lo que va en "Entra por mes" y "Al año",
   y lo que cuenta como sueldo del mes (aguinaldo, horas extras, reparto). */
function valorFijoMes(f, ym){
  if(esQuincena(f)) return fijoVigente(f, ym) ? 2 * montoFijoPesos(f, ym) : 0;
  return montoFijoMes(f, ym);
}
/* Ya llegó: el día pasó, o es hoy y no tiene hora (o la hora ya pasó). */
function yaLlegoFijo(fecha, hora){
  var h = today();
  return fecha < h || (fecha === h && (!hora || hora <= ahoraHM()));
}
/* Pagos adelantados: { 'YYYY-MM': 'YYYY-MM-DD' }, el día en que lo tachaste a
   mano; en los de quincena la clave es la quincena ('YYYY-MM-q1' o '-q2'), que
   se puede cobrar en ese mes o en el siguiente. Va dentro del fijo, así viaja
   con él a los otros dispositivos. */
function adelLimpio(o){
  if(!o || typeof o !== 'object' || Array.isArray(o)) return undefined;
  var out = {}, n = 0;
  Object.keys(o).sort().slice(-60).forEach(function(k){
    var v = String(o[k] || '');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
    var ok = /^\d{4}-\d{2}$/.test(k) ? v.slice(0,7) === k
           : /^\d{4}-\d{2}-q[12]$/.test(k) ? (v.slice(0,7) === k.slice(0,7) || v.slice(0,7) === ymAdd(k.slice(0,7), 1))
           : false;
    if(ok){ out[k] = v; n++; }
  });
  return n ? out : undefined;
}
function adelantoDe(f, ym){ return (f && f.adel && typeof f.adel[ym] === 'string') ? f.adel[ym] : ''; }
function ponerAdelanto(f, ym, fecha){
  var o = Object.assign({}, f.adel || {});
  if(fecha) o[ym] = fecha; else delete o[ym];
  var l = adelLimpio(o);
  if(l) f.adel = l; else delete f.adel;
}
/* Un movimiento derivado del mes en curso cuyo día todavía no llegó queda
   PENDIENTE: se sigue viendo en la lista, pero no suma a los totales. Un sueldo
   que cobrás el último día hábil no es plata que tengas el día 1, y una cuota
   que vence el 12 tampoco se pagó el 1; contarlos desde el 1 hace que el mes
   mienta. Los meses pasados ya pasaron y los futuros son una proyección de lo
   que está comprometido, así que ahí cuenta todo. Lo usan los fijos y las
   cuotas por igual. */
function todaviaNoLlego(fecha, ym){ return ym === ymNow() && fecha > today(); }
/* La lista de pagos del mes: cada fijo guarda en qué meses lo tachaste. Va
   dentro del propio fijo para que viaje con él a los otros dispositivos y se
   vaya si lo borrás. Tacharlo antes de su día lo cuenta ya en el mes. */
function pagLimpio(l){
  if(!Array.isArray(l)) return undefined;
  var out = [];
  l.forEach(function(x){ x = String(x||''); if(/^\d{4}-\d{2}$/.test(x) && out.indexOf(x) < 0) out.push(x); });
  out.sort();
  return out.length ? out.slice(-60) : undefined;
}
function fijoPago(f, ym){ return !!(f && Array.isArray(f.pag) && f.pag.indexOf(ym) > -1); }
function marcarPago(f, ym, si){
  var l = (Array.isArray(f.pag) ? f.pag : []).filter(function(x){ return x !== ym; });
  if(si) l.push(ym);
  l = pagLimpio(l);
  if(l) f.pag = l; else delete f.pag;
}
/* `real`: por la fecha en que cae cada uno (el calendario y el detalle del día).
   Sin `real`: por el mes al que cuenta, que sólo difiere para el sueldo que se
   cobra el último día hábil (ver ocurrenciasImp). */
function fijosDe(ym, tipo, real, pesoFn){
  var out = [];
  (S.fijos||[]).forEach(function(f){
    if(tipo && (f.tipo||'gasto') !== tipo) return;
    var w = (pesoFn || pesoDe)(f, ym), hora = horaFijo(f);
    if(!(w > 0)) return;
    (real ? ocurrenciasFijo(f, ym) : ocurrenciasImp(f, ym)).forEach(function(oc){
      var m = montoFijoPesos(f, oc.per), fe = oc.fecha;
      if(!(m > 0)) return;
      var llego = oc.aMano || (!oc.man && yaLlegoFijo(fe, hora));
      out.push({ fijo:f, monto:m * w, propio:precioFijo(f, oc.per) * w, fecha:fe, vence:oc.vence, clave:oc.clave,
                 q:oc.q, per:oc.per, aMano:oc.aMano, hora:hora, man:oc.man, falta:oc.falta,
                 pend:((ym === ymNow() && !llego) || !!oc.falta), pago:llego, parte:w < 1 ? w : 0 });
    });
  });
  return out;
}
function fijosGasto(ym){ return fijosDe(ym, 'gasto'); }
function fijosIngreso(ym){ return fijosDe(ym, 'ingreso'); }
// los que ya ocurrieron: son los únicos que entran en los totales del mes
function yaOcurrio(l){ return l.filter(function(x){ return !x.pend; }); }
function fijosGastoVal(ym){ return yaOcurrio(fijosGasto(ym)); }
function fijosIngresoVal(ym){ return yaOcurrio(fijosIngreso(ym)); }
function sumaPend(l){ return l.reduce(function(a,x){ return a + (x.pend ? x.monto : 0); }, 0); }
// por el mes al que cuenta cada movimiento (el sueldo del último día hábil cuenta en el mes que viene)
function txDe(ym){ return conPeso(S.tx.filter(function(t){ return mesDeTx(t) === ym; })); }
// por la fecha real: es lo que usa el calendario
function txDeReal(ym){ return conPeso(S.tx.filter(function(t){ return ymOf(t.fecha) === ym; })); }
// "recencia": cuándo se cargó. Los movimientos viejos no tienen sello, así que
// vale su posición en la lista, que es el orden en que se fueron cargando.
function recencia(t, i){ var v = Number(t && t.ts); return (v > 0) ? v : i; }
function masNuevoPrimero(a, b){
  if(a.f !== b.f) return a.f < b.f ? 1 : -1;
  return b.r - a.r;
}
// lo ahorrado en la moneda de la meta
/* Lo que rinde una meta que está guardada en la cuenta remunerada. La plata no
   salió del banco: sigue generando interés, y ese interés se suma a la misma
   meta (así funciona, por ejemplo, la sección de ahorros de Mercado Pago).
   Arranca el día que creaste la meta, con lo que ya tenías puesto, y cada
   aporte empieza a rendir desde su fecha. */
/* El punto de partida son dos montos: los pesos y los dólares que ya tenías.
   Es un stock —plata que seguís teniendo—, así que para pasarlo a la moneda del
   objetivo se usa el dólar de hoy, en cualquiera de las dos direcciones. */
function iniArs(m){ return Math.max(0, Number(m && m.inicial)||0); }
function iniUsd(m){ return Math.max(0, Number(m && m.inicialUsd)||0); }
function aMonedaMeta(m, ars, usd){
  var c = cotDolar();
  if(((m && m.moneda) || 'ARS') === 'USD') return usd + (c > 0 ? ars / c : 0);
  return ars + (c > 0 ? usd * c : 0);
}
function inicialEnMeta(m){ return aMonedaMeta(m, iniArs(m), iniUsd(m)); }
/* Cuántos dólares hay guardados de verdad en esta meta: el punto de partida en
   dólares más los aportes que se cargaron en dólares. */
function usdDeMeta(m){
  var t = iniUsd(m);
  (m.aportes||[]).forEach(function(a){ if(monAporte(m, a) === 'USD') t += (Number(a.monto)||0); });
  return t;
}
/* Y cuántos PESOS hay: el punto de partida en pesos más los aportes cargados en
   pesos. Es la plata que sí rinde, así que la tarjeta la nombra aparte. */
/* ---- lo que ya tenías, repartido ----
   Lo que ya tenías en pesos puede estar en más de un lugar: una parte en
   efectivo, otra en Mercado Pago. El primer lugar es el de siempre (`m.inicial`,
   con `m.rinde`/`m.cuenta`); cada lugar más es una "parte": un aporte marcado
   `previo` + `parte`, con la fecha de la meta. Por ser `previo` ya se comporta
   como tiene que comportarse —rinde desde esa fecha en su cuenta, no toca el
   balance de ningún mes ni le descuenta a la cuenta— y por ser `parte` se
   muestra acá arriba y no en la lista de aportes. */
function partesDe(m){ return (m && m.aportes || []).filter(function(a){ return a && a.parte; }); }
function sumaPartes(m){ return partesDe(m).reduce(function(t, a){ return t + (Number(a.monto)||0); }, 0); }
function iniTotalArs(m){ return iniArs(m) + sumaPartes(m); }
/* Cambia el total de pesos que ya tenías. Lo que se mueve es el primer lugar;
   si el total nuevo no alcanza ni para las partes, se achican desde la última. */
function ponerTotalIni(m, total){
  total = Math.max(0, Number(total)||0);
  var sp = sumaPartes(m);
  if(total >= sp){ m.inicial = total - sp; return; }
  m.inicial = 0;
  var sobra = sp - total, ps = partesDe(m);
  for(var i = ps.length - 1; i >= 0 && sobra > 0.0001; i--){
    var v = Number(ps[i].monto)||0, saco = Math.min(v, sobra);
    ps[i].monto = Math.round((v - saco) * 100) / 100;
    sobra -= saco;
  }
  m.aportes = (m.aportes||[]).filter(function(a){ return !(a.parte && !((Number(a.monto)||0) > 0)); });
}
function arsDeMeta(m){
  var t = iniArs(m);
  (m.aportes||[]).forEach(function(a){ if(monAporte(m, a) !== 'USD') t += (Number(a.monto)||0); });
  return t;
}
/* ---- dónde está cada peso de una meta ----
   Una meta puede tener plata en varios lugares a la vez: una parte en Mercado
   Pago, otra en Lemon y otra en efectivo en un cajón. Cada aporte guarda el suyo,
   y el punto de partida ("ya tenías ahorrado") el de la meta (`m.rinde` y
   `m.cuenta`, que se llaman así por compatibilidad con los datos de antes).
   El lugar es el id de una cuenta, o '' si la plata está guardada aparte y no
   rinde. Los dólares nunca rinden: la TNA que paga el banco es en pesos. */
function cuentaPorDefecto(){ return cuentasQueRinden()[0] || null; }
function lugarValido(id){ var c = id ? cuentaPorId(id) : null; return (c && c.medio) ? c.id : ''; }
function lugarPorDefecto(){ var c = cuentaPorDefecto(); return c ? c.id : ''; }
function lugarInicial(m){
  if(!m || m.rinde !== true) return '';
  return lugarValido(m.cuenta) || lugarPorDefecto();
}
function lugarAporte(m, a){
  if(!a || monAporte(m, a) === 'USD') return '';
  var r = (typeof a.rinde === 'boolean') ? a.rinde : (!!m && m.rinde === true);
  if(!r) return '';
  return lugarValido(a.cuenta) || lugarPorDefecto();
}
function nombreLugar(id){ var c = id ? cuentaPorId(id) : null; return c ? c.medio : ''; }
function hayDondeRendir(){ return cuentas().some(function(c){ return !!c.medio; }); }

/* El interés de la meta. Cada lugar simula su propio saldo con SU tasa: lo de
   Lemon rinde a la tasa de Lemon y lo de Mercado Pago a la de Mercado Pago. Cada
   peso empieza a rendir el día que dice su fecha —si cargás hoy algo que pusiste
   hace tres días, esos tres días ya rindieron—, con la tasa de hoy: la de los
   días pasados no la tengo, y de un día para el otro casi no cambia.
   Devuelve { total, por:{cuenta: interés}, base:{lugar: capital} }; en `base`, la
   clave '' es la plata guardada aparte. */
var _mintCache = null;
function interesMetaDet(m){
  if(!m) return { total:0, por:{}, base:{} };
  if(!_mintCache) _mintCache = {};
  if(_mintCache[m.id]) return _mintCache[m.id];
  var hoy = today(), tope = sumarDias(hoy, -1500);
  var grupos = {}, base = {};
  function poner(lugar, f, v){
    if(!v) return;
    base[lugar] = (base[lugar] || 0) + v;
    if(!lugar || !f || f > hoy) return;          // aparte no rinde; lo futuro, todavía no
    if(f < tope) f = tope;
    var g = grupos[lugar] || (grupos[lugar] = { mov:{}, desde:f });
    g.mov[f] = (g.mov[f] || 0) + v;
    if(f < g.desde) g.desde = f;
  }
  if(iniArs(m) > 0) poner(lugarInicial(m), (m.desde && m.desde <= hoy) ? m.desde : hoy, iniArs(m));
  (m.aportes||[]).forEach(function(a){
    if(monAporte(m, a) === 'USD') return;         // los dólares no rinden la tasa en pesos
    poner(lugarAporte(m, a), a.fecha, Number(a.monto) || 0);
  });
  var out = { total:0, por:{}, base:base };
  Object.keys(grupos).forEach(function(cid){
    var tna = tnaDe(cuentaPorId(cid));
    if(tna <= 0) return;
    var diaria = tna / 100 / 365, g = grupos[cid];
    var saldo = 0, tot = 0, f = g.desde, vueltas = 0;
    while(f <= hoy && vueltas++ < 2000){
      saldo += g.mov[f] || 0;
      if(saldo > 0){ var x = saldo * diaria; tot += x; saldo += x; }
      f = sumarDias(f, 1);
    }
    out.por[cid] = tot;
    out.total += tot;
  });
  _mintCache[m.id] = out;
  return out;
}
function interesMetaArs(m){ return interesMetaDet(m).total; }
// el mismo interés, visto en la moneda en la que está escrito el objetivo
function interesMeta(m){ return aMonedaMeta(m, interesMetaArs(m), 0); }
/* Un aporte se guarda en la moneda en la que lo cargaste (`a.mon`), no en la de
   la meta: podés meterle dólares a una meta en pesos y al revés. Sin `a.mon`
   (datos anteriores) vale la moneda de la meta, que es como venía.

   La regla para convertirlo: **la plata que todavía tenés se valúa al dólar de
   hoy; la que ya gastaste queda con el valor que tenía ese día**. Por eso los
   gastos y los ingresos guardan su cotización y un ahorro no: esos dólares
   siguen siendo tuyos, y si el dólar sube tenés más plata.
   La única parte que sí queda fija es CUÁNTOS dólares compraste con pesos: esa
   cantidad es un hecho del día de la compra. Lo que cambia es cuánto valen. */
function monAporte(m, a){
  return (a && (a.mon === 'USD' || a.mon === 'ARS')) ? a.mon : ((m && m.moneda) || 'ARS');
}
function aporteEnMeta(m, a){
  var v = Number(a.monto)||0, mon = monAporte(m, a), meta = (m.moneda || 'ARS');
  if(mon === meta) return v;
  if(meta === 'USD'){
    // pesos que compraron dólares: la cantidad quedó fijada ese día
    var c0 = Number(a.cot) > 0 ? Number(a.cot) : cotDolar();
    return c0 > 0 ? (v / c0) : 0;
  }
  // dólares guardados en una meta en pesos: valen lo que valen hoy
  var c1 = cotDolar();
  return c1 > 0 ? (v * c1) : 0;
}
/* El mismo aporte visto en pesos. Al dólar de hoy: es plata que seguís teniendo. */
function aportePesos(m, a){
  var v = Number(a.monto)||0;
  return (monAporte(m, a) === 'USD') ? aPesos(v, 'USD', 0) : v;
}
function ahorradoEn(m){
  var s = (m.aportes||[]).reduce(function(a,b){ return a + aporteEnMeta(m, b); }, 0);
  return s + inicialEnMeta(m) + interesMeta(m);
}
// lo mismo, pasado a pesos (los aportes en dólares guardan la cotización del día)
/* Todo lo que está en dólares se pasa a pesos al dólar de hoy, así el total
   siempre dice cuánto vale tu ahorro ahora y no una mezcla de cotizaciones. */
function ahorradoEnPesos(m){
  if(m.moneda !== 'USD') return ahorradoEn(m);
  return aPesos(ahorradoEn(m), 'USD', 0);
}
/* La cotización con la que se guarda un aporte. Devuelve null si hace falta y
   no la hay —ahí el aviso ya se mostró con su botón—. */
function guardarCotAporte(m, mon){
  var meta = (m.moneda || 'ARS');
  if(mon === meta && mon !== 'USD') return 0;      // pesos en meta en pesos: no hace falta
  var c = cotDolar();
  if(c > 0) return c;
  if(mon === meta) return 0;                       // dólares en meta en dólares: tampoco
  toast('Falta la cotización del dólar',
        { texto:'Llevame ahí', ir:'ajustes', scroll:'#cardDolar', foco:'#dolarVenta' });
  return null;
}
function aportePorId(m, id){
  var r = null;
  (m.aportes||[]).forEach(function(a){ if(a.id === id) r = a; });
  return r;
}
function aportesDe(ym){
  var out = [];
  S.metas.forEach(function(m){
    // lo que ya tenías (`previo`) no es un movimiento de ese mes: no toca su balance
    (m.aportes||[]).forEach(function(a){ if(!a.previo && ymOf(a.fecha)===ym && esDeVista(a)) out.push({meta:m, ap:a}); });
  });
  return out;
}
/* ---- el saldo que pasa de un mes al otro ----
   No se guarda como un movimiento: se guarda sólo la decisión (`S.arrastre`) y
   el monto se calcula del balance del mes anterior. Así, si después corregís
   algo de agosto, lo que arrastró septiembre se actualiza solo, y la cadena
   sigue para atrás todo lo que haga falta. */
var _arrCache = null, _arrProf = 0;
function arrOlvidar(){ _arrCache = null; _intCache = null; _mintCache = null; _repCache = null; }
function llevaArrastre(ym){
  if(S.arrastreModo === 'siempre') return true;
  if(S.arrastreModo === 'nunca') return false;
  return !!(S.arrastre && S.arrastre[ym] === true);
}
function arrastreDe(ym){
  if(!_arrCache) _arrCache = {};
  if(_arrCache[ym] !== undefined) return _arrCache[ym];
  _arrCache[ym] = 0;                       // corta la recursión si algo se enreda
  if(!llevaArrastre(ym)) return 0;
  if(_arrProf > 36) return 0;              // tope de meses hacia atrás
  _arrProf++;
  var v = 0;
  try{ v = resumen(ymAdd(ym, -1)).bal; }catch(e){ v = 0; }
  _arrProf--;
  _arrCache[ym] = v;
  return v;
}
/* ¿tiene sentido ofrecer el arrastre en este mes? */
function hayQueArrastrar(ym){
  if(S.arrastreModo === 'nunca') return false;
  var prev = ymAdd(ym, -1);
  var r = resumen(prev);
  if(!r.nTx && !r.nCuotas && !aportesDe(prev).length) return false;
  return Math.round(r.bal) !== 0;
}
