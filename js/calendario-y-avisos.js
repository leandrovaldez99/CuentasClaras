/* Cuentas Claras · js/calendario-y-avisos.js
   El calendario del mes, el detalle de un día y los carteles de aviso (toast).

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

/* ---- el calendario del mes ----
   Un cuadrito por día, pintado con los colores de los GRUPOS en los que gastaste
   ese día: si el martes compraste en el súper y pagaste el gimnasio, el martes
   tiene las dos franjas. El color es el del grupo, no el de la categoría —ocho
   colores se distinguen de un vistazo, veinte categorías no—, y tocando un día
   se abre el detalle con todo lo que pasó, categoría por categoría.

   Los intereses quedan afuera del cuadrito a propósito: caen todos los días y
   pintarían el mes entero de un solo color. En el detalle del día sí están. */
function calendarioDelMes(ym){
  var out = {};
  function dia(f){
    if(!out[f]) out[f] = { fecha:f, gasto:0, ingreso:0, ahorro:0, por:{}, n:0, pend:0 };
    return out[f];
  }
  function gasto(f, cat, v, pend){
    if(!(v > 0)) return;
    var d = dia(f);
    d.gasto += v; d.n++;
    if(pend) d.pend++;
    var g = grupoDeCat(cat || 'Otros');
    d.por[g] = (d.por[g] || 0) + v;
  }
  // el calendario va por la fecha real: el sueldo del último día hábil se ve ese día
  txDeReal(ym).forEach(function(t){
    if(t.tipo === 'gasto') gasto(t.fecha, t.cat, montoPesos(t), false);
    else { var d = dia(t.fecha); d.ingreso += montoPesos(t); d.n++; }
  });
  cuotasDe(ym).forEach(function(c){ gasto(c.fecha, c.plan.cat, c.monto, c.pend); });
  fijosGasto(ym).forEach(function(f){ gasto(f.fecha, f.fijo.cat, f.monto, f.pend); });
  fijosDe(ym, 'ingreso', true).forEach(function(f){
    var d = dia(f.fecha); d.ingreso += f.monto; d.n++;
    if(f.pend) d.pend++;
  });
  aportesDe(ym).forEach(function(x){
    var d = dia(x.ap.fecha); d.ahorro += aportePesos(x.meta, x.ap); d.n++;
  });
  return out;
}
/* Todo lo que pasó un día, para el detalle: ahí sí entran los intereses. */
function movimientosDelDia(f){
  var ym = ymOf(f), out = [];
  var idxD = indiceTx();
  conPeso(S.tx.filter(function(t){ return t.fecha === f; })).forEach(function(t){ out.push({ r:recencia(t, idxD[t.id]), tx:t }); });
  cuotasDe(ym).forEach(function(c){ if(c.fecha === f) out.push({ r:-1, cuota:c }); });
  fijosDe(ym, '', true).forEach(function(x){ if(x.fecha === f) out.push({ r:-1, fijo:x }); });
  S.metas.forEach(function(m){
    (m.aportes||[]).forEach(function(a){ if(!a.previo && a.fecha === f && esDeVista(a)) out.push({ r:recencia(a, 0), ap:a, meta:m }); });
  });
  interesesDias(ym).forEach(function(x){ if(x.fecha === f) out.push({ r:-3, itr:x.monto, cuenta:x.cuenta }); });
  (S.pases||[]).forEach(function(p, i){ if(p.fecha === f && esDeVista(p)) out.push({ r:recencia(p, i), pase:p }); });
  return out.sort(function(a,b){ return b.r - a.r; });
}
/* Las franjas de un día: un degradado con cortes secos, uno por grupo, del
   ancho que le toca según cuánto gastaste en cada uno. */
function franjas(partes, suave){
  var total = partes.reduce(function(a,x){ return a + x.monto; }, 0);
  if(!(total > 0) || !partes.length) return '';
  var acum = 0, paradas = [];
  partes.forEach(function(x){
    var col = suave ? colorSuave(x.color) : x.color;
    var a = acum / total * 100;
    acum += x.monto;
    var b = acum / total * 100;
    paradas.push(col + ' ' + a.toFixed(2) + '%', col + ' ' + b.toFixed(2) + '%');
  });
  return 'linear-gradient(90deg,' + paradas.join(',') + ')';
}
/* El mismo color, pero lavado contra el fondo de la tarjeta: así el número del
   día se sigue leyendo encima. Se mezcla a mano y no con color-mix() porque
   este último no existe en los WebView viejos de Android. */
function colorSuave(hex){
  var fondo = temaOscuro() ? '#0A1222' : '#FFFFFF', a = temaOscuro() ? 0.34 : 0.26;
  var c1 = hexRgb(normHex(hex) || '#000000'), c2 = hexRgb(fondo);
  return rgbHex(c1[0]*a + c2[0]*(1-a), c1[1]*a + c2[1]*(1-a), c1[2]*a + c2[2]*(1-a));
}
function partesDelDia(d){
  if(!d) return [];
  return Object.keys(d.por).map(function(g){
    return { id:g, monto:d.por[g], color:colorGrupo(g) };
  }).sort(function(a,b){ return b.monto - a.monto; });
}
function renderCalendario(){
  var el = $('#calMes'); if(!el) return;
  var y = parseInt(mes.slice(0,4),10), m = parseInt(mes.slice(5,7),10);
  var dias = finDeMes(mes), arranque = (new Date(y, m-1, 1).getDay() + 6) % 7;   // lunes = 0
  var datos = calendarioDelMes(mes), hoy = today();
  var html = '<div class="cal-dow"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>'
    + '<div class="calgrid">';
  for(var k=0; k<arranque; k++) html += '<span class="caldia hueco" aria-hidden="true"></span>';
  for(var d=1; d<=dias; d++){
    var f = mes + '-' + pad(d), info = datos[f];
    var partes = partesDelDia(info);
    var hayAlgo = !!(info && info.n);
    var futuro = (f > hoy);
    var cls = (f === hoy ? ' hoy' : '') + (hayAlgo ? '' : ' vacio') + (futuro ? ' futuro' : '')
      + (info && info.ingreso > 0 ? ' entro' : '') + (info && info.ahorro > 0 ? ' guardo' : '');
    var fondo = partes.length ? ' style="background:' + franjas(partes, true) + '"' : '';
    var tit = hayAlgo
      ? (fechaLabel(f)
         + (info.ingreso > 0 ? ' · entró ' + money(info.ingreso) : '')
         + (info.ahorro > 0 ? ' · guardaste ' + money(info.ahorro) : '')
         + ' · ' + (info.gasto > 0 ? 'gastaste ' + money(info.gasto) : 'sin gastos')
         + (partes.length ? ' · ' + partes.map(function(x){ return nombreGrupo(x.id); }).join(', ') : ''))
      : (fechaLabel(f) + ' · sin movimientos');
    html += hayAlgo
      ? '<button type="button" class="caldia' + cls + '" data-dia="' + f + '"' + fondo
        + ' title="' + esc(tit) + '" aria-label="' + esc(tit) + '">'
        + '<span class="n">' + d + '</span>'
        + (partes.length ? '<i class="tira" style="background-image:' + franjas(partes, false) + '"></i>' : '')
        + '</button>'
      : '<span class="caldia' + cls + '" title="' + esc(tit) + '"><span class="n">' + d + '</span></span>';
  }
  html += '</div>';
  el.innerHTML = html;

  // la leyenda: sólo los grupos en los que gastaste algo este mes
  var totales = {};
  Object.keys(datos).forEach(function(f){
    Object.keys(datos[f].por).forEach(function(g){ totales[g] = (totales[g]||0) + datos[f].por[g]; });
  });
  var leg = $('#calLeg');
  if(leg){
    var lista = Object.keys(totales).sort(function(a,b){ return totales[b] - totales[a]; });
    leg.innerHTML = lista.map(function(g){
      return '<span><i style="background:'+colorGrupo(g)+'"></i>'+esc(nombreGrupo(g))
        + ' <b>'+esc(money(totales[g]))+'</b></span>';
    }).join('');
  }
  var sub = $('#calSub');
  if(sub){
    var conAlgo = Object.keys(datos).filter(function(f){ return datos[f].n > 0; }).length;
    var conIng = Object.keys(datos).filter(function(f){ return datos[f].ingreso > 0; }).length;
    var conAho = Object.keys(datos).filter(function(f){ return datos[f].ahorro > 0; }).length;
    sub.textContent = conAlgo
      ? ('Tocá un día para ver el detalle. ' + conAlgo
         + (conAlgo === 1 ? ' día con movimientos en ' : ' días con movimientos en ') + ymLabel(mes) + '.'
         + (conIng ? ' Marco verde: entró plata.' : '')
         + (conAho ? ' Marco azul: guardaste plata.' : '')
         + (mes === ymNow() ? ' Resplandor: hoy.' : ''))
      : ('Todavía no cargaste nada en ' + ymLabel(mes) + '. Cada día se va a pintar con el color de los grupos en los que gastes.');
  }
}

/* ---- el detalle de un día ---- */
var diaAbierto = null;
function abrirDia(f){
  var l = $('#lupaDia'); if(!l) return;
  diaAbierto = f;
  l.hidden = false;
  document.body.style.overflow = 'hidden';
  pintarDia();
  var c = l.querySelector('[data-cerrar-lupa].iconbtn');
  if(c) try{ c.focus({preventScroll:true}); }catch(x){}
}
function cerrarDia(){
  var l = $('#lupaDia'); if(!l) return;
  l.hidden = true;
  diaAbierto = null;
  if($('#lupa').hidden && $('#lupaMed').hidden) document.body.style.overflow = '';
}
/* Las flechas se mueven adentro del mes que estás mirando: saltar a otro mes
   dejaría el calendario de atrás mostrando otra cosa. */
function moverDia(paso){
  if(!diaAbierto) return;
  var f = sumarDias(diaAbierto, paso);
  if(ymOf(f) !== ymOf(diaAbierto)) return;
  diaAbierto = f;
  pintarDia();
}
function tituloDia(f){
  var y = parseInt(f.slice(0,4),10), m = parseInt(f.slice(5,7),10), d = parseInt(f.slice(8,10),10);
  var nom = DIAS_SEM[(new Date(y, m-1, d).getDay() + 6) % 7] || '';
  return nom.charAt(0).toUpperCase() + nom.slice(1) + ' ' + d + ' de ' + (MESES[m-1] || '');
}
function pintarDia(){
  var l = $('#lupaDia'); if(!l || l.hidden || !diaAbierto) return;
  var f = diaAbierto;
  var info = calendarioDelMes(ymOf(f))[f];
  var items = movimientosDelDia(f);
  var intereses = items.reduce(function(a,x){ return a + (x.itr || 0); }, 0);

  $('#lupaDiaTit').textContent = tituloDia(f);
  var partes = [];
  if(info && info.gasto > 0) partes.push('gastaste ' + money(info.gasto));
  if(info && info.ingreso > 0) partes.push('entró ' + money(info.ingreso));
  if(info && info.ahorro > 0) partes.push('apartaste ' + money(info.ahorro));
  if(intereses > 0) partes.push('rindió ' + money(intereses));
  $('#lupaDiaSub').textContent = partes.length
    ? (partes.join(' · ') + (f === today() ? ' · es hoy' : ''))
    : 'No cargaste nada este día';

  var g = $('#lupaDiaGrupos');
  if(g){
    var porG = partesDelDia(info);
    g.innerHTML = porG.map(function(x){
      return '<span><i style="background:'+x.color+'"></i>'+esc(nombreGrupo(x.id))+' <b>'+esc(money(x.monto))+'</b></span>';
    }).join('');
  }

  $('#lupaDiaCuerpo').innerHTML = items.length
    ? items.map(function(x){
        if(x.tx) return rowTx(x.tx, false, true);
        if(x.pase) return rowPase(x.pase, false, true);
        if(x.cuota) return rowCuota(x.cuota, true);
        if(x.fijo) return rowFijo(x.fijo.fijo, x.fijo.monto, x.fijo.fecha, x.fijo.propio, x.fijo.pend, true, x.fijo);
        if(x.itr !== undefined) return rowInteres(x.fecha || f, x.itr, x.cuenta, true);
        return rowAporte(x.ap, x.meta, true);
      }).join('')
    : emptyBox('Ese día no cargaste ningún movimiento');

  var nota = $('#lupaDiaNota');
  if(nota){
    var hayGasto = items.some(function(x){
      return (x.tx && x.tx.tipo === 'gasto') || x.cuota || (x.fijo && x.fijo.fijo.tipo !== 'ingreso');
    });
    nota.textContent = items.length
      ? ((hayGasto ? 'Cada gasto lleva el color de su grupo. ' : '')
         + (intereses > 0 ? 'Los intereses no pintan el calendario: caen todos los días. ' : '')
         + 'Las flechas de arriba te mueven de día.')
      : '';
  }
}

/* El aviso puede traer un botón para ir a resolver lo que falta. Cuando lo trae
   dura más (hay que leerlo y tocarlo) y sólo el botón recibe los toques: si todo
   el recuadro los recibiera, taparía la barra de abajo durante varios segundos. */
/* v277: el tipo del cartel. Si no se dice, se adivina por el texto: los que
   piden algo ("Poné…", "Elegí…") son avisos; los que confirman ("…guardado",
   "Listo…", "Agregué…") van con el tilde verde. */
var TOAST_ERR = /^(Poné|Elegí|Escribí|Cargá|Ponele|No |Falta|Ese |Esa |Ya ten|Ya hay|El nombre no|Tiene que|Tienen que|Hasta |Un día tiene|La salida|Llegaste al máximo|Este navegador|Alguien tiene|Alguien más|¿En cuántas|Primero |La copia está|Lo que repartiste|Rechazado|El iPhone|Con \d|Revisá)/;
var TOAST_OK = /(guardad[oa]|cargad[oa]|actualizad[oa]|cread[oa]|corregid[oa]|importados|descargada|vinculados)|^(Listo|Agregué|Borré|Sumé|Junté|Vinculado|Pasaste|Sacaste|Ahora |Reanudado|Dado de baja|Copiado|Código copiado|Te sumaste|Desvinculado|Volví|Te aviso|Cerraste|Viaje creado|Lo borré|Se actualizó|Los .* vuelven)|pasó a /;
var TOAST_ICO = {
  ok:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  err:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 6.5v7"/><path d="M12 17.6v.1"/></svg>',
  info:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" aria-hidden="true"><path d="M12 10.8v6.4"/><path d="M12 6.9v.1"/></svg>'
};
function toastTipo(msg){
  if(TOAST_ERR.test(msg)) return 'err';
  if(TOAST_OK.test(msg)) return 'ok';
  return 'info';
}
/* En el iPhone, con el teclado abierto, la parte visible de la página puede estar
   corrida: el cartel se acomoda a lo que se ve. */
function toastUbicar(){
  var t = $('#toast'), vv = window.visualViewport;
  if(t) t.style.setProperty('--vvt', (vv ? Math.max(0, Math.round(vv.offsetTop)) : 0) + 'px');
}
if(window.visualViewport){
  window.visualViewport.addEventListener('resize', toastUbicar);
  window.visualViewport.addEventListener('scroll', toastUbicar);
}
function toast(msg, accion, tipo){
  var t = $('#toast');
  tipo = tipo || toastTipo(String(msg));
  t.innerHTML = '';
  t.classList.remove('on', 'ok', 'err', 'info');
  void t.offsetWidth;   // para que la animación arranque de nuevo si ya estaba
  var ico = document.createElement('span');
  ico.className = 'toast-ico';
  ico.innerHTML = TOAST_ICO[tipo] || TOAST_ICO.info;
  t.appendChild(ico);
  var txt = document.createElement('span');
  txt.textContent = msg;
  t.appendChild(txt);
  if(accion){
    var b = document.createElement('button');
    b.type = 'button';
    b.id = 'toastAcc';
    b.className = 'toast-btn';
    b.textContent = accion.texto || 'Llevame ahí';
    b.setAttribute('data-ir', accion.ir || '');
    if(accion.scroll) b.setAttribute('data-scroll', accion.scroll);
    if(accion.foco) b.setAttribute('data-foco', accion.foco);
    t.appendChild(b);
  }
  t.classList.toggle('conacc', !!accion);
  t.classList.add(tipo);
  toastUbicar();
  t.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(function(){ t.classList.remove('on'); }, accion ? 7000 : (tipo === 'err' ? 3400 : 2800));
}
function cerrarToast(){
  var t = $('#toast');
  if(t) t.classList.remove('on');
  clearTimeout(toast._t);
}

/* navegación + acciones globales */
