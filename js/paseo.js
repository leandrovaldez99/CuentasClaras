/* Cuentas Claras · js/paseo.js
   El paseo guiado para quien abre la app por primera vez.

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

/* ---------- v223: el paseo ----------
   La primera vez que se abre la app sin nada cargado, un foco recorre los
   botones de verdad con un globito corto, y la pantalla de atrás va cambiando
   a la sección de la que habla. Se puede saltear, y volver a ver desde Ajustes.
   Que ya lo viste queda en este dispositivo. */
var PASEO_KEY = 'plata-clara-paseo';
var PZ_MES = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>';
function pzNav(go){ return ['.tabs [data-go="' + go + '"]', '.rail [data-go="' + go + '"]']; }
/* v245: cada paso con su escenita (`demo`) y lo que se puede hacer (`l`). */
var PZ_SVG = {
  ok:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.6 2.5L16 9.5"/></svg>',
  baja:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
  sube:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 19V5M6 11l6-6 6 6"/></svg>',
  tarj:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="2" y="5" width="20" height="14" rx="2.5"/><path d="M2 10h20"/></svg>',
  meta:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v18M5 8l7-5 7 5M5 8v8l7 5 7-5V8"/></svg>',
  fam:'<svg viewBox="0 0 22 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="5" cy="5.6" r="2"/><path d="M1 13.6c0-2.2 1.7-3.6 3.6-3.6"/><circle cx="17" cy="5.6" r="2"/><path d="M21 13.6c0-2.2-1.7-3.6-3.6-3.6"/><circle cx="11" cy="4.8" r="2.5"/><path d="M6.4 14.2c0-2.8 2-4.5 4.6-4.5s4.6 1.7 4.6 4.5"/></svg>',
  cal:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>',
  div:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="6" r="1.6"/><circle cx="12" cy="18" r="1.6"/><path d="M5 12h14"/></svg>',
  conv:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h13l-3-3M20 16H7l3 3"/></svg>',
  avion:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M10.5 13.5L3 11l1.5-1.5 8 .5 4-4.5a2 2 0 013 3l-4.5 4 .5 8L14 22l-2.5-7.5-3 3V20l-1.5 1-1-3.5L2.5 16l1-1.5h2.5z"/></svg>',
  luna:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/></svg>',
  mic:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0013 0M12 17.5V21"/></svg>'
};
function pzConMic(){ return !!(vozHayMic() && pzBlanco({ sel:['.tabs .fab > span'] })); }
function pzDemo(k){
  var V = PZ_SVG, mes = function(d){ return ymLabel(ymAdd(ymNow(), d)).split(' ')[0].replace(/^./, function(c){ return c.toUpperCase(); }); };
  if(k === 'hola') return '<div class="dm dm-hola">'
    + '<span class="dm-card"><i class="dm-dot out">' + V.baja + '</i>Gastos</span>'
    + '<span class="dm-card"><i class="dm-dot cu">' + V.tarj + '</i>Cuotas</span>'
    + '<span class="dm-card"><i class="dm-dot in">' + V.meta + '</i>Ahorros</span>'
    + '<span class="dm-card"><i class="dm-dot cu" style="color:var(--acc);background:var(--acc-soft)">' + V.fam + '</i>En familia</span></div>';
  if(k === 'carga') return '<div class="dm dm-carga' + (pzConMic() ? ' con-mic' : '') + '">'
    + '<div class="dm-in"><span class="dm-tipea">$ 15.000</span><i class="dm-cursor"></i><span class="dm-cat">Súper</span></div>'
    + (pzConMic() ? '<span class="dm-mic">' + V.mic + '</span>' : '')
    + '<div class="dm-card"><div class="dm-fila"><i class="dm-dot out">' + V.baja + '</i><b>Súper</b><em class="out">− $ 15.000</em></div></div></div>';
  if(k === 'mes') return '<div class="dm dm-mes"><div class="dm-mesn">‹<span><i>' + esc(mes(0)) + '</i><i>' + esc(mes(1)) + '</i><i>' + esc(mes(2)) + '</i></span>›</div>'
    + '<div class="dm-barra e"><span>Entró</span><s><i></i></s><em class="in">$ 850.000</em></div>'
    + '<div class="dm-barra g"><span>Salió</span><s><i></i></s><em class="out">$ 560.000</em></div></div>';
  if(k === 'mov') return '<div class="dm dm-mov"><div class="dm-chips"><span>Todo</span><span class="f">Súper</span><span>Salidas</span></div>'
    + '<div class="dm-card"><div class="dm-fila"><i class="dm-dot out">' + V.baja + '</i><b>Cine</b><em class="out">− $ 12.000</em></div>'
    + '<div class="dm-fila"><i class="dm-dot out">' + V.baja + '</i><b>Súper del mes</b><em class="out">− $ 84.500</em></div></div></div>';
  if(k === 'cuotas') return '<div class="dm dm-cuo"><div class="dm-card"><div class="dm-top"><i class="dm-dot cu">' + V.tarj + '</i>Heladera'
    + '<em><i>3 de 6</i><i>4 de 6</i><i>5 de 6</i></em></div><div class="dm-prog"><i></i></div><small>$ 100.000 por mes · hasta marzo</small></div></div>';
  if(k === 'ahorro') return '<div class="dm dm-aho"><span class="dm-moneda">$</span><div class="dm-card"><div class="dm-top">Vacaciones<em>US$ 680 de 1.000</em></div>'
    + '<div class="dm-prog"><i></i></div></div></div>';
  if(k === 'tools') return '<div class="dm dm-her">'
    + '<span class="dm-card">' + V.cal + 'Fijos</span><span class="dm-card">' + V.div + 'Dividir</span>'
    + '<span class="dm-card">' + V.conv + 'Monedas</span><span class="dm-card">' + V.avion + 'Viajes</span></div>';
  if(k === 'ajustes') return '<div class="dm dm-aju">'
    + '<span class="dm-card">' + V.luna + 'Oscuro<i class="dm-sw"></i></span>'
    + '<span class="dm-card">Categorías<span class="dm-cats"><i style="background:#E07A5F"></i><i style="background:#3E82D0"></i><i style="background:#E9B949"></i></span></span>'
    + '<span class="dm-card dm-ancho">' + V.tarj + 'Tus tarjetas y medios de pago</span></div>';
  return '';
}
var PASOS = [
  { t:'¡Hola! Esto es Cuentas Claras', d:'Lo que entra, lo que sale, las cuotas y lo que ahorrás, en un solo lugar. Te muestro todo en un minuto.', logo:true, demo:'hola' },
  { t:'Cargá lo que gastás', d:'Con el + cargás cualquier cosa en segundos.', sel:['.tabs .fab > span', '.rail .railcargar'], demo:'carga',
    l:function(){ return ['Gastos e ingresos, en pesos o en dólares', 'Compras en cuotas: cada mes aparece la que toca',
      pzConMic() ? (vozAlSoltar() ? 'O dictalo: mantené apretado el +, soltalo y decí «gasté 15 mil en el súper»' : 'O dictalo: mantené apretado el + y decí «gasté 15 mil en el súper»')
                 : 'Elegís la categoría y con qué pagaste, y listo']; } },
  { t:'Tu mes de un vistazo', d:'Con las flechas pasás de un mes a otro.', sel:['.topbar .month'], vista:'resumen', ico:PZ_MES, demo:'mes',
    l:['Cuánto entró, cuánto salió y cuánto te queda', 'En qué se te va la plata, por categoría', 'Topes por categoría que te avisan antes de pasarte'] },
  { t:'Todos tus movimientos', d:'La lista completa de cada mes.', sel:pzNav('mov'), vista:'mov', demo:'mov',
    l:['Tocá cualquiera para corregirlo o borrarlo', 'Filtrá gastos, ingresos o una categoría'] },
  { t:'Cuotas bajo control', d:'Todas tus compras en cuotas, juntas.', sel:pzNav('cuotas'), vista:'cuotas', demo:'cuotas',
    l:['Cuánto pagás este mes entre todas las tarjetas', 'Cuántas te faltan y cuándo terminás cada una', 'Cuánto debés en total'] },
  { t:'Ahorrá con metas', d:'Ponele nombre y un objetivo, y andá sumando.', sel:pzNav('ahorro'), vista:'ahorro', demo:'ahorro',
    l:['En pesos o en dólares', 'Cada aporte suma y ves cuánto te falta', 'Si sacás, también queda anotado'] },
  { t:'Herramientas', d:'Cosas que te ahorran cuentas.', sel:pzNav('tools'), vista:'tools', demo:'tools',
    l:['Fijos y suscripciones: aparecen solos cada mes', 'Dividir gastos, viajes con amigos y grupo familiar', '¿Cuotas o contado?, conversor de monedas y horas extras'] },
  { t:'A tu medida', d:'Dejala como más te sirva.', sel:pzNav('ajustes'), vista:'ajustes', demo:'ajustes',
    l:['Tus categorías, tarjetas y medios de pago', 'Modo claro u oscuro', 'Una copia de tus datos, y tus otros dispositivos'] }
];
var pzI = 0, pzAbierto = false, pzDesde = 'resumen', pzFocoAntes = null;
function pzVisto(){ try{ return !!localStorage.getItem(PASEO_KEY); }catch(e){ return false; } }
function pzNuevo(){ return !(S.tx && S.tx.length) && !(S.planes && S.planes.length) && !(S.metas && S.metas.length); }
function pzBlanco(p){
  var l = p.sel || [];
  for(var i = 0; i < l.length; i++){
    var el = document.querySelector(l[i]);
    if(el){ var r = el.getBoundingClientRect(); if(r.width > 0 && r.height > 0) return el; }
  }
  return null;
}
function pzClamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function pzContenido(dir){
  var box = $('#paseo'), p = PASOS[pzI], ult = pzI === PASOS.length - 1;
  $('#pzTit').textContent = p.t;
  $('#pzDesc').textContent = typeof p.d === 'function' ? p.d() : p.d;
  // v245: la escenita, lo que se puede hacer y en qué paso vas
  var dm = box.querySelector('.pz-demo'), l = typeof p.l === 'function' ? p.l() : (p.l || []);
  dm.innerHTML = p.demo ? pzDemo(p.demo) : '';
  dm.classList.remove('entra'); void dm.offsetWidth; dm.classList.add('entra');
  $('#pzLista').innerHTML = l.map(function(x){ return '<li>' + PZ_SVG.ok + '<span>' + esc(x) + '</span></li>'; }).join('');
  var ico = box.querySelector('.pz-ico');
  ico.classList.toggle('logo', !!p.logo);
  if(p.logo) ico.innerHTML = '<span class="pz-logo"><i></i><i></i><i></i></span>';
  else if(p.ico) ico.innerHTML = p.ico;
  else { var el = pzBlanco(p), sv = el && el.querySelector('svg'); ico.innerHTML = sv ? sv.outerHTML : ''; }
  var pts = '';
  for(var i = 0; i < PASOS.length; i++) pts += '<i class="' + (i === pzI ? 'on' : (i < pzI ? 'ya' : '')) + '"></i>';
  var pu = box.querySelector('.pz-puntos');
  if(pu.children.length !== PASOS.length) pu.innerHTML = pts;
  else [].forEach.call(pu.children, function(x, i){ x.className = i === pzI ? 'on' : (i < pzI ? 'ya' : ''); });
  box.querySelector('[data-pzatras]').hidden = pzI === 0;
  box.querySelector('[data-pzsaltar]').hidden = ult;
  box.querySelector('[data-pzsig]').textContent = pzI === 0 ? 'Mostrame' : (ult ? '¡Empezar!' : 'Siguiente');
  box.querySelector('[data-pzsaltar]').textContent = pzI === 0 ? 'Ahora no' : 'Saltear';
  var c = box.querySelector('.pz-cuerpo');
  c.classList.remove('entra-d', 'entra-i'); void c.offsetWidth;
  c.classList.add(dir < 0 ? 'entra-i' : 'entra-d');
}
function pzColocar(quieto){
  var box = $('#paseo'); if(!box || box.hidden) return;
  var p = PASOS[pzI], el = pzBlanco(p), f = box.querySelector('.pz-foco'), g = box.querySelector('.pz-globo');
  var vw = window.innerWidth, vh = window.innerHeight, m = 16, sep = 14, pad = 6;
  if(quieto) box.classList.add('quieto');
  var r = el ? el.getBoundingClientRect() : null, x, y, w, h, rad = 16;
  if(r){
    x = r.left - pad; y = r.top - pad; w = r.width + pad * 2; h = r.height + pad * 2;
    rad = el.closest('.fab') ? Math.max(w, h) / 2 : 14;
  } else { x = vw / 2; y = vh * 0.45; w = 0; h = 0; }
  f.style.transform = 'translate(' + Math.round(x) + 'px,' + Math.round(y) + 'px)';
  f.style.width = Math.round(w) + 'px'; f.style.height = Math.round(h) + 'px'; f.style.borderRadius = rad + 'px';
  box.classList.toggle('sin-blanco', !r);
  var bw = g.offsetWidth, bh = g.offsetHeight, gx, gy, lado;
  if(!r){ lado = 'centro'; gx = (vw - bw) / 2; gy = (vh - bh) / 2; }
  else if(vw >= 700 && r.right < vw * 0.3){ lado = 'izq'; gx = x + w + sep; gy = pzClamp(r.top + r.height / 2 - bh / 2, m, vh - bh - m); }
  else if(r.top + r.height / 2 > vh / 2){ lado = 'abajo'; gy = y - sep - bh; gx = pzClamp(r.left + r.width / 2 - bw / 2, m, vw - bw - m); }
  else { lado = 'arriba'; gy = y + h + sep; gx = pzClamp(r.left + r.width / 2 - bw / 2, m, vw - bw - m); }
  g.className = 'pz-globo ' + lado;
  g.style.transform = 'translate(' + Math.round(gx) + 'px,' + Math.round(gy) + 'px)';
  if(r){
    g.style.setProperty('--ax', Math.round(pzClamp(r.left + r.width / 2 - gx, 22, bw - 22)) + 'px');
    g.style.setProperty('--ay', Math.round(pzClamp(r.top + r.height / 2 - gy, 20, bh - 20)) + 'px');
  }
  if(quieto){ void box.offsetWidth; box.classList.remove('quieto'); }
}
function pzIr(i){
  if(i < 0) return;
  if(i >= PASOS.length){ pzCerrar(true); return; }
  var dir = i >= pzI ? 1 : -1;
  pzI = i;
  var p = PASOS[i];
  if(p.vista && vista !== p.vista) go(p.vista);
  pzContenido(dir);
  requestAnimationFrame(function(){ pzColocar(false); });
}
function pzAbrir(){
  var box = $('#paseo'); if(!box) return;
  vozPistaOcultar();
  pzDesde = vista; pzFocoAntes = document.activeElement;
  pzI = 0; pzAbierto = true;
  box.classList.remove('cierra'); box.hidden = false;
  pzContenido(1);
  pzColocar(true);
  try{ box.querySelector('[data-pzsig]').focus({ preventScroll:true }); }catch(e){}
}
/* v225: con "¡Empezar!" (`fin`) te deja en la carga, listo para el primer gasto;
   con Saltear o Escape, vuelve a donde estabas. */
function pzCerrar(fin){
  var box = $('#paseo'); if(!box || !pzAbierto) return;
  pzAbierto = false;
  try{ localStorage.setItem(PASEO_KEY, '1'); }catch(e){}
  if(fin){
    if(editando) salirEdit();
    if(editandoPlan) salirEditPlan();
    cargaTab = 'gasto'; tipoMov = 'gasto'; pintarCarga(); fillSelects();
    if(vista !== 'cargar') go('cargar');
    pzFocoAntes = null;
  }
  else if(vista !== pzDesde) go(pzDesde);
  box.classList.add('cierra');
  setTimeout(function(){ if(!pzAbierto){ box.hidden = true; box.classList.remove('cierra'); } }, 260);
  try{ if(pzFocoAntes && pzFocoAntes.focus) pzFocoAntes.focus({ preventScroll:true }); }catch(e){}
}
window.__ccPaseo = pzAbrir;
document.addEventListener('click', function(e){
  if(!e.target.closest) return;
  if(e.target.closest('[data-paseo]')){ pzAbrir(); return; }
  if(!pzAbierto) return;
  if(e.target.closest('[data-pzsig]')){ pzIr(pzI + 1); return; }
  if(e.target.closest('[data-pzatras]')){ pzIr(pzI - 1); return; }
  if(e.target.closest('[data-pzsaltar]')){ pzCerrar(); return; }
});
// deslizar el dedo pasa de paso; tocar lo oscuro, también avanza
(function(){
  var x0 = null, y0 = 0;
  document.addEventListener('pointerdown', function(e){ if(pzAbierto && e.target.closest && e.target.closest('#paseo')){ x0 = e.clientX; y0 = e.clientY; } }, true);
  document.addEventListener('pointerup', function(e){
    if(!pzAbierto || x0 === null) return;
    var dx = e.clientX - x0, dy = e.clientY - y0; x0 = null;
    if(Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy)){ pzIr(pzI + (dx < 0 ? 1 : -1)); return; }
    if(Math.abs(dx) < 10 && Math.abs(dy) < 10 && !e.target.closest('.pz-globo')) pzIr(pzI + 1);
  }, true);
  // v262: escuchado sólo en el paseo (que tapa toda la pantalla mientras está abierto);
  // escucharlo en todo el documento hacía que cada rueditazo esperara al JavaScript.
  var pzBox = document.getElementById('paseo');
  if(pzBox) pzBox.addEventListener('wheel', function(e){ if(pzAbierto) e.preventDefault(); }, { passive:false });
  document.addEventListener('keydown', function(e){
    if(!pzAbierto) return;
    if(e.key === 'Escape'){ e.preventDefault(); e.stopPropagation(); pzCerrar(); }
    else if(e.key === 'ArrowRight'){ e.preventDefault(); pzIr(pzI + 1); }
    else if(e.key === 'ArrowLeft'){ e.preventDefault(); pzIr(pzI - 1); }
    else if(e.key === 'Tab'){
      // el foco del teclado no se escapa del globito
      var bs = [].filter.call($$('#paseo button'), function(b){ return !b.hidden; });
      var i = bs.indexOf(document.activeElement);
      e.preventDefault();
      var n = (i + (e.shiftKey ? -1 : 1) + bs.length) % bs.length; try{ bs[n].focus(); }catch(x){}
    }
  }, true);
  window.addEventListener('resize', function(){ if(pzAbierto) pzColocar(true); });
})();
/* Al arrancar: si la app está vacía y nunca lo viste, el paseo; si no, el
   globito del micrófono de siempre. Espera a que lleguen los datos de la nube,
   para no mostrárselo a alguien que ya usa la app en otro lado. */
function pzArranque(n){
  n = n || 0;
  // con cuenta: espera a que entres y lleguen tus datos (si no, se abriría detrás de la pantalla de entrada)
  if(cuentaHayBase() && !dbEst.listo){ setTimeout(function(){ pzArranque(0); }, 600); return; }
  if(!cloudReady && n < 12){ setTimeout(function(){ pzArranque(n + 1); }, 500); return; }
  var dialogo = [].some.call($$('[role="dialog"]'), function(d){ return d.id !== 'paseo' && d.getClientRects().length > 0; });
  if(!(window.SIN_INTRO && !window.CON_PASEO) && !pzVisto() && pzNuevo() && !dialogo && !vozOyendo){ pzAbrir(); return; }
  vozPistaMostrar();
}
// al abrir la app, después de la presentación
setTimeout(function(){ vozPintar(); pzArranque(); }, 2200);
/* v224: "Borrar todo" pide un segundo toque; el texto largo es para la compu y el corto para la ficha del teléfono */
function wipeTxt(b, armado){
  var lg = b.querySelector('.lg'), co = b.querySelector('.co');
  if(lg) lg.textContent = armado ? 'Tocá otra vez' : 'Borrar todo';
  if(co) co.textContent = armado ? 'Tocá otra vez' : 'Borrar todo';
}

/* export / import */
function exportar(){
  var data = JSON.stringify(paraGuardar(sinSy()), null, 2);
  var name = 'cuentas-claras-'+today()+'.json';
  if(AND()){
    var msg = '';
    try{ msg = AND().exportar(data, name); }catch(e){}
    toast(msg || 'No pude guardar la copia');
    return;
  }
  var cap = (window.claude && window.claude.use) ? window.claude.use('downloads') : Promise.resolve(null);
  cap.then(function(d){
    if(!d) throw new Error('no');
    return d.save({filename:name, data:data});
  }).then(function(){ toast('Copia descargada'); })
  .catch(function(err){
    if(err && err.code === 'declined') return;
    try{
      var a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([data],{type:'application/json'}));
      a.download = name; document.body.appendChild(a); a.click(); a.remove();
      toast('Copia descargada');
    }catch(x){ toast('No pude descargar la copia acá'); }
  });
}
$('#fileIn').addEventListener('change', function(e){
  var f = e.target.files && e.target.files[0];
  if(!f) return;
  var rd = new FileReader();
  rd.onload = function(){
    try{
      var o = JSON.parse(rd.result);
      var syAntes = S.sy, gente = S.personas, marca = S.dbMarca;
      S = normalize(o); S.updatedAt = Date.now();
      if(dbActiva()){
        // con cuenta: lo importado reemplaza los datos, pero la gente del grupo es la que está en la base
        S.dbMarca = marca;
        if((gente || []).length) S.personas = gente;
      }
      // el vínculo de este dispositivo se queda; lo importado entra como nuevo, sin borrar nada en los otros
      delete S.sy;
      if(syAntes && syAntes.link) S.sy = { link:syAntes.link, h:{}, pub:{}, vistos:syAntes.vistos || {}, base:Date.now(), solo:syAntes.solo };
      save(); render(); toast('Datos importados');
    }catch(x){ toast('Ese archivo no tiene el formato correcto'); }
  };
  rd.readAsText(f);
  e.target.value = '';
});
