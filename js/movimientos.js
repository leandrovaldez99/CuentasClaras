/* Cuentas Claras · js/movimientos.js
   La pantalla Movimientos y sus filtros (tipo, categoría y medio de pago).

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

/* ---- movimientos ----
   Arriba, Todo / Gastos / Ingresos y, al lado, un filtro por categoría. El
   filtro sólo ofrece las categorías que tienen algo en el mes (con cuántos
   hay), y con "Todo" las separa en gastos e ingresos: "Otros" puede estar en
   las dos listas. Con una categoría elegida, el subtítulo dice cuánto suma. */
function catDeItem(x){
  if(x.tx) return (x.tx.tipo === 'ingreso' ? 'ingreso' : 'gasto') + '|' + (x.tx.cat || 'Otros');
  if(x.cuota) return 'gasto|' + (x.cuota.plan.cat || 'Otros');
  if(x.fijo) return ((x.fijo.fijo.tipo === 'ingreso') ? 'ingreso' : 'gasto') + '|' + (x.fijo.fijo.cat || 'Otros');
  if(x.itr !== undefined) return 'ingreso|' + (S.catIng.indexOf('Intereses') > -1 ? 'Intereses' : 'Otros');
  return '';
}
function montoDeItem(x){
  if(x.tx) return montoPesos(x.tx);
  if(x.cuota) return x.cuota.pend ? 0 : x.cuota.monto;
  if(x.fijo) return x.fijo.pend ? 0 : x.fijo.monto;
  if(x.itr !== undefined) return x.itr;
  return 0;
}
/* ---- v289: filtro por medio de pago ----
   Para revisar una cuenta contra el banco: sus movimientos del mes, cuánto entró,
   cuánto salió y el saldo que da la app. Un pase cuenta en los dos medios. */
function itemEnMedio(x, m){
  if(x.pase) return x.pase.de === m || x.pase.a === m;
  if(x.tx) return (x.tx.medio || '') === m;
  if(x.cuota) return (x.cuota.plan.medio || '') === m;
  if(x.fijo) return (x.fijo.fijo.medio || '') === m;
  if(x.itr !== undefined) return (x.cuenta || (cuentasQueRinden()[0] || {}).medio || '') === m;
  return false;
}
function pintarMedFiltro(items){
  var sel = $('#medFiltro'); if(!sel) return;
  var cuenta = {}, orden = medios().slice();
  items.forEach(function(x){
    var ms = x.pase ? [x.pase.de, x.pase.a]
           : [x.tx ? x.tx.medio : x.cuota ? x.cuota.plan.medio : x.fijo ? x.fijo.fijo.medio
              : x.itr !== undefined ? (x.cuenta || (cuentasQueRinden()[0] || {}).medio) : ''];
    ms.forEach(function(m){ if(!m) return; cuenta[m] = (cuenta[m] || 0) + 1; if(orden.indexOf(m) < 0) orden.push(m); });
  });
  if(medFiltro && cuenta[medFiltro] === undefined) cuenta[medFiltro] = 0;
  var html = '<option value=""' + (medFiltro ? '' : ' selected') + '>Todos los medios</option>'
    + orden.filter(function(m){ return cuenta[m] !== undefined; }).map(function(m){
        return '<option value="' + esc(m) + '"' + (m === medFiltro ? ' selected' : '') + '>' + esc(m) + (cuenta[m] ? ' (' + cuenta[m] + ')' : '') + '</option>';
      }).join('');
  sel.innerHTML = html;
  sel.value = medFiltro;
  sel.classList.toggle('on', !!medFiltro);
  sel.hidden = sel.options.length < 3 && !medFiltro;    // con un solo medio no hay nada que filtrar
}
function pintarMedRes(items){
  var box = $('#medRes'); if(!box) return;
  if(!medFiltro){ box.hidden = true; box.innerHTML = ''; return; }
  var m = medFiltro, entro = 0, salio = 0;
  items.forEach(function(x){
    if(x.pase){ if(x.pase.de === m) salio += x.pase.monto; if(x.pase.a === m) entro += x.pase.monto; return; }
    var v = montoDeItem(x);
    if(x.itr !== undefined || (x.tx && x.tx.tipo === 'ingreso') || (x.fijo && x.fijo.fijo.tipo === 'ingreso')) entro += v; else salio += v;
  });
  var fila = null; saldosPorMedio(mes).forEach(function(f){ if(f.medio === m) fila = f; });
  var saldo = fila ? fila.saldo : 0, ahora = ymNow();
  var labSaldo = mes === ahora ? 'Saldo hoy' : mes < ahora ? 'Saldo al cierre' : 'Saldo previsto';
  var n = items.length, nm = MESES[parseInt(mes.slice(5, 7), 10) - 1];
  box.hidden = false;
  box.innerHTML = '<div><small>Entró</small><b class="in">' + esc(money(entro)) + '</b></div>'
    + '<div><small>Salió</small><b class="out">' + esc(money(salio)) + '</b></div>'
    + '<div><small>' + labSaldo + '</small><b>' + esc((saldo < 0 ? '− ' : '') + money(Math.abs(saldo))) + '</b></div>'
    + '<p>' + esc(m) + ' en ' + esc(nm) + ': ' + n + (n === 1 ? ' movimiento' : ' movimientos')
    + (catFiltro ? ' de ' + esc(catFiltro.split('|').slice(1).join('|')) : '')
    + '. El saldo es todo lo acumulado con este medio; comparalo con el de tu banco o billetera.</p>';
}
function pintarCatFiltro(items){
  var sel = $('#catFiltro'); if(!sel) return;
  var cuenta = {};
  items.forEach(function(x){ var k = catDeItem(x); if(k) cuenta[k] = (cuenta[k] || 0) + 1; });
  if(catFiltro && !cuenta[catFiltro]) cuenta[catFiltro] = 0;     // la elegida queda aunque no tenga nada
  function opciones(tipo){
    var lista = (tipo === 'ingreso' ? S.catIng : S.catGasto).slice();
    Object.keys(cuenta).forEach(function(k){ var p = k.split('|'); if(p[0] === tipo && lista.indexOf(p[1]) < 0) lista.push(p[1]); });
    return lista.filter(function(c){ return cuenta[tipo + '|' + c] !== undefined; }).map(function(c){
      var k = tipo + '|' + c, n = cuenta[k];
      return '<option value="' + esc(k) + '"' + (k === catFiltro ? ' selected' : '') + '>' + esc(c) + (n ? ' (' + n + ')' : '') + '</option>';
    }).join('');
  }
  var html = '<option value=""' + (catFiltro ? '' : ' selected') + '>Todas las categorías</option>';
  if(filtroMov === 'todo'){
    var g = opciones('gasto'), i = opciones('ingreso');
    if(g) html += '<optgroup label="Gastos">' + g + '</optgroup>';
    if(i) html += '<optgroup label="Ingresos">' + i + '</optgroup>';
  } else html += opciones(filtroMov);
  sel.innerHTML = html;
  sel.value = catFiltro;
  sel.classList.toggle('on', !!catFiltro);
  sel.hidden = sel.options.length < 2;
}
function renderMov(){
  arrOlvidar();
  renderPend();
  var r = resumen(mes);
  // una categoría de gastos no tiene sentido mirando sólo ingresos (y al revés)
  if(catFiltro && filtroMov !== 'todo' && catFiltro.split('|')[0] !== filtroMov) catFiltro = '';

  var items = [], idxM = indiceTx();
  txDe(mes).forEach(function(t){
    if(filtroMov !== 'todo' && t.tipo !== filtroMov) return;
    items.push({ f:t.fecha, r:recencia(t, idxM[t.id]), tx:t });
  });
  /* Las cuotas y los fijos que todavía no llegaron NO van en esta lista: con
     varios por venir tapaban lo que ya hiciste. Aparecen solos el día que se
     cobran; mientras tanto se ven en Gastos fijos (y las cuotas en Cuotas). */
  var nPend = 0, nCuoV = 0, nFijV = 0;
  // cada cuota cae el día en que vence el resumen de su tarjeta
  if(filtroMov !== 'ingreso') cuotasDe(mes).forEach(function(c){
    if(c.pend){ nPend++; return; }
    items.push({ f:c.fecha, r:-1, cuota:c }); nCuoV++;
  });
  if(filtroMov !== 'ingreso') fijosGasto(mes).forEach(function(x){
    if(x.pend){ nPend++; return; }
    items.push({ f:x.fecha, r:-1, fijo:x }); nFijV++;
  });
  if(filtroMov !== 'gasto') fijosIngreso(mes).forEach(function(x){
    if(x.pend){ nPend++; return; }
    items.push({ f:x.fecha, r:-1, fijo:x }); nFijV++;
  });
  // un renglón por cada día que rindió
  // los pases entre medios, sólo en "Todo": no son ni gastos ni ingresos
  var nPases = 0;
  if(filtroMov === 'todo') (S.pases||[]).forEach(function(p, i){
    if(ymOf(p.fecha) !== mes || !esDeVista(p)) return;
    items.push({ f:p.fecha, r:recencia(p, i), pase:p }); nPases++;
  });
  if(filtroMov !== 'gasto') interesesDias(mes).forEach(function(d){
    items.push({ f:d.fecha, r:-3, itr:d.monto, cuenta:d.cuenta });
  });
  pintarCatFiltro(items);
  pintarMedFiltro(items);
  var nomCat = catFiltro ? catFiltro.split('|').slice(1).join('|') : '';
  if(medFiltro) items = items.filter(function(x){ return itemEnMedio(x, medFiltro); });
  if(catFiltro){
    items = items.filter(function(x){ return catDeItem(x) === catFiltro; });
  } else if(filtroMov === 'todo' && !medFiltro){
    // el saldo del mes pasado, o el ofrecimiento de pasarlo
    if(r.arr) items.push({ f: mes+'-01', r:-2, arr:r.arr });
    else if(!verDe() && !llevaArrastre(mes) && hayQueArrastrar(mes)) items.push({ f: mes+'-01', r:-2, oferta:true });
  }
  items.sort(masNuevoPrimero);

  if(catFiltro){
    var tot = items.reduce(function(a, x){ return a + montoDeItem(x); }, 0);
    var esIng = catFiltro.split('|')[0] === 'ingreso';
    $('#movSub').textContent = nomCat + ' en ' + ymLabel(mes) + ': ' + money(tot)
      + (esIng ? ' que entraron' : ' gastados') + (medFiltro ? ' con ' + medFiltro : '') + ' · ' + items.length + (items.length === 1 ? ' movimiento' : ' movimientos');
  } else if(medFiltro){
    $('#movSub').textContent = items.length + (items.length === 1 ? ' movimiento' : ' movimientos') + ' con ' + medFiltro + ' en ' + ymLabel(mes);
  } else {
    $('#movSub').textContent = ymLabel(mes)+' · '+r.nTx+(r.nTx===1?' movimiento':' movimientos')
      + (nCuoV? ' + '+nCuoV+(nCuoV===1?' cuota':' cuotas') : '')
      + (nFijV? ' + '+nFijV+(nFijV===1?' fijo':' fijos') : '')
      + (nPases ? ' · ' + nPases + (nPases === 1 ? ' pase entre medios' : ' pases entre medios') : '')
      + (nPend ? ' · ' + nPend + ' por venir, en Gastos fijos' : '');
  }

  $('#movList').innerHTML = items.length
    ? items.map(function(x){
        if(x.tx) return rowTx(x.tx, true);
        if(x.pase) return rowPase(x.pase, true);
        if(x.arr !== undefined) return rowArrastre(mes, x.arr, S.arrastreModo === 'preguntar');
        if(x.itr !== undefined) return rowInteres(x.f, x.itr, x.cuenta);
        if(x.fijo) return rowFijo(x.fijo.fijo, x.fijo.monto, x.fijo.fecha, x.fijo.propio, x.fijo.pend, false, x.fijo);
        if(x.oferta) return rowOferta(mes);
        return rowCuota(x.cuota);
      }).join('')
    : emptyBox(catFiltro ? 'No hay nada de ' + nomCat + (medFiltro ? ' con ' + medFiltro : '') + ' en ' + ymLabel(mes)
             : medFiltro ? 'No hay movimientos con ' + medFiltro + ' en ' + ymLabel(mes) : 'No hay movimientos en '+ymLabel(mes));
  pintarMedRes(items);
}
