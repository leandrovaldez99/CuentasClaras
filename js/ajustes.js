/* Cuentas Claras · js/ajustes.js
   Ajustes: recordatorio, medios de pago, categorías y presupuestos.

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

/* ---- el recordatorio para cargar los gastos ----
   Se guarda la REGLA (si está prendido, a qué hora, qué días), nunca la próxima
   fecha: quien avisa la calcula cada vez. En el APK la alarma la pone Android,
   que es el único que puede despertar al teléfono con la app cerrada; en el
   navegador queda un temporizador, que sólo corre mientras la página esté
   abierta. La decisión de molestarte o no se toma al sonar, no al programar:
   entre una cosa y la otra podés haber cargado el día. */
function avisoCfg(){ return S.aviso || { on:false, hora:21, min:0, dias:'todos', saltar:true }; }
function hhmm(h, m){ return pad(h) + ':' + pad(m); }
/* ¿Cargaste algo ese día? Las cuotas y los fijos no cuentan: salen solos, así
   que no dicen nada sobre si te sentaste a cargar. Un aporte a una meta sí. */
function cargasteEn(f){
  var hay = false;
  (S.pases||[]).forEach(function(p){ if(p.fecha === f) hay = true; });
  S.tx.forEach(function(t){ if(t.fecha === f) hay = true; });
  S.metas.forEach(function(m){ (m.aportes||[]).forEach(function(a){ if(a.fecha === f) hay = true; }); });
  return hay;
}
function esDiaDeAviso(f){
  if(avisoCfg().dias !== 'habiles') return true;
  return esDiaDeSemana(parseInt(f.slice(0,4),10), parseInt(f.slice(5,7),10), parseInt(f.slice(8,10),10));
}
function tocaAvisar(){
  var a = avisoCfg();
  if(!a.on) return false;
  var f = today();
  if(!esDiaDeAviso(f)) return false;
  return !(a.saltar && cargasteEn(f));
}
var _avisoTimer = null;
function msHastaAviso(){
  var a = avisoCfg(), ahora = new Date();
  var t = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate(), a.hora, a.min, 0, 0);
  if(t.getTime() <= ahora.getTime()) t = new Date(t.getTime() + 86400000);
  return t.getTime() - ahora.getTime();
}
function programarAvisoWeb(){
  if(_avisoTimer){ clearTimeout(_avisoTimer); _avisoTimer = null; }
  if(AND()) return;                    // en el APK avisa Android, aunque esté cerrada
  if(!avisoCfg().on) return;
  _avisoTimer = setTimeout(function(){
    if(tocaAvisar()) mostrarAviso();
    programarAvisoWeb();               // y queda armado para mañana
  }, msHastaAviso());
}
function mostrarAviso(){
  try{
    if(window.Notification && Notification.permission === 'granted'){
      new Notification('Cuentas Claras', { body:'¿Cargaste los gastos de hoy?', tag:'cc-aviso' });
      return;
    }
  }catch(e){}
  toast('¿Cargaste los gastos de hoy?', { texto:'Cargar', ir:'cargar' });
}
/* El permiso del navegador sólo se puede pedir desde un toque tuyo. Adentro de
   un iframe de otro origen puede estar bloqueado: ahí queda el cartel de la app. */
function pedirPermisoAviso(){
  if(AND()) return;
  try{
    if(window.Notification && Notification.permission === 'default'){
      var r = Notification.requestPermission();
      if(r && r.then) r.then(function(){ renderAviso(); });
    }
  }catch(e){}
}
/* Le pasa la regla a Android cada vez que cambia, y reacomoda el temporizador. */
function sincronizarAviso(){
  var a = avisoCfg(), and = AND();
  if(and && and.programarAviso){
    try{ and.programarAviso(a.on ? 1 : 0, a.hora, a.min, a.dias, a.saltar ? 1 : 0); }catch(e){}
  }
  programarAvisoWeb();
}
function renderAviso(){
  var chip = $('#avisoOn'); if(!chip) return;
  var a = avisoCfg();
  chip.setAttribute('aria-pressed', a.on ? 'true' : 'false');
  chip.textContent = a.on ? 'Prendido' : 'Apagado';
  $('#avisoConf').hidden = !a.on;

  var hs = $('#avisoHora');
  if(hs && document.activeElement !== hs){
    var oh = '';
    for(var h = 0; h < 24; h++) oh += '<option value="'+h+'"'+(h===a.hora?' selected':'')+'>'+pad(h)+'</option>';
    hs.innerHTML = oh; hs.value = String(a.hora);
  }
  var mins = $('#avisoMin');
  if(mins && document.activeElement !== mins){
    var om = '';
    for(var m = 0; m < 60; m += 5) om += '<option value="'+m+'"'+(m===a.min?' selected':'')+'>'+pad(m)+'</option>';
    mins.innerHTML = om; mins.value = String(a.min);
  }
  $$('#segAvisoDias button').forEach(function(b){
    b.setAttribute('aria-pressed', b.getAttribute('data-v') === a.dias ? 'true' : 'false');
  });
  var sw = $('#avisoSaltar');
  if(sw) sw.setAttribute('aria-checked', a.saltar ? 'true' : 'false');

  var n = $('#avisoNota'); if(!n) return;
  if(!a.on){
    n.textContent = 'Apagado. Prendelo y te recuerdo cargar los gastos a la hora que le pongas.';
    return;
  }
  var cuando = 'Te aviso a las ' + hhmm(a.hora, a.min)
    + (a.dias === 'habiles' ? ', de lunes a viernes' : ', todos los días')
    + (a.saltar ? ', salvo que ese día ya hayas cargado algo' : '') + '.';
  n.textContent = AND()
    ? (cuando + ' Aunque tengas la app cerrada.')
    : (cuando + ' Ojo: el navegador sólo puede avisarte con la app abierta; para que suene con la app cerrada está la versión de Android.');
}
function renderArr(){
  var seg = $('#segArr'); if(!seg) return;
  $$('#segArr button').forEach(function(b){
    b.setAttribute('aria-pressed', b.getAttribute('data-v') === S.arrastreModo ? 'true' : 'false');
  });
  var n = $('#arrNota'); if(!n) return;
  n.textContent = S.arrastreModo === 'siempre'
    ? 'Lo que sobra pasa solo al mes siguiente. Si cerrás en rojo, el rojo también pasa.'
    : (S.arrastreModo === 'nunca'
      ? 'Cada mes arranca de cero: el balance dice cómo te fue en ese mes.'
      : 'Te pregunto una vez por mes y decidís vos.');
}
/* Cambiar de dólar. Si todavía no tengo el que elegiste, la cotización queda en
   cero: la app avisa y la podés escribir a mano. Lo que NO hago es dejar puesta
   la del tipo anterior, que sería valuar tus dólares a un precio que no es el
   tuyo. */
function elegirDolar(tp){
  if(!esTipoDolar(tp)) return;
  S.dolar = S.dolar || {}; S.dolar.tipos = S.dolar.tipos || {};
  if(S.dolar.tipo === tp) return;
  S.dolar.tipo = tp;
  if(!aplicarTipoDolar(true)){ S.dolar.venta = 0; S.dolar.fecha = ''; S.dolar.auto = false; }
  save(); render();
  toast(cotDolar() > 0
    ? ('Ahora uso el dólar ' + nombreDolar(tp).toLowerCase() + ': ' + money(cotDolar()))
    : ('No tengo el dólar ' + nombreDolar(tp).toLowerCase() + '. Escribí la venta acá al lado.'));
}
function ventaDolar(id){
  var t = S.dolar && S.dolar.tipos ? S.dolar.tipos[id] : null;
  return (t && t.venta > 0) ? t.venta : 0;
}
function renderMonedas(){
  var box = $('#monedasLista'); if(!box) return;
  var o = (S.dolar && S.dolar.otras) || {}, f = '';
  var h = MONEDAS.map(function(m){
    var t = o[m.id];
    if(t && t.fecha && t.fecha > f) f = t.fecha;
    return kv(m.n, t ? moneyCot(t.venta) : 'sin cotización', null,
      t ? 'Venta' + (t.compra > 0 && t.compra !== t.venta ? '. Compra: ' + moneyCot(t.compra) : '') + (t.mano ? '. La escribiste vos' : '') : 'Se baja sola cuando hay internet');
  }).join('');
  h += '<p class="note" style="margin-top:8px">Cotización oficial, en pesos por cada una' + (f ? ', del ' + esc(fechaLarga(f)) : '') + '. Para pasar plata de una a otra, usá el conversor de Herramientas.</p>';
  if(box.innerHTML !== h) box.innerHTML = h;
}
function renderDolar(){
  renderMonedas();
  var i = $('#dolarVenta'); if(!i) return;
  var c = cotDolar(), elegido = tipoDolar();

  var sel = $('#dolarTipo');
  if(sel && document.activeElement !== sel){
    sel.innerHTML = DOLARES.map(function(d){
      var v = ventaDolar(d.id);
      return '<option value="'+d.id+'"'+(d.id === elegido ? ' selected' : '')+'>'
        + esc(d.n) + (v > 0 ? ' · ' + esc(money(v)) : '') + '</option>';
    }).join('');
    sel.value = elegido;
  }
  if(document.activeElement !== i) i.value = c > 0 ? enCampo(c) : '';

  var n = $('#dolarNota');
  if(!n) return;
  if(c <= 0){
    n.textContent = 'No tengo la cotización del dólar ' + nombreDolar(elegido).toLowerCase()
      + ', así que no puedo pasar tus dólares a pesos. Escribila acá al lado.';
    return;
  }
  var f = S.dolar && S.dolar.fecha ? S.dolar.fecha : '';
  var det = detDolar(elegido);
  n.textContent = 'Uso el dólar ' + nombreDolar(elegido).toLowerCase()
    + (det ? ': ' + det : '') + '. '
    + (S.dolar && S.dolar.auto ? 'La bajé sola' : 'La cargaste vos')
    + (f ? ' el ' + fechaLarga(f) : '') + '.';
}
/* ---- medios de pago ---- */
function medios(){ return (S.medios && S.medios.length) ? S.medios : MEDIOS; }
function medioPorDefecto(pref){ return medios().indexOf(pref) > -1 ? pref : medios()[0]; }
function opcionesMedio(pref){
  var d = medioPorDefecto(pref);
  return medios().map(function(c){ return '<option'+(c===d?' selected':'')+'>'+esc(c)+'</option>'; }).join('');
}
function usosMedio(m){
  var n = 0;
  S.tx.forEach(function(t){ if((t.medio||'') === m) n++; });
  S.planes.forEach(function(p){ if((p.medio||'') === m) n++; });
  (S.pases||[]).forEach(function(p){ if(p.de === m || p.a === m) n++; });
  (S.fijos||[]).forEach(function(f){ if((f.medio||'') === m) n++; });
  return n;
}
function existeMedio(nombre, salvoIdx){
  var l = medios(), n = nombre.toLowerCase();
  for(var i=0;i<l.length;i++){ if(i !== salvoIdx && l[i].toLowerCase() === n) return true; }
  return false;
}
function marcarMedioQuitado(nombre){
  if(MEDIOS.indexOf(nombre) > -1 && S.mediosQuitados.indexOf(nombre) < 0) S.mediosQuitados.push(nombre);
}
function desmarcarMedioQuitado(nombre){
  var i = S.mediosQuitados.indexOf(nombre);
  if(i > -1) S.mediosQuitados.splice(i, 1);
}
/* v292: lo que antes se olvidaba al renombrar o borrar un medio: el día de las
   cuotas de esa tarjeta, lo que se pagaron en el grupo (de qué medio salió y a
   cuál entró) y la parte de un viaje que cargaste como gasto. */
function medioCambiarEnResto(viejo, nuevo){
  if(S.diaMedio && S.diaMedio[viejo]){ if(nuevo && !S.diaMedio[nuevo]) S.diaMedio[nuevo] = S.diaMedio[viejo]; delete S.diaMedio[viejo]; }
  [S.tx, S.planes, S.fijos].forEach(function(l){
    (l || []).forEach(function(x){
      if(!x || !x.sal) return;
      Object.keys(x.sal).forEach(function(k){ var v = x.sal[k]; if(!v) return; if(v.de === viejo) v.de = nuevo; if(v.a === viejo) v.a = nuevo; });
    });
  });
  (S.viajes || []).forEach(function(v){ if(v && v.cargado && v.cargado.medio === viejo) v.cargado.medio = nuevo; });
}
function renombrarMedio(i, nuevo){
  var viejo = S.medios[i];
  if(viejo === nuevo) return;
  S.medios[i] = nuevo;
  S.tx.forEach(function(t){ if((t.medio||'') === viejo) t.medio = nuevo; });
  S.planes.forEach(function(p){ if((p.medio||'') === viejo) p.medio = nuevo; });
  (S.fijos||[]).forEach(function(f){ if((f.medio||'') === viejo) f.medio = nuevo; });
  (S.pases||[]).forEach(function(p){ if(p.de === viejo) p.de = nuevo; if(p.a === viejo) p.a = nuevo; });
  // la cuenta que rinde con ese medio se llama igual: que lo siga
  cuentas().forEach(function(c){ if(c.medio === viejo) c.medio = nuevo; });
  medioCambiarEnResto(viejo, nuevo);
  // v292: el id es el mismo: sólo cambia el nombre
  var reg = medReg(); if(reg[viejo]){ reg[nuevo] = reg[viejo]; delete reg[viejo]; }
  marcarMedioQuitado(viejo);
  desmarcarMedioQuitado(nuevo);
}
function borrarMedio(i){
  if(S.medios.length <= 1) return 'Tiene que quedar al menos un medio de pago';
  var nombre = S.medios[i];
  // es el medio de una cuenta que rinde: borrarlo la dejaría sin saldo
  if(cuentaDelMedio(nombre)) return 'No puedo: "'+nombre+'" es la cuenta que rinde. Borrala desde "Cuentas que rinden".';
  S.medios.splice(i, 1);
  var destino = S.medios.indexOf('Efectivo') > -1 ? 'Efectivo' : S.medios[0];
  var movidos = 0;
  S.tx.forEach(function(t){ if((t.medio||'') === nombre){ t.medio = destino; movidos++; } });
  S.planes.forEach(function(p){ if((p.medio||'') === nombre){ p.medio = destino; movidos++; } });
  (S.fijos||[]).forEach(function(f){ if((f.medio||'') === nombre){ f.medio = destino; movidos++; } });
  (S.pases||[]).forEach(function(p){
    if(p.de === nombre){ p.de = destino; movidos++; }
    if(p.a === nombre){ p.a = destino; movidos++; }
  });
  // un pase que quedó de un medio al mismo medio no mueve nada
  S.pases = (S.pases||[]).filter(function(p){ return p.de !== p.a; });
  medioCambiarEnResto(nombre, destino);
  delete medReg()[nombre];
  marcarMedioQuitado(nombre);
  return movidos ? ('Borré "'+nombre+'" y pasé '+movidos+(movidos===1?' movimiento':' movimientos')+' a "'+destino+'"')
                 : ('Borré "'+nombre+'"');
}
function renderMedios(){
  var el = $('#medioList'); if(!el) return;
  el.innerHTML = medios().map(function(m, i){
    var n = usosMedio(m);
    var borrar = (medioConfirm === i)
      ? '<button class="confirm" type="button" data-mediodel="'+i+'">'+(n ? 'Borrar y mover '+n : 'Borrar')+'</button>'
      : '<button class="iconbtn" type="button" data-mediodel="'+i+'" aria-label="Borrar '+esc(m)+'" title="'+(n ? n+(n===1?' movimiento usa este medio':' movimientos usan este medio') : 'Sin movimientos')+'">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg></button>';
    return '<div class="catrow">'
      + '<input type="text" data-medio="'+i+'" value="'+esc(m)+'" maxlength="28" autocomplete="off" aria-label="Nombre del medio de pago '+esc(m)+'">'
      + borrar + '</div>';
  }).join('');
}

/* ---- categorías ---- */
function listaCat(tipo){ return tipo === 'ingreso' ? S.catIng : S.catGasto; }
function defaultsCat(tipo){ return tipo === 'ingreso' ? CAT_ING : CAT_GASTO; }
function usosCat(tipo, cat){
  var n = 0;
  S.tx.forEach(function(t){ if(t.tipo === tipo && (t.cat||'') === cat) n++; });
  if(tipo === 'gasto') S.planes.forEach(function(p){ if((p.cat||'') === cat) n++; });
  return n;
}
function marcarQuitada(tipo, nombre){
  if(defaultsCat(tipo).indexOf(nombre) > -1 && S.catQuitadas.indexOf(nombre) < 0) S.catQuitadas.push(nombre);
}
function desmarcarQuitada(nombre){
  var i = S.catQuitadas.indexOf(nombre);
  if(i > -1) S.catQuitadas.splice(i, 1);
}
function existeCat(tipo, nombre, salvoIdx){
  var l = listaCat(tipo), n = nombre.toLowerCase();
  for(var i=0;i<l.length;i++){ if(i !== salvoIdx && l[i].toLowerCase() === n) return true; }
  return false;
}
function renombrarCat(tipo, i, nuevo){
  var lista = listaCat(tipo), viejo = lista[i];
  if(viejo === nuevo) return;
  lista[i] = nuevo;
  S.tx.forEach(function(t){ if(t.tipo === tipo && (t.cat||'') === viejo) t.cat = nuevo; });
  if(tipo === 'gasto'){
    S.planes.forEach(function(p){ if((p.cat||'') === viejo) p.cat = nuevo; });
    if(S.grupoDe[viejo] != null){ S.grupoDe[nuevo] = S.grupoDe[viejo]; delete S.grupoDe[viejo]; }
  }
  (S.fijos||[]).forEach(function(f){
    if((f.tipo === 'ingreso' ? 'ingreso' : 'gasto') === tipo && (f.cat||'') === viejo) f.cat = nuevo;
  });
  marcarQuitada(tipo, viejo);
  desmarcarQuitada(nuevo);
}
function borrarCat(tipo, i){
  var lista = listaCat(tipo), nombre = lista[i];
  if(lista.length <= 1) return 'Tiene que quedar al menos una categoría';
  lista.splice(i, 1);
  var destino = lista.indexOf('Otros') > -1 ? 'Otros' : lista[0];
  var movidos = 0;
  S.tx.forEach(function(t){ if(t.tipo === tipo && (t.cat||'') === nombre){ t.cat = destino; movidos++; } });
  if(tipo === 'gasto'){
    S.planes.forEach(function(p){ if((p.cat||'') === nombre){ p.cat = destino; movidos++; } });
    delete S.grupoDe[nombre];
  }
  (S.fijos||[]).forEach(function(f){
    if((f.tipo === 'ingreso' ? 'ingreso' : 'gasto') === tipo && (f.cat||'') === nombre){ f.cat = destino; movidos++; }
  });
  marcarQuitada(tipo, nombre);
  return movidos ? ('Borré "'+nombre+'" y pasé '+movidos+(movidos===1?' movimiento':' movimientos')+' a "'+destino+'"')
                 : ('Borré "'+nombre+'"');
}
function renderCats(){
  var el = $('#catList'); if(!el) return;
  $$('#segCat button').forEach(function(b){ b.setAttribute('aria-pressed', b.getAttribute('data-v') === catTab ? 'true':'false'); });
  var lista = listaCat(catTab), esGasto = (catTab === 'gasto');
  var add = $('#catAdd') && $('#catAdd').parentNode;
  if(add) add.classList.toggle('congrupo', esGasto);
  var selGrupoAdd = $('#catGrupoNueva');
  if(selGrupoAdd) selGrupoAdd.style.display = esGasto ? '' : 'none';
  el.innerHTML = lista.map(function(c, i){
    var n = usosCat(catTab, c);
    var borrar = (catConfirm === catTab+':'+i)
      ? '<button class="confirm" type="button" data-catdel="'+i+'">'+(n ? 'Borrar y mover '+n : 'Borrar')+'</button>'
      : '<button class="iconbtn" type="button" data-catdel="'+i+'" aria-label="Borrar '+esc(c)+'" title="'+(n ? n+(n===1?' movimiento usa esta categoría':' movimientos usan esta categoría') : 'Sin movimientos')+'">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg></button>';
    var sel = esGasto
      ? '<select data-catgrupo="'+i+'" aria-label="Grupo de '+esc(c)+'">'
        + S.grupos.map(function(g){ return '<option value="'+g.id+'"'+(grupoDeCat(c)===g.id?' selected':'')+'>'+esc(nombreGrupo(g.id))+'</option>'; }).join('')
        + '</select>'
      : '';
    return '<div class="catrow'+(esGasto?' congrupo':'')+'">'
      + '<input type="text" data-cat="'+i+'" value="'+esc(c)+'" maxlength="28" autocomplete="off" aria-label="Nombre de la categoría '+esc(c)+'">'
      + sel + borrar + '</div>';
  }).join('');
}

/* ---- presupuestos ---- */
function baseInfo(ym){
  if(S.baseIngreso > 0) return { v:S.baseIngreso, de:'referencia' };
  var ing = resumen(ym).ing;
  if(ing > 0) return { v:ing, de:'este mes' };
  for(var i=1; i<=12; i++){
    var prev = ymAdd(ym,-i), v = resumen(prev).ing;
    if(v > 0) return { v:v, de:ymLabel(prev,true) };
  }
  return { v:0, de:'' };
}
function baseDelMes(ym){ return baseInfo(ym).v; }
/* Un tope se guarda de una de dos formas, y la diferencia importa:

   · en PORCENTAJE (`S.presuGrupo`): "el 10% de lo que entra". Si te aumentan el
     sueldo, el tope sube solo. El 10% de 1.000.000 son 100.000; el 10% de
     10.000.000 son 1.000.000.
   · en PESOS (`S.presuFijo`): "$ 250.000 y punto". No se mueve aunque cambie tu
     ingreso. El alquiler es esto: sale lo que sale, no un porcentaje de lo que
     ganes.

   Manda el campo que tocaste último: escribís en el de % y el grupo queda
   porcentual, escribís en el de $ y queda fijo. Nunca tiene los dos, así que no
   hay forma de que se contradigan. */
function esTopeFijo(id){ return (Number(S.presuFijo && S.presuFijo[id]) || 0) > 0; }
function topeFijoDe(id){ return Math.max(0, Number(S.presuFijo && S.presuFijo[id]) || 0); }
function topePctGuardado(id){ return Math.max(0, Number(S.presuGrupo && S.presuGrupo[id]) || 0); }
/* El tope en pesos. El fijo vale siempre lo mismo —y por eso funciona incluso
   sin base, cuando todavía no cargaste ningún ingreso—; el porcentual sale de la
   base del mes que estés mirando. */
function topeEnPlata(id, ym){
  if(esTopeFijo(id)) return topeFijoDe(id);
  var pct = topePctGuardado(id);
  return pct > 0 ? topeEnPesos(pct, baseDelMes(ym)) : 0;
}
/* El mismo tope visto como porcentaje de la base, que es lo que necesitan la
   barra de reparto y el "repartiste X%". Un tope fijo SÍ cambia de porcentaje
   cuando cambia tu ingreso: son los mismos pesos sobre una base más grande. */
function topeEnPct(id, ym){
  if(!esTopeFijo(id)) return topePctGuardado(id);
  var base = baseDelMes(ym);
  return base > 0 ? Math.min(100, topeFijoDe(id) / base * 100) : 0;
}
function tieneTope(id, ym){ return topeEnPlata(id, ym) > 0; }
function gruposConTope(ym){ return S.grupos.filter(function(g){ return tieneTope(g.id, ym); }); }
function totalAsignado(){
  var t = 0;
  S.grupos.forEach(function(g){ t += topeEnPct(g.id, mes); });
  return t;
}
function budList(ym, limit){
  var conTope = gruposConTope(ym);
  var base = baseDelMes(ym);
  if(!conTope.length){
    /* Sin base, un tope porcentual no se puede calcular, pero uno fijo sí: si no
       hay ninguno de los dos, el cartel tiene que decir cuál de las dos cosas
       falta, no mandarte a "cargá un ingreso" cuando alcanzaba con poner pesos. */
    var hayPct = S.grupos.some(function(g){ return topePctGuardado(g.id) > 0; });
    if(hayPct && base <= 0) return emptyBox('Tus topes son un porcentaje de lo que entra, y todavía no cargaste ingresos. Cargá uno, o poné el tope en pesos.');
    return emptyBox('Sin topes definidos. Repartí tu mes por grupo desde Ajustes.');
  }
  var g = gastosPorGrupo(ym);
  var rows = conTope.map(function(gr){
    var cap = topeEnPlata(gr.id, ym), us = g.por[gr.id]||0;
    return { id:gr.id, pct:topeEnPct(gr.id, ym), fijo:esTopeFijo(gr.id), cap:cap, us:us,
             r: cap ? us/cap : 0, det:(g.det[gr.id]||[]) };
  }).sort(function(a,b){ return b.r - a.r; });
  if(limit) rows = rows.slice(0,limit);
  return rows.map(function(x){
    var pctv = Math.min(100, x.r*100);
    var cls = x.r >= 1 ? 'over' : (x.r >= 0.8 ? 'near' : '');
    var pill = x.r > 1.001 ? '<span class="pill over">Te pasaste</span>'
      : x.r >= 0.999 ? '<span class="pill over">Justo al límite</span>'
      : x.r >= 0.8 ? '<span class="pill near">Casi</span>' : '<span class="pill ok">En orden</span>';
    var resto = x.cap - x.us;
    var detalle = x.det.length
      ? '<div class="gcats">' + x.det.slice(0,6).map(function(d){ return esc(d.cat)+' '+esc(money(d.monto)); }).join(' · ')
        + (x.det.length > 6 ? ' · +'+(x.det.length-6)+' más' : '') + '</div>'
      : '';
    return '<div class="bud">'
      + '<div class="l1"><b><i class="gdot" style="background:'+colorGrupo(x.id)+'"></i> '+esc(nombreGrupo(x.id))+'</b>'+pill+'</div>'
      + '<div class="prog '+cls+'"><i style="width:'+pctv.toFixed(1)+'%;background:'+colorGrupo(x.id)+'"></i></div>'
      + '<div class="l2"><span>'+esc(money(x.us))+' de '+esc(money(x.cap))
      +   ' ('+esc(x.fijo ? (x.pct > 0 ? 'fijo, hoy el '+fmtPct(x.pct) : 'fijo') : fmtPct(x.pct))+')</span>'
      + '<span>'+(resto>=0 ? 'te quedan '+esc(money(resto)) : 'excedido en '+esc(money(-resto)))+'</span></div>'
      + detalle
      + '</div>';
  }).join('');
}
/* Los topes se guardan en PORCENTAJE de la base, no en pesos: si te aumentan el
   sueldo, cambiás la base y los topes se acomodan solos. El costo de eso es que
   escribir "$ 250.000" tiene que pasar por un porcentaje y volver, y ahí el
   redondeo mordía el monto: con 2 decimales, sobre una base de $ 1.500.000, el
   16,67% volvía como $ 250.050. Ahora el porcentaje se guarda con 10 decimales
   —exacto al CENTAVO para bases de hasta cien millones; con 6 alcanzaba para el
   peso pero no para los centavos, y escribir 250.000,56 volvía 250.000,55— y el
   campo muestra hasta 4, que es lo que se puede leer de un vistazo. */
var PCT_DEC = 10;
function redondearPct(v){ var f = Math.pow(10, PCT_DEC); return Math.round((Number(v)||0) * f) / f; }
function recortarCeros(s){ return s.replace(/0+$/,'').replace(/[.,]$/,''); }
/* Para leer: dos decimales, que es lo que interesa en una etiqueta. */
function fmtPct(v){
  var r = Math.round((Number(v)||0) * 100) / 100;
  if(Math.abs(r % 1) < 0.005) return Math.round(r) + '%';
  return recortarCeros(r.toFixed(2)).replace('.', ',') + '%';
}
/* Para el campo editable: hasta cuatro, sin ceros de relleno. */
function fmtPctFino(v){
  var r = Math.round((Number(v)||0) * 10000) / 10000;
  if(Math.abs(r % 1) < 0.00005) return Math.round(r) + '%';
  return recortarCeros(r.toFixed(4)).replace('.', ',') + '%';
}
/* El campo muestra 4 decimales pero adentro hay 6. Si lo que está escrito se ve
   igual que lo guardado, es que no lo tocaste: vale el guardado, con todos sus
   decimales. Sin esto, entrar y salir del campo iba limando el monto. */
/* El tope en pesos sale del porcentaje, que se guarda con seis decimales: se
   redondea al centavo, no al peso. Al peso te comía lo que hubieras escrito
   —poner 250.000,56 y que volviera 250.001 es justamente lo que no queremos—,
   y con seis decimales el número que escribís vuelve exacto. */
function topeEnPesos(pct, base){
  var v = (Number(base)||0) * (Number(pct)||0) / 100;
  return Math.round(v * 100) / 100;          // al centavo, no al peso
}
function pctDelCampo(id, texto){
  var guardado = Number(S.presuGrupo[id]) || 0;
  var tipeado = redondearPct(Math.min(100, Math.max(0, parseMoney(texto))));
  return (guardado > 0 && fmtPctFino(guardado) === fmtPctFino(tipeado)) ? guardado : tipeado;
}
function renderPresuEdit(){
  var el = $('#presuEdit'); if(!el) return;
  var base = baseDelMes(mes);
  $('#baseIng').value = S.baseIngreso > 0 ? enCampo(S.baseIngreso) : '';
  el.innerHTML = S.grupos.map(function(g){
    /* Los dos campos se muestran siempre llenos, pero uno es el que manda y el
       otro es su traducción. El que manda va en tinta normal; el derivado, en
       gris. La clase de la fila dice cuál es cuál. */
    var fijo = esTopeFijo(g.id);
    var pct  = topeEnPct(g.id, mes);
    var plata = topeEnPlata(g.id, mes);
    var nom = esc(nombreGrupo(g.id));
    return '<div class="pctrow'+(fijo ? ' fijo' : '')+'" data-fila="'+g.id+'">'
      + '<span class="grow"><button type="button" class="gpick" data-gcolor="'+g.id+'" aria-haspopup="dialog"'
      +   ' aria-expanded="false" title="Elegir el color de '+nom+'" aria-label="Color de '+nom+'">'
      +   '<i class="gdot" style="background:'+colorGrupo(g.id)+'"></i></button>'
      +   '<input type="text" data-gname="'+g.id+'" value="'+esc(nombreGrupo(g.id))+'" maxlength="28" autocomplete="off" aria-label="Nombre del grupo"></span>'
      + '<span class="pctin"><input type="text" inputmode="decimal" data-pct="'+g.id+'"'
      /* El porcentual muestra cuatro decimales, que son suyos; el derivado de un
         tope fijo, dos: es una referencia, no un número que vayas a editar. */
      +   ' value="'+(pct > 0 ? esc((fijo ? fmtPct(pct) : fmtPctFino(pct)).replace('%','')) : '')+'" placeholder="0" autocomplete="off"'
      +   ' title="'+(fijo ? 'Hoy el tope fijo de '+nom+' es esto de tu base. Si escribís acá pasa a ser un porcentaje y se va a mover con tu ingreso.'
                           : 'Tope de '+nom+' como porcentaje de tu ingreso: sube y baja con él.')+'"'
      +   ' aria-label="Porcentaje para '+nom+(fijo ? ', calculado del tope fijo' : '')+'"><i>%</i></span>'
      + '<span class="pctin plata"><i>$</i><input type="text" inputmode="decimal" data-money="'+g.id+'"'
      +   ' value="'+(plata > 0 ? esc(enCampo(plata)) : '')+'"'
      +   ' title="'+(fijo ? 'Tope fijo de '+nom+': son estos pesos siempre, cambie lo que cambie tu ingreso.'
                           : 'Lo que da hoy el porcentaje de '+nom+'. Si escribís acá el tope pasa a ser fijo en pesos.')+'"'
      +   ' placeholder="0" autocomplete="off" aria-label="Tope en pesos para '+nom+(fijo ? '' : ', calculado del porcentaje')+'"></span>'
      + botonBorrarGrupo(g.id)
      + '</div>';
  }).join('');
  // el select de grupo del alta de categorías
  var selAdd = $('#catGrupoNueva');
  if(selAdd){
    var prev = selAdd.value;
    selAdd.innerHTML = S.grupos.map(function(g){ return '<option value="'+g.id+'">'+esc(nombreGrupo(g.id))+'</option>'; }).join('');
    if(prev) selAdd.value = prev;
  }
  pintarColorNuevo();
  pintarAlloc();
  actualizarSumaPresu();
}
/* Cuánto vale HOY el tope de este grupo, mirando lo que hay ESCRITO en la fila
   (todavía sin guardar). Se lee el campo que manda —el de pesos si la fila está
   en modo fijo, el de porcentaje si no— y se devuelve en porcentaje, que es lo
   que necesita la barra de reparto. Antes esto se hacía escribiendo en S y
   deshaciéndolo después; así no se toca el estado en absoluto. */
function pctEscrito(id){
  if(esTopeFijo(id)){
    var mi = campoPlata(id);
    var plata = mi ? Math.max(0, parseMoney(mi.value)) : topeFijoDe(id);
    var base = baseDelMes(mes);
    return (base > 0 && plata > 0) ? Math.min(100, plata / base * 100) : 0;
  }
  var pi = campoPct(id);
  return pi ? pctDelCampo(id, pi.value) : topePctGuardado(id);
}
function vistaPreviaAlloc(){ pintarAlloc(pctEscrito); }
