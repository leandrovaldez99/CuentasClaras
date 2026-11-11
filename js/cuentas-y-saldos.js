/* Cuentas Claras · js/cuentas-y-saldos.js
   Las cuentas que rinden (intereses día por día) y el saldo de cada medio de pago.

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

/* ---- la cuenta que rinde ----
   La plata de las categorías de ingreso marcadas se considera depositada en una
   cuenta que paga interés. Cada día se le suma el interés del saldo con el que
   cerró ese día: sube con esos ingresos y baja con todo lo que gastás, pagás en
   cuotas o apartás en ahorros. El interés se capitaliza, o sea que al día
   siguiente rinde también lo que rindió antes.

   Nada de esto se guarda como movimiento: se recalcula de los datos que ya
   tenés, así que si corregís un gasto viejo, los intereses se reacomodan solos. */
function cuentas(){ return S.cuentas || []; }
function cuentaPorId(id){ var r = null; cuentas().forEach(function(c){ if(c.id === id) r = c; }); return r; }
function tnaDe(c){
  if(!c) return 0;
  if(c.manual) return Math.max(0, Number(c.tna)||0);
  var e = null;
  (S.tasas||[]).forEach(function(x){ if(x.api === c.entidad) e = x; });
  return e ? Math.max(0, Number(e.tna)||0) : 0;
}
/* Cada cuenta ES un medio de pago. El nombre del medio sale del banco elegido
   ("Mercado Pago", "Galicia") y se renombra solo cuando cambiás de banco. Todo
   lo que cargues con ese medio —te entre o te salga— mueve el saldo de esa
   cuenta, y nada más.

   Los movimientos en DÓLARES quedan afuera: la TNA que paga el banco es en
   pesos y sobre el saldo en pesos. Tener U$S 1.000 en Mercado Pago no te rinde
   al 19% anual —eso lo cobra la cuenta remunerada en pesos—, así que un ingreso
   en dólares no engorda el saldo que rinde y un gasto en dólares tampoco lo
   baja. La única plata en dólares que sí descuenta es el aporte a una meta de
   ahorro: para comprar esos dólares salieron pesos de la cuenta. */
function entidadDe(c){
  var e = null;
  if(c) (S.tasas||[]).forEach(function(x){ if(x.api === c.entidad) e = x; });
  return e;
}
/* "Ualá (cuenta)" es el nombre del producto; como medio de pago alcanza "Ualá". */
function nombreCorto(n){ return String(n||'').replace(/\s*\([^)]*\)\s*$/, '').trim(); }
function nombreSugerido(c, salvoId){
  var ent = entidadDe(c);
  var base = ent ? nombreCorto(ent.n) : '';
  if(!base) return '';
  return nombreLibre(base, salvoId);
}
/* Si el nombre ya lo usa OTRA cuenta, le agrego un número. Si lo usa un medio
   suelto, me lo quedo: es justamente el medio con el que venías pagando. */
function nombreLibre(base, salvoId){
  var deOtras = {};
  cuentas().forEach(function(c){ if(c.id !== salvoId && c.medio) deOtras[c.medio.toLowerCase()] = true; });
  var n = base, k = 2;
  while(deOtras[n.toLowerCase()] && k < 20){ n = base + ' ' + k; k++; }
  return n.slice(0,28);
}
function cuentaRinde(c){ return !!c && tnaDe(c) > 0 && !!c.medio; }
/* Le pone a la cuenta el medio de pago que le corresponde por su banco. Si ya
   tenía uno, lo RENOMBRA (los movimientos lo siguen); si el nombre nuevo ya
   existe como medio suelto, se muda a ese en vez de duplicarlo. */
function aplicarMedioDeCuenta(c){
  var sug = nombreSugerido(c, c.id);
  if(!sug || c.medio === sug) return '';
  var anterior = c.medio, l = medios(), iSug = -1;
  for(var k = 0; k < l.length; k++) if(l[k].toLowerCase() === sug.toLowerCase()) iSug = k;
  if(iSug > -1 && l[iSug] !== anterior){
    c.medio = l[iSug];
    return 'Esta cuenta ahora es "' + c.medio + '"';
  }
  var iAnt = anterior ? S.medios.indexOf(anterior) : -1;
  if(iAnt > -1){
    renombrarMedio(iAnt, sug);            // deja c.medio = sug y arrastra los movimientos
    return 'Le cambié el nombre a "' + sug + '": los movimientos que tenías lo siguieron';
  }
  S.medios.push(sug);
  desmarcarMedioQuitado(sug);
  c.medio = sug;
  return 'Te agregué el medio de pago "' + sug + '"';
}
/* ¿Esta cuenta tiene movimientos en dólares? Sólo entonces vale la pena aclarar
   en la tarjeta que no entran en la cuenta del interés. */
function cuentaTieneUsd(c){
  if(!c || !c.medio) return false;
  var hay = false;
  S.tx.forEach(function(t){ if(esUSD(t) && (t.medio||'') === c.medio) hay = true; });
  (S.fijos||[]).forEach(function(f){ if(esUSD(f) && (f.medio||'') === c.medio) hay = true; });
  return hay;
}
function cuentaDelMedio(m){
  var r = null;
  cuentas().forEach(function(c){ if(c.medio && c.medio === m) r = c; });
  return r;
}
function cuentasQueRinden(){ return cuentas().filter(cuentaRinde); }
function rindeAlgo(){ return cuentasQueRinden().length > 0; }
/* La TNA "vigente" es la de la primera cuenta que rinde. La usa la calculadora
   de metas de ahorro cuando la meta no dice de qué cuenta sale. */
function tnaVigente(){
  var c = cuentasQueRinden()[0];
  return c ? tnaDe(c) : 0;
}
/* Un movimiento es de esta cuenta si se cargó con su medio de pago. */
function esDeLaCuenta(c, medio){ return !!c.medio && (medio || '') === c.medio; }

var _intCache = null;
function intOlvidar(){ _intCache = null; }
/* Devuelve { idCuenta: { fecha: interés } }. Cada cuenta simula su propio saldo:
   entra lo de sus categorías de ingreso y sale lo que se pagó con sus medios. */
function interesesPorDia(){
  if(_intCache) return _intCache;
  _intCache = {};
  var lista = cuentasQueRinden();
  if(!lista.length) return _intCache;

  var hoy = today();
  var tope = sumarDias(hoy, -1500);

  lista.forEach(function(c){
    var diaria = tnaDe(c) / 100 / 365;
    var mov = {}, primera = null;
    function poner(f, v){
      if(!f || f > hoy) return;
      mov[f] = (mov[f] || 0) + v;
      if(!primera || f < primera) primera = f;
    }
    S.tx.forEach(function(t){
      if(!esDeLaCuenta(c, t.medio)) return;
      if(esUSD(t)) return;          // la TNA es en pesos: los dólares no rinden acá
      var m = montoPesos(t);
      poner(t.fecha, t.tipo === 'ingreso' ? m : -m);
    });
    /* Lo que apartás en una meta sale del saldo libre de la cuenta donde lo
       dejás. Sólo los pesos (los dólares ya los tenías: de la cuenta en pesos no
       salió nada), sólo lo que está EN esta cuenta (lo guardado aparte no sale de
       ninguna) y no lo que ya tenías de antes, que no se movió ese día. */
    // lo que pasaste a esta cuenta desde otro medio (o sacaste de ella)
    (S.pases||[]).forEach(function(p){
      if(p.a === c.medio) poner(p.fecha, p.monto);
      if(p.de === c.medio) poner(p.fecha, -p.monto);
    });
    S.metas.forEach(function(m){
      (m.aportes||[]).forEach(function(a){
        if(a.previo || monAporte(m, a) === 'USD') return;
        if(lugarAporte(m, a) !== c.id) return;
        poner(a.fecha, -(Number(a.monto)||0));
      });
    });
    (S.fijos||[]).forEach(function(f){
      if(!esDeLaCuenta(c, f.medio)) return;
      if(esUSD(f)) return;          // ídem: un sueldo en dólares no engorda el saldo en pesos
      var esIngFijo = (f.tipo === 'ingreso');
      var ym = f.desde;
      for(var k=0; k<600 && ym <= ymOf(hoy); k++){
        ocurrenciasFijo(f, ym).forEach(function(oc){
          if(oc.falta) return;          // uno que tachás vos y todavía no tachaste: no salió
          var mm = montoFijoPesos(f, oc.per);
          if(mm > 0) poner(oc.fecha, esIngFijo ? mm : -mm);
        });
        ym = ymAdd(ym, 1);
      }
    });
    S.planes.forEach(function(p){
      if(!esDeLaCuenta(c, p.medio)) return;
      var n = Math.max(1, Number(p.n)||1), cu = cuotaMonto(p);
      for(var i=0; i<n; i++){ var ymC = ymAdd(p.desde, i); poner(fechaCuota(p, ymC), -cu); }
    });
    if(!primera) return;
    if(primera < tope) primera = tope;

    var acum = {}, saldo = 0, f = primera, vueltas = 0;
    while(f <= hoy && vueltas++ < 2000){
      saldo += mov[f] || 0;
      if(saldo > 0){
        var i2 = saldo * diaria;
        acum[f] = i2;
        saldo += i2;
      }
      f = sumarDias(f, 1);
    }
    _intCache[c.id] = acum;
  });
  return _intCache;
}
/* Una fila por cuenta y por día. Con una sola cuenta la fila no la nombra:
   decir "Mi cuenta" cuando no hay con qué compararla es ruido. */
function interesesDias(ym){
  if(verDe()) return [];            // los intereses son de las cuentas, no de una persona
  var por = interesesPorDia(), out = [], varias = Object.keys(por).length > 1;
  Object.keys(por).forEach(function(cid){
    var c = cuentaPorId(cid);
    Object.keys(por[cid]).forEach(function(f){
      if(ymOf(f) === ym) out.push({ fecha:f, monto:por[cid][f], cuenta:(varias && c) ? c.medio : '' });
    });
  });
  out.sort(function(a,b){ return a.fecha === b.fecha ? (a.cuenta < b.cuenta ? -1 : 1) : (a.fecha < b.fecha ? -1 : 1); });
  return out;
}
function interesesDe(ym){
  if(verDe()) return 0;
  var por = interesesPorDia(), t = 0;
  Object.keys(por).forEach(function(cid){
    Object.keys(por[cid]).forEach(function(f){ if(ymOf(f) === ym) t += por[cid][f]; });
  });
  return t;
}
function interesesPorCuenta(ym){
  var por = interesesPorDia(), out = [];
  cuentas().forEach(function(c){
    var t = 0, d = por[c.id] || {};
    Object.keys(d).forEach(function(f){ if(ymOf(f) === ym) t += d[f]; });
    if(t > 0) out.push({ cuenta:c, monto:t });
  });
  return out.sort(function(a,b){ return b.monto - a.monto; });
}

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
  var itr = interesesDe(ym);
  var ingTot = ing + fijIng;
  return { ing:ingTot, ingDirecto:ing, ingFijos:fijIng, ingUsd:ingUsd, gasUsd:gasUsd,
           gasDirecto:gas, cuotas:cuo, fijos:fij, gas:gas+cuo+fij, aho:aho, arr:arr, int:itr,
           pendGas:pendGas, pendIng:pendIng,
           bal: ingTot+itr-(gas+cuo+fij)-aho+arr,
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
    if(!mapa[k]){ mapa[k] = { medio:k, entro:0, salio:0, interes:0, ahorro:0, pasoIn:0, pasoOut:0 }; orden.push(k); }
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
  /* Lo que apartás en una meta sale de la cuenta donde lo dejás, igual que en el
     cálculo de intereses. Lo guardado aparte no sale de ningún medio (no sé de
     dónde vino), los dólares tampoco (ya los tenías) y lo que ya tenías de antes
     tampoco (no se movió ese día). */
  S.metas.forEach(function(m){
    (m.aportes||[]).forEach(function(a){
      if(a.previo || monAporte(m, a) === 'USD' || !esDeVista(a)) return;
      if(!a.fecha || a.fecha > corte) return;
      var cta = cuentaPorId(lugarAporte(m, a));
      if(!cta || !cta.medio) return;
      var v = Number(a.monto)||0, f = fila(cta.medio);
      if(v >= 0) f.ahorro += v; else f.entro += -v;    // un retiro vuelve a la cuenta
    });
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
  var por = verDe() ? {} : interesesPorDia();
  cuentas().forEach(function(c){
    if(!c.medio || !por[c.id]) return;
    var t = 0;
    Object.keys(por[c.id]).forEach(function(fch){ if(fch <= corte) t += por[c.id][fch]; });
    if(t > 0) fila(c.medio).interes += t;
  });
  return orden.map(function(k){
    var f = mapa[k];
    f.entro += f.interes;
    f.salio += f.ahorro;
    f.saldo = f.entro - f.salio;
    f.rinde = cuentaRinde(cuentaDelMedio(f.medio));
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
