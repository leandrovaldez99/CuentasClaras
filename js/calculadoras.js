/* Cuentas Claras · js/calculadoras.js
   Calculadoras: ¿cuotas o contado?, conversor de monedas, aguinaldo y horas extras.

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

/* ============================================================
   calculadoras: cuotas o contado, conversor de dólar, aguinaldo, horas extras
   ============================================================
   Ninguna guarda nada por su cuenta: hacen la cuenta mientras escribís y, si
   querés, la anotan en tus movimientos con un botón. */
function catSueldo(){ return S.catIng.indexOf('Sueldo') > -1 ? 'Sueldo' : (S.catIng[0] || 'Otros'); }
function esMioCalc(x){ return !hayGrupo() || quienDe(x) === (verDe() || miPersona() || quienDe(x)); }
/* Lo que entró como sueldo en un mes: movimientos y fijos de la categoría
   Sueldo, sin el aguinaldo que anotó la calculadora (si no, el aguinaldo del año
   que viene saldría inflado). Las horas extras anotadas quedan afuera salvo con
   `conHx`: para el aguinaldo sí cuentan (son parte de la remuneración del mes,
   v197), pero no para calcular la hora normal en Horas extras. */
function sueldoDelMes(ym, conHx){
  var c = catSueldo(), t = 0;
  S.tx.forEach(function(x){
    if(x.tipo !== 'ingreso' || x.cat !== c || mesDeTx(x) !== ym || x.sac || (x.hx && !conHx) || !esMioCalc(x)) return;
    t += montoPesos(x);
  });
  (S.fijos || []).forEach(function(f){
    if(f.tipo !== 'ingreso' || f.cat !== c || !esMioCalc(f)) return;
    t += valorFijoMes(f, ym);
  });
  return Math.round(t * 100) / 100;
}
function hxDelMesAnotadas(ym){
  var t = 0;
  S.tx.forEach(function(x){ if(x.tipo === 'ingreso' && x.hx && x.cat === catSueldo() && mesDeTx(x) === ym && esMioCalc(x)) t += montoPesos(x); });
  return Math.round(t * 100) / 100;
}
function ultimoSueldo(conHx){
  for(var i = 0; i < 12; i++){ var v = sueldoDelMes(ymAdd(ymNow(), -i), conHx); if(v > 0) return v; }
  return 0;
}
function medioDelSueldo(){
  var c = catSueldo(), m = '';
  (S.fijos || []).forEach(function(f){ if(!m && f.tipo === 'ingreso' && f.cat === c && f.medio) m = f.medio; });
  return medioPorDefecto(m || 'Transferencia');
}
function calcNum(id){ var el = $(id); return el ? parseMoney(el.value) : 0; }
/* v196: a qué medio entra lo que anotan las calculadoras. De entrada, el del
   sueldo (o, si ya lo anotaste, el que usaste esa vez); si lo cambiás, queda
   el que elegiste mientras estés en la pantalla. */
var calcMedio = { hx:'' };
function calcMedioDe(cual, marca, valor){
  if(calcMedio[cual] && medios().indexOf(calcMedio[cual]) > -1) return calcMedio[cual];
  var prev = null; S.tx.forEach(function(x){ if(x[marca] === valor) prev = x; });
  return medioPorDefecto(prev && prev.medio ? prev.medio : medioDelSueldo());
}
function calcAnotarHtml(cual, medio, boton){
  return '<div class="hr"></div><div class="calc-anotar"><div class="field"><label class="lab" for="' + cual + 'Medio">Entra en</label>'
    + '<select id="' + cual + 'Medio">' + opcionesMedio(medio) + '</select></div>' + boton + '</div>';
}
function anotarIngreso(datos, marca, valor){
  // si ya lo anotaste antes (el mismo aguinaldo), se reemplaza: no se suma dos veces
  if(marca) S.tx = S.tx.filter(function(x){ return x[marca] !== valor; });
  var t = { id:uid(), ts:Date.now(), tipo:'ingreso', monto:Math.round(datos.monto * 100) / 100, cat:catSueldo(),
            fecha:datos.fecha, medio:datos.medio ? medioPorDefecto(datos.medio) : medioDelSueldo(), nota:datos.nota };
  if(marca) t[marca] = valor;
  if(miPersona()) t.quien = miPersona();
  S.tx.push(t);
  save(); render();
  return t;
}

/* ---- ¿cuotas o contado? ----
   Como en Infleta: cada cuota se paga más adelante, y para entonces la plata
   vale menos. Se pasa cada cuota a pesos de hoy dividiéndola por la inflación
   acumulada hasta el mes en que se paga (la primera, dentro de un mes). Si la
   suma de las cuotas "en pesos de hoy" da menos que el contado, convienen las
   cuotas. La inflación se propone con el último IPC del INDEC (ver "la
   inflación"), y se puede cambiar por la que cada uno espere. */
function mejorTna(){
  var mejor = null;
  cuentasQueRinden().forEach(function(c){ var t = tnaDe(c); if(t > 0 && (!mejor || t > mejor.t)) mejor = { t:t, n:c.medio }; });
  return mejor;
}
function tasaMensual(tna){ return Math.pow(1 + (Number(tna) || 0) / 100 / 365, 365 / 12) - 1; }
function cycTasaImplicita(contado, cuota, n){
  // la tasa mensual i con la que n cuotas valen hoy lo mismo que el contado
  function vp(i){ var s = 0; for(var k = 1; k <= n; k++) s += cuota / Math.pow(1 + i, k); return s; }
  if(!(contado > 0) || !(cuota > 0)) return null;
  var lo = -0.5, hi = 2;
  if(vp(lo) < contado || vp(hi) > contado) return null;
  for(var j = 0; j < 80; j++){ var mid = (lo + hi) / 2; if(vp(mid) > contado) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
function pctAnual(m){ return (Math.pow(1 + (Number(m) || 0) / 100, 12) - 1) * 100; }
function pct1(v){ var r = Math.round((Number(v) || 0) * 10) / 10; return String(r).replace('.', ',') + '%'; }
var cycInfTocada = false, cycInfEdit = false;
/* v198: la inflación queda trabada, como la TNA de las cuentas: para cambiarla
   hay que tocar el lápiz, así no se pisa sin querer al pasar por el formulario. */
function cycPintarLapiz(){
  var inp = $('#cycInf'), b = $('#cycInfLapiz'); if(!inp || !b) return;
  inp.readOnly = !cycInfEdit;
  inp.classList.toggle('bloq', !cycInfEdit);
  if(cycInfEdit) inp.removeAttribute('tabindex'); else inp.setAttribute('tabindex', '-1');
  b.setAttribute('aria-pressed', cycInfEdit ? 'true' : 'false');
  b.setAttribute('aria-label', cycInfEdit ? 'Listo' : 'Cambiar la inflación');
  b.title = cycInfEdit ? 'Listo' : 'Cambiar la inflación';
  b.innerHTML = cycInfEdit ? TILDE_SVG : LAPIZ_SVG;
}
function cycInfTrabar(){ if(!cycInfEdit) return; cycInfEdit = false; cycPintarLapiz(); }
function cycPrepararInf(){
  var inp = $('#cycInf'), nota = $('#cycInfNota'); if(!inp) return;
  var d = ipcDato, mesTxt = ymLabel(d.ym);
  if(!cycInfTocada) inp.value = String(d.v).replace('.', ',');
  if(!nota) return;
  if(cycInfTocada){
    var v = parseMoney(inp.value);
    nota.innerHTML = 'La que pusiste vos' + (v > 0 ? ' (≈' + esc(pct1(pctAnual(v))) + ' en un año)' : '') + '. '
      + '<button type="button" class="linkbtn" data-cycipc>Usar la del INDEC (' + esc(pct1(d.v)) + ')</button>';
  } else {
    nota.textContent = 'Último dato del INDEC: ' + pct1(d.v) + ' en ' + mesTxt + ' (≈' + pct1(pctAnual(d.v)) + ' en un año si sigue así). Si esperás otra, tocá el lápiz.';
  }
}
var CYC_ICO = {
  hoy:'<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
  rec:'<path d="M19 5L5 19"/><circle cx="7" cy="7" r="2.4"/><circle cx="17" cy="17" r="2.4"/>',
  cuota:'<rect x="3" y="6" width="18" height="12" rx="2.2"/><path d="M3 10.5h18M7 15h4"/>',
  inf:'<path d="M3 17l6-6 4 4 8-8M15 7h6v6"/>'
};
function cycTile(cls, ico, lab, num, meta){
  return '<div class="tile ' + cls + '"><span class="stripe"></span><div class="tile-top"><span class="tico" aria-hidden="true">'
    + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' + CYC_ICO[ico] + '</svg></span>'
    + '<div class="lab">' + esc(lab) + '</div></div><div class="num">' + esc(num) + '</div><div class="meta">' + meta + '</div></div>';
}
function cycCalcular(){
  var out = $('#cycOut'); if(!out) return;
  var contado = calcNum('#cycContado');
  var n = Math.max(1, Math.min(72, Math.round(calcNum('#cycN')) || 1));
  var total = calcNum('#cycTotal'), inf = Math.max(-20, Math.min(50, calcNum('#cycInf')));
  if(!(contado > 0) || !(total > 0)){ out.innerHTML = ''; out._d = null; return; }
  var cuota = total / n, f = inf / 100, aj = [], vp = 0;
  // en pesos enteros, como el resto de los números grandes: así la lista suma justo lo que dice arriba
  for(var k = 1; k <= n; k++){ var x = Math.round(cuota / Math.pow(1 + f, k)); aj.push(x); vp += x; }
  var dif = Math.round(contado - vp), tol = Math.max(0.5, contado * 0.0005);
  var parejo = Math.abs(dif) <= tol, convieneCuotas = !parejo && dif > 0;
  var recargo = (total / contado - 1) * 100, sinInt = Math.abs(total - contado) <= 0.5;
  var titulo = parejo ? 'Da lo mismo' : (convieneCuotas ? 'Te conviene en cuotas' : 'Te conviene de contado');
  var color = parejo ? 'var(--ink)' : (convieneCuotas ? 'var(--in)' : 'var(--out)');
  var nTxt = n === 1 ? 'la cuota' : 'las ' + n + ' cuotas';
  var sub = (n === 1 ? 'Con la inflación, la cuota vale hoy ' : 'Con la inflación, ' + nTxt + ' valen hoy ') + '<b>' + esc(money(vp)) + '</b>'
    + (parejo ? ', casi lo mismo que el contado.'
       : ': <b>' + esc(money(Math.abs(dif))) + (convieneCuotas ? ' menos' : ' más') + '</b> que los ' + esc(money(contado)) + ' de contado.');
  var i = cycTasaImplicita(contado, cuota, n), corte = '';
  if(sinInt) corte = inf > 0 ? 'Son sin interés: con inflación, siempre convienen las cuotas.' : 'Son sin interés: sin inflación, da lo mismo.';
  else if(total < contado) corte = 'Las cuotas salen menos que el contado: convienen siempre.';
  else if(i !== null) corte = 'Las cuotas convienen si la inflación es más de <b>' + esc(pct1(i * 100)) + '</b> por mes (≈' + esc(pct1(pctAnual(i * 100))) + ' en un año).';
  var ym0 = ymNow();
  var html = '<div class="card"><div class="card-head"><div><h2 style="color:' + color + '">' + titulo + '</h2>'
    + '<p class="sub cyc-sub">' + sub + '</p></div></div>'
    + '<div class="grid cyc-tiles">'
    + cycTile(parejo ? 'bal' : (convieneCuotas ? 'in' : 'out'), 'hoy', 'Valen hoy', money(vp), 'De contado: ' + esc(money(Math.round(contado))))
    + cycTile('bal', 'rec', 'Recargo', sinInt ? '0%' : pct1(recargo), sinInt ? 'Sin interés' : esc(money(Math.abs(total - contado))) + (total > contado ? ' más que de contado' : ' menos que de contado'))
    + cycTile('bal', 'cuota', 'Cada cuota', money(Math.round(cuota)), n + (n === 1 ? ' cuota' : ' cuotas') + ' · ' + esc(money(total)))
    + cycTile('meta-c', 'inf', 'Inflación', pct1(inf), 'Por mes · ≈' + esc(pct1(pctAnual(inf))) + ' en un año')
    + '</div>'
    + (corte ? '<p class="hero-base cyc-corte">' + corte + '</p>' : '')
    + '<div class="hr"></div><div class="lab" style="margin-bottom:10px">Cada cuota en pesos de hoy</div>'
    + '<div class="cyc-cuotas">' + aj.map(function(x, j){
        return '<div class="cyc-c"><span>Cuota ' + (j + 1) + '</span><b>' + esc(money(x)) + '</b><i>' + esc(ymLabel(ymAdd(ym0, j + 1), true)) + '</i></div>';
      }).join('') + '</div>'
    + '<p class="note" style="margin-top:12px">Cada cuota es de ' + esc(money(Math.round(cuota))) + ', pero cuando la pagues la plata va a valer menos: acá está lo que vale cada una en pesos de hoy. Supone que la primera sale dentro de un mes y que la inflación se mantiene.</p>'
    + '<div class="hr"></div><div class="lab" style="margin-bottom:10px">Anotarlo</div>'
    + '<div class="rowflex" style="gap:8px">'
    + '<button class="btn' + (convieneCuotas ? '' : ' ghost') + '" type="button" data-cycir="cuotas">Cargarlo en cuotas</button>'
    + '<button class="btn' + (convieneCuotas ? ' ghost' : '') + '" type="button" data-cycir="contado">Cargarlo de contado</button></div>'
    + '</div>';
  out.innerHTML = html;
  out._d = { ef:contado, total:total, n:n, que:(($('#cycQue') || {}).value || '').trim() };
}
function cycIrACargar(como){
  var d = $('#cycOut') && $('#cycOut')._d; if(!d) return;
  if(editando) salirEdit();
  if(editandoPlan) salirEditPlan();
  if(como === 'cuotas'){
    cargaTab = 'cuotas';
    pintarCarga(); fillSelects();
    $('#qDesc').value = d.que; $('#qTotal').value = enCampo(Math.round(d.total * 100) / 100); $('#qN').value = String(d.n);
    go('cargar'); pintarFechas(); previewCuota();
    toast('Revisá la tarjeta y el día del resumen, y guardala');
  } else {
    cargaTab = 'gasto'; tipoMov = 'gasto';
    pintarCarga(); fillSelects();
    $('#mMonto').value = enCampo(Math.round(d.ef * 100) / 100); $('#mNota').value = d.que;
    go('cargar'); pintarFechas();
    toast('Elegí la categoría y el medio, y agregalo');
  }
}

/* ---- conversor de dólar ----
   Para pasar pesos a dólares se usa el precio de venta (es lo que te cobran por
   cada dólar); para pasar dólares a pesos, el de compra (lo que te pagan). Si
   de algún dólar no tengo la compra, uso la venta y lo aviso. */
var convDir = 'ars', convTipo = '';
/* v215: la cotización del conversor. Si la hay, se ve trabada; con el lápiz la
   cambiás para probar (`convCotMano`), sin tocar la guardada. */
var convCotEdit = false, convCotMano = false;
function convCampo(n){ return (n > 0 && n < 10) ? new Intl.NumberFormat('es-AR', { maximumFractionDigits:4 }).format(n) : enCampo(n); }
/* Lo que se puede convertir: los dólares (`blue`, `oficial`…) y, desde v203,
   las otras monedas (`m:EUR`…). Cada una con su cotización, si la tengo. */
function convItem(id){
  if(typeof id === 'string' && id.slice(0,2) === 'm:'){
    var mo = monedaDef(id.slice(2)); if(!mo) return null;
    return { id:id, n:mo.n, nombre:mo.n.toLowerCase(), det:'cotización oficial', sim:mo.sim, pl:mo.pl, otra:mo.id,
             t:((S.dolar && S.dolar.otras) || {})[mo.id] || null };
  }
  if(!esTipoDolar(id)) return null;
  var d = DOLARES.filter(function(x){ return x.id === id; })[0];
  return { id:id, n:'Dólar ' + d.n, nombre:'dólar ' + d.n.toLowerCase(), det:enMinuscula(d.det), sim:'U$S', pl:'dólares', otra:'',
           t:((S.dolar && S.dolar.tipos) || {})[id] || null };
}
function convFmt(n, it){ return it.otra ? enOtra(n, it.sim) : usd(n); }
function renderConv(){
  var box = $('#convLista'), sel = $('#convTipo'); if(!box || !sel) return;
  var elegido = tipoDolar();
  if(!convItem(convTipo)) convTipo = elegido;
  var it = convItem(convTipo);
  var aOtra = convDir === 'ars';
  var par = $('#convPar'); if(par) par.classList.toggle('al-reves', !aOtra);
  var on = $('#convOtraN'); if(on) on.textContent = it.n;
  var tp = $('#convPar .conv-pesos .conv-t'), to = $('#convPar .conv-otra .conv-t');
  if(tp) tp.textContent = aOtra ? 'Tenés' : 'Recibís';
  if(to) to.textContent = aOtra ? 'Recibís' : 'Tenés';
  var sw = $('#convSwap'); if(sw) sw.setAttribute('aria-label', 'Dar vuelta: de ' + (aOtra ? it.pl + ' a pesos' : 'pesos a ' + it.pl));
  $('#convLab').textContent = aOtra ? 'Cuántos pesos' : 'Cuántos ' + it.pl;
  $('#convSim').textContent = aOtra ? '$' : it.sim;
  function tiene(x){ return !!(x.t && x.t.venta > 0); }
  function cotDe(x){ return aOtra ? x.t.venta : (x.t.compra > 0 ? x.t.compra : x.t.venta); }
  function op(x, extra){
    return '<option value="' + x.id + '"' + (x.id === convTipo ? ' selected' : '') + '>' + esc(x.n) + ' · '
      + (tiene(x) ? esc(moneyCot(cotDe(x))) : 'sin cotización') + (extra || '') + '</option>';
  }
  // el desplegable: todos los dólares y las otras monedas; arranca en el dólar de Ajustes
  var ops = '<optgroup label="Dólar">' + DOLARES.map(function(d){ return op(convItem(d.id)); }).join('') + '</optgroup>'
    + '<optgroup label="Otras monedas">' + MONEDAS.map(function(m){ return op(convItem('m:' + m.id)); }).join('') + '</optgroup>';
  if(sel.innerHTML !== ops) sel.innerHTML = ops;
  sel.value = convTipo;
  var os = $('#convOtraS'); if(os) os.textContent = tiene(it) ? moneyCot(cotDe(it)) : 'sin cotización';
  var m = calcNum('#convMonto'), t = it.t;
  var n = $('#convNota'), s2 = $('#convSub'), cb = $('#convCotBox');
  // la cotización: si la hay, trabada (el lápiz la destraba para probar otra);
  // si no la hay (sin internet), la escribís vos y queda guardada
  var hay = tiene(it), ci = $('#convCot'), lp = $('#convCotLapiz'), cno = $('#convCotNota');
  if(!hay){ convCotEdit = false; convCotMano = false; }
  if(cb){ cb.hidden = false; var cl = $('#convCotLab'); if(cl) cl.textContent = 'Cuánto está el ' + it.nombre + (hay && !aOtra ? ' (compra)' : ' (venta)'); }
  if(ci){
    var trabado = hay && !convCotEdit;
    ci.readOnly = trabado; ci.classList.toggle('bloq', trabado);
    if(trabado) ci.setAttribute('tabindex', '-1'); else ci.removeAttribute('tabindex');
    if(hay && !convCotMano && document.activeElement !== ci) ci.value = convCampo(cotDe(it));
  }
  if(lp){
    lp.hidden = !hay;
    lp.setAttribute('aria-pressed', convCotEdit ? 'true' : 'false');
    lp.setAttribute('aria-label', convCotEdit ? 'Listo' : 'Cambiar la cotización'); lp.title = convCotEdit ? 'Listo' : 'Cambiar la cotización';
    var ico = convCotEdit ? TILDE_SVG : LAPIZ_SVG; if(lp.innerHTML !== ico) lp.innerHTML = ico;
  }
  var mano = hay && convCotMano && calcNum('#convCot') > 0;
  if(cno){
    cno.hidden = !mano;
    if(mano) cno.innerHTML = 'La que pusiste vos, sólo para esta cuenta. <button type="button" class="linkbtn" data-convcothoy>Usar la de hoy (' + esc(moneyCot(cotDe(it))) + ')</button>';
  }
  if(!tiene(it)){
    var cm = calcNum('#convCot');
    if(!(cm > 0)){
      box.innerHTML = emptyBox('No tengo la cotización del ' + it.nombre + '. Con internet se baja sola; si no, escribila arriba.');
      if(n) n.textContent = ''; if(s2) s2.textContent = 'Con las cotizaciones de hoy';
      return;
    }
    t = { venta:cm };
  }
  var cot = mano ? calcNum('#convCot') : (hay ? cotDe(it) : t.venta);
  if(os && hay) os.textContent = moneyCot(cot);
  var usaVenta = !aOtra && !(t.compra > 0);
  var cada = it.otra ? 'cada ' + (it.otra === 'EUR' ? 'euro' : it.otra === 'BRL' ? 'real' : 'peso') : 'cada dólar';
  box.innerHTML = '<div class="lab">Son</div>'
    + '<div class="hero" style="margin-top:4px">' + esc(m > 0 ? (aOtra ? convFmt(m / cot, it) : money(m * cot)) : (aOtra ? convFmt(0, it) : '$ 0')) + '</div>'
    + '<div style="margin-top:12px">'
    + kv(it.n, moneyCot(cot), null, mano ? 'La que pusiste vos' : (aOtra ? 'Precio de venta: lo que te cobran por ' + cada : (usaVenta ? 'No tengo el de compra: uso el de venta' : 'Precio de compra: lo que te pagan por ' + cada)) + ' · ' + it.det)
    + '</div>';
  if(n) n.textContent = it.otra ? 'Las otras monedas van con la cotización oficial, la misma que muestra dolarhoy.'
                                : 'Arranca en el dólar que elegiste en Ajustes para valuar tus ahorros. Acá podés probar con cualquiera sin cambiarlo.';
  if(s2) s2.textContent = (t.fecha ? 'Cotización del ' + fechaLarga(t.fecha) : 'Con las cotizaciones de hoy');
}
/* v214: la flecha del medio da vuelta la cuenta. Las dos casillas se cruzan:
   se mide dónde estaba cada una, se cambian de lugar y se las hace viajar
   desde donde estaban (así se ve el cambio, no un salto). */
function convDarVuelta(){
  var a = $('#convPar .conv-pesos'), b = $('#convPar .conv-otra'), sw = $('#convSwap');
  var ra = a && a.getBoundingClientRect(), rb = b && b.getBoundingClientRect();
  convDir = convDir === 'ars' ? 'usd' : 'ars';
  convCotEdit = false; convCotMano = false;
  renderConv();
  var suave = a && b && a.animate && !(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  if(!suave) return;
  var na = a.getBoundingClientRect(), nb = b.getBoundingClientRect(), dur = 340, ease = 'cubic-bezier(.3,.7,.2,1)';
  // la que va para la derecha pasa por arriba, la otra por abajo: no se pisan
  a.animate([{ transform:'translateX(' + (ra.left - na.left) + 'px)', zIndex:2 }, { transform:'translateY(-6px) translateX(' + ((ra.left - na.left) / 2) + 'px)', zIndex:2, offset:.5 }, { transform:'none', zIndex:2 }], { duration:dur, easing:ease });
  b.animate([{ transform:'translateX(' + (rb.left - nb.left) + 'px)' }, { transform:'translateY(6px) translateX(' + ((rb.left - nb.left) / 2) + 'px)', offset:.5 }, { transform:'none' }], { duration:dur, easing:ease });
  if(sw) sw.animate([{ transform:'rotate(0)' }, { transform:'rotate(360deg)' }], { duration:dur, easing:ease });
}
/* La cotización que escribiste para una moneda que no tenía queda guardada para
   la próxima (igual que la de Ajustes). Cuando se baje la de internet, la pisa. */
function convGuardarCot(){
  var cm = calcNum('#convCot'), it = convItem(convTipo); if(!(cm > 0) || cm > 100000000 || !it) return;
  S.dolar = S.dolar || {}; S.dolar.tipos = S.dolar.tipos || {}; S.dolar.otras = S.dolar.otras || {};
  var dest = it.otra ? S.dolar.otras : S.dolar.tipos, k = it.otra || convTipo;
  if(dest[k] && dest[k].venta > 0) return;
  dest[k] = { venta:Math.round(cm * 100) / 100, fecha:today() };
  if(it.otra) dest[k].mano = 1;
  var ci = $('#convCot'); if(ci) ci.value = '';
  if(!it.otra && convTipo === tipoDolar()) aplicarTipoDolar(false);
  save(); render(); renderConv();
}

/* ---- horas extras ----
   Ley 20.744, art. 201: las horas de más se pagan con un 50% de recargo los días
   comunes y con un 100% los sábados después de las 13, los domingos y los
   feriados. El valor de la hora sale de dividir el sueldo por las horas normales
   del mes. El decreto 484/2000 pone un tope de 30 extras por mes. */
var hxTocado = false, hxModo = '50', hxPctTocado = false, hxEdit = null;
/* El recargo elegido: 50, 100, o el que escribiste en "Otro" (null si falta). */
function hxPctActual(){
  if(hxModo !== 'otro') return Number(hxModo);
  var t = (($('#hxOtro') || {}).value || '').trim(), v = parseMoney(t);
  return (t !== '' && v >= 0) ? Math.min(500, Math.round(v * 100) / 100) : null;
}
/* v191: en vez de acordarte a fin de mes cuántas hiciste, las vas anotando cada
   día: cuántas y con qué recargo (50%, 100% u otro que elijas). La cuenta del
   mes sale sola, sumando día por día. Lo anotado se guarda con tus datos (y se
   sincroniza con tus otros dispositivos). */
function hxDelMes(ym){
  return (S.hx || []).filter(function(x){ return ymOf(x.fecha) === ym && esMioCalc(x); })
    .sort(function(a, b){ return a.fecha === b.fecha ? b.ts - a.ts : (a.fecha < b.fecha ? 1 : -1); });
}
function hxHorasTxt(h){ var v = Math.round(h * 100) / 100; return String(v).replace('.', ',') + (v === 1 ? ' hora' : ' horas'); }
function hxPctTxt(p){ return fmtPct(p); }
/* "1,5", "2" o "1:30" */
function hxLeerHoras(t){
  t = String(t || '').trim();
  var m = t.match(/^(\d{1,2}):([0-5]?\d)$/);
  if(m) return parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
  return parseMoney(t);
}
function hxValorHora(){ var s = calcNum('#hxSueldo'), hs = calcNum('#hxHoras'); return (s > 0 && hs > 0) ? s / hs : 0; }
/* Un domingo se propone al 100%; el resto, al 50%. Si ya elegiste, no te lo cambio. */
function hxProponerPct(){
  if(hxPctTocado || hxEdit) return;
  var f = ($('#hxFecha') || {}).value || '';
  if(!f) return;
  var d = new Date(parseInt(f.slice(0,4),10), parseInt(f.slice(5,7),10) - 1, parseInt(f.slice(8,10),10)).getDay();
  hxModo = (d === 0) ? '100' : '50';
}
function hxPintarPct(){
  var otro = hxModo === 'otro', pct = hxPctActual();
  $$('#segHxPct button').forEach(function(b){
    b.setAttribute('aria-pressed', b.getAttribute('data-v') === hxModo ? 'true' : 'false');
  });
  var box = $('#hxOtroBox'); if(box) box.hidden = !otro;
  var pi = $('#hxPista'); if(!pi) return;
  var h = hxLeerHoras(($('#hxCant') || {}).value), vh = hxValorHora();
  var f = ($('#hxFecha') || {}).value || '';
  var dom = f && new Date(parseInt(f.slice(0,4),10), parseInt(f.slice(5,7),10) - 1, parseInt(f.slice(8,10),10)).getDay() === 0;
  pi.textContent = (otro && pct === null) ? 'Escribí el recargo: por ejemplo 75 si te pagan la hora un 75% más.'
    : (h > 0 && vh > 0)
    ? hxHorasTxt(h) + ' al ' + hxPctTxt(pct) + ': ' + money(h * vh * (1 + pct / 100))
    : (dom && !hxPctTocado ? 'Es domingo: te lo puse al 100%.' : '');
}
function hxSalirEdit(){
  var era = !!hxEdit;
  hxEdit = null;
  var c = $('#hxCant'); if(c) c.value = '';
  var f = $('#hxFecha'); if(f){ f.value = defaultFecha(); pintarFecha(f); }
  // el recargo que elegiste queda para el próximo día; al soltar una corrección, vuelve al de siempre
  if(era){ hxPctTocado = false; var o = $('#hxOtro'); if(o) o.value = ''; hxProponerPct(); }
}
function renderHx(){
  var inp = $('#hxSueldo'); if(!inp) return;
  if(!hxTocado){ var v = sueldoDelMes(mes) || ultimoSueldo(); inp.value = v > 0 ? enCampo(v) : ''; }
  var hs = $('#hxHoras'); if(hs && document.activeElement !== hs) hs.value = String(S.hxHoras || 200).replace('.', ',');
  var n = $('#hxNota');
  if(n) n.textContent = hxTocado ? 'Pusiste el sueldo vos.' : (inp.value ? 'Puse tu sueldo de ' + (sueldoDelMes(mes) > 0 ? ymLabel(mes) : 'lo último que cargaste') + '. Cambialo si no es ese.' : 'Poné tu sueldo mensual.');
  var f = $('#hxFecha');
  // el día propuesto es del mes que estás mirando
  if(f && !hxEdit && (!f.value || ymOf(f.value) !== mes)){ f.value = defaultFecha(); hxProponerPct(); }
  pintarFecha(f);
  $('#hxOk').textContent = hxEdit ? 'Guardar cambios' : 'Sumar horas';
  $('#hxCancelar').hidden = !hxEdit;
  hxPintarPct();
  // la lista del mes
  var l = hxDelMes(mes), vh = hxValorHora();
  $('#hxListaTit').textContent = 'Lo de ' + ymLabel(mes) + (l.length ? ' · ' + l.length + (l.length === 1 ? ' día' : ' días') : '');
  $('#hxLista').innerHTML = l.length ? l.map(function(x){
      return '<div class="row editable' + (hxEdit === x.id ? ' propuesta' : '') + '" data-hxedit="' + esc(x.id) + '" title="Tocá para corregirlo">'
        + '<span class="mark in">' + iconFor('in') + '</span>'
        + '<span class="t"><b>' + icoQ(x) + esc(hxHorasTxt(x.h)) + ' al ' + esc(hxPctTxt(x.pct)) + '</b><small>' + esc(fechaLabel(x.fecha)) + esc(quienTxt(x)) + '</small></span>'
        + '<span class="acts"><span class="amt neu">' + (vh > 0 ? esc(money(x.h * vh * (1 + x.pct / 100))) : '') + '</span>' + delBtn('hx', x.id) + '</span></div>';
    }).join('') : emptyBox('Todavía no anotaste horas extras en ' + ymLabel(mes));
  hxCalcular();
}
/* v247: las horas extras de un mes se anotan como ingreso de ese mes o del que
   viene. Si no lo elegiste: si cobrás el sueldo por quincena, ese mes; si no,
   el que viene (se pagan con el sueldo siguiente). */
function hxSueldoQuincena(ym){
  // v248: cualquier ingreso fijo que se cobre por quincena
  return (S.fijos || []).some(function(f){
    return f.tipo === 'ingreso' && esQuincena(f) && esMioCalc(f) && f.desde <= ym && (!f.hasta || f.hasta >= ym);
  });
}
function hxElegido(){ return S.hxMes === 'este' || S.hxMes === 'sig'; }
function hxCobroDe(ym){ return hxElegido() ? (S.hxMes === 'este' ? 0 : 1) : (hxSueldoQuincena(ym) ? 0 : 1); }
function hxMesCobro(ym){ return ymAdd(ym, hxCobroDe(ym)); }
function hxFechaCobro(ym){
  var c = hxMesCobro(ym), d = defaultFecha();
  if(c === ymOf(d)) return d;
  return c + '-' + pad(Math.min(new Date().getDate(), finDeMes(c)));
}
function hxCalcular(){
  var out = $('#hxOut'); if(!out) return;
  var s = calcNum('#hxSueldo'), hs = calcNum('#hxHoras'), l = hxDelMes(mes);
  if(!(s > 0) || !(hs > 0) || !l.length){ out.innerHTML = ''; out._d = null; return; }
  var vh = s / hs, por = {}, horas = 0, tot = 0;
  l.forEach(function(x){
    var k = String(x.pct); por[k] = por[k] || { pct:x.pct, h:0 };
    por[k].h += x.h; horas += x.h;
  });
  var grupos = Object.keys(por).map(function(k){ return por[k]; }).sort(function(a, b){ return a.pct - b.pct; });
  grupos.forEach(function(g){ g.m = g.h * vh * (1 + g.pct / 100); tot += g.m; });
  tot = Math.round(tot * 100) / 100;
  var ya = S.tx.some(function(x){ return x.hx === mes && esMioCalc(x); });
  out.innerHTML = '<div class="card"><div class="card-head"><div><h2>Por las horas extras de ' + esc(ymLabel(mes)) + ' cobrás</h2>'
    + '<p class="sub">' + hxHorasTxt(horas) + ' de más en ' + l.length + (l.length === 1 ? ' día' : ' días')
    + ' · las cobrás en ' + esc(ymLabel(hxMesCobro(mes))) + '</p></div></div>'
    + '<div class="hero">' + esc(money(tot)) + '</div>'
    /* la hora normal es la base de la cuenta, no algo que se suma: va chica, abajo del total */
    + '<p class="hero-base">Con tu hora normal de <b>' + esc(money(vh)) + '</b> (' + esc(money(s)) + ' ÷ ' + esc(hxHorasTxt(hs)) + ')</p>'
    + '<div style="margin-top:14px">'
    + grupos.map(function(g){ return kv('Al ' + hxPctTxt(g.pct), money(g.m), null, hxHorasTxt(g.h) + ' × ' + money(vh * (1 + g.pct / 100))); }).join('')
    + '</div>'
    + (horas > 30 ? '<p class="note warn" style="margin-top:10px">Ojo: la ley pone un tope de 30 horas extras por mes (y 200 por año).</p>' : '')
    + '<p class="note" style="margin-top:12px">Si tu convenio divide el sueldo por otras horas, cambiá las horas normales. Si pusiste el sueldo en mano, esto también es en mano.</p>'
    + '<div class="lab" style="margin-top:14px">Anotarlas en</div>'
    + '<div class="seg" id="segHxCobro" role="group" aria-label="En qué mes anotarlas" style="margin-top:4px">'
    + [[0, esc(ymLabel(mes))], [1, esc(ymLabel(ymAdd(mes, 1)))]].map(function(o){
        return '<button type="button" data-hxcobro="' + o[0] + '" aria-pressed="' + (hxCobroDe(mes) === o[0] ? 'true' : 'false') + '">' + o[1] + '</button>'; }).join('')
    + '</div>'
    + (hxElegido() ? '' : '<p class="note" style="margin:6px 0 0">'
        + (hxSueldoQuincena(mes) ? 'Como tenés un ingreso por quincena, te propongo este mes.' : 'Se suelen cobrar con el sueldo del mes que viene.') + '</p>')
    + calcAnotarHtml('hx', calcMedioDe('hx', 'hx', mes), '<button class="btn' + (ya ? ' ghost' : '') + '" type="button" data-hxanotar>' + (ya ? 'Actualizar lo que anoté' : 'Sumarlas a mis ingresos') + '</button>')
    + '<p class="note" style="margin-top:8px">Entra como ingreso de ' + esc(ymLabel(hxMesCobro(mes))) + ', en ' + esc(catSueldo()) + '.'
    + (ya ? ' Reemplaza lo que ya anotaste de este mes, así no se suma dos veces.' : ' Si después anotás más días, lo actualizás y se reemplaza.') + '</p></div>';
  out._d = { monto:tot, horas:horas };
}
document.addEventListener('submit', function(e){
  if(e.target.id !== 'hxForm') return;
  e.preventDefault();
  var h = Math.round(hxLeerHoras($('#hxCant').value) * 100) / 100;
  if(!(h > 0)){ toast('Poné cuántas horas hiciste'); $('#hxCant').focus(); return; }
  if(h > 24){ toast('Un día tiene 24 horas'); $('#hxCant').focus(); return; }
  var hxPct = hxPctActual();
  if(hxPct === null){ toast('Poné el recargo en porcentaje'); $('#hxOtro').focus(); return; }
  var fecha = $('#hxFecha').value || defaultFecha();
  S.hx = S.hx || [];
  var ed = null; if(hxEdit) S.hx.forEach(function(x){ if(x.id === hxEdit) ed = x; });
  if(ed){ ed.fecha = fecha; ed.h = h; ed.pct = hxPct; ed.ts = Date.now(); }
  else {
    var nuevo = { id:uid(), ts:Date.now(), fecha:fecha, h:h, pct:hxPct };
    if(miPersona()) nuevo.quien = miPersona();
    S.hx.push(nuevo);
  }
  var pctUsado = hxPct, eraEd = !!ed;
  save();
  if(ymOf(fecha) !== mes){ mes = ymOf(fecha); render(); syncFechas(); }
  var f = $('#hxFecha'), fGuard = fecha;
  hxSalirEdit();
  if(f && !eraEd){ f.value = fGuard; pintarFecha(f); }   // el próximo suele ser otro día cercano: dejo la fecha
  renderHx();
  toast((eraEd ? 'Corregido: ' : 'Anoté ') + hxHorasTxt(h) + ' al ' + hxPctTxt(pctUsado) + ' el ' + fechaLabel(fecha));
  if(!eraEd) try{ $('#hxCant').focus({ preventScroll:true }); }catch(x){}
});
document.addEventListener('input', function(e){
  var id = e.target.id || '';
  if(id === 'cycInf') cycInfTocada = true;
  if(/^cyc/.test(id)){ if(id === 'cycInf') cycPrepararInf(); cycCalcular(); return; }
  if(id === 'convMonto'){ renderConv(); return; }
  if(id === 'convTipo'){ convTipo = e.target.value; convCotEdit = false; convCotMano = false; var ci = $('#convCot'); if(ci) ci.value = ''; renderConv(); return; }
  if(id === 'convCot'){ var it0 = convItem(convTipo); if(it0 && it0.t && it0.t.venta > 0) convCotMano = true; renderConv(); return; }
  if(id === 'hxSueldo'){ hxTocado = true; var nh = $('#hxNota'); if(nh) nh.textContent = 'Pusiste el sueldo vos.'; }
  if(id === 'hxHoras'){ var vhh = parseMoney(e.target.value); if(vhh > 0 && vhh <= 400){ S.hxHoras = vhh; save(); } }
  if(id === 'hxSueldo' || id === 'hxHoras'){ renderHxLista(); return; }
  if(id === 'hxCant' || id === 'hxOtro'){ hxPintarPct(); return; }
});
document.addEventListener('change', function(e){
  if(e.target.id === 'convCot') convGuardarCot();
  if(e.target.id === 'hxFecha'){ hxProponerPct(); hxPintarPct(); }
  if(e.target.id === 'hxMedio') calcMedio.hx = e.target.value;
});
/* Los montos de la lista dependen del sueldo y de las horas normales: se repintan
   sin tocar lo que estás escribiendo en esos campos. */
function renderHxLista(){
  var vh = hxValorHora();
  $$('#hxLista [data-hxedit]').forEach(function(r){
    var x = null; (S.hx || []).forEach(function(y){ if(y.id === r.getAttribute('data-hxedit')) x = y; });
    var a = r.querySelector('.amt'); if(x && a) a.textContent = vh > 0 ? money(x.h * vh * (1 + x.pct / 100)) : '';
  });
  hxPintarPct(); hxCalcular();
}
document.addEventListener('click', function(e){
  if(!e.target.closest) return;
  var t;
  if((t = e.target.closest('[data-cycir]'))){ cycIrACargar(t.getAttribute('data-cycir')); return; }
  // v212: borra lo cargado y vuelve a como estaba al entrar (12 cuotas, la inflación del INDEC)
  if(e.target.closest('#cycLimpiar')){
    ['#cycQue', '#cycContado', '#cycTotal'].forEach(function(q){ var el = $(q); if(el) el.value = ''; });
    var cn = $('#cycN'); if(cn) cn.value = '12';
    cycInfTocada = false; cycInfEdit = false; cycPintarLapiz(); cycPrepararInf(); cycCalcular();
    return;
  }
  if(e.target.closest('[data-cycipc]')){ cycInfTocada = false; cycInfEdit = false; cycPintarLapiz(); cycPrepararInf(); cycCalcular(); return; }
  if(e.target.closest('[data-cycinfedit]')){
    cycInfEdit = !cycInfEdit; cycPintarLapiz();
    var ci = $('#cycInf'); if(cycInfEdit && ci) try{ ci.focus(); ci.select(); }catch(x){}
    return;
  }
  if(e.target.closest('#convSwap')){ convDarVuelta(); return; }
  if(e.target.closest('#convCotLapiz')){
    convCotEdit = !convCotEdit; renderConv();
    var cc = $('#convCot'); if(convCotEdit && cc) try{ cc.focus(); cc.select(); }catch(x){}
    return;
  }
  if(e.target.closest('[data-convcothoy]')){ convCotEdit = false; convCotMano = false; renderConv(); return; }
  if(e.target.closest('[data-hxanotar]')){
    var h = $('#hxOut')._d; if(!h) return;
    anotarIngreso({ monto:h.monto, fecha:hxFechaCobro(mes), medio:($('#hxMedio') || {}).value, nota:'Horas extras de ' + ymLabel(mes) + ' (' + hxHorasTxt(h.horas) + ')' }, 'hx', mes);
    renderHx();
    toast('Sumé ' + money(h.monto) + ' de horas extras de ' + ymLabel(mes) + ' a tus ingresos de ' + ymLabel(hxMesCobro(mes)) + ', en ' + calcMedioDe('hx', 'hx', mes));
    return;
  }
  if((t = e.target.closest('[data-hxcobro]'))){
    S.hxMes = t.getAttribute('data-hxcobro') === '0' ? 'este' : 'sig';
    save(); hxCalcular(); return;
  }
  if((t = e.target.closest('#segHxPct button'))){
    var v = t.getAttribute('data-v');
    hxPctTocado = true;
    hxModo = v; hxPintarPct();
    if(v === 'otro'){ var oi = $('#hxOtro'); if(oi) try{ oi.focus(); }catch(x){} }
    return;
  }
  if(e.target.closest('#hxCancelar')){ hxSalirEdit(); renderHx(); return; }
  if((t = e.target.closest('[data-hxedit]')) && !e.target.closest('.acts')){
    var idE = t.getAttribute('data-hxedit');
    if(hxEdit === idE){ hxSalirEdit(); renderHx(); return; }
    var xe = null; (S.hx || []).forEach(function(y){ if(y.id === idE) xe = y; });
    if(!xe) return;
    hxEdit = idE; hxPctTocado = true;
    hxModo = (xe.pct === 50 || xe.pct === 100) ? String(xe.pct) : 'otro';
    $('#hxFecha').value = xe.fecha; $('#hxCant').value = String(xe.h).replace('.', ',');
    $('#hxOtro').value = (xe.pct !== 50 && xe.pct !== 100) ? String(xe.pct).replace('.', ',') : '';
    renderHx();
    try{ $('#hxForm').scrollIntoView({ block:'center' }); $('#hxCant').focus({ preventScroll:true }); }catch(x){}
    return;
  }
});
/* Al entrar a cada calculadora se rellenan los datos que la app ya sabe. */
function abrirCalc(v){
  if(v === 'cyc'){ cycInfEdit = false; cycPintarLapiz(); cycPrepararInf(); cycCalcular(); }
  if(v === 'conv') renderConv();
  if(v === 'hext') renderHx();
}
