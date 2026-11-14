/* Cuentas Claras · js/cuentas-y-saldos.js
   El resumen del mes y el saldo de cada medio de pago.

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

function resumen(ym){
  var t = txDe(ym), ap = aportesDe(ym);
  var cTodas = cuotasDe(ym), c = yaOcurrio(cTodas);
  var fjTodos = fijosGasto(ym), fjIngTodos = fijosIngreso(ym);
  var fj = yaOcurrio(fjTodos), fjIng = yaOcurrio(fjIngTodos);
  var pendGas = sumaPend(fjTodos) + sumaPend(cTodas), pendIng = sumaPend(fjIngTodos);
  var ing = 0, gas = 0, cuo = 0, aho = 0, fij = 0, fijIng = 0;
  var ingUsd = 0, gasUsd = 0;
  t.forEach(function(x){
    if(x.tipo==='ingreso'){ ing += montoPesos(x); ingUsd += montoUSD(x); }
    else { gas += montoPesos(x); gasUsd += montoUSD(x); }
  });
  c.forEach(function(x){ cuo += x.monto; });
  fj.forEach(function(x){ fij += x.monto; if(esUSD(x.fijo)) gasUsd += x.propio; });
  fjIng.forEach(function(x){ fijIng += x.monto; if(esUSD(x.fijo)) ingUsd += x.propio; });
  ap.forEach(function(x){ aho += aportePesos(x.meta, x.ap); });
  var arr = arrastreDe(ym);
  var ingTot = ing + fijIng;
  return { ing:ingTot, ingDirecto:ing, ingFijos:fijIng, ingUsd:ingUsd, gasUsd:gasUsd,
           gasDirecto:gas, cuotas:cuo, fijos:fij, gas:gas+cuo+fij, aho:aho, arr:arr,
           pendGas:pendGas, pendIng:pendIng,
           bal: ingTot-(gas+cuo+fij)-aho+arr,
           nTx:t.length, nCuotas:cTodas.length, nFijos:fjTodos.length, nFijosIng:fjIngTodos.length };
}
function gastosPorCat(ym){
  var map = {};
  txDe(ym).forEach(function(t){ if(t.tipo==='gasto'){ map[t.cat||'Otros'] = (map[t.cat||'Otros']||0) + montoPesos(t); } });
  cuotasVal(ym).forEach(function(c){ var k = c.plan.cat||'Otros'; map[k] = (map[k]||0) + c.monto; });
  fijosGastoVal(ym).forEach(function(f){ var k = f.fijo.cat||'Otros'; map[k] = (map[k]||0) + f.monto; });
  return Object.keys(map).map(function(k){ return {cat:k, monto:map[k]}; }).sort(function(a,b){ return b.monto-a.monto; });
}
function gastosPorMedio(ym){
  var map = {}, sinMedio = 'Sin especificar';
  function sumar(k, v){ k = (k||'').trim() || sinMedio; map[k] = (map[k]||0) + v; }
  txDe(ym).forEach(function(t){ if(t.tipo==='gasto') sumar(t.medio, montoPesos(t)); });
  cuotasVal(ym).forEach(function(c){ sumar(c.plan.medio, c.monto); });
  fijosGastoVal(ym).forEach(function(f){ sumar(f.fijo.medio, f.monto); });
  return Object.keys(map).map(function(k){ return {medio:k, monto:map[k]}; }).sort(function(a,b){ return b.monto-a.monto; });
}
/* ---- cuánta plata hay en cada medio de pago ----
   No se guarda en ningún lado: se deriva, como todo lo demás. Se suma lo que
   entró y se resta lo que salió con ese medio, desde el primer movimiento que
   cargaste hasta el corte del mes que estás mirando.

   El corte es el fin de mes, salvo en el mes en curso, donde es hoy: un sueldo
   que cobrás el 30 todavía no lo tenés el 13, y contarlo desde el 1 haría que la
   pantalla mienta. Es la misma regla que usan los totales del resumen.

   Lo que la app NO puede saber es lo que ya tenías antes de empezar a usarla.
   Por eso un medio como Efectivo puede dar en rojo: no es un error de cuenta, es
   que nunca le dijiste cuánto tenías en la billetera el primer día. Está avisado
   en pantalla y el número se muestra tal cual —taparlo con un Math.max(0, …)
   sería inventar plata que no sé si tenés—. */
function corteDelMes(ym){
  return (ym === ymNow()) ? today() : (ym + '-' + pad(finDeMes(ym)));
}
function saldosPorMedio(ym){
  var corte = corteDelMes(ym), mapa = {}, orden = [];
  function fila(m){
    var k = String(m || '').trim() || 'Sin especificar';
    if(!mapa[k]){ mapa[k] = { medio:k, entro:0, salio:0, pasoIn:0, pasoOut:0 }; orden.push(k); }
    return mapa[k];
  }
  medios().forEach(fila);            // los que tenés cargados definen el orden
  S.tx.forEach(function(t){
    if(!t.fecha || t.fecha > corte || !esDeVista(t)) return;
    var f = fila(t.medio), v = montoPesos(t);
    if(t.tipo === 'ingreso') f.entro += v; else f.salio += v;
  });
  (S.fijos||[]).forEach(function(fx){
    if(!esDeVista(fx)) return;
    var ymF = fx.desde;
    for(var k=0; k<600 && ymF <= ym; k++){
      ocurrenciasFijo(fx, ymF).forEach(function(oc){
        if(oc.falta) return;
        var v = montoFijoPesos(fx, oc.per);
        if(v > 0 && oc.fecha <= corte){
          var f = fila(fx.medio);
          if(fx.tipo === 'ingreso') f.entro += v; else f.salio += v;
        }
      });
      ymF = ymAdd(ymF, 1);
    }
  });
  S.planes.forEach(function(p){
    if(!esDeVista(p)) return;
    var n = Math.max(1, Number(p.n)||1), cu = cuotaMonto(p);
    for(var i=0; i<n; i++){
      var ymC = ymAdd(p.desde, i);
      if(ymC > ym) break;
      if(fechaCuota(p, ymC) <= corte) fila(p.medio).salio += cu;
    }
  });
  // v284: lo que se pagaron entre ustedes por los gastos a medias
  var vL = verDe();
  liquidaciones().forEach(function(l){
    if(l.fecha > corte) return;
    if(!vL || vL === l.deudor) fila(l.de).salio += l.monto;
    if(!vL || vL === l.pagador) fila(l.a).entro += l.monto;
  });
  // los pases: salen de un medio y entran en el otro
  (S.pases||[]).forEach(function(p){
    if(!p.fecha || p.fecha > corte || !esDeVista(p)) return;
    var fd = fila(p.de), fa = fila(p.a);
    fd.salio += p.monto; fd.pasoOut += p.monto;
    fa.entro += p.monto; fa.pasoIn += p.monto;
  });
  return orden.map(function(k){
    var f = mapa[k];
    f.saldo = f.entro - f.salio;
    f.usa = (Math.abs(f.entro) > 0.005 || Math.abs(f.salio) > 0.005);
    return f;
  }).sort(function(a,b){ return b.saldo - a.saldo; });
}

function deudaRestante(desdeYm){
  var total = 0, planes = 0, ultimo = null;
  S.planes.forEach(function(p){
    var n = Number(p.n)||0;
    var restantes = Math.max(0, n - cuotasPagadas(p, desdeYm)), w = pesoDe(p, desdeYm);
    if(restantes > 0 && w > 0){
      planes++; total += restantes * cuotaMonto(p) * w;
      var fin = ymAdd(p.desde, n-1);
      if(!ultimo || fin > ultimo) ultimo = fin;
    }
  });
  return {total:total, planes:planes, ultimo:ultimo};
}
