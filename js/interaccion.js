/* Cuentas Claras · js/interaccion.js
   Navegación entre pantallas, edición de movimientos, saldo por medio en grande y pases entre medios.

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

/* ============================================================
   interacción
   ============================================================ */
function defaultFecha(){
  return mes === ymNow() ? today() : (mes + '-01');
}
function fillSelects(){
  var cat = $('#mCat');
  var lista = tipoMov === 'ingreso' ? S.catIng : S.catGasto;
  cat.innerHTML = lista.map(function(c){ return '<option>'+esc(c)+'</option>'; }).join('');
  var med = $('#mMedio');
  med.innerHTML = opcionesMedio('Débito');
  $('#qCat').innerHTML = S.catGasto.map(function(c){ return '<option'+(c==='Otros'?' selected':'')+'>'+esc(c)+'</option>'; }).join('');
  $('#qMedio').innerHTML = opcionesMedio('Crédito');
  $('#fCat').innerHTML = S.catGasto.map(function(c){ return '<option'+(c==='Servicios'?' selected':'')+'>'+esc(c)+'</option>'; }).join('');
  $('#fMedio').innerHTML = opcionesMedio('Débito');
}
var NAV_DE = { dividir:'tools', fijos:'tools', viaje:'tools', familia:'tools', cyc:'tools', conv:'tools', hext:'tools' };
var cargaTab = 'gasto';   // gasto | ingreso | cuotas
var editando = null;      // id del movimiento que estoy editando
var editandoPlan = null;  // id de la compra en cuotas que estoy editando
/* "Volver" lleva a la pantalla desde la que entraste (Herramientas, Ajustes,
   el Resumen…), no a una fija. Se anota al entrar a cada pantalla de
   herramienta; si no se sabe (la abrió un link), vuelve a Herramientas. */
var vistaDesde = {}, volviendo = false;
function volver(){
  var d = vistaDesde[vista];
  volviendo = true;
  go(d && d !== vista ? d : 'tools');
  volviendo = false;
}
function go(v){
  // v251: salir de Dividir gastos (con Volver o por cualquier lado) a mitad de
  // corregir un gasto viejo cancela la corrección y deja lo que estabas dividiendo
  if(vista === 'dividir' && v !== 'dividir' && typeof splitEdit !== 'undefined' && splitEdit) splitVolverBorrador();
  // de una herramienta a otra: la segunda vuelve a la primera (salvo que la
  // primera vuelva a la segunda, que sería dar vueltas en círculo)
  if(!volviendo && v !== vista && NAV_DE[v]) vistaDesde[v] = (vistaDesde[vista] === v) ? (vistaDesde[v] || 'tools') : vista;
  vista = v;
  pintarFab();
  var nav = NAV_DE[v] || v;
  $$('.view').forEach(function(s){ s.classList.toggle('on', s.id === 'v-'+v); });
  $$('.rail [data-go], .tabs [data-go]').forEach(function(b){ b.setAttribute('aria-current', b.getAttribute('data-go')===nav ? 'true':'false'); });
  window.scrollTo({top:0, behavior:'instant' in window ? 'auto':'auto'});
  if(v === 'cargar') pintarCarga();   // por si apareció o se terminó un viaje
  if(v === 'familia') renderFamilia();
  abrirCalc(v);
  pintarVerQuien();
  vjSincContenedor();
  ajustarNumsPronto();     // la pantalla que aparece estaba oculta: sus números no se pudieron medir
}
/* La pantalla de carga: un solo lugar para gastos, entradas y compras en cuotas.
   El mismo formulario sirve para cargar y para editar algo que ya cargaste. */
/* El color del "+" de la barra sigue a la solapa en uso, y sólo mientras estás
   en la pantalla de carga. */
function pintarFab(){
  var f = document.querySelector('.tabs .fab');
  if(!f) return;
  if(vista === 'cargar') f.setAttribute('data-tono', cargaTab);
  else f.removeAttribute('data-tono');
}
function pintarCarga(){
  var seg = $('#segCarga'); if(!seg) return;
  /* Con un viaje activo, el "+" suma una cuarta opción con el nombre del viaje:
     el gasto se carga ahí y se divide con el grupo. Va en un renglón propio
     debajo de las otras tres, a lo ancho, así el nombre entra entero. */
  var vc = vjViajeCarga(), bv = $('#segCarga [data-v="viaje"]');
  if(vc){
    if(!bv){
      bv = document.createElement('button'); bv.type = 'button'; bv.setAttribute('data-v', 'viaje');
      seg.appendChild(bv);
    }
    var etq = VJ_ICONO + '<span>' + esc(vc.nombre) + '</span>';
    if(bv.innerHTML !== etq) bv.innerHTML = etq;
    bv.setAttribute('aria-label', 'Gasto del viaje ' + vc.nombre);
  } else if(bv){ bv.parentNode.removeChild(bv); }
  seg.classList.toggle('con-viaje', !!vc);
  if(cargaTab === 'viaje' && !vc) cargaTab = 'gasto';
  pintarFab();
  var editandoAlgo = !!editando || !!editandoPlan;
  $$('#segCarga button').forEach(function(b){
    b.setAttribute('aria-pressed', b.getAttribute('data-v') === cargaTab ? 'true':'false');
    b.disabled = editandoAlgo && b.getAttribute('data-v') !== cargaTab;
  });
  var esCuota = cargaTab === 'cuotas', esViaje = cargaTab === 'viaje';
  if(esCuota) proponerDiaDeMedio();
  $('#fMov').hidden = esCuota || esViaje;
  $('#fCuota').hidden = !esCuota;
  var cv = $('#cargaViaje'); if(cv) cv.hidden = !esViaje;
  var pl = $('#paseLink'); if(pl) pl.hidden = esCuota || esViaje || editandoAlgo;
  var mqb = $('#mQuienBox .qb-med'); if(mqb) mqb.hidden = (cargaTab !== 'gasto');
  $('#cancelarEdit').hidden = !editandoAlgo;
  $('#cargaTit').textContent = editando ? 'Editar movimiento'
    : (editandoPlan ? 'Editar compra en cuotas'
    : (esCuota ? 'Nueva compra en cuotas' : (esViaje ? 'Gasto del viaje' : 'Cargar')));
  $('#cargaSub').textContent = editandoAlgo
    ? 'Cambiá lo que quieras y guardá'
    : (esCuota ? 'Cargá el total y las cuotas: el resto lo calculo yo'
    : (esViaje ? 'Se divide entre los de ' + vc.nombre + ' y les llega solo. Tu parte la sumás a tus gastos desde el viaje.'
               : 'Un gasto, una entrada de plata o una compra en cuotas'));
  vjSincContenedor();
  $('#fMov').querySelector('button[type=submit]').textContent = editando ? 'Guardar cambios' : 'Agregar movimiento';
  $('#fCuota').querySelector('button[type=submit]').textContent = editandoPlan ? 'Guardar cambios' : 'Guardar compra en cuotas';
  pintarSueldoAyudas();
  vozPintar();
}
function entrarEdit(id){
  var t = null;
  S.tx.forEach(function(x){ if(x.id === id) t = x; });
  if(!t) return;
  if(t.split && Array.isArray(t.split.p) && t.split.p.length > 1 && t.tipo === 'gasto'){ splitAbrirGasto(t); return; }
  editando = id;
  cargaTab = (t.tipo === 'ingreso') ? 'ingreso' : 'gasto';
  tipoMov = cargaTab;
  fillSelects();
  monMov = esUSD(t) ? 'USD' : 'ARS';
  pintarMon();
  $('#mMonto').value = enCampo(Number(t.monto)||0);
  $('#mFecha').value = t.fecha || defaultFecha();
  $('#mCat').value = t.cat || '';
  $('#mMedio').value = t.medio || '';
  $('#mNota').value = t.nota || '';
  pintarCarga(); pintarFechas();
  ponerQuien('m', quienDe(t), t.med, t.rep);
  go('cargar');
}
function entrarEditPlan(id){
  var p = null;
  S.planes.forEach(function(x){ if(x.id === id) p = x; });
  if(!p) return;
  editando = null;
  editandoPlan = id;
  cargaTab = 'cuotas';
  $('#qDesc').value = p.desc || '';
  $('#qTotal').value = enCampo(Number(p.total)||0);
  $('#qN').value = String(Math.max(1, Number(p.n)||1));
  $('#qDia').value = String(Math.min(31, Math.max(1, Number(p.dia)||1)));
  $('#qDesde').value = p.desde || mes;
  fillSelects();
  if(p.cat) $('#qCat').value = p.cat;
  if(p.medio) $('#qMedio').value = p.medio;
  pintarCarga(); pintarFechas(); previewCuota();
  ponerQuien('q', quienDe(p), p.med, p.rep);
  go('cargar');
}
function salirEditPlan(){
  editandoPlan = null;
  $('#qDesc').value = ''; $('#qTotal').value = ''; $('#qN').value = '12';
  $('#qDesde').value = mes;
  ponerQuien('q', miPersona(), null);
  pintarCarga(); pintarFechas(); proponerDiaDeMedio(); previewCuota();
}
function salirEdit(){
  editando = null; monMov = 'ARS'; pintarMon();
  $('#mMonto').value = ''; $('#mNota').value = '';
  $('#mFecha').value = defaultFecha();
  ponerQuien('m', miPersona(), null);
  pintarCarga(); pintarFechas();
}
/* El gráfico de meses, en grande: mismas barras pero con más aire, más líneas
   de referencia, el valor arriba de cada barra cuando entra, y abajo la tabla
   con todos los números — que es lo que un gráfico chico no puede dar. */
function serieMeses(){
  var out = [];
  for(var i=rangoMeses-1;i>=0;i--){ var ym = ymAdd(mes,-i); var r = resumen(ym); out.push({ym:ym, ing:r.ing, gas:r.gas, bal:r.bal}); }
  return out;
}
function abrirLupa(){
  var l = $('#lupa'); if(!l) return;
  l.hidden = false;
  document.body.style.overflow = 'hidden';
  pintarLupa();
}
function cerrarLupa(){
  var l = $('#lupa'); if(!l) return;
  l.hidden = true;
  document.body.style.overflow = '';
}
function pintarLupa(){
  var l = $('#lupa'); if(!l || l.hidden) return;
  var serie = serieMeses();
  $('#lupaTit').textContent = rangoMeses===12 ? 'Últimos 12 meses' : 'Últimos 6 meses';
  $$('#segRangoLupa button').forEach(function(b){
    b.setAttribute('aria-pressed', b.getAttribute('data-v')===String(rangoMeses) ? 'true':'false');
  });
  var contL = $('#lupaCh');
  contL.innerHTML = barrasMeses(serie, true, contL.clientWidth);
  var filas = serie.slice().reverse().map(function(s){
    return '<tr'+(s.ym===mes?' class="hoy"':'')+'><td>'
      + '<span class="mes-lg">'+esc(ymLabel(s.ym))+'</span>'
      + '<span class="mes-sm">'+esc(ymLabel(s.ym, true))+'</span></td>'
      + '<td>'+esc(numTabla(s.ing))+'</td>'
      + '<td>'+esc(numTabla(s.gas))+'</td>'
      + '<td style="color:'+(s.bal<0?'var(--out)':(s.bal>0?'var(--in)':'var(--ink-2)'))+'">'+esc(numTabla(s.bal))+'</td></tr>';
  }).join('');
  var tot = serie.reduce(function(a,b){ return {ing:a.ing+b.ing, gas:a.gas+b.gas}; }, {ing:0,gas:0});
  $('#lupaTabla').innerHTML = '<thead><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th><th>Balance</th></tr></thead>'
    + '<tbody>'+filas+'</tbody>'
    + '<tfoot><tr><td><b>Total</b></td><td>'+esc(numTabla(tot.ing))+'</td><td>'+esc(numTabla(tot.gas))+'</td>'
    + '<td style="color:'+((tot.ing-tot.gas)<0?'var(--out)':'var(--in)')+'">'+esc(numTabla(tot.ing-tot.gas))+'</td></tr></tfoot>';
}

/* ---- la plata que tenés en cada medio de pago, en grande ----
   Mismo recuadro que el gráfico ampliado. Arriba el total, abajo la tabla con
   lo que entró, lo que salió y lo que queda en cada uno. */
function abrirMedios(){
  var l = $('#lupaMed'); if(!l) return;
  l.hidden = false;
  document.body.style.overflow = 'hidden';
  pintarMedios();
  var c = l.querySelector('[data-cerrar-lupa].iconbtn');
  if(c) try{ c.focus({preventScroll:true}); }catch(x){}
}
function cerrarMedios(){
  var l = $('#lupaMed'); if(!l) return;
  l.hidden = true;
  cerrarPase();
  if($('#lupa') && $('#lupa').hidden) document.body.style.overflow = '';
}
function pintarMedios(){
  var l = $('#lupaMed'); if(!l || l.hidden) return;
  var todos = saldosPorMedio(mes), filas = todos.filter(function(f){ return f.usa; });
  var corte = corteDelMes(mes), futuro = mes > ymNow();

  /* Ojo con el mes: el tile de Balance dice cómo te fue ESTE mes, pero lo que
     tenés en cada cuenta es la suma de todo lo que pasó desde que arrancaste.
     Son dos números distintos y hay que decirlo, o parece que uno está mal. */
  $('#lupaMedSub').textContent = futuro
    ? ('Proyección a ' + ymLabel(mes) + ': lo que va a quedar en cada medio.')
    : ('Lo que entró menos lo que salió con cada medio, desde tu primer movimiento '
       + (mes === ymNow() ? 'hasta hoy' : 'hasta que cerró ' + ymLabel(mes))
       + '. Es lo acumulado, no sólo ' + ymLabel(mes) + '.');

  if(!filas.length){
    $('#lupaMedTot').innerHTML = '';
    $('#lupaMedCuerpo').innerHTML = emptyBox('Todavía no cargaste movimientos');
    $('#lupaMedNota').textContent = '';
    return;
  }

  var tot = filas.reduce(function(a,f){
    return { entro:a.entro+f.entro, salio:a.salio+f.salio, saldo:a.saldo+f.saldo };
  }, {entro:0, salio:0, saldo:0});

  $('#lupaMedTot').innerHTML = '<div class="hero" style="text-align:center;color:'
    + (tot.saldo < 0 ? 'var(--out)' : 'var(--ink)') + '">' + esc(money(tot.saldo)) + '</div>'
    + '<p class="note" style="margin:6px 0 14px;text-align:center">'
    + esc(tot.saldo < 0
        ? 'Entre todos los medios estás en rojo'
        : ('Sumando todo lo que tenés repartido en ' + filas.length
           + (filas.length === 1 ? ' medio de pago' : ' medios de pago')))
    + '</p>';

  /* En pantalla angosta el entró/salió baja a un renglón chico bajo el nombre:
     el CSS esconde una cosa o la otra, así que el dato nunca se pierde. */
  function detalle(f){
    return '<small class="soloch">entró ' + esc(money(f.entro)) + ' · salió ' + esc(money(f.salio)) + '</small>';
  }
  var cuerpo = filas.map(function(f){
    return '<tr><td>' + esc(f.medio) + (f.rinde ? ' <span class="pill ok">rinde</span>' : '') + detalle(f) + '</td>'
      + '<td class="det' + (f.entro > 0 ? ' verde' : '') + '">' + esc(numTabla(f.entro)) + '</td>'
      + '<td class="det' + (f.salio > 0 ? ' rojo' : '') + '">' + esc(numTabla(f.salio)) + '</td>'
      + '<td class="' + (f.saldo < 0 ? 'rojo' : (f.saldo > 0 ? 'verde' : '')) + '"><b>'
      + esc(numTabla(f.saldo)) + '</b></td></tr>';
  }).join('');

  $('#lupaMedCuerpo').innerHTML = '<div class="tablawrap"><table class="tabla">'
    + '<thead><tr><th>Medio</th><th class="det">Entró</th><th class="det">Salió</th><th>Queda</th></tr></thead>'
    + '<tbody>' + cuerpo + '</tbody>'
    + '<tfoot><tr><td><b>Total</b>' + detalle(tot) + '</td>'
    + '<td class="det">' + esc(numTabla(tot.entro)) + '</td>'
    + '<td class="det">' + esc(numTabla(tot.salio)) + '</td>'
    + '<td class="' + (tot.saldo < 0 ? 'rojo' : 'verde') + '"><b>' + esc(numTabla(tot.saldo)) + '</b></td></tr></tfoot>'
    + '</table></div>';

  var intereses = filas.reduce(function(a,f){ return a + f.interes; }, 0);
  var ahorros   = filas.reduce(function(a,f){ return a + f.ahorro; }, 0);
  var notas = ['Todo en pesos, al dólar del día de cada movimiento.'];
  if(intereses > 0) notas.push('En "entró" van ' + money(intereses) + ' de intereses.');
  if(ahorros > 0) notas.push('En "salió" van ' + money(ahorros) + ' que apartaste en metas: la plata es tuya, pero ya no está en la cuenta.');
  var pasado = filas.reduce(function(a,f){ return a + f.pasoIn; }, 0);
  if(pasado > 0) notas.push('También van ' + money(pasado) + ' que pasaste de un medio a otro: salen de uno y entran en el otro, así que el total no cambia.');
  notas.push('Cuento desde tu primer movimiento: lo que tenías antes de usar la app no lo sé, así que un medio puede darte en rojo aunque tengas plata.');
  $('#lupaMedNota').textContent = notas.join(' ');
}
/* ---- pasar plata de un medio a otro ----
   Un pase no es un ingreso ni un gasto: sale de un medio y entra en el otro.
   Se guarda aparte (`S.pases`), así que los totales del mes, el balance y los
   gráficos no lo ven; sí lo ven los saldos por medio y el interés de las
   cuentas que rinden (la plata que llega a Mercado Pago empieza a rendir). */
var paseEdit = null;
function paseDefectos(){
  var l = medios(), de = l.indexOf('Efectivo') > -1 ? 'Efectivo' : l[0], a = '';
  cuentasQueRinden().forEach(function(c){ if(!a && c.medio !== de && l.indexOf(c.medio) > -1) a = c.medio; });
  if(!a) l.forEach(function(m){ if(!a && m !== de) a = m; });
  return { de:de, a:a || de };
}
function abrirPase(p){
  var f = $('#fPase'); if(!f) return;
  paseEdit = p ? p.id : null;
  var d = p ? { de:p.de, a:p.a } : paseDefectos();
  $('#paseDe').innerHTML = medios().map(function(m){ return '<option'+(m===d.de?' selected':'')+'>'+esc(m)+'</option>'; }).join('');
  $('#paseA').innerHTML = medios().map(function(m){ return '<option'+(m===d.a?' selected':'')+'>'+esc(m)+'</option>'; }).join('');
  $('#paseMonto').value = p ? enCampo(p.monto) : '';
  $('#paseNota').value = p ? (p.nota || '') : '';
  $('#paseFecha').value = p ? p.fecha : defaultFecha();
  $('#paseTit').textContent = p ? 'Corregir el pase' : 'Pasar plata de un medio a otro';
  $('#paseOk').textContent = p ? 'Guardar cambios' : 'Pasar';
  f.hidden = false; $('#paseAbrir').hidden = true;
  pintarFechas();
  try{ f.scrollIntoView({block:'nearest'}); }catch(x){}
  try{ $('#paseMonto').focus({preventScroll:true}); }catch(x){}
}
function cerrarPase(){
  var f = $('#fPase'); if(!f) return;
  paseEdit = null; f.hidden = true; $('#paseAbrir').hidden = false;
  $('#paseMonto').value = ''; $('#paseNota').value = '';
}
