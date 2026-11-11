/* Cuentas Claras · js/gastos-fijos.js
   Gastos e ingresos fijos: la lista, editar uno entero y sus precios.

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

/* ---- v289: editar un fijo entero ----
   El lápiz carga el fijo en el formulario de arriba. Al guardar se elige desde
   cuándo vale: "Desde este mes" deja los meses anteriores como se pagaron (el
   fijo se parte en dos: el viejo termina el mes anterior y sigue en uno nuevo,
   enlazados con `sig`/`ant`); "Todos los meses" lo corrige entero. */
var editandoFijo = null, alcanceFijo = 'desde';
function fijoPorId(id){ var r = null; (S.fijos||[]).forEach(function(f){ if(f.id === id) r = f; }); return r; }
function cadenaFijo(id){
  var ids = [id], cambio = true;
  while(cambio){
    cambio = false;
    (S.fijos||[]).forEach(function(f){
      if(ids.indexOf(f.id) > -1) return;
      if((f.sig && ids.indexOf(f.sig) > -1) || (f.ant && ids.indexOf(f.ant) > -1)){ ids.push(f.id); cambio = true; }
    });
    (S.fijos||[]).forEach(function(f){
      if(ids.indexOf(f.id) < 0) return;
      [f.sig, f.ant].forEach(function(o){ if(o && ids.indexOf(o) < 0 && fijoPorId(o)){ ids.push(o); cambio = true; } });
    });
  }
  return ids;
}
// el mes del fijo que se edita: el que estás mirando, si el fijo corre ese mes
function ymEdicionFijo(f){
  if(mes < f.desde) return f.desde;
  if(f.hasta && mes > f.hasta) return f.hasta;
  return mes;
}
function puedePartir(f){ return mes > f.desde && !(f.hasta && f.hasta < mes); }
function pintarAlcance(){
  var f = editandoFijo ? fijoPorId(editandoFijo) : null, box = $('#fAlcanceBox'); if(!box) return;
  box.hidden = !(f && puedePartir(f));
  if(box.hidden) return;
  var nm = MESES[parseInt(mes.slice(5, 7), 10) - 1];
  $('#fAlcDesde').textContent = 'Desde ' + nm;
  $$('#segAlcance button').forEach(function(b){ b.setAttribute('aria-pressed', b.getAttribute('data-alc') === alcanceFijo ? 'true' : 'false'); });
  var ant = ymLabel(ymAdd(mes, -1));
  $('#fAlcanceNota').textContent = alcanceFijo === 'desde'
    ? 'Hasta ' + ant + ' queda como se ' + (f.tipo === 'ingreso' ? 'cobró' : 'pagó') + '; los cambios valen desde ' + ymLabel(mes) + '.'
    : 'Corrige también los meses anteriores, como si lo hubieras cargado así desde el principio.';
}
function entrarEditFijo(id){
  var f = fijoPorId(id); if(!f) return;
  editandoFijo = id; alcanceFijo = 'desde';
  fijoTab = f.tipo === 'ingreso' ? 'ingreso' : 'gasto';
  var esIng = fijoTab === 'ingreso', ymE = ymEdicionFijo(f);
  monFijo = f.mon === 'USD' ? 'USD' : 'ARS'; pintarMon();
  fQuin = esIng && f.dia === 'quincena';
  fManual = !!f.man;
  pintarFijoForm();
  $('#fNombre').value = f.nombre || '';
  $('#fMonto').value = enCampo(precioFijo(f, ymE));
  if(esIng){
    var cu = $('#fCuando');
    if(typeof f.dia === 'number'){
      if(!cu.querySelector('option[value="dia"]')) cu.insertAdjacentHTML('beforeend', '<option value="dia">Un día del mes</option>');
      cu.value = 'dia'; $('#fDia').value = String(f.dia);
    } else if(f.dia === 'quincena'){
      $('#fQuinHab').value = String(f.qhab >= 0 ? f.qhab : 0);
    } else {
      cu.value = f.dia;
      if(f.dia === 'nHabil') $('#fNhab').value = String(nhabDe(f));
    }
    $('#fDesde').value = f.desde;
  } else {
    var dd = Math.min(Number(f.dia) || 1, finDeMes(ymE));
    $('#fFecha').value = ymE + '-' + pad(dd); pintarFecha($('#fFecha'));
    if($('#fHora')) $('#fHora').value = f.hora || '';
  }
  pintarFijoForm();
  var fc = $('#fCat'); if(f.cat && ![].some.call(fc.options, function(o){ return o.value === f.cat; })) fc.insertAdjacentHTML('beforeend', '<option>' + esc(f.cat) + '</option>');
  fc.value = f.cat || fc.value;
  var fm = $('#fMedio'); if(f.medio && ![].some.call(fm.options, function(o){ return o.value === f.medio; })) fm.insertAdjacentHTML('beforeend', '<option>' + esc(f.medio) + '</option>');
  fm.value = f.medio || fm.value;
  ponerQuien('f', quienDe(f), f.med, f.rep);
  pintarFManual(); pintarEditFijo();
  var card = $('#cardFijoNuevo'); if(card) try{ card.scrollIntoView({ behavior:'smooth', block:'start' }); }catch(x){ card.scrollIntoView(); }
}
function pintarEditFijo(){
  var f = editandoFijo ? fijoPorId(editandoFijo) : null;
  var seg = $('#segFijo'); if(seg) seg.closest('.rowflex').hidden = !!f;
  var cd = $('#campoDesde'); if(f && cd) cd.hidden = true;
  var c = $('#fCancelar'); if(c) c.hidden = !f;
  if(f){
    $('#fNuevoTit').textContent = 'Editar: ' + f.nombre;
    $('#fNuevoSub').textContent = 'Cambiá lo que quieras y guardá';
    $('#fSubmit').textContent = 'Guardar cambios';
  }
  pintarAlcance();
}
function salirEditFijo(){
  editandoFijo = null; alcanceFijo = 'desde';
  fManual = false; fQuin = false; monFijo = 'ARS'; pintarMon();
  $('#fNombre').value = ''; $('#fMonto').value = ''; if($('#fHora')) $('#fHora').value = '';
  $('#fFecha').value = defaultFecha(); pintarFecha($('#fFecha'));
  ponerQuien('f', miPersona(), null);
  pintarFijoForm(); pintarEditFijo();
}
function partirFijo(f, ym){
  var n = JSON.parse(JSON.stringify(f));
  n.id = uid(); n.desde = ym; n.ant = f.id; delete n.sig;
  var vig = tramoFijo(f, ym) || f.precios[0];
  n.precios = f.precios.filter(function(t){ return t.desde > ym; });
  n.precios.unshift(Object.assign({}, vig, { desde:ym }));
  var desp = function(k){ return k >= ym; };
  n.pag = pagLimpio((f.pag || []).filter(desp)); f.pag = pagLimpio((f.pag || []).filter(function(k){ return !desp(k); }));
  if(!n.pag) delete n.pag; if(!f.pag) delete f.pag;
  var partirObj = function(o, mesDe){
    var a = {}, b = {};
    Object.keys(o || {}).forEach(function(k){ (mesDe(k) >= ym ? a : b)[k] = o[k]; });
    return [a, b];
  };
  var ad = partirObj(f.adel, function(k){ return k.slice(0, 7); });
  n.adel = adelLimpio(ad[0]); f.adel = adelLimpio(ad[1]); if(!n.adel) delete n.adel; if(!f.adel) delete f.adel;
  var sl = partirObj(f.sal, function(k){ return (k.split('|')[1] || ''); });
  n.sal = salLimpio(sl[0]); f.sal = salLimpio(sl[1]); if(!n.sal) delete n.sal; if(!f.sal) delete f.sal;
  if(f.man) n.man = f.man > ym ? f.man : ym;
  f.hasta = ymAdd(ym, -1); f.sig = n.id;
  S.fijos.splice(S.fijos.indexOf(f) + 1, 0, n);
  return n;
}
function guardarEdicionFijo(d, monto, cotF){
  var f = fijoPorId(editandoFijo); if(!f){ salirEditFijo(); return; }
  var esIng = f.tipo === 'ingreso', ymE = ymEdicionFijo(f);
  var cambioMon = (d.mon || '') !== (f.mon || '');
  var cambioMonto = cambioMon || Math.abs(monto - precioFijo(f, ymE)) > 0.004;
  var gqCambio = hayGrupo() && (JSON.stringify([d.quien || quienDe(f), d.med || null, d.med ? (d.rep || null) : null])
                                 !== JSON.stringify([quienDe(f), esMedias(f) ? f.med : null, esMedias(f) ? (repLimpio(f.rep) || null) : null]));
  var otros = String(d.dia) !== String(f.dia) || (d.hora || '') !== (f.hora || '') || (d.qhab || 0) !== (f.qhab || 0)
           || (d.nhab || 0) !== (f.nhab || 0) || d.cat !== f.cat || d.medio !== f.medio || gqCambio
           || (!!fManual) !== (!!f.man) || cambioMonto;
  if(!otros && d.nombre === f.nombre){ salirEditFijo(); toast('No cambiaste nada'); return; }
  var alc = puedePartir(f) ? alcanceFijo : 'todos';
  var partir = alc === 'desde' && otros;
  var g = partir ? partirFijo(f, mes) : f;
  g.nombre = d.nombre;
  if(d.mon) g.mon = d.mon; else delete g.mon;
  g.dia = d.dia;
  if(d.hora) g.hora = d.hora; else delete g.hora;
  if(d.qhab !== undefined) g.qhab = d.qhab; else delete g.qhab;
  if(d.nhab !== undefined) g.nhab = d.nhab; else delete g.nhab;
  g.cat = d.cat; g.medio = d.medio;
  if(hayGrupo()){
    if(d.quien) g.quien = d.quien;
    if(d.med){ if(!esMedias(g)){ g.pend = 1; g.pendDesde = ymNow(); } g.med = d.med; if(d.rep) g.rep = d.rep; else delete g.rep; }
    else { delete g.med; delete g.rep; delete g.pend; delete g.pendDesde; delete g.sal; }
  }
  if(fManual){ if(!g.man) g.man = (alc === 'desde' && mes > g.desde) ? mes : g.desde; }
  else delete g.man;
  if(cambioMonto){
    var tr = { desde:g.desde, monto:monto }; if(cotF) tr.cot = cotF;
    if(alc === 'todos' || cambioMon) g.precios = [tr];
    else {
      var D = g.desde > mes ? g.desde : mes; tr.desde = D;
      g.precios = g.precios.filter(function(t){ return t.desde !== D; }).concat([tr]).sort(function(a, b){ return a.desde < b.desde ? -1 : 1; });
      if(g.precios[0].desde > g.desde) g.precios[0].desde = g.desde;
    }
  }
  var nom = g.nombre;
  save(); salirEditFijo(); render();
  toast(nom + ': ' + (partir ? 'cambios guardados desde ' + ymLabel(mes) + '; lo de antes queda como estaba' : 'cambios guardados'));
}
document.addEventListener('click', function(e){
  if(!e.target.closest) return;
  var b = e.target.closest('[data-fedit]');
  if(b){ entrarEditFijo(b.getAttribute('data-fedit')); return; }
  if(e.target.closest('#fCancelar')){ salirEditFijo(); return; }
  var a = e.target.closest('#segAlcance [data-alc]');
  if(a){ alcanceFijo = a.getAttribute('data-alc'); pintarAlcance(); }
});
function renderFijos(){
  renderPagos();
  var el = $('#fijoList'); if(!el) return;
  var esIng = (fijoTab === 'ingreso');
  var lista = (S.fijos||[]).filter(function(f){
    if((f.tipo||'gasto') !== fijoTab || !(pesoParte(f, mes) > 0)) return false;
    // v289: un fijo editado "desde este mes" son dos: se ve el que corresponde al mes que mirás
    if(f.sig && f.hasta && mes > f.hasta) return false;
    if(f.ant && mes < f.desde) return false;
    return true;
  });
  var delMes = fijosDe(mes, fijoTab, false, pesoParte);
  var tot = delMes.reduce(function(a,b){ return a + b.monto; }, 0);
  var pend = sumaPend(delMes);

  $('#fTotalLab').textContent = esIng ? 'Entra por mes' : 'Sale por mes';
  var tile = $('#fTileTot'); if(tile) tile.className = 'tile ' + (esIng ? 'in' : 'out');
  $('#fAnioLab').textContent  = 'Al año';
  /* v226: por mes = lo que vale cada fijo en un mes entero (dos quincenas). Lo
     que de verdad cae en este mes puede ser distinto: el primer mes de uno por
     quincena sólo entra la 1.ª. Eso se aclara abajo. */
  var porMes = (S.fijos||[]).reduce(function(a, f){
    if((f.tipo||'gasto') !== fijoTab) return a;
    var w = pesoParte(f, mes); return w > 0 ? a + valorFijoMes(f, mes) * w : a;
  }, 0);
  // v289: con alguien elegido arriba y gastos a medias, los cuadros dicen "su parte"
  var vQ = verDe(), soyYo = vQ && vQ === miPersona();
  var conMedias = !esIng && vQ && lista.some(function(f){ return esMedias(f, mes); });
  var porMesTodo = conMedias ? lista.reduce(function(a, f){ return a + valorFijoMes(f, mes); }, 0) : porMes;
  var difiere = Math.abs(porMes - tot) > 0.5;
  var arranca = (S.fijos||[]).some(function(f){ return (f.tipo||'gasto') === fijoTab && esQuincena(f) && f.desde === mes && pesoDe(f, mes) > 0; });
  $('#fTotal').textContent = money(porMes);
  $('#fTotalM').textContent = difiere
    ? ('En ' + MESES[parseInt(mes.slice(5,7),10) - 1] + ' ' + (esIng ? 'entra' : 'sale') + ' ' + money(tot)
       + (arranca ? ': la 2.ª quincena se cobra el mes que viene' : ', por el día en que cae cada quincena')
       + (pend > 0 ? ' · ' + money(pend) + (esIng ? ' sin cobrar' : ' sin pagar') : ''))
    : delMes.length
    ? (delMes.length + ' fijo' + (delMes.length===1?'':'s') + ' en ' + ymLabel(mes, true)
       + (pend > 0 ? ' · ' + money(pend) + (esIng ? ' todavía sin cobrar' : ' todavía sin pagar') : ''))
    : ('Nada fijo en ' + ymLabel(mes, true));
  $('#fAnio').textContent = money(porMes*12);
  $('#fAnioM').textContent = conMedias ? ((soyYo ? 'Tu' : 'Su') + ' parte, si todo sigue igual') : 'Si todo sigue igual';
  if(conMedias){
    $('#fTotalLab').textContent = soyYo ? 'Te toca por mes' : 'A ' + nombrePersona(vQ) + ' le toca';
    $('#fTotalM').textContent = (soyYo ? 'Tu' : 'Su') + ' parte de ' + money(porMesTodo) + ' en total'
      + (pend > 0 ? ' · ' + money(pend) + ' sin pagar' : '');
  }
  pintarQueda(delMes, esIng);
  $('#fijoTit').textContent = esIng ? 'Tus ingresos fijos' : 'Tus gastos fijos';
  $('#fijoSub').textContent = lista.length
    ? (esIng ? 'Entran solos. Con el lápiz cambiás lo que quieras; abajo, rápido, el monto.'
             : 'Salen solos. Con el lápiz cambiás lo que quieras; abajo, rápido, el precio.')
    : 'Todavía no cargaste ninguno';

  if(!lista.length){
    el.innerHTML = emptyBox(esIng
      ? 'Cargá el primero arriba: el sueldo, un alquiler que cobrás'
      : 'Cargá el primero arriba: el gimnasio, una suscripción, el alquiler');
    return;
  }

  function ordenDia(f){
    if(f.dia === 'primerHabil') return 0.5;
    if(f.dia === 'ultimoHabil') return 31.5;
    if(f.dia === 'nHabil') return nhabDe(f) * 1.4 + 0.3;
    if(esQuincena(f)) return 15.5;
    return (Number(f.dia)||1) + (horaFijo(f) ? parseInt(horaFijo(f), 10) / 100 : 0);
  }
  var orden = lista.slice().sort(function(a,b){ return ordenDia(a) - ordenDia(b); });
  el.innerHTML = orden.map(function(f){
    var activo = mes >= f.desde && (!f.hasta || mes <= f.hasta);
    var usdF = esUSD(f);
    var tramoHoy = tramoFijo(f, mes) || f.precios[f.precios.length-1];
    var propio = Number(tramoHoy.monto)||0;
    var enPesos = montoFijoPesos(f, activo ? mes : (f.hasta || f.desde));
    // v289: en uno a medias, primero la parte del que mira (o la tuya, con "Todos")
    var pTu = verDe() || miPersona();
    var rr = (!esIng && pTu && esMedias(f, mes)) ? repartoDe(f.med, mes, f.rep) : null;
    var parteTu = (rr && rr[pTu] > 0) ? rr[pTu] : 0;
    var nRep = rr ? Object.keys(rr).filter(function(k){ return rr[k] > 0; }).length : 0;
    var tuParte = parteTu
      ? '<div class="tuparte"><b>'+esc(money(enPesos * parteTu))+'</b><small>'
        + (pTu === miPersona() ? 'tu parte' : 'parte de ' + esc(nombrePersona(pTu)))
        + (esQuincena(f) ? ' de cada una' : '') + ', de ' + esc(money(enPesos)) + ' · '
        + (nRep === 2 && Math.abs(parteTu - 0.5) < 0.001 ? 'mitad y mitad' : esc(pctTxt(parteTu)))
        + '</small></div>'
      : '';
    var cambios = f.precios.length > 1
      ? f.precios.slice().reverse().map(function(x){
          return '<div class="row"><span class="t"><b>'+esc(usdF ? usd(x.monto) : money(x.monto))+'</b>'
            + '<small>desde '+esc(ymLabel(x.desde))
            + (usdF && x.cot ? ' · el dólar estaba '+esc(money(x.cot)) : '')+'</small></span></div>';
        }).join('')
      : '';
    return '<div class="card" style="margin-bottom:12px">'
      + '<div class="card-head"><div><h2>'+esc(f.nombre)+'</h2>' + tuParte
      + '<p class="sub">'+(parteTu ? '' : esc(usdF ? usd(propio) : money(propio))+(esQuincena(f) ? ' cada una' : '')+' · ')+esc(diaFijoTexto(f))+' · '
      + esc(f.cat||'Otros')+(f.medio?' · '+esc(f.medio):'')+esc(parteTu ? ' · paga ' + nombrePersona(quienDe(f)) : quienTxt(f))
      + (usdF && !parteTu ? ' · son '+esc(money(enPesos)) : '')
      + esc(parteTu ? medFalta(f, mes) : medTxt(f, mes, montoFijoPesos(f, mes)))
      + (f.hasta ? ' · <span class="warn">dado de baja en '+esc(ymLabel(f.hasta))+'</span>'
                 : (mes < f.desde ? ' · arranca en '+esc(ymLabel(f.desde)) : ''))
      + '</p></div>'
      + '<div class="rowflex" style="gap:8px;flex-wrap:nowrap">'
      +   '<button class="iconbtn" type="button" data-fedit="'+esc(f.id)+'" aria-label="Editar '+esc(f.nombre)+'" title="Editar">'+LAPIZ_SVG+'</button>'
      +   delBtn('fijo', f.id)+'</div></div>'
      + '<div class="previo"><span class="k">'+(esIng ? 'Cambiar el monto' : 'Cambiar el precio')
      +   '<small>Rige desde '+esc(ymLabel(mes))+'; los meses anteriores quedan como están'
      +   (usdF ? ', con el dólar de hoy' : '')+'.</small></span>'
      +   '<span class="pctin plata"><i>'+(usdF?'U$S':'$')+'</i><input class="money-in" type="text" inputmode="decimal" data-fprecio="'+esc(f.id)+'"'
      +   ' value="'+esc(enCampo(propio))+'" autocomplete="off" aria-label="Importe de '+esc(f.nombre)+'"></span></div>'
      + '<div class="rowflex" style="margin-top:12px">'
      +   '<button type="button" class="swi rsw" role="switch" data-fman="'+esc(f.id)+'" aria-checked="'+(f.man ? 'true' : 'false')+'" style="margin:0 8px 0 0"><span class="swi-t"></span><span>'+(esIng ? 'Lo tacho yo cuando lo cobre' : 'Lo tacho yo cuando lo pague')+'</span></button>'
      +   ((hayGrupo() && !esIng)
            ? '<button type="button" class="swi rsw" role="switch" data-fmed="'+esc(f.id)+'" aria-checked="'+(esMedias(f) ? 'true' : 'false')+'" style="margin:0 8px 0 0"><span class="swi-t"></span><span>A medias con el grupo</span></button>'
            : '')
      +   (f.hasta
            ? '<button class="btn ghost sm" type="button" data-freanudar="'+esc(f.id)+'">Reanudar</button>'
            : '<button class="btn ghost sm" type="button" data-fbaja="'+esc(f.id)+'">Dar de baja</button>')
      + '</div>'
      + (cambios ? '<div class="hr"></div><p class="lab" style="margin-bottom:8px">Historial</p><div class="rows">'+cambios+'</div>' : '')
      + '</div>';
  }).join('');
}
/* Un pase entre medios: gris, sin signo, porque la plata no entró ni salió. */
function rowPase(p, withDel, conColor){
  return '<div class="row'+(withDel?' editable':'')+'"'+(withDel?' data-pase="'+esc(p.id)+'" title="Tocá para corregirlo"':'')+'>'
    + marcaFila('pase', '', conColor)
    + '<span class="t"><b>'+icoQ(p)+esc(p.nota || 'Pase entre medios')+'</b>'
    + '<small>'+esc(fechaLabel(p.fecha))+' · '+esc(p.de)+' → '+esc(p.a)+esc(quienTxt(p))+'</small></span>'
    + (withDel
        ? '<span class="acts"><span class="amt neu">'+esc(money(p.monto))+'</span>'+delBtn('pase', p.id)+'</span>'
        : '<span class="amt neu">'+esc(money(p.monto))+'</span>')
    + '</div>';
}
function montoTxt(t){ return esUSD(t) ? usd(Number(t.monto)||0) : money(Number(t.monto)||0); }
/* La fila de una cuota del mes. Lleva la fecha real de débito y, si todavía no
   llegó, se muestra apagada: está anunciada, no pagada. */
function rowCuota(c, conColor){
  var pend = !!c.pend;
  return '<div class="row'+(pend?' pend':'')+'">'
    + marcaFila('cuota', conColor ? (c.plan.cat||'Otros') : '', conColor)
    + '<span class="t"><b>'+icoQ(c.plan, ymOf(c.fecha))+esc(c.plan.desc)+'</b><small>'+esc(fechaLabel(c.fecha))
    + ' · Cuota '+(c.i+1)+' de '+c.plan.n+(c.plan.medio?' · '+esc(c.plan.medio):'')+esc(quienTxt(c.plan))
    + esc(medTxt(c.plan, ymOf(c.fecha), cuotaMonto(c.plan)))
    + (pend ? ' · todavía no se debitó' : '')+'</small></span>'
    + '<span class="amt '+(pend?'neu':'out')+'">− '+esc(money(c.monto))+'</span></div>';
}
function rowFijo(f, monto, fecha, propio, pend, conColor, oc){
  var esIng = (f.tipo === 'ingreso'), usdF = esUSD(f), h = horaFijo(f);
  return '<div class="row'+(pend?' pend':'')+'">'
    + marcaFila(esIng?'in':'fijo', (conColor && !esIng) ? (f.cat||'Otros') : '', conColor)
    + '<span class="t"><b>'+icoQ(f, ymOf(fecha))+esc(f.nombre)+'</b><small>'+esc(fechaLabel(fecha))+((h && !(oc && oc.aMano)) ? ' · '+esc(h) : '')
    + ((oc && oc.q) ? ' · '+esc(quincenaTexto(oc)) : '')+' · '+esc(f.cat||'Otros')
    + (f.medio?' · '+esc(f.medio):'')+' · fijo'+esc(quienTxt(f))+esc(medTxt(f, ymOf(fecha), montoFijoPesos(f, ymOf(fecha))))
    + ((oc && oc.vence && esSueldoAdelantado(f)) ? ' · cuenta para '+esc(ymLabel(ymAdd(ymOf(oc.vence), 1), true)) : '')
    + (usdF ? ' · '+esc(usd(propio||0))+' a '+esc(money(monto/Math.max(1,(propio||1)))) : '')
    + (pend ? ' · ' + (esIng ? 'todavía no lo cobraste' : 'todavía no lo pagaste') : '')
    + ((oc ? oc.aMano : adelantoDe(f, ymOf(fecha)) === fecha) ? ' · ' + (esIng ? 'cobrado' : 'pagado') + ' antes de su día' : '')
    + '</small></span>'
    + '<span class="amt '+(pend ? 'neu' : (esIng?'in':'out'))+'">'+(esIng?'+':'−')+' '+esc(money(monto))+'</span></div>';
}
/* Cómo se escribe un aporte: en la moneda en que se cargó, y si es otra que la
   de la meta, con la conversión al lado. */
function textoAporte(m, a){
  var mon = monAporte(m, a), abs = Math.abs(Number(a.monto)||0);
  return (mon === 'USD') ? usd(abs) : money(abs);
}
function conversionAporte(m, a){
  var mon = monAporte(m, a), meta = (m.moneda || 'ARS');
  if(mon === meta) return '';
  var v = Math.abs(aporteEnMeta(m, a));
  if(!(v > 0)) return ' · falta la cotización para pasarlo a ' + (meta === 'USD' ? 'dólares' : 'pesos');
  // dólares guardados: valen lo de hoy. Pesos que compraron dólares: cantidad fija.
  return (meta === 'USD')
    ? (' · fueron ' + usd(v) + (Number(a.cot) > 0 ? ' al dólar de ese día' : ''))
    : (' · hoy son ' + money(v));
}
function rowAporte(a, m, conColor){
  var v = Number(a.monto)||0, saca = v < 0;
  return '<div class="row">'
    + marcaFila(saca?'saca':'meta', '', conColor)
    + '<span class="t"><b>'+icoQ(a)+esc(m.nombre)+'</b>'
    + '<small>'+esc(fechaLabel(a.fecha))+' · '+(saca ? 'Saqué de los ahorros' : 'Ahorro')
    + esc(conversionAporte(m, a))+esc(quienTxt(a))+'</small></span>'
    + '<span class="amt neu">'+(saca?'− ':'')+esc(textoAporte(m, a))+'</span>'
    + '</div>';
}
function delBtn(kind,id,extra){
  if(confirmId === kind+':'+id+(extra||'')) return '<button class="confirm" data-del="'+kind+'" data-id="'+esc(id)+'" data-x="'+esc(extra||'')+'" type="button">Borrar</button>';
  return '<button class="iconbtn" data-del="'+kind+'" data-id="'+esc(id)+'" data-x="'+esc(extra||'')+'" type="button" aria-label="Borrar">'
    + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg></button>';
}
