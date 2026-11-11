/* Cuentas Claras · js/cuotas.js
   La pantalla de compras en cuotas.

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

/* ---- cuotas ---- */
/* v241: sumarse a las cuotas que le quedan a una compra de otro. Desde la
   próxima que se debita, es a medias con el reparto del grupo. */
var sumArmado = '';
function planProxYm(p){
  var ym = ymNow(), n = Number(p.n) || 1;
  if(today() >= fechaCuota(p, ym)) ym = ymAdd(ym, 1);
  if(ym < p.desde) ym = p.desde;
  return ymDiff(p.desde, ym) < n ? ym : '';
}
function planSumable(p){
  var yo = miPersona();
  return !!(hayGrupo() && yo && quienDe(p) !== yo && !(Array.isArray(p.med) && p.med.length > 1) && planProxYm(p));
}
function sumarmeHtml(p){
  if(!planSumable(p)) return '';
  var ym = planProxYm(p), arm = sumArmado === p.id;
  return '<div class="l3"><button type="button" class="btn sm ico' + (arm ? ' armado' : ' ghost acc') + '" data-sumplan="' + esc(p.id) + '">'
    + (arm ? 'Tocá otra vez: pagás tu parte desde la cuota de ' + esc(ymLabel(ym))
           : ICO_VARIOS + 'Sumarme a las cuotas que quedan') + '</button></div>';
}
function sumarmePlan(id){
  var p = null; S.planes.forEach(function(x){ if(x.id === id) p = x; });
  if(!p || !planSumable(p)) return;
  if(sumArmado !== id){ sumArmado = id; renderCuotas(); return; }
  sumArmado = '';
  var ym = planProxYm(p), yo = miPersona(), dueno = quienDe(p);
  p.quien = dueno; p.med = [dueno, yo];
  if(ym > p.desde) p.medDesde = ym; else delete p.medDesde;
  save(); render();
  toast('Te sumaste a ' + (p.desc || 'esa compra') + ': desde la cuota de ' + ymLabel(ym) + ' te toca el ' + pctTxt(repartoDe(p.med, ym, p.rep)[yo]));
}
function renderCuotas(){
  var cm = cuotasDe(mes), tot = cm.reduce(function(a,b){return a+b.monto;},0);
  var cmPend = sumaPend(cm);
  var d = deudaRestante(mes);
  $('#cMes').textContent = money(tot);
  $('#cMesM').textContent = cm.length
    ? (cm.length+(cm.length===1?' cuota activa':' cuotas activas')
       + (cmPend > 0 ? ' · ' + money(cmPend) + ' sin debitar' : ''))
    : 'Ninguna cuota este mes';
  $('#cDeuda').textContent = money(d.total);
  $('#cDeudaM').textContent = 'Desde '+ymLabel(mes)+' en adelante';
  $('#cAct').textContent = String(d.planes);
  $('#cActM').textContent = d.planes===1 ? 'compra en curso' : 'compras en curso';
  $('#cFin').textContent = d.ultimo ? ymLabel(d.ultimo,true) : '—';
  $('#cFinM').textContent = d.ultimo ? 'Última cuota de todas' : 'No tenés cuotas pendientes';

  var sub = $('#cuotaSub');
  if(sub) sub.textContent = S.planes.length ? 'Tocá una para editarla' : 'Cuánto llevás pagado y cuánto falta';
  var el = $('#cuotaList');
  if(!S.planes.length){ el.innerHTML = emptyBox('Todavía no cargaste ninguna compra en cuotas'); return; }
  var planes = S.planes.filter(function(p){ return pesoDe(p, mes) > 0; })
    .sort(function(a,b){ return ymAdd(a.desde, a.n) < ymAdd(b.desde, b.n) ? 1 : -1; });
  if(!planes.length){ el.innerHTML = emptyBox('Ninguna compra en cuotas de ' + nombrePersona(verDe())); return; }
  el.innerHTML = planes.map(function(p){
    var wq = pesoDe(p, mes);
    var n = Number(p.n)||1, i = ymDiff(p.desde, mes);
    var pagadas = cuotasPagadas(p, mes);
    var pend = n - pagadas;
    var cuota = cuotaMonto(p) * wq;
    var pctv = Math.round(pagadas/n*100);
    var fin = ymAdd(p.desde, n-1);
    var porVencer = (i >= 0 && i < n && todaviaNoLlego(fechaCuota(p, mes), mes));
    var estado = pend===0 ? '<span class="pill ok">Terminada</span>'
      : (i<0 ? '<span class="pill near">Arranca en '+esc(ymLabel(p.desde,true))+'</span>'
             : (porVencer
                ? '<span class="pill near">Se debita el '+diaCuota(p, mes)+'</span>'
                : '<span class="pill near">'+pend+(pend===1?' cuota':' cuotas')+' por pagar</span>'));
    return '<div class="bud editable" data-plan="'+esc(p.id)+'" title="Tocá para editarla">'
      + '<div class="l1"><b>'+icoQ(p, mes)+esc(p.desc)+'</b><span class="rowflex" style="gap:8px">'+estado+delBtn('plan',p.id)+'</span></div>'
      + '<div class="prog'+(pend===0?'':'')+'"><i style="width:'+pctv+'%;background:'+(pend===0?'var(--in)':'var(--cuota)')+'"></i></div>'
      + '<div class="l2"><span>'+esc(money(cuota))+' × '+n+' · vence el '+diaCuota(p, mes)+' · '+esc(p.cat||'Otros')+(p.medio?' · '+esc(p.medio):'')+esc(quienTxt(p))+esc(medTxt(p, mes, cuotaMonto(p)))+'</span>'
      + '<span>'+pagadas+'/'+n+' · falta '+esc(money(pend*cuota))+' · hasta '+esc(ymLabel(fin,true))+'</span></div>'
      + sumarmeHtml(p)
      + '</div>';
  }).join('');
}
