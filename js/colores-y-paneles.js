/* Cuentas Claras · js/colores-y-paneles.js
   La paleta y la rueda de colores, y el orden de los paneles del Resumen.

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

/* ---------- la paleta ----------
   Un desplegable chico colgado del puntito de color: arriba los básicos, abajo
   los colores que te fuiste inventando, y un botón que abre la rueda para hacer
   uno nuevo. El mismo desplegable sirve para un grupo que ya existe y para el
   que estás por crear (ahí el id es '@nuevo'). */
var paletaAbierta = null;      // id del grupo, o '@nuevo'
var colorNuevo = null;         // el color elegido para el grupo que todavía no existe
var rueda = null;              // {h,s,l} mientras la rueda está abierta

var TILDE_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 13l4 4L19 7"/></svg>';

function colorDe(id){
  if(id === '@nuevo') return colorNuevo || colorLibre();
  var g = grupoPorId(id);
  return g ? normHex(g.color) : '';
}
function cerrarPaleta(){
  var p = document.getElementById('paleta');
  if(p && p.parentNode) p.parentNode.removeChild(p);
  $$('[data-gcolor]').forEach(function(b){ b.setAttribute('aria-expanded','false'); });
  paletaAbierta = null;
  rueda = null;
}
function paletaSwatches(lista, id, actual){
  return lista.map(function(x){
    var hex = normHex(x.v || x), nom = x.n || hex;
    var otro = grupoConColor(hex, id === '@nuevo' ? '' : id);
    var sel = (hex === actual);
    var t = nom + (sel ? ' · el de ahora' : (otro ? ' · también lo usa ' + otro.nombre : ''));
    return '<button type="button" class="pal-sw" data-gcolorv="'+esc(hex)+'" data-gcolorid="'+esc(id)+'"'
      + ' style="background:'+colorVisible(hex)+'" aria-pressed="'+(sel ? 'true' : 'false')+'"'
      + ' title="'+esc(t)+'" aria-label="'+esc(t)+'">'
      + (sel ? TILDE_SVG : (otro ? '<i class="usado"></i>' : '')) + '</button>';
  }).join('');
}
function abrirPaleta(id){
  cerrarPaleta();
  var btn = botonPaleta(id);
  if(!btn || (id !== '@nuevo' && !grupoPorId(id))) return;
  var actual = colorDe(id);
  var html = '<div class="pal-tit">Básicos</div>'
    + '<div class="pal-grid">' + paletaSwatches(COLORES_BASE, id, actual) + '</div>';
  if((S.colores||[]).length){
    html += '<div class="pal-tit">Los tuyos</div>'
      + '<div class="pal-grid">' + paletaSwatches(S.colores, id, actual) + '</div>';
  }
  html += '<button type="button" class="btn ghost sm pal-nuevo" data-palnuevo="'+esc(id)+'">Crear un color</button>';
  var pop = document.createElement('div');
  pop.id = 'paleta';
  pop.className = 'paleta';
  pop.setAttribute('role','dialog');
  pop.setAttribute('aria-label', id === '@nuevo' ? 'Color del grupo nuevo' : ('Color de ' + nombreGrupo(id)));
  pop.innerHTML = html;
  btn.parentNode.appendChild(pop);
  btn.setAttribute('aria-expanded','true');
  paletaAbierta = id;
}
function botonPaleta(id){
  return (id === '@nuevo') ? $('#grupoColor')
    : $('#presuEdit [data-gcolor="'+String(id).replace(/"/g,'')+'"]');
}
function elegirColor(id, hex){
  hex = normHex(hex);
  if(!hex){ cerrarPaleta(); return; }
  if(id === '@nuevo'){
    colorNuevo = hex;
    cerrarPaleta();
    save();                       // los colores propios ya quedan guardados
    pintarColorNuevo();
    return;
  }
  var g = grupoPorId(id);
  if(!g){ cerrarPaleta(); return; }
  var otro = grupoConColor(hex, id);
  g.color = hex;
  cerrarPaleta();
  save(); renderPresuEdit(); renderResumen();
  toast(otro ? ('Listo. Ojo que ese color también lo usa ' + otro.nombre)
             : ('Nuevo color para ' + g.nombre));
}
/* Los colores propios se guardan en una lista corta. Cuando se llena sale el
   más viejo que no esté usando ningún grupo: borrar uno que estás viendo en
   pantalla sería raro. */
function guardarColorPropio(hex){
  hex = normHex(hex);
  if(!hex || esBasico(hex)) return;
  S.colores = S.colores || [];
  if(S.colores.indexOf(hex) > -1) return;
  S.colores.unshift(hex);
  while(S.colores.length > MAX_COLORES){
    var fuera = -1;
    for(var i = S.colores.length - 1; i >= 0; i--){
      if(!grupoConColor(S.colores[i], '')){ fuera = i; break; }
    }
    S.colores.splice(fuera > -1 ? fuera : S.colores.length - 1, 1);
  }
}

/* ---- la rueda ----
   El ángulo es el tono y la distancia al centro, cuán intenso. El deslizador de
   abajo mueve cuán claro es, y por eso la rueda se vuelve a dibujar con cada
   cambio: a distinta claridad, los mismos tonos se ven distinto. */
function ruedaHex(){ return rueda ? hslHex(rueda.h, rueda.s, rueda.l) : ''; }
function dibujarRueda(){
  var cv = document.getElementById('palCanvas');
  if(!cv || !rueda || !cv.getContext) return;
  var ctx = cv.getContext('2d');
  var w = cv.width, h = cv.height, r = w/2;
  var img = ctx.createImageData(w, h);
  for(var y=0; y<h; y++){
    for(var x=0; x<w; x++){
      var dx = x - r + 0.5, dy = y - r + 0.5;
      var d = Math.sqrt(dx*dx + dy*dy), i = (y*w + x) * 4;
      if(d > r){ img.data[i+3] = 0; continue; }
      var ang = Math.atan2(dy, dx) * 180 / Math.PI + 90;
      var c = hslRgb(ang, Math.min(1, d/r), rueda.l);
      img.data[i] = c[0]; img.data[i+1] = c[1]; img.data[i+2] = c[2];
      img.data[i+3] = (d > r - 1) ? Math.round((r - d) * 255) : 255;   // borde suave
    }
  }
  ctx.putImageData(img, 0, 0);
}
function pintarRueda(){
  if(!rueda) return;
  var hex = ruedaHex();
  var cv = document.getElementById('palCanvas');
  var m = document.getElementById('palMarca');
  if(cv && m){
    var r = cv.width/2, ang = (rueda.h - 90) * Math.PI / 180, d = rueda.s * r;
    m.style.left = Math.round(r + Math.cos(ang)*d) + 'px';
    m.style.top  = Math.round(r + Math.sin(ang)*d) + 'px';
    m.style.background = hex;
  }
  var pv = document.getElementById('palPrev');
  if(pv) pv.style.background = colorVisible(hex);
  var hx = document.getElementById('palHex');
  if(hx && document.activeElement !== hx) hx.value = hex;
}
function ruedaDesdeEvento(e){
  var cv = document.getElementById('palCanvas');
  if(!cv || !rueda) return;
  var caja = cv.getBoundingClientRect(), r = caja.width/2;
  var dx = e.clientX - caja.left - r, dy = e.clientY - caja.top - r;
  var d = Math.sqrt(dx*dx + dy*dy);
  rueda.h = (Math.atan2(dy, dx) * 180 / Math.PI + 90 + 360) % 360;
  rueda.s = Math.max(0, Math.min(1, d / r));
  pintarRueda();
}
function abrirRueda(id){
  var pop = document.getElementById('paleta');
  if(!pop || document.getElementById('palRueda')) return;
  var base = colorDe(id) || COLORES_BASE[0].v;
  var c = hslDeHex(base);
  rueda = { h:c.h, s:(c.s > 0.05 ? c.s : 0.7), l:c.l };
  pop.insertAdjacentHTML('beforeend',
      '<div class="pal-rueda" id="palRueda">'
    +   '<div class="pal-tit">Un color nuevo</div>'
    +   '<div class="rueda-wrap"><canvas id="palCanvas" width="150" height="150" aria-label="Rueda de colores"></canvas>'
    +     '<i class="rueda-marca" id="palMarca"></i></div>'
    +   '<input class="slider" id="palLuz" type="range" min="8" max="92" value="50" aria-label="Qué tan claro es el color">'
    +   '<div class="pal-fila"><span class="pal-prev" id="palPrev"></span>'
    +     '<input class="pal-hex" id="palHex" type="text" maxlength="7" autocomplete="off" spellcheck="false" aria-label="Código del color">'
    +   '</div>'
    +   '<button type="button" class="btn sm" style="width:100%" data-palusar="'+esc(id)+'">Usar este color</button>'
    + '</div>');
  var luz = document.getElementById('palLuz');
  if(luz) luz.value = String(Math.round(rueda.l * 100));
  var cv = document.getElementById('palCanvas');
  if(cv){
    var mover = function(ev){ ev.preventDefault(); ruedaDesdeEvento(ev); };
    var soltar = function(){ cv.removeEventListener('pointermove', mover); };
    cv.addEventListener('pointerdown', function(ev){
      try{ cv.setPointerCapture && cv.setPointerCapture(ev.pointerId); }catch(x){}
      mover(ev);
      cv.addEventListener('pointermove', mover);
    });
    cv.addEventListener('pointerup', soltar);
    cv.addEventListener('pointercancel', soltar);
  }
  dibujarRueda();
  pintarRueda();
  var el = document.getElementById('palRueda');
  if(el && el.scrollIntoView) try{ el.scrollIntoView({block:'nearest'}); }catch(x){}
}
function usarColorRueda(id){
  if(!rueda) return;
  var hex = ruedaHex();
  guardarColorPropio(hex);
  elegirColor(id, hex);
}
document.addEventListener('input', function(e){
  if(!rueda) return;
  if(e.target.id === 'palLuz'){
    rueda.l = Math.max(0.02, Math.min(0.98, (parseInt(e.target.value, 10) || 50) / 100));
    dibujarRueda(); pintarRueda();
    return;
  }
  if(e.target.id === 'palHex'){
    var v = e.target.value.trim();
    if(v && v.charAt(0) !== '#') v = '#' + v;
    if(esHex(v)){
      var c = hslDeHex(normHex(v));
      rueda = { h:c.h, s:c.s, l:c.l };
      var luz = document.getElementById('palLuz');
      if(luz) luz.value = String(Math.round(c.l * 100));
      dibujarRueda(); pintarRueda();
    }
  }
});
document.addEventListener('keydown', function(e){
  if(!paletaAbierta) return;
  if(e.key === 'Escape' || e.key === 'Esc'){ e.stopPropagation(); cerrarPaleta(); }
}, true);
document.addEventListener('mousedown', function(e){
  if(!paletaAbierta || !e.target.closest) return;
  if(e.target.closest('.paleta') || e.target.closest('[data-gcolor]')) return;
  cerrarPaleta();
});
/* El puntito del formulario de grupo nuevo. Sin elegir nada muestra el color
   que le tocaría, así que lo que ves es lo que vas a tener. */
function pintarColorNuevo(){
  var b = $('#grupoColor');
  if(!b) return;
  var d = b.querySelector('.gdot');
  if(d) d.style.background = colorGrupoHex(colorNuevo || colorLibre());
}
function colorGrupoHex(hex){ return colorVisible(hex); }
function catsDelGrupo(id){
  var n = 0;
  S.catGasto.forEach(function(c){ if(grupoDeCat(c) === id) n++; });
  return n;
}
function botonBorrarGrupo(id){
  if(S.grupos.length <= 1) return '<span></span>';
  var n = catsDelGrupo(id);
  if(grupoConfirm === id){
    return '<button class="confirm" type="button" data-gdel="'+id+'">'+(n ? 'Borrar y mover '+n : 'Borrar')+'</button>';
  }
  return '<button class="iconbtn" type="button" data-gdel="'+id+'" aria-label="Borrar el grupo '+esc(nombreGrupo(id))+'" title="'+(n ? n+(n===1?' categoría pasa a otro grupo':' categorías pasan a otro grupo') : 'Sin categorías')+'">'
    + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg></button>';
}
function borrarGrupo(id){
  if(S.grupos.length <= 1) return 'Tiene que quedar al menos un grupo';
  var nombre = nombreGrupo(id), i = -1;
  for(var k=0;k<S.grupos.length;k++) if(S.grupos[k].id === id) i = k;
  if(i < 0) return '';
  S.grupos.splice(i, 1);
  var destino = S.grupos[Math.min(i, S.grupos.length - 1)].id;
  for(var j=0;j<S.grupos.length;j++) if(S.grupos[j].id === 'otros') destino = 'otros';
  var movidas = 0;
  S.catGasto.forEach(function(c){ if((S.grupoDe[c]||'') === id){ S.grupoDe[c] = destino; movidas++; } });
  delete S.presuGrupo[id];
  if(S.presuFijo) delete S.presuFijo[id];
  return movidas
    ? ('Borré "'+nombre+'" y pasé '+movidas+(movidas===1?' categoría':' categorías')+' a "'+nombreGrupo(destino)+'"')
    : ('Borré "'+nombre+'"');
}
/* `cuanto` es opcional: sin él la barra dibuja lo guardado, y con él dibuja lo
   que haya escrito en los campos mientras se está tipeando. */
function pintarAlloc(cuanto){
  var bar = $('#allocBar'), leg = $('#allocLeg');
  if(!bar) return;
  var base = baseDelMes(mes);
  var vals = S.grupos.map(function(g){
    return { id:g.id, pct: cuanto ? (cuanto(g.id)||0) : topeEnPct(g.id, mes) };
  });
  var suma = vals.reduce(function(a,x){ return a + x.pct; }, 0);
  var escala = Math.max(100, suma);
  var html = vals.filter(function(x){ return x.pct > 0; }).map(function(x){
    return '<span style="width:'+(x.pct/escala*100).toFixed(2)+'%;background:'+colorGrupo(x.id)+'" title="'+esc(nombreGrupo(x.id))+' '+fmtPct(x.pct)+'"></span>';
  }).join('');
  if(suma < 100) html += '<span class="libre" style="width:'+((100-suma)/escala*100).toFixed(2)+'%" title="Sin asignar"></span>';
  bar.innerHTML = html || '<span class="libre" style="width:100%"></span>';
  bar.setAttribute('aria-label', suma > 0
    ? ('Reparto del ingreso: ' + vals.filter(function(x){return x.pct>0;}).map(function(x){ return nombreGrupo(x.id)+' '+fmtPct(x.pct); }).join(', ') + (suma<100 ? ', sin asignar '+fmtPct(100-suma) : ''))
    : 'Todavía no repartiste nada');
  if(leg){
    leg.innerHTML = vals.filter(function(x){ return x.pct > 0; }).map(function(x){
      return '<span><i style="background:'+colorGrupo(x.id)+'"></i>'+esc(nombreGrupo(x.id))+' <b>'+fmtPct(x.pct)+'</b>'
        + (base>0 ? ' <span style="color:var(--ink-3)">'+esc(money(topeEnPesos(x.pct, base)))+(esTopeFijo(x.id) ? ' fijo' : '')+'</span>' : '') + '</span>';
    }).join('') + (suma < 100 ? '<span><i class="libre" style="background:var(--surface-2);box-shadow:inset 0 0 0 1px var(--line)"></i>Sin asignar <b>'+fmtPct(100-suma)+'</b></span>' : '');
  }
}
function actualizarSumaPresu(){
  var bi = baseInfo(mes), base = bi.v;
  var b = $('#baseHint');
  if(b) b.innerHTML = S.baseIngreso > 0
    ? 'Los topes se calculan sobre este número. Si te aumentan, cambialo acá.'
    : (base > 0
        ? 'Vacío = uso tus ingresos de ' + esc(bi.de === 'este mes' ? ymLabel(mes) : bi.de) + ' (' + esc(money(base)) + ').'
        : 'Vacío = uso tus ingresos del mes, que todavía no cargaste.');
  var suma = 0;
  S.grupos.forEach(function(g){ suma += pctEscrito(g.id); });
  var enPesos = 0, nFijos = 0;
  S.grupos.forEach(function(g){
    if(!esTopeFijo(g.id)) return;
    var mi = campoPlata(g.id);
    var v = mi ? Math.max(0, parseMoney(mi.value)) : topeFijoDe(g.id);
    if(v > 0){ enPesos += v; nFijos++; }
  });
  var el = $('#presuSuma'); if(!el) return;
  var libre = 100 - suma;
  /* Sin base no hay porcentajes que sumar, pero los topes fijos igual existen:
     decir "todavía no repartiste nada" cuando pusiste $ 250.000 sería mentir. */
  if(suma <= 0 && nFijos > 0){
    el.className = 'note';
    el.textContent = 'Tenés ' + money(enPesos) + ' en topes fijos, en ' + nFijos
      + (nFijos === 1 ? ' grupo' : ' grupos') + '. Cargá un ingreso y te digo qué parte de lo que entra se van.';
    return;
  }
  if(suma <= 0){ el.className = 'note'; el.textContent = 'Todavía no repartiste nada. Poné un porcentaje, o pesos, en los grupos que quieras controlar.'; return; }
  if(libre < -0.05){
    el.className = 'note warn';
    el.textContent = 'Te pasaste: repartiste ' + fmtPct(suma) + (base>0 ? ' ('+money(topeEnPesos(suma, base))+')' : '') + ', ' + fmtPct(-libre) + ' más de lo que entra.';
  } else {
    el.className = 'note';
    el.textContent = 'Repartiste ' + fmtPct(suma) + (base>0 ? ' ('+money(topeEnPesos(suma, base))+')' : '')
      + ' · te queda ' + fmtPct(libre) + (base>0 ? ' ('+money(topeEnPesos(libre, base))+')' : '') + ' sin asignar.'
      + (nFijos > 0 ? ' De eso, ' + money(enPesos) + ' son topes fijos.' : '');
  }
}

/* ---- orden de los paneles del resumen ---- */
function aplicarOrden(){
  var cont = $('#panels'); if(!cont) return;
  (S.orden && S.orden.length ? S.orden : PANELES).forEach(function(k){
    var el = cont.querySelector('[data-panel="'+k+'"]');
    if(el) cont.appendChild(el);
  });
}
function guardarOrden(){
  var cont = $('#panels'); if(!cont) return;
  S.orden = Array.prototype.map.call(cont.querySelectorAll(':scope > [data-panel]'), function(el){
    return el.getAttribute('data-panel');
  });
  save();
}
function moverPanel(panel, paso){
  var cont = $('#panels'); if(!cont || !panel) return;
  var hijos = Array.prototype.filter.call(cont.children, function(c){ return c.hasAttribute('data-panel'); });
  var i = hijos.indexOf(panel), j = i + paso;
  if(i < 0 || j < 0 || j >= hijos.length) return;
  if(paso < 0) cont.insertBefore(panel, hijos[j]);
  else cont.insertBefore(panel, hijos[j].nextSibling);
  guardarOrden();
  var g = panel.querySelector('.grip'); if(g) g.focus();
}

var arr = null, autoScroll = null;
function panelesHermanos(){
  var cont = $('#panels');
  return Array.prototype.filter.call(cont.children, function(c){
    return c !== arr.panel && c !== arr.ph && (c.hasAttribute('data-panel') || c === arr.ph);
  });
}
function reubicar(x, y){
  var cont = $('#panels');
  var hijos = Array.prototype.filter.call(cont.children, function(c){
    return c !== arr.panel && c !== arr.ph && c.hasAttribute('data-panel');
  });
  if(cont.classList.contains('mas')){
    /* Apilados, el orden de la página ya no va de arriba abajo: el hueco va al
       lado del panel que tenés más cerca, antes si estás en su mitad de arriba
       y después si estás en la de abajo. Encima del hueco no se mueve nada, así
       no tiembla mientras se reacomoda. */
    var pr = arr.ph.getBoundingClientRect();
    if(x >= pr.left && x <= pr.right && y >= pr.top && y <= pr.bottom) return;
    var cerca = null, desp = false, dist = Infinity;
    hijos.forEach(function(h){
      var r = h.getBoundingClientRect();
      var dx = x < r.left ? r.left - x : (x > r.right ? x - r.right : 0);
      var dy = y < r.top ? r.top - y : (y > r.bottom ? y - r.bottom : 0);
      var d = dx * dx + dy * dy;
      if(d < dist){ dist = d; cerca = h; desp = y > r.top + r.height / 2; }
    });
    if(!cerca) return;
    var ref = desp ? cerca.nextElementSibling : cerca;
    while(ref && ref === arr.panel) ref = ref.nextElementSibling;
    if(ref === arr.ph) return;
    if(!desp && cerca.previousElementSibling === arr.ph) return;
    cont.insertBefore(arr.ph, ref);
    apilarPaneles();
    return;
  }
  var destino = null;
  for(var i=0;i<hijos.length;i++){
    var r = hijos[i].getBoundingClientRect();
    var cy = r.top + r.height/2, cx = r.left + r.width/2;
    if(y < cy || (y < r.bottom && x < cx)){ destino = hijos[i]; break; }
  }
  if(destino) cont.insertBefore(arr.ph, destino); else cont.appendChild(arr.ph);
}
function pararAuto(){ if(autoScroll){ clearInterval(autoScroll); autoScroll = null; } }
function moverArrastre(e){
  if(!arr) return;
  var x = e.clientX, y = e.clientY;
  arr.panel.style.left = (x - arr.dx) + 'px';
  arr.panel.style.top  = (y - arr.dy) + 'px';
  reubicar(x, y);
  pararAuto();
  var borde = 90, vel = 0;
  if(y < borde) vel = -14; else if(y > window.innerHeight - borde) vel = 14;
  if(vel){ arr.ultY = y; autoScroll = setInterval(function(){ window.scrollBy(0, vel); if(arr) reubicar(x, arr.ultY); }, 16); }
}
function terminarArrastre(){
  if(!arr) return;
  pararAuto();
  var cont = $('#panels'), panel = arr.panel;
  cont.insertBefore(panel, arr.ph);
  arr.ph.parentNode && arr.ph.parentNode.removeChild(arr.ph);
  panel.classList.remove('dragging');
  panel.style.width = panel.style.height = panel.style.left = panel.style.top = '';
  document.body.classList.remove('arrastrando');
  document.removeEventListener('pointermove', moverArrastre);
  document.removeEventListener('pointerup', terminarArrastre);
  document.removeEventListener('pointercancel', terminarArrastre);
  arr = null;
  guardarOrden();
}
document.addEventListener('pointerdown', function(e){
  var grip = e.target.closest ? e.target.closest('.grip') : null;
  if(!grip || e.button > 0) return;
  var panel = grip.closest('[data-panel]');
  if(!panel) return;
  e.preventDefault();
  var r = panel.getBoundingClientRect();
  var ph = document.createElement('div');
  ph.className = 'panel-ph';
  ph.style.height = r.height + 'px';
  panel.parentNode.insertBefore(ph, panel);
  arr = { panel:panel, ph:ph, dx:e.clientX - r.left, dy:e.clientY - r.top, ultY:e.clientY };
  panel.classList.add('dragging');
  panel.style.width = r.width + 'px';
  panel.style.height = r.height + 'px';
  panel.style.left = r.left + 'px';
  panel.style.top = r.top + 'px';
  document.body.classList.add('arrastrando');
  try{ grip.setPointerCapture && grip.releasePointerCapture && grip.releasePointerCapture(e.pointerId); }catch(x){}
  document.addEventListener('pointermove', moverArrastre);
  document.addEventListener('pointerup', terminarArrastre);
  document.addEventListener('pointercancel', terminarArrastre);
});
document.addEventListener('keydown', function(e){
  var grip = e.target.closest ? e.target.closest('.grip') : null;
  if(!grip) return;
  if(e.key === 'ArrowUp' || e.key === 'ArrowLeft'){ e.preventDefault(); moverPanel(grip.closest('[data-panel]'), -1); }
  if(e.key === 'ArrowDown' || e.key === 'ArrowRight'){ e.preventDefault(); moverPanel(grip.closest('[data-panel]'), 1); }
});
