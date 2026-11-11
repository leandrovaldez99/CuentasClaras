/* Cuentas Claras · js/dividir-gastos.js
   Dividir gastos: quién puso cuánto y quién le pasa a quién.

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

/* ---------- divisor de gastos ---------- */
var SPLIT_KEY = 'plata-clara-split';
var amigos = (function(){
  try{ var v = JSON.parse(localStorage.getItem(SPLIT_KEY)); if(Array.isArray(v) && v.length) return v; }catch(e){}
  return [{n:'Yo',p:''},{n:'',p:''}];
})();
function leerAmigos(){
  var rows = $$('#splitRows .splitrow');
  if(rows.length) amigos = rows.map(function(r){
    return { n:r.querySelector('[data-nom]').value, p:r.querySelector('[data-pago]').value };
  });
  return amigos;
}
/* v250: mientras corregís un gasto viejo no se pisa lo que estabas dividiendo:
   queda guardado aparte (`splitBorrador`) y vuelve al terminar. */
function guardarAmigos(){ if(splitEdit) return; try{ localStorage.setItem(SPLIT_KEY, JSON.stringify(amigos)); }catch(e){} }
var splitBorrador = null;
function splitFoto(){
  var v = function(id){ var el = $(id); return el ? el.value : ''; };
  return { amigos:JSON.parse(JSON.stringify(leerAmigos())), pag:Object.assign({}, splitPag), calc:!!($('#splitOut') && $('#splitOut').innerHTML),
           yo:v('#splitYo'), cat:v('#splitCat'), medio:v('#splitMedio'), nota:v('#splitNota') };
}
function splitVolverBorrador(){
  var b = splitBorrador; splitBorrador = null; splitEdit = null;
  if(!b){ splitPag = {}; $('#splitOut').innerHTML = ''; renderAmigos(); return; }
  amigos = b.amigos; splitPag = b.pag || {};
  renderAmigos(); guardarAmigos();
  $('#splitOut').innerHTML = '';
  if(b.calc){
    calcular();
    var put = function(id, val){ var el = $(id); if(el && val !== '' && [].some.call(el.options || [], function(o){ return o.value === val; })) el.value = val; };
    put('#splitYo', b.yo); put('#splitCat', b.cat); put('#splitMedio', b.medio);
    if($('#splitNota')) $('#splitNota').value = b.nota || '';
    splitPintar();
  }
}
function renderAmigos(){
  $('#splitRows').innerHTML = amigos.map(function(a,i){
    return '<div class="splitrow">'
      + '<input data-nom type="text" placeholder="Nombre" autocomplete="off" value="'+esc(a.n)+'">'
      + '<input data-pago class="money-in" type="text" inputmode="decimal" placeholder="0" autocomplete="off" value="'+esc(a.p)+'">'
      + '<button class="iconbtn" data-rm="'+i+'" type="button" aria-label="Sacar a esta persona">'
      + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg></button>'
      + '</div>';
  }).join('');
}
/* v249: `splitPag` = los que ya te pagaron (por nombre). Los que no tildás
   (por ejemplo, porque invitabas vos) se suman a tu gasto. `splitEdit` = el
   gasto de Movimientos que se está corrigiendo desde acá. */
var splitPag = {}, splitEdit = null;
var SPLIT_TICK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
function splitCuenta(){
  var o = $('#splitOut'), sa = (o && o._saldos) || [], pa = (o && o._pases) || [];
  var k = parseInt(($('#splitYo') || {}).value, 10) || 0, yo = sa[k]; if(!yo) return null;
  var extra = 0, quienes = [];
  pa.forEach(function(t){ if(t.a === yo.nombre && !splitPag[t.de]){ extra += t.monto; quienes.push(t.de); } });
  return { k:k, yo:yo, parte:yo.toca, extra:extra, quienes:quienes, total:Math.round((yo.toca + extra) * 100) / 100,
           aMi:pa.filter(function(t){ return t.a === yo.nombre; }).length };
}
function splitPintar(){
  var c = splitCuenta(); if(!c) return;
  $$('#splitOut .settle[data-de]').forEach(function(r){
    var de = r.getAttribute('data-de'), paraMi = r.getAttribute('data-a') === c.yo.nombre, b = r.querySelector('[data-splitpago]');
    if(b){ b.hidden = !paraMi; b.setAttribute('aria-pressed', splitPag[de] ? 'true' : 'false'); }
    r.classList.toggle('pagado', paraMi && !!splitPag[de]);
    var pg = r.querySelector('.pago-ok'); if(pg) pg.hidden = !(paraMi && splitPag[de]);
  });
  var h = $('#splitTildar'); if(h) h.hidden = !c.aMi;
  var su = $('#splitSuma'); if(!su) return;
  var y = function(l){ return l.length === 1 ? l[0] : l.slice(0, -1).join(', ') + ' y ' + l[l.length - 1]; };
  su.innerHTML = 'Se suma a tus gastos: <b>' + esc(money(c.total)) + '</b>'
    + (c.extra > 0.004 ? '<br>Tu parte (' + esc(money(c.parte)) + ') más lo de ' + esc(y(c.quienes)) + ' (' + esc(money(c.extra)) + '), que ' + (c.quienes.length === 1 ? 'no te pagó' : 'no te pagaron') + '.'
                       : (c.aMi ? '<br>Sólo tu parte: los demás ya te pagaron.' : '<br>Es lo que te tocaba pagar.'));
}
function calcular(){
  var lista = leerAmigos().map(function(a,i){
    return { nombre: (a.n||'').trim() || ('Persona '+(i+1)), pago: parseMoney(a.p) };
  }).filter(function(a,i){ return (a.pago>0) || (amigos[i].n||'').trim(); });

  if(lista.length < 2){ $('#splitOut').innerHTML = ''; toast('Cargá al menos dos personas'); return; }
  var total = lista.reduce(function(x,a){ return x + a.pago; }, 0);
  if(total <= 0){ $('#splitOut').innerHTML = ''; toast('Alguien tiene que haber puesto plata'); return; }
  var unidad = total / lista.length;

  var saldos = lista.map(function(a){ return { nombre:a.nombre, pago:a.pago, toca: unidad, dif: a.pago - unidad }; });
  var deben = saldos.filter(function(x){ return x.dif < -0.01; }).map(function(x){ return {nombre:x.nombre, m:-x.dif}; }).sort(function(a,b){ return b.m-a.m; });
  var cobran = saldos.filter(function(x){ return x.dif > 0.01; }).map(function(x){ return {nombre:x.nombre, m:x.dif}; }).sort(function(a,b){ return b.m-a.m; });
  var pases = [], i=0, j=0, guard=0;
  while(i < deben.length && j < cobran.length && guard++ < 200){
    var m = Math.min(deben[i].m, cobran[j].m);
    if(m > 0.01) pases.push({ de:deben[i].nombre, a:cobran[j].nombre, monto:m });
    deben[i].m -= m; cobran[j].m -= m;
    if(deben[i].m <= 0.01) i++;
    if(cobran[j].m <= 0.01) j++;
  }

  var html = '<div class="card" style="margin-top:14px">'
    + '<div class="card-head"><div><h2>Cómo se salda</h2><p class="sub">Total '+esc(money(total))+' entre '+lista.length+' personas</p></div></div>';
  // lo que le tocaba a cada uno, una vez y arriba de quién le pasa a quién
  // (lo que puso cada uno ya está en las casillas: no se repite abajo)
  html += '<div class="lab" style="margin-bottom:6px">A cada uno le tocaba '+esc(money(unidad))+'</div>';
  html += pases.length
    ? '<p class="note" id="splitTildar" style="margin:0 0 4px">Tildá a los que ya te pagaron. Si alguno no te paga (por ejemplo, porque lo invitaste), dejalo sin tildar y se suma a tu gasto.</p>'
      + pases.map(function(t){
        return '<div class="settle" data-de="'+esc(t.de)+'" data-a="'+esc(t.a)+'"><span class="who">'
             + '<button type="button" class="tick" data-splitpago="'+esc(t.de)+'" aria-pressed="false" aria-label="'+esc(t.de)+' ya me pagó" title="Ya me pagó">'+SPLIT_TICK+'</button>'
             + '<em>'+esc(t.de)+'</em><span class="arrow">le pasa a</span><em>'+esc(t.a)+'</em><span class="pago-ok" hidden>ya pagó</span></span>'
             + '<span class="amt2">'+esc(montoTxt(t))+'</span></div>';
      }).join('')
    : '<div class="empty">Ya está parejo: nadie le debe nada a nadie.</div>';
  html += '<div class="hr"></div><div class="lab" style="margin-bottom:10px">Cargar tu parte como gasto</div>'
    + '<div class="splitform">'
    + '<div class="field c2"><label class="lab" for="splitYo">Vos sos</label>'
    + '<select id="splitYo">'+saldos.map(function(x,k){ return '<option value="'+k+'"'+(k===0?' selected':'')+'>'+esc(x.nombre)+'</option>'; }).join('')+'</select></div>'
    + '<div class="field c2"><label class="lab" for="splitCat">Categoría</label><select id="splitCat">'
    + S.catGasto.map(function(c){ return '<option'+(c==='Comida afuera'?' selected':'')+'>'+esc(c)+'</option>'; }).join('')+'</select></div>'
    + '<div class="field c2"><label class="lab" for="splitMedio">Medio de pago</label><select id="splitMedio">'
    + opcionesMedio('Efectivo')+'</select></div>'
    + '<div class="field c4"><label class="lab" for="splitNota">Detalle</label>'
    + '<input id="splitNota" type="text" autocomplete="off" placeholder="Opcional: cena con amigos, asado en lo de Nico…"></div>'
    + '<div class="field c2" style="align-self:end"><button class="btn'+(splitEdit ? '' : ' ghost')+'" id="splitToGasto" type="button">'+(splitEdit ? 'Guardar el gasto' : 'Sumar a mis gastos')+'</button></div></div>'
    + '<div class="split-suma" id="splitSuma"></div>'
    + (splitEdit ? '<div class="rowflex" style="margin-top:10px"><button class="btn ghost sm" id="splitCancelEdit" type="button">Cancelar la corrección</button></div>'
                 : '<p class="note" style="margin-top:8px">Entra como un gasto de '+esc(ymLabel(mes))+'.</p>')
    + '</div>';
  $('#splitOut').innerHTML = html;
  $('#splitOut')._saldos = saldos;
  $('#splitOut')._pases = pases;
  $('#splitOut')._lista = lista;
  splitPintar();
  guardarAmigos();
}
document.addEventListener('click', function(e){
  if(e.target.closest('#addAmigo')){ leerAmigos(); amigos.push({n:'',p:''}); guardarAmigos(); renderAmigos(); 
    var ins = $$('#splitRows [data-nom]'); if(ins.length) ins[ins.length-1].focus(); return; }
  if(e.target.closest('#clearSplit')){
    // corrigiendo un gasto viejo, "Limpiar" es dejar la corrección y volver a lo que estabas dividiendo
    if(splitEdit){ splitVolverBorrador(); toast('Volviste a lo que estabas dividiendo'); return; }
    amigos = [{n:'Yo',p:''},{n:'',p:''}]; splitPag = {}; guardarAmigos(); renderAmigos(); $('#splitOut').innerHTML=''; return;
  }
  var sp = e.target.closest('[data-splitpago]');
  if(sp){ var dn = sp.getAttribute('data-splitpago'); if(splitPag[dn]) delete splitPag[dn]; else splitPag[dn] = 1; splitPintar(); return; }
  if(e.target.closest('#splitCancelEdit')){ splitVolverBorrador(); go('mov'); return; }
  if(e.target.closest('#calcSplit')){ calcular(); return; }
  var rm = e.target.closest('[data-rm]');
  if(rm){
    leerAmigos();
    if(amigos.length <= 2){ toast('Tienen que quedar al menos dos'); return; }
    amigos.splice(parseInt(rm.getAttribute('data-rm'),10), 1);
    guardarAmigos(); renderAmigos(); return;
  }
  if(e.target.closest('#splitToGasto')){
    var c = splitCuenta(); if(!c) return;
    var lista = $('#splitOut')._lista || [];
    var nota = ($('#splitNota') ? $('#splitNota').value.trim() : '') || 'Mi parte de un gasto compartido';
    // v249: el gasto se acuerda de la división, para poder corregirla desde Movimientos
    var div = { p:lista.map(function(a){ return { n:a.nombre, m:a.pago }; }), yo:c.k,
                pag:Object.keys(splitPag).filter(function(n){ return lista.some(function(a){ return a.nombre === n; }); }) };
    var datos = { monto:c.total, cat:$('#splitCat').value, medio:($('#splitMedio') ? $('#splitMedio').value : 'Efectivo'), nota:nota, split:div };
    var ed = null; if(splitEdit) S.tx.forEach(function(x){ if(x.id === splitEdit) ed = x; });
    if(ed){
      Object.keys(datos).forEach(function(k2){ ed[k2] = datos[k2]; }); ed.ts = Date.now();
      save(); splitVolverBorrador(); render(); go('mov'); toast('Gasto corregido: ' + money(c.total));
    } else {
      var nt = { id:uid(), ts:Date.now(), tipo:'gasto', fecha:defaultFecha() };
      Object.keys(datos).forEach(function(k2){ nt[k2] = datos[k2]; });
      if(miPersona()) nt.quien = miPersona();
      S.tx.push(nt);
      save(); render(); toast('Sumé ' + money(c.total) + ' a tus gastos');
    }
    return;
  }
});
$('#splitRows').addEventListener('change', function(){ leerAmigos(); guardarAmigos(); });
document.addEventListener('change', function(e){ if(e.target && e.target.id === 'splitYo') splitPintar(); });
/* v249: corregir desde Movimientos un gasto que salió de Dividir gastos: vuelve
   la lista con lo que puso cada uno, la categoría, el medio y los tildes. */
function splitAbrirGasto(t){
  var d = t.split;
  if(!splitEdit) splitBorrador = splitFoto();     // lo que estabas dividiendo, para después
  splitEdit = t.id; splitPag = {};
  (d.pag || []).forEach(function(n){ splitPag[n] = 1; });
  amigos = d.p.map(function(a){ return { n:a.n, p:a.m > 0 ? enCampo(a.m) : '' }; });
  renderAmigos(); go('dividir'); calcular();
  var yo = $('#splitYo'); if(yo && d.yo >= 0 && d.yo < d.p.length) yo.value = String(d.yo);
  if($('#splitCat') && t.cat){ if(![].some.call($('#splitCat').options, function(o){ return o.value === t.cat; })) $('#splitCat').insertAdjacentHTML('beforeend', '<option>' + esc(t.cat) + '</option>'); $('#splitCat').value = t.cat; }
  if($('#splitMedio') && t.medio) $('#splitMedio').value = t.medio;
  if($('#splitNota')) $('#splitNota').value = t.nota || '';
  splitPintar();
  try{ $('#splitOut').scrollIntoView({ block:'start' }); }catch(x){}
}
