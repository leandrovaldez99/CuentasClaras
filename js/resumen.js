/* Cuentas Claras · js/resumen.js
   La pantalla Resumen, las filas de cada tipo de movimiento y los pagos del mes.

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

/* ---- resumen ---- */
function renderResumen(){
  arrOlvidar();
  var r = resumen(mes), prev = resumen(ymAdd(mes,-1));
  /* Ingresos: si hubo algo en dólares, el tile los muestra aparte y el interruptor
     decide si se suman convertidos o quedan a un costado. Cada movimiento se pasa
     a pesos con SU cotización, no con la de hoy. */
  var enPesosUsd = 0;
  txDe(mes).forEach(function(x){ if(x.tipo==='ingreso' && esUSD(x)) enPesosUsd += montoPesos(x); });
  fijosIngresoVal(mes).forEach(function(x){ if(esUSD(x.fijo)) enPesosUsd += x.monto; });
  var soloPesos = r.ing - enPesosUsd;
  var hayUsd = r.ingUsd > 0;
  var sw = $('#swPesos'), tu = $('#tIngUsd');
  if(sw) sw.hidden = !hayUsd;
  if(sw) sw.setAttribute('aria-checked', verEnPesos ? 'true' : 'false');
  if(tu) tu.hidden = !(hayUsd && !verEnPesos);

  var soloEnUsd = hayUsd && !verEnPesos && Math.round(soloPesos + r.int) === 0;
  var nums = $('#tIngNums');
  if(nums) nums.classList.toggle('dual', hayUsd && !verEnPesos && !soloEnUsd);

  if(soloEnUsd){
    // el mes fue todo en dólares: mostrar "$ 0" arriba sería esconder el dato
    $('#tIng').textContent = usd(r.ingUsd);
    if(tu) tu.hidden = true;
    $('#tIngM').textContent = 'Todo en dólares · son ' + money(enPesosUsd)
      + (r.int ? ' · más ' + money(r.int) + ' de intereses' : '');
  } else if(hayUsd && !verEnPesos){
    $('#tIng').textContent = money(soloPesos + r.int);
    if(tu) tu.textContent = usd(r.ingUsd);
    $('#tIngM').textContent = 'En pesos y en dólares, por separado'
      + (r.int ? ' · incluye ' + money(r.int) + ' de intereses' : '');
  } else {
    $('#tIng').textContent = money(r.ing + r.int);
    $('#tIngM').textContent = hayUsd
      ? (usd(r.ingUsd) + ' pasados a ' + money(enPesosUsd) + ', al dólar de cada movimiento')
      : (r.int ? ('Incluye ' + money(r.int) + ' de intereses')
               : (r.nTx ? deltaTxt(r.ing, prev.ing) : 'Sin movimientos todavía'));
  }
  /* Lo que todavía no llegó se avisa acá y no en el número: el tile dice lo que
     ya tenés, y abajo cuánto falta este mes. Cuando el subtítulo era la
     comparación con el mes pasado, la nota la reemplaza: decir "−100% vs. ago"
     es ruido si lo único que pasa es que el sueldo todavía no entró. */
  function notaPend(id, nota){
    var el = $(id); if(!el) return;
    var t0 = el.textContent;
    el.textContent = (/% vs\.|Sin dato del mes anterior|Sin movimientos todavía|^—$/.test(t0))
      ? (nota.charAt(0).toUpperCase() + nota.slice(1))
      : (t0 + ' · ' + nota);
  }
  if(r.pendIng > 0) notaPend('#tIngM', 'faltan cobrar ' + money(r.pendIng) + ' este mes');
  $('#tGas').textContent = money(r.gas);
  $('#tGasM').textContent = (r.cuotas>0 || r.fijos>0)
    ? ([r.cuotas>0 ? money(r.cuotas)+' en cuotas' : '', r.fijos>0 ? money(r.fijos)+' fijos' : ''].filter(Boolean).join(' · '))
    : deltaTxt(r.gas, prev.gas);
  if(r.pendGas > 0) notaPend('#tGasM', 'faltan pagar ' + money(r.pendGas) + ' este mes');
  $('#tAho').textContent = money(r.aho);
  $('#tAhoM').textContent = r.aho > 0 ? 'Aportado a tus metas'
    : (r.aho < 0 ? 'Sacaste plata de tus ahorros' : 'Todavía no apartaste nada');
  $('#tBal').textContent = money(r.bal);
  var balUsd = (hayUsd && !verEnPesos)
    ? ('Cuenta los ' + usd(r.ingUsd) + ' pasados a ' + money(enPesosUsd)) : '';
  $('#tBal').style.color = r.bal < 0 ? 'var(--out)' : (r.bal>0 ? 'var(--in)' : 'var(--ink)');
  $('#tBalM').textContent = balUsd
    ? balUsd
    : (r.arr
        ? ((r.arr < 0 ? 'Arrastra ' : 'Incluye ') + money(Math.abs(r.arr)) + ' de ' + ymLabel(ymAdd(mes,-1), true))
        : (r.bal < 0 ? 'Estás gastando de más' : 'Te queda libre'));
  pintarAvisoArr();

  // gastos por categoría
  var cats = gastosPorCat(mes), el = $('#chCat');
  if(!cats.length){ el.innerHTML = emptyBox('Sin gastos cargados en '+ymLabel(mes)); }
  else{
    var max = cats[0].monto, tot = cats.reduce(function(a,b){return a+b.monto;},0);
    el.innerHTML = cats.slice(0,8).map(function(c){
      var p = tot? Math.round(c.monto/tot*100):0;
      return '<div class="hbar" data-tip="'+esc(c.cat)+' · '+esc(money(c.monto))+' · '+p+'% de tus gastos">'
        + '<span class="hbar-lab">'+esc(c.cat)+'</span>'
        + '<span class="hbar-track"><span class="hbar-fill" style="width:'+Math.max(2,(c.monto/max*100)).toFixed(1)+'%"></span></span>'
        + '<span class="hbar-val">'+esc(money(c.monto))+'</span></div>';
    }).join('');
  }

  // gastos por medio de pago
  var meds = gastosPorMedio(mes), elm = $('#chMedio');
  if(elm){
    if(!meds.length){ elm.innerHTML = emptyBox('Sin gastos cargados en '+ymLabel(mes)); }
    else{
      var maxm = meds[0].monto, totm = meds.reduce(function(a,b){return a+b.monto;},0);
      elm.innerHTML = meds.slice(0,8).map(function(c){
        var pm = totm ? Math.round(c.monto/totm*100) : 0;
        return '<div class="hbar" data-tip="'+esc(c.medio)+' · '+esc(money(c.monto))+' · '+pm+'% de tus gastos">'
          + '<span class="hbar-lab">'+esc(c.medio)+'</span>'
          + '<span class="hbar-track"><span class="hbar-fill" style="width:'+Math.max(2,(c.monto/maxm*100)).toFixed(1)+'%"></span></span>'
          + '<span class="hbar-val">'+esc(money(c.monto))+'</span></div>';
      }).join('');
    }
    var subm = $('#chMedioSub');
    if(subm){
      subm.textContent = meds.length > 1
        ? ('Gastos del mes por medio de pago · ' + meds.length + ' en uso')
        : 'Gastos del mes por medio de pago';
    }
  }

  // evolución (6 o 12 meses)
  var serie = [];
  for(var i=rangoMeses-1;i>=0;i--){ var ym = ymAdd(mes,-i); var rr = resumen(ym); serie.push({ym:ym, ing:rr.ing, gas:rr.gas}); }
  $('#chMesTit').textContent = rangoMeses===12 ? 'Últimos 12 meses' : 'Últimos 6 meses';
  $$('#segRango button').forEach(function(b){ b.setAttribute('aria-pressed', b.getAttribute('data-v')===String(rangoMeses) ? 'true':'false'); });
  var contCh = $('#chMes');
  contCh.innerHTML = barrasMeses(serie, false, contCh.clientWidth);

  // cuotas del mes
  var cm = cuotasDe(mes), cmPend = sumaPend(cm);
  $('#cuotasSub').textContent = cm.length
    ? (cm.length+(cm.length===1?' cuota':' cuotas')+' por '+money(cm.reduce(function(a,b){return a+b.monto;},0))
       + (cmPend > 0 ? ' · ' + money(cmPend) + ' sin debitar todavía' : ''))
    : 'Nada en cuotas este mes';
  $('#cuotasMes').innerHTML = cm.length
    ? cm.slice().sort(function(a,b){ return a.fecha < b.fecha ? -1 : 1; }).map(rowCuota).join('')
    : emptyBox('Ninguna cuota vence este mes');

  // últimos movimientos (incluye los aportes a metas de ahorro)
  var idxU = indiceTx();
  var ult = conPeso(S.tx).map(function(t){ return { f:t.fecha, r:recencia(t, idxU[t.id]), tx:t }; });
  S.metas.forEach(function(m){
    (m.aportes||[]).forEach(function(a){ if(!a.previo && esDeVista(a)) ult.push({ f:a.fecha, r:recencia(a, 0), ap:a, meta:m }); });
  });
  // el saldo que viene del mes pasado entra al principio de su mes
  // los fijos que todavía no llegaron no entran: aparecen el día que se cobran
  fijosDe(mes).forEach(function(x){ if(!x.pend) ult.push({ f:x.fecha, r:-1, fijo:x }); });
  if(r.arr) ult.push({ f: mes+'-01', r:-2, arr:r.arr, ym:mes });
  (S.pases||[]).forEach(function(p, i){ if(esDeVista(p)) ult.push({ f:p.fecha, r:recencia(p, i), pase:p }); });
  if(r.int){
    var dias = interesesDias(mes);
    ult.push({ f: dias.length ? dias[dias.length-1].fecha : mes+'-01', r:-1, itr:r.int, ym:mes });
  }
  ult.sort(masNuevoPrimero);
  ult = ult.slice(0,6);
  var filaPend = rowPendResumen();
  $('#ultMov').innerHTML = (ult.length || filaPend)
    ? filaPend + ult.map(function(x){
        if(x.tx) return rowTx(x.tx,false);
        if(x.pase) return rowPase(x.pase, false);
        if(x.arr !== undefined) return rowArrastre(x.ym, x.arr, false);
        if(x.itr !== undefined) return rowInteresMes(x.ym, x.itr);
        if(x.fijo) return rowFijo(x.fijo.fijo, x.fijo.monto, x.fijo.fecha, x.fijo.propio, x.fijo.pend, false, x.fijo);
        return rowAporte(x.ap, x.meta);
      }).join('')
    : emptyBox('Cargá tu primer movimiento');

  // presupuestos
  var bi = baseInfo(mes);
  var asignado = totalAsignado();
  $('#presuSub').innerHTML = bi.v > 0
    ? 'Base ' + esc(money(bi.v)) + ' <span style="opacity:.75">(' + esc(bi.de) + ')</span>'
      + (asignado > 0 ? ' · repartiste <span'+(asignado>100.05?' class="warn"':'')+'>'+fmtPct(asignado)+'</span>' : '')
    : 'Cómo venís contra tus topes del mes';
  $('#presuMini').innerHTML = budList(mes, 0);

  var gg = gastosPorGrupo(mes);
  var sin = S.grupos.filter(function(g){ return !tieneTope(g.id, mes) && (gg.por[g.id]||0) > 0; });
  var totalSin = sin.reduce(function(a,g){ return a + gg.por[g.id]; }, 0);
  $('#presuSinTope').textContent = (sin.length && gruposConTope(mes).length)
    ? 'Además gastaste ' + money(totalSin) + ' en grupos sin tope: ' + sin.map(function(g){ return nombreGrupo(g.id); }).join(', ') + '.'
    : '';

  renderCalendario();
  pintarDia();
}
function deltaTxt(now, before){
  if(!before) return before===0 && now===0 ? '—' : 'Sin dato del mes anterior';
  var d = (now-before)/before*100;
  var s = (d>=0?'+':'−')+Math.abs(Math.round(d))+'% vs. '+ymLabel(ymAdd(mes,-1),true);
  return s;
}

/* El SVG se dibuja con el ancho REAL del contenedor, no con uno fijo de 640 que
   después el navegador achica. Si lo achicás, la letra se achica con él: en un
   celular el texto terminaba renderizado a 4 px. Con el viewBox del tamaño real,
   1 unidad = 1 píxel y la letra mide lo que dice que mide. */
function barrasMeses(serie, grande, ancho){
  var mini = serie.length > 8;
  var W = Math.max(260, Math.round(Number(ancho) || 640));
  var H = grande ? 330 : (mini ? 226 : 210);
  var padL = grande ? 62 : 46, padR = 8, padT = grande ? 22 : 12;
  var max = 0; serie.forEach(function(s){ max = Math.max(max, s.ing, s.gas); });
  if(max <= 0) return emptyBox('Todavía no hay datos para comparar meses');
  var step = Math.pow(10, Math.floor(Math.log(max)/Math.LN10));
  var top = Math.ceil(max/step)*step; if(top<=0) top = max;

  var iw = W-padL-padR;
  var gw = iw/serie.length;
  // ¿entra "sep 26" abajo de cada barra? En mono, cada letra mide ~0,6 de la
  // altura. Si no entra, el mes va solo y el año pasa a un segundo renglón.
  var fs = grande ? 12.5 : 11;
  var dosLineas = mini || (gw < 6*0.6*fs + 6);
  // si ni el mes de tres letras entra, se rotula uno de cada dos (o de cada
  // tres), contando desde el último, que es el que siempre interesa
  var salto = Math.max(1, Math.ceil((3*0.6*fs + 5) / gw));
  var padB = dosLineas ? Math.round(fs*3.1) : Math.round(fs*1.9);
  var ih = H-padT-padB;
  var bw = Math.max(5, Math.min(grande ? 24 : 22, gw*(grande?0.38:0.32)));
  var y = function(v){ return padT + ih - (v/top)*ih; };
  var out = '<svg class="chart'+(grande?' grande':'')+'" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Ingresos y gastos de los últimos '+serie.length+' meses">';
  (grande ? [0,0.25,0.5,0.75,1] : [0,0.5,1]).forEach(function(f){
    var vy = padT + ih - f*ih;
    out += '<line class="'+(f===0?'zl':'gl')+'" x1="'+padL+'" y1="'+vy+'" x2="'+(W-padR)+'" y2="'+vy+'"/>';
    out += '<text x="'+(padL-7)+'" y="'+(vy+3.5)+'" text-anchor="end">'+esc(moneyShort(top*f).replace('$ ',''))+'</text>';
  });
  serie.forEach(function(s,i){
    var cx = padL + gw*i + gw/2;
    var x1 = cx - bw - 1, x2 = cx + 1;
    var hi = Math.max(0, padT+ih - y(s.ing)), hg = Math.max(0, padT+ih - y(s.gas));
    if(s.ing>0) out += '<rect x="'+x1.toFixed(1)+'" y="'+y(s.ing).toFixed(1)+'" width="'+bw+'" height="'+hi.toFixed(1)+'" rx="3" fill="var(--in)" data-tip="'+esc(ymLabel(s.ym))+' · ingresos '+esc(money(s.ing))+'"/>';
    if(s.gas>0) out += '<rect x="'+x2.toFixed(1)+'" y="'+y(s.gas).toFixed(1)+'" width="'+bw+'" height="'+hg.toFixed(1)+'" rx="3" fill="var(--out)" data-tip="'+esc(ymLabel(s.ym))+' · gastos '+esc(money(s.gas))+'"/>';
    var yMes = dosLineas ? (H - padB + fs*1.6) : (H - padB + fs*1.5);
    var rotula = ((serie.length-1-i) % salto) === 0;
    if(rotula){
      out += '<text x="'+cx.toFixed(1)+'" y="'+yMes.toFixed(1)+'" text-anchor="middle"'+(s.ym===mes?' fill="var(--ink)" font-weight="500"':'')+'>'+esc(ymLabel(s.ym, dosLineas?'mini':true))+'</text>';
      if(dosLineas && (s.ym.slice(5,7)==='01' || i===0)) out += '<text x="'+cx.toFixed(1)+'" y="'+(yMes+fs*1.25).toFixed(1)+'" text-anchor="middle" opacity=".65">'+esc(s.ym.slice(0,4))+'</text>';
    }
  });
  out += '</svg>';
  return out;
}

function rowTx(t, withDel, conColor){
  var esIng = t.tipo==='ingreso';
  return '<div class="row'+(withDel?' editable':'')+'"'+(withDel?' data-tx="'+esc(t.id)+'" title="Tocá para editarlo"':'')+'>'
    + marcaFila(esIng?'in':'out', (conColor && !esIng) ? (t.cat||'Otros') : '', conColor)
    + '<span class="t"><b>'+icoQ(t, ymOf(t.fecha))+esc(t.nota || t.cat || (esIng?'Ingreso':'Gasto'))+'</b>'
    + '<small>'+esc(fechaLabel(t.fecha))+' · '+esc(t.cat||'Otros')+(t.medio?' · '+esc(t.medio):'')+esc(quienTxt(t))
    + (mesDeTx(t) !== ymOf(t.fecha) ? ' · cuenta para '+esc(ymLabel(mesDeTx(t), true)) : '')
    + (esUSD(t) ? ' · son '+esc(money(montoPesos(t)))+', al dólar de ese día' : '')
    + esc(medTxt(t, ymOf(t.fecha), t._total !== undefined ? montoPesos({ monto:t._total, mon:t.mon, cot:t.cot }) : montoPesos(t)))+'</small>'
    + ((hayGrupo() && t.por && t.por !== quienDe(t) && personaPorId(t.por)) ? '<em class="cargo">De '+esc(nombrePersona(quienDe(t)))+' · lo cargó '+esc(nombrePersona(t.por))+'</em>' : '')
    + '</span>'
    + (withDel
        ? '<span class="acts"><span class="amt '+(esIng?'in':'out')+'">'+(esIng?'+':'−')+' '+esc(montoTxt(t))+'</span>'+delBtn('tx',t.id)+'</span>'
        : '<span class="amt '+(esIng?'in':'out')+'">'+(esIng?'+':'−')+' '+esc(montoTxt(t))+'</span>')
    + '</div>';
}
/* La fila del saldo que viene del mes pasado. No es ingreso ni gasto: se
   muestra en gris, con el signo, para que se entienda que es plata que ya
   tenías y no algo que ganaste o gastaste este mes. */
function rowArrastre(ym, monto, conBoton){
  var prev = ymAdd(ym, -1);
  var signo = monto < 0 ? '− ' : '+ ';
  var txt = signo + money(Math.abs(monto));
  return '<div class="row"><span class="mark carry">'+iconFor('carry')+'</span>'
    + '<span class="t"><b>Viene de '+esc(ymLabel(prev, true))+'</b>'
    + '<small>'+(monto < 0 ? 'Rojo que dejó el mes pasado' : 'Saldo libre del mes pasado')+'</small></span>'
    + (conBoton
        ? '<span class="acts"><span class="amt neu">'+esc(txt)+'</span>'+delBtn('arrastre', ym)+'</span>'
        : '<span class="amt neu">'+esc(txt)+'</span>')
    + '</div>';
}
/* Una fila por día de interés. El nombre de la entidad va abajo para que se
   entienda de dónde sale la tasa. */
function nombreEntidad(c){
  if(!c) return 'tu cuenta';
  if(c.manual) return 'TNA ' + fmtPct(tnaDe(c));
  var ent = null;
  (S.tasas||[]).forEach(function(x){ if(x.api === c.entidad) ent = x; });
  return ent ? ent.n : 'tu cuenta';
}
function rowInteres(f, monto, cuenta, conColor){
  var de = cuenta || nombreEntidad(cuentasQueRinden()[0]);
  return '<div class="row">'
    + marcaFila('tasa', '', conColor)
    + '<span class="t"><b>Intereses</b>'
    + '<small>'+esc(fechaLabel(f))+' · '+esc(de)+'</small></span>'
    + '<span class="amt in">+ '+esc(money(monto))+'</span></div>';
}
/* En el Resumen no tiene sentido llenar "Últimos movimientos" con treinta filas
   de intereses: ahí va una sola con el total del mes. */
function rowInteresMes(ym, monto){
  var porCta = interesesPorCuenta(ym);
  var det = porCta.length > 1
    ? porCta.map(function(x){ return x.cuenta.medio + ' ' + money(x.monto); }).join(' · ')
    : 'Lo que rindió tu plata en el mes';
  return '<div class="row"><span class="mark tasa">'+iconFor('tasa')+'</span>'
    + '<span class="t"><b>Intereses de '+esc(ymLabel(ym, true))+'</b>'
    + '<small>'+esc(det)+'</small></span>'
    + '<span class="amt in">+ '+esc(money(monto))+'</span></div>';
}
/* Cuando el mes NO está arrastrando pero podría, ofrecerlo acá mismo. */
function rowOferta(ym){
  var prev = ymAdd(ym, -1), v = resumen(prev).bal;
  return '<div class="row propuesta"><span class="mark carry">'+iconFor('carry')+'</span>'
    + '<span class="t"><b>'+esc(ymLabel(prev, true))+' cerró con '+esc(money(v))+'</b>'
    + '<small>No lo estás pasando a este mes</small></span>'
    + '<span class="acts"><button class="btn ghost sm" type="button" data-arr="si" data-ym="'+esc(ym)+'">Pasarlo</button></span>'
    + '</div>';
}
/* Las opciones del "dónde está": guardada aparte, o cualquiera de tus cuentas.
   Las que todavía no tienen tasa también aparecen —la plata puede estar ahí
   igual—, avisando que así no rinde. */
function opcionesLugar(sel){
  var html = '<option value=""' + (sel ? '' : ' selected') + '>Aparte · no rinde</option>';
  cuentas().forEach(function(c){
    if(!c.medio) return;
    var t = tnaDe(c);
    html += '<option value="' + esc(c.id) + '"' + (c.id === sel ? ' selected' : '') + '>'
      + esc(c.medio) + (t > 0 ? ' · rinde ' + esc(fmtPct(t)) : ' · sin tasa') + '</option>';
  });
  return html;
}
/* Adentro de cada meta: dónde está lo que ya tenías, y una línea que resume
   dónde está todo y cuánto rindió. Antes era un solo botón "Sí, rinde" para la
   meta entera; ahora cada aporte dice lo suyo y esto es el resumen. */
function filaRinde(m){
  var det = interesMetaDet(m), out = '';
  var dol = usdDeMeta(m), pes = arsDeMeta(m);
  if(iniTotalArs(m) > 0){
    var li = lugarInicial(m), tna = li ? tnaDe(cuentaPorId(li)) : 0, ef = efectivoDe(m);
    var otras = li ? otrasCuentasIni(m) : [];
    var resto = li ? restoIni(m) : iniTotalArs(m);
    var abierto = ef > 0 || !!efecAbierto[m.id];
    var varias = cuentas().filter(function(c){ return !!c.medio; }).length > 1;
    var txt;
    if(!hayDondeRendir()) txt = 'Guardados aparte: no rinden.';
    else if(!li) txt = 'No rinden: están guardados aparte.';
    else if(!otras.length && !(ef > 0)){
      txt = 'Rinden en ' + nombreLugar(li) + (tna > 0 ? ' al ' + fmtPct(tna) + ' anual' : ', que todavía no tiene tasa')
        + ' desde el ' + fechaLarga(m.desde) + '.' + (varias ? ' Si una parte está en otra cuenta, tocala también.' : '');
    } else {
      var sinMonto = otras.filter(function(c){ return !(montoEn(m, c) > 0); }).map(nombreLugar);
      if(sinMonto.length) txt = 'Poné cuánto hay en ' + listaY(sinMonto) + '; lo que queda sigue en ' + nombreLugar(li) + '.';
      else {
        var fr = [money(resto) + ' rinden en ' + nombreLugar(li)];
        otras.forEach(function(c){ fr.push(money(montoEn(m, c)) + ' en ' + nombreLugar(c)); });
        if(ef > 0) fr.push(money(ef) + ' están en efectivo');
        txt = listaY(fr) + '. Cada parte rinde a la tasa de su cuenta.';
      }
    }
    var X = X_SVG(), filas = '';
    if(li && otras.length){
      filas += '<div class="refec"><span class="lab">En ' + esc(nombreLugar(li)) + '</span>'
        + '<span class="resto-v">' + esc(money(resto)) + '<small>lo que queda</small></span><span></span></div>';
      otras.forEach(function(c){
        var v = montoEn(m, c), k = esc(m.id) + '|' + esc(c), idc = 'ic-' + esc(m.id) + '-' + esc(c);
        filas += '<div class="refec"><label class="lab" for="' + idc + '">En ' + esc(nombreLugar(c)) + '</label>'
          + '<span class="pctin plata"><i>$</i><input class="money-in" id="' + idc + '" type="text" inputmode="decimal"'
          + ' data-icta="' + k + '" value="' + (v > 0 ? esc(enCampo(v)) : '') + '" placeholder="0" autocomplete="off"></span>'
          + '<button type="button" class="iconbtn" data-ctasacar="' + k + '" aria-label="Sacar ' + esc(nombreLugar(c)) + '" title="Sacar ' + esc(nombreLugar(c)) + '">' + X + '</button></div>';
      });
    }
    out += '<div class="previo donde"><span class="k">Dónde están esos ' + esc(money(iniTotalArs(m)))
      + '<small>' + esc(txt) + '</small></span>'
      + ctlRinde('ini:' + m.id, li, { multi:true, otras:otras })
      + (filas ? '<div class="rotras">' + filas + '</div>' : '')
      + ((li && hayDondeRendir())
          ? (abierto
              ? '<div class="refec"><label class="lab" for="ief-' + esc(m.id) + '">En efectivo, sin rendir</label>'
                + '<span class="pctin plata"><i>$</i><input class="money-in" id="ief-' + esc(m.id) + '" type="text" inputmode="decimal"'
                + ' data-iefec="' + esc(m.id) + '" value="' + (ef > 0 ? esc(enCampo(ef)) : '') + '" placeholder="0" autocomplete="off"></span>'
                + '<button type="button" class="iconbtn" data-efcerrar="' + esc(m.id) + '" aria-label="Sacar la parte en efectivo" title="Sacar la parte en efectivo">' + X + '</button></div>'
              : '<button type="button" class="linkbtn" data-efabrir="' + esc(m.id) + '">+ Parte está en efectivo</button>')
          : '')
      + '</div>';
  }
  if(!(pes > 0.005) && !(dol > 0)) return out;
  var enCta = [], frases = [];
  Object.keys(det.base).forEach(function(k){
    if(!k || !(det.base[k] > 0.005)) return;
    var c = cuentaPorId(k), t = tnaDe(c);
    enCta.push(money(det.base[k]) + ' en ' + (c ? c.medio : 'tu cuenta') + ' (' + (t > 0 ? fmtPct(t) : 'sin tasa') + ')');
  });
  if(enCta.length) frases.push('Tenés ' + listaY(enCta));
  if((det.base[''] || 0) > 0.005) frases.push(money(det.base['']) + ' guardados aparte, sin rendir');
  if(det.total > 0.005) frases.push('ya generaron ' + money(det.total) + ' acá adentro');
  if(dol > 0) frases.push(usd(dol) + ' no rinden: la tasa es en pesos');
  if(pes > 0.005 && !hayDondeRendir()) frases.push('para que rindan, cargá tu cuenta en Ajustes › Cuentas que rinden');
  if(!frases.length) return out;
  var t0 = frases.join(' · ');
  return out + '<p class="note rinde-res">' + esc(t0.charAt(0).toUpperCase() + t0.slice(1)) + '.</p>';
}
/* Cuánto de lo que hay en la meta es plata que ya tenías y sumaste después
   (`previo`), para decirlo al lado del punto de partida. */
function previosTexto(m){
  var ars = 0, us = 0;
  (m.aportes||[]).forEach(function(a){
    if(!a.previo || a.parte) return;
    if(monAporte(m, a) === 'USD') us += Number(a.monto)||0; else ars += Number(a.monto)||0;
  });
  var p = [];
  if(Math.abs(ars) > 0.005) p.push(money(ars));
  if(Math.abs(us) > 0.005) p.push(usd(us));
  return p.length ? (' Además sumaste ' + p.join(' y ') + ' que ya tenías, con su fecha: están abajo.') : '';
}
function renderPagos(){
  var list = $('#pgList'); if(!list) return;
  var esIng = (fijoTab === 'ingreso');
  var l = fijosDe(mes, fijoTab).slice().sort(function(a,b){
    if(a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
    return String(a.fijo.nombre).localeCompare(String(b.fijo.nombre));
  });
  var hechos = 0, falta = 0, hoy = today();
  l.forEach(function(x){ if(x.pago) hechos++; else falta += x.monto; });
  $('#pgTit').textContent = (esIng ? 'Cobros de ' : 'Pagos de ') + ymLabel(mes);
  $('#pgSub').textContent = l.length
    ? (hechos + ' de ' + l.length + (esIng ? ' cobrados' : ' pagados')
       + (falta > 0.005 ? ' · ' + (esIng ? 'falta cobrar ' : 'faltan ') + money(falta) : ' · todo al día')
       + (l.every(function(x){ return x.man; }) ? '. Se cuentan cuando los tachás'
          : '. Se tachan solos el día que se cobran' + (l.some(function(x){ return x.man; }) ? ', salvo los que tachás vos' : ''))
       + (l.some(function(x){ return !x.pago && (ymOf(x.vence) === ymNow() || x.falta); }) ? (esIng ? '; si ya lo cobraste, tocalo.' : '; si ya lo pagaste, tocalo.') : '.'))
    : (esIng ? 'No tenés ingresos fijos este mes' : 'No tenés gastos fijos este mes');
  var pr = $('#pgProg');
  if(pr){ pr.hidden = !l.length; pr.firstChild.style.width = (l.length ? Math.round(hechos * 100 / l.length) : 0) + '%'; }
  if(!l.length){
    list.innerHTML = emptyBox(esIng ? 'Tocá el + para sumar el primero' : 'Tocá el + para sumar el primero: la luz, el gimnasio, una suscripción');
    return;
  }
  var tilde = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
  list.innerHTML = l.map(function(x){
    // se puede tachar a mano lo que cae este mes calendario; el sueldo del último
    // día hábil se ve en el mes siguiente pero cae en éste
    var esteMes = (ymOf(x.vence) === ymNow());
    var f = x.fijo, cl = f.id + '|' + x.clave;
    // uno que tachás vos se puede tachar también en un mes que ya pasó
    var puede = esteMes || (x.man && ymOf(x.vence) < ymNow());
    var fechaT = esteMes ? today() : x.vence;
    var vence = x.vence, aMano = !!x.aMano, adel = aMano ? x.fecha : '';
    var nomQ = esc(f.nombre) + (x.q ? ' · ' + esc(quincenaTexto(x)) : '');
    var aLas = x.hora ? ' a las ' + esc(x.hora) : '';
    // tocar uno que falta (o uno que tachaste vos) pide confirmación acá mismo
    if(pgConf === cl && puede && (aMano || !x.pago)){
      return '<div class="row pg pgconf" role="group" aria-label="Confirmar ' + esc(f.nombre) + '">'
        + '<p><b>' + (aMano ? '¿Lo desmarco?' : (esIng ? '¿Ya cobraste ' : '¿Ya pagaste ') + nomQ + '?') + '</b> '
        + (aMano
            ? (x.man ? 'Sale de tus ' + (esIng ? 'ingresos' : 'gastos') + ' y queda esperando a que lo taches.'
                     : 'Sale de tus ' + (esIng ? 'ingresos' : 'gastos') + ' de hoy y vuelve a quedar para el ' + esc(fechaLabel(vence)) + aLas + '.')
            : x.man
              ? 'Se suma ' + (fechaT === today() ? 'hoy ' : '') + 'a tus ' + (esIng ? 'ingresos' : 'gastos') + ' de ' + esc(ymLabel(mes)) + ' por ' + esc(money(x.monto))
                + (fechaT === today() ? '' : ', el ' + esc(fechaLabel(fechaT))) + '.'
              : 'Se suma hoy a tus ' + (esIng ? 'ingresos' : 'gastos') + ' de ' + esc(ymLabel(mes)) + ' por ' + esc(money(x.monto))
                + ', en vez del ' + esc(fechaLabel(vence)) + aLas + '.') + '</p>'
        + '<div class="rowflex"><button class="btn sm" type="button" data-pgsi="' + esc(cl) + '">'
        + (aMano ? 'Sí, desmarcar' : (esIng ? 'Sí, ya lo cobré' : 'Sí, ya lo pagué')) + '</button>'
        + '<button class="btn ghost sm" type="button" data-pgno>Cancelar</button></div></div>';
    }
    var estado = aMano
      ? (esIng ? 'Lo cobraste el ' : 'Lo pagaste el ') + esc(fechaLabel(adel)) + (adel !== vence ? ' · vencía el ' + esc(fechaLabel(vence)) + aLas : '')
      : (x.man && !x.pago)
        ? (vence >= today()
            ? (esIng ? 'Entra el ' : 'Vence el ') + esc(fechaLabel(vence)) + aLas + ' · se cuenta cuando lo taches'
            : (esIng ? 'Tenía que entrar el ' : 'Venció el ') + esc(fechaLabel(vence)) + aLas + ' · no lo conté: tachalo ' + (esIng ? 'si ya lo cobraste' : 'si ya lo pagaste'))
      : x.pago
        ? (esIng ? 'Entró el ' : 'Se cobró el ') + esc(fechaLabel(x.fecha)) + aLas
        : (esIng ? 'Entra el ' : 'Se cobra el ') + esc(fechaLabel(x.fecha)) + aLas;
    var toca = puede ? (aMano || !x.pago) : !x.pago;
    return '<div class="row pg' + (x.pago ? ' hecho' : '') + (x.falta && vence < today() ? ' vencido' : '') + (toca ? ' editable' : '') + '"'
      + (toca ? ' data-pgfijo="' + esc(cl) + '" role="button" tabindex="0" title="'
          + (aMano ? 'Tocá para desmarcarlo' : (esIng ? 'Tocá si ya lo cobraste' : 'Tocá si ya lo pagaste')) + '"' : '') + '>'
      + '<span class="pgchk" aria-hidden="true">' + tilde + '</span>'
      + '<span class="t"><b>' + esc(f.nombre) + '</b><small>' + (x.q ? esc(quincenaTexto(x)) + ' · ' : '') + estado
      + (esSueldoAdelantado(f) ? ' · cuenta para ' + esc(ymLabel(mes, true)) : '') + ' · ' + esc(f.cat || 'Otros')
      + (f.medio ? ' · ' + esc(f.medio) : '') + (esUSD(f) ? ' · ' + esc(usd(x.propio || 0)) : '') + '</small></span>'
      + '<span class="amt ' + (x.pago ? 'neu' : (esIng ? 'in' : 'out')) + '">' + esc(money(x.monto)) + '</span>'
      + '</div>';
  }).join('');
}
/* v293: "Te queda después de los fijos": la plata que tenés HOY (el saldo de
   todos tus medios de pago, como en "Saldo por medio") menos los gastos fijos
   del mes que todavía no se pagaron. Los que ya se pagaron ya salieron de ese
   saldo, por eso no se vuelven a restar. Con alguien elegido arriba, es su plata
   y su parte de los gastos a medias; con "Todos", la de la casa. Como es "hoy",
   sólo se muestra mirando el mes actual. */
function pintarQueda(delMes, esIng){
  var box = $('#fQueda'); if(!box) return;
  if(esIng || !delMes.length || mes !== ymNow()){ box.hidden = true; return; }
  var tengo = 0, conPlata = [];
  saldosPorMedio(mes).forEach(function(f){
    if(!f.usa) return;
    tengo += f.saldo;
    if(Math.abs(f.saldo) >= 0.5) conPlata.push(f);
  });
  /* De lo que falta pagar cuenta tu parte: en un fijo a medias, la del otro te
     la devuelve (pedido de leandro). Por lo mismo se suma lo que el grupo te
     tiene que devolver y se resta lo que vos tenés que devolver (Pendientes). */
  var pag = 0, falta = 0, nFalta = 0, hayMedias = false;
  fijosDe(mes, 'gasto', false, pesoParte).forEach(function(x){
    if(x.pago){ pag += x.monto; return; }
    falta += x.monto; nFalta++;
    if(verDe() && esMedias(x.fijo, mes)) hayMedias = true;   // con "Todos" va entero: es la plata de la casa
  });
  var v = verDe(), yo = (!v || v === miPersona());
  // lo pendiente del grupo es de quien usa este celular: se cuenta mirándose a sí mismo
  var deben = 0;
  if(v && v === miPersona()) pendPorPersona().forEach(function(g){ deben -= g.neto; });
  deben = Math.round(deben * 100) / 100;
  var queda = tengo + deben - falta;
  box.hidden = false;
  $('#fQuedaLab').textContent = yo ? 'Te queda después de los fijos' : 'A ' + nombrePersona(v) + ' le queda después de los fijos';
  var n = $('#fQuedaNum');
  n.textContent = (queda < 0 ? '− ' : '') + money(Math.abs(queda));
  n.style.color = queda < 0 ? 'var(--out)' : 'var(--in)';
  var nomMes = MESES[parseInt(mes.slice(5, 7), 10) - 1];
  var firma = function(x){ return (x < 0 ? '− ' : '') + money(Math.abs(x)); };
  conPlata.sort(function(a, b){ return b.saldo - a.saldo; });
  $('#fQuedaCta').innerHTML = '<span>' + (yo ? 'Tenés hoy' : 'Tiene hoy') + '</span><span class="v">' + esc(firma(tengo)) + '</span>'
    + (conPlata.length ? '<span class="det">' + conPlata.map(function(f){ return esc(f.medio) + ' ' + esc(firma(f.saldo)); }).join(' · ') + '</span>' : '')
    + (deben > 0 ? '<span>Te tienen que devolver</span><span class="v">+ ' + esc(money(deben)) + '</span>' : '')
    + (deben < 0 ? '<span>Tenés que devolver</span><span class="v neg">− ' + esc(money(-deben)) + '</span>' : '')
    + '<span>Fijos que faltan pagar' + (nFalta ? ' (' + nFalta + ')' : '') + '</span><span class="v neg">− ' + esc(money(falta)) + '</span>'
    + '<span class="tot">' + (yo ? 'Te queda' : 'Le queda') + '</span><span class="v tot">' + esc(firma(queda)) + '</span>'
    + (hayMedias ? '<span class="det">De los fijos a medias cuenta sólo ' + (yo ? 'tu' : 'su') + ' parte: la otra ' + (yo ? 'te' : 'le') + ' la devuelven.</span>' : '')
    + (deben ? '<span class="det">' + (deben > 0 ? 'Lo que te deben' : 'Lo que debés') + ' sale de Pendientes del grupo, en Movimientos.</span>' : '')
    + '<span class="det">' + (pag > 0 ? 'Los fijos de ' + esc(nomMes) + ' que ya se pagaron ya están descontados de lo que ' + (yo ? 'tenés' : 'tiene') + '.' : 'Todavía no se pagó ningún fijo de ' + esc(nomMes) + '.') + '</span>';
}
