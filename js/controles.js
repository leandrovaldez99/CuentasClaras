/* Cuentas Claras · js/controles.js
   Controles propios: buscador, fecha compacta, calendario y desplegables.

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

/* ---------- buscador (combo) ----------
   Funciona sobre cualquier .combo que tenga adentro un input[role=combobox],
   un .combo-pop y un <select>. El <select> sigue siendo el dato: el combo lee
   sus <option> y, al elegir, le pone el value y dispara 'change'. */
function sinTildes(s){
  return String(s||'').toLowerCase()
    .replace(/[áàäâã]/g,'a').replace(/[éèëê]/g,'e').replace(/[íìïî]/g,'i')
    .replace(/[óòöôõ]/g,'o').replace(/[úùüû]/g,'u').replace(/ñ/g,'n');
}
function comboPartes(root){
  if(typeof root === 'string') root = $(root);
  if(!root || !root.querySelector) return null;
  var inp = root.querySelector('input[role="combobox"]');
  var pop = root.querySelector('.combo-pop');
  var sel = root.querySelector('select');
  return (inp && pop && sel) ? { root:root, inp:inp, pop:pop, sel:sel } : null;
}
/* El <option> dice "Mercado Pago · 19,63%" porque la lista muestra las dos cosas,
   pero en el campo va sólo el nombre: la tasa está en el campo de al lado y
   repetirla adentro del nombre del banco confunde. */
function comboSoloNombre(o){ return o ? String(o.textContent).split(' · ')[0] : ''; }
function comboEtiqueta(root){
  var c = comboPartes(root); if(!c) return;
  if(document.activeElement === c.inp) return;
  var o = c.sel.options[c.sel.selectedIndex];
  c.inp.value = (c.sel.value && o) ? comboSoloNombre(o) : '';
  c.inp.setAttribute('placeholder',
    (c.sel.value ? c.root.getAttribute('data-ph') : c.root.getAttribute('data-ph0')) || 'Escribí para buscar');
}
function comboOpciones(c){
  var out = [];
  [].slice.call(c.sel.options).forEach(function(o){
    if(!o.value) return;
    var g = (o.parentNode && o.parentNode.tagName === 'OPTGROUP') ? o.parentNode.label : '';
    var p = o.textContent.split(' · ');
    out.push({ v:o.value, n:p[0], tna:p[1]||'', g:g, busca:o.getAttribute('data-busca')||'' });
  });
  return out;
}
function resaltar(txt, nq){
  var t = String(txt||'');
  if(!nq) return esc(t);
  var i = sinTildes(t).indexOf(nq);
  if(i < 0) return esc(t);
  return esc(t.slice(0,i)) + '<mark>' + esc(t.slice(i, i+nq.length)) + '</mark>' + esc(t.slice(i+nq.length));
}
function comboPintar(c, q){
  var nq = sinTildes(q).trim(), actual = c.sel.value;
  var lista = comboOpciones(c).filter(function(o){
    return !nq || sinTildes(o.n).indexOf(nq) >= 0 || sinTildes(o.busca).indexOf(nq) >= 0;
  });
  if(nq){
    // dentro de cada grupo, primero las que empiezan con lo que escribiste
    lista.forEach(function(o, i){ o._i = i; o._p = (sinTildes(o.n).indexOf(nq) === 0) ? 0 : 1; });
    lista.sort(function(a, b){
      if(a.g !== b.g) return a._i - b._i;
      return (a._p - b._p) || (a._i - b._i);
    });
  }
  if(!lista.length){
    c.pop.innerHTML = '<div class="combo-nada">No encontré ninguna que diga “' + esc(q.trim()) + '”. '
      + esc(c.root.getAttribute('data-nada') || '') + '</div>';
    return;
  }
  var html = '', g = null, vacio = c.root.getAttribute('data-vacio');
  if(!nq && vacio){
    html += '<button type="button" class="combo-o" role="option" data-v=""'
      + ' aria-selected="' + (actual ? 'false' : 'true') + '"><b>' + esc(vacio) + '</b></button>';
  }
  lista.forEach(function(o){
    if(o.g !== g){ g = o.g; if(g) html += '<div class="combo-g">' + esc(g) + '</div>'; }
    html += '<button type="button" class="combo-o" role="option" data-v="' + esc(o.v) + '"'
      + ' aria-selected="' + (o.v === actual ? 'true' : 'false') + '">'
      + '<b>' + resaltar(o.n, nq) + '</b><i>' + esc(o.tna) + '</i></button>';
  });
  c.pop.innerHTML = html;
}
function comboAbrir(c, q){
  if(!c) return;
  comboPintar(c, typeof q === 'string' ? q : '');
  c.pop.hidden = false;
  c.inp.setAttribute('aria-expanded','true');
  var el = c.pop.querySelector('.combo-o[aria-selected="true"]');
  if(el && el.scrollIntoView) try{ el.scrollIntoView({block:'nearest'}); }catch(x){}
}
function comboCerrar(c){
  if(!c) return;
  c.pop.hidden = true;
  c.inp.setAttribute('aria-expanded','false');
}
function comboCerrarTodos(){
  $$('.combo').forEach(function(r){ var c = comboPartes(r); if(c){ comboCerrar(c); comboEtiqueta(r); } });
}
function comboMover(c, paso){
  if(!c || c.pop.hidden) return;
  var ops = [].slice.call(c.pop.querySelectorAll('.combo-o'));
  if(!ops.length) return;
  var i = ops.indexOf(c.pop.querySelector('.combo-o.act'));
  if(i < 0) i = (paso > 0) ? -1 : 0;
  var j = (i + paso + ops.length) % ops.length;
  ops.forEach(function(o){ o.classList.remove('act'); });
  ops[j].classList.add('act');
  if(ops[j].scrollIntoView) try{ ops[j].scrollIntoView({block:'nearest'}); }catch(x){}
}
function comboElegir(c, v){
  if(!c) return;
  c.sel.value = v;
  comboCerrar(c);
  c.inp.blur();
  c.sel.dispatchEvent(new Event('change', {bubbles:true}));   // el resto lo hace el handler de siempre
}
function comboDelEvento(e){
  var root = e.target.closest ? e.target.closest('.combo') : null;
  return root ? comboPartes(root) : null;
}
document.addEventListener('focusin', function(e){
  if(!e.target.matches || !e.target.matches('.combo input[role="combobox"]')) return;
  comboAbrir(comboDelEvento(e), '');
  try{ e.target.select(); }catch(x){}
});
document.addEventListener('input', function(e){
  if(e.target.matches && e.target.matches('.combo input[role="combobox"]')) comboAbrir(comboDelEvento(e), e.target.value);
});
document.addEventListener('keydown', function(e){
  if(!e.target.matches || !e.target.matches('.combo input[role="combobox"]')) return;
  var c = comboDelEvento(e); if(!c) return;
  if(e.key === 'ArrowDown' || e.key === 'ArrowUp'){
    e.preventDefault();
    if(c.pop.hidden) comboAbrir(c, e.target.value);
    else comboMover(c, e.key === 'ArrowDown' ? 1 : -1);
    return;
  }
  if(e.key === 'Enter'){
    var m = c.pop.querySelector('.combo-o.act') || (c.pop.hidden ? null : c.pop.querySelector('.combo-o'));
    if(m){ e.preventDefault(); comboElegir(c, m.getAttribute('data-v')); }
    return;
  }
  if(e.key === 'Escape' || e.key === 'Esc'){
    e.stopPropagation(); comboCerrar(c); e.target.blur(); comboEtiqueta(c.root);
  }
});
document.addEventListener('mousedown', function(e){
  var op = e.target.closest ? e.target.closest('.combo-pop .combo-o') : null;   // v260: no las de .selpop
  if(op){ e.preventDefault(); comboElegir(comboDelEvento(e), op.getAttribute('data-v')); return; }
  if(e.target.closest && e.target.closest('.selpop')){ e.preventDefault(); return; }   // que no se vaya el foco al tocar la lista
  if(e.target.closest && e.target.closest('.combo')) return;
  comboCerrarTodos();
});
document.addEventListener('focusout', function(e){
  if(!e.target.matches || !e.target.matches('.combo input[role="combobox"]')) return;
  var c = comboDelEvento(e);
  setTimeout(function(){
    if(document.activeElement === c.inp) return;
    comboCerrar(c); comboEtiqueta(c.root);
  }, 120);
});

/* ---------- fecha compacta ---------- */
function esMes(inp){ return !!(inp && inp.getAttribute && inp.getAttribute('type') === 'month'); }
function pintarFecha(inp){
  if(inp.id === 'mFecha') pintarSueldoAyudas();
  var wrap = inp.closest ? inp.closest('.datewrap') : null;
  if(!wrap) return;
  var sm = wrap.querySelector('.datebtn .d-sm'), lg = wrap.querySelector('.datebtn .d-lg');
  if(!sm || !lg) return;
  var v = inp.value;
  if(!v){ sm.textContent = lg.textContent = '—'; wrap.removeAttribute('title'); return; }
  var m = parseInt(v.slice(5,7),10);
  if(esMes(inp)){
    var mes3 = (MESES[m-1]||'').slice(0,3);
    sm.textContent = mes3 + ' ' + v.slice(2,4);
    lg.textContent = mes3 + ' ' + v.slice(0,4);
    wrap.setAttribute('title', 'Elegir mes — ahora: ' + ymLabel(v));
    return;
  }
  var d = parseInt(v.slice(8,10),10);
  sm.textContent = d + '/' + m;
  lg.textContent = d + ' ' + (MESES[m-1]||'').slice(0,3) + ' ' + v.slice(0,4);
  wrap.setAttribute('title', 'Elegir fecha — ahora: ' + fechaLabel(v));
}
function pintarFechas(){ $$('.datewrap input').forEach(pintarFecha); }

document.addEventListener('input', function(e){
  if(e.target.matches && e.target.matches('.datewrap input')) pintarFecha(e.target);
});
document.addEventListener('change', function(e){
  if(e.target.matches && e.target.matches('.datewrap input')) pintarFecha(e.target);
});
/* ---------- calendario propio ----------
   El selector nativo (showPicker) no se puede abrir por código dentro de un
   iframe de otro origen, así que la app trae su propio calendario. */
var cal = null, calInput = null, calAncla = null;
function cerrarCal(){
  var mb = document.getElementById('mesBtn');
  if(mb) mb.setAttribute('aria-expanded','false');
  if(!cal) return;
  cal.parentNode && cal.parentNode.removeChild(cal);
  cal = null; calInput = null; calAncla = null;
  document.removeEventListener('keydown', calTecla, true);
  window.removeEventListener('resize', reubicarCal);
  if(window.visualViewport) window.visualViewport.removeEventListener('resize', reubicarCal);
  window.removeEventListener('scroll', reubicarCal, true);
}
function calTecla(e){ if(e.key === 'Escape' || e.key === 'Esc'){ e.stopPropagation(); cerrarCal(); } }
function reubicarCal(){
  if(!cal || !calAncla || !calAncla.getBoundingClientRect) return;
  var r = calAncla.getBoundingClientRect();
  if(r.width === 0 && r.height === 0){ cerrarCal(); return; }
  var w = cal.offsetWidth, h = cal.offsetHeight;
  var left = Math.min(Math.max(8, r.left), Math.max(8, window.innerWidth - w - 8));
  var top = r.bottom + 6;
  if(top + h > window.innerHeight - 8) top = Math.max(8, r.top - h - 6);
  cal.style.left = Math.round(left) + 'px';
  cal.style.top = Math.round(top) + 'px';
}
function pintarCal(ym, sel){
  var y = parseInt(ym.slice(0,4),10), m = parseInt(ym.slice(5,7),10);
  var arranque = (new Date(y, m-1, 1).getDay() + 6) % 7; // lunes = 0
  var dias = new Date(y, m, 0).getDate();
  var hoy = today();
  var html = '<div class="cal-top">'
    + '<button type="button" class="cal-nav" data-cal="-1" aria-label="Mes anterior">‹</button>'
    + '<b>' + esc(ymLabel(ym)) + '</b>'
    + '<button type="button" class="cal-nav" data-cal="1" aria-label="Mes siguiente">›</button></div>'
    + '<div class="cal-dow"><span>L</span><span>M</span><span>M</span><span>J</span><span>V</span><span>S</span><span>D</span></div>'
    + '<div class="cal-grid">';
  for(var i=0;i<arranque;i++) html += '<span></span>';
  for(var d=1; d<=dias; d++){
    var f = y + '-' + pad(m) + '-' + pad(d);
    html += '<button type="button" class="cal-d' + (f===sel?' sel':'') + (f===hoy?' hoy':'') + '" data-f="' + f + '"'
      + (f===sel?' aria-current="date"':'') + '>' + d + '</button>';
  }
  html += '</div><div class="cal-pie"><button type="button" class="btn ghost sm" data-f="' + hoy + '">Hoy</button></div>';
  cal.innerHTML = html;
  cal.setAttribute('data-ym', ym);
  cal.setAttribute('data-sel', sel || '');
}
function pintarCalMes(anio, sel){
  var hoy = ymNow();
  var html = '<div class="cal-top">'
    + '<button type="button" class="cal-nav" data-caly="-1" aria-label="Año anterior">‹</button>'
    + '<b>' + anio + '</b>'
    + '<button type="button" class="cal-nav" data-caly="1" aria-label="Año siguiente">›</button></div>'
    + '<div class="cal-meses">';
  for(var m=1; m<=12; m++){
    var ym = anio + '-' + pad(m);
    html += '<button type="button" class="cal-m' + (ym===sel?' sel':'') + (ym===hoy?' hoy':'') + '" data-ym="' + ym + '"'
      + (ym===sel?' aria-current="date"':'') + '>' + esc((MESES[m-1]||'').slice(0,3)) + '</button>';
  }
  html += '</div><div class="cal-pie"><button type="button" class="btn ghost sm" data-ym="' + hoy + '">Este mes</button></div>';
  cal.innerHTML = html;
  cal.setAttribute('data-y', String(anio));
  cal.setAttribute('data-sel', sel || '');
}
function abrirCal(inp, ancla){
  var yaEra = (calInput === inp);
  cerrarCal();
  if(yaEra) return;
  calInput = inp; calAncla = ancla;
  var soloMes = esMes(inp);
  cal = document.createElement('div');
  cal.className = 'cal' + (soloMes ? ' cal-mes' : '');
  cal.setAttribute('role','dialog');
  cal.setAttribute('aria-label', soloMes ? 'Elegir mes' : 'Elegir fecha');
  document.body.appendChild(cal);
  if(soloMes){
    var ym = inp.value || mes || ymNow();
    pintarCalMes(parseInt(ym.slice(0,4),10) || (new Date()).getFullYear(), ym);
  } else {
    var v = inp.value || defaultFecha();
    pintarCal(v.slice(0,7), v);
  }
  reubicarCal();
  document.addEventListener('keydown', calTecla, true);
  /* Al cambiar el tamaño de la ventana el calendario se REACOMODA, no se cierra.
     Parece un detalle y era un bug feo en el teléfono: si venías escribiendo el
     monto y tocabas el botón de la fecha, el teclado se cerraba, y cerrarse el
     teclado ES un cambio de tamaño de ventana. O sea: el calendario se abría y
     un décimo de segundo después se cerraba solo. Desde afuera se veía como un
     flash. Reacomodarlo también es lo correcto: mientras el teclado está abierto
     no entra abajo del botón y se dibuja arriba; cuando el teclado se va, vuelve
     a su lugar. Si el botón que lo ancló desapareció, `reubicarCal` igual lo
     cierra. `visualViewport` es para los navegadores donde el teclado no cambia
     el tamaño de la ventana pero sí el del área visible. */
  window.addEventListener('resize', reubicarCal);
  if(window.visualViewport) window.visualViewport.addEventListener('resize', reubicarCal);
  window.addEventListener('scroll', reubicarCal, true);
  var sel = cal.querySelector('.cal-d.sel, .cal-m.sel') || cal.querySelector('.cal-d, .cal-m');
  if(sel) try{ sel.focus({preventScroll:true}); }catch(x){}
}
document.addEventListener('click', function(e){
  var btn = e.target.closest ? e.target.closest('.datebtn') : null;
  if(btn){
    e.preventDefault();
    var inp = btn.parentNode.querySelector('input');
    if(inp) abrirCal(inp, btn);
    return;
  }
  var mb = e.target.closest ? e.target.closest('#mesBtn') : null;
  if(mb){
    e.preventDefault();
    var mi = $('#mesInput');
    if(mi){ mi.value = mes; abrirCal(mi, mb); mb.setAttribute('aria-expanded', cal ? 'true' : 'false'); }
    return;
  }
  if(!cal) return;
  var nav = e.target.closest('.cal [data-cal]');
  if(nav){
    pintarCal(ymAdd(cal.getAttribute('data-ym'), parseInt(nav.getAttribute('data-cal'),10)), cal.getAttribute('data-sel'));
    reubicarCal();
    return;
  }
  var navA = e.target.closest('.cal [data-caly]');
  if(navA){
    pintarCalMes(parseInt(cal.getAttribute('data-y'),10) + parseInt(navA.getAttribute('data-caly'),10), cal.getAttribute('data-sel'));
    reubicarCal();
    return;
  }
  var elMes = e.target.closest('.cal [data-ym]');
  if(elMes){
    if(calInput){
      calInput.value = elMes.getAttribute('data-ym');
      calInput.dispatchEvent(new Event('input', {bubbles:true}));
      calInput.dispatchEvent(new Event('change', {bubbles:true}));
    }
    cerrarCal();
    return;
  }
  var dia = e.target.closest('.cal [data-f]');
  if(dia){
    var f = dia.getAttribute('data-f');
    if(calInput){
      calInput.value = f;
      calInput.dispatchEvent(new Event('input', {bubbles:true}));
      calInput.dispatchEvent(new Event('change', {bubbles:true}));
    }
    cerrarCal();
    return;
  }
  if(!e.target.closest('.cal')) cerrarCal();
});

/* ---------- v260: los desplegables se abren como el calendario ----------
   El <select> de siempre sigue estando (y la app lo lee igual), pero al tocarlo
   no se abre la lista del sistema: se abre una lista nuestra, con el mismo
   vidrio que el calendario de las fechas. Los que están escondidos adentro de un
   buscador (.combo) siguen como estaban. */
var selPop = null, selAncla = null, selToque = null;
var SEL_TILDE = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
function selSirve(s){
  return !!(s && s.tagName === 'SELECT' && !s.multiple && !s.disabled && !s.closest('.combo')
    && s.getAttribute('aria-hidden') !== 'true' && !s.hasAttribute('data-nativo'));
}
/* el desplegable que está debajo del dedo o del mouse, buscando adentro de lo que se tocó */
function selEnPunto(t, x, y){
  if(!t || t.nodeType !== 1) return null;
  if(t.tagName === 'SELECT') return selSirve(t) ? t : null;
  var c = t.closest('label');
  if(c && c.control && c.control.tagName === 'SELECT') return selSirve(c.control) ? c.control : null;
  var ss = t.querySelectorAll ? t.querySelectorAll('select') : [];
  for(var i = 0; i < ss.length; i++){
    if(!selSirve(ss[i])) continue;
    var r = ss[i].getBoundingClientRect();
    if(r.width && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return ss[i];
  }
  return null;
}
function selPopCerrar(volver){
  if(!selPop) return;
  var s = selAncla;
  selPop.parentNode && selPop.parentNode.removeChild(selPop);
  selPop = null; selAncla = null;
  if(s) s.classList.remove('abierto');
  document.removeEventListener('keydown', selPopTecla, true);
  window.removeEventListener('resize', selPopUbicar);
  if(window.visualViewport) window.visualViewport.removeEventListener('resize', selPopUbicar);
  window.removeEventListener('scroll', selPopUbicar, true);
  if(volver && s) try{ s.focus({ preventScroll:true }); }catch(x){}
}
function selPopUbicar(e){
  if(!selPop || !selAncla) return;
  if(e && e.type === 'scroll' && e.target && e.target.nodeType === 1 && selPop.contains(e.target)) return;
  var r = selAncla.getBoundingClientRect();
  if(r.width === 0 && r.height === 0){ selPopCerrar(); return; }
  var vw = window.innerWidth, vh = window.innerHeight;
  selPop.style.minWidth = Math.round(Math.min(Math.max(r.width, 180), vw - 16)) + 'px';
  selPop.style.maxWidth = Math.round(Math.min(Math.max(r.width, 360), vw - 16)) + 'px';
  var w = selPop.offsetWidth, h = selPop.offsetHeight;
  var left = Math.min(Math.max(8, r.left), Math.max(8, vw - w - 8));
  var top = r.bottom + 6;
  if(top + h > vh - 8) top = (r.top - h - 6 >= 8) ? r.top - h - 6 : Math.max(8, vh - h - 8);
  selPop.style.left = Math.round(left) + 'px';
  selPop.style.top = Math.round(top) + 'px';
}
function selPopAbrir(s){
  var yaEra = (selAncla === s);
  selPopCerrar();
  if(yaEra) return;
  if(typeof cerrarCal === 'function') cerrarCal();
  selAncla = s; s.classList.add('abierto');
  var html = '';
  function opt(o){
    if(o.hidden) return;
    html += '<button type="button" class="combo-o" role="option" data-si="' + o.index + '"' + (o.disabled ? ' disabled' : '')
      + ' aria-selected="' + (o.selected ? 'true' : 'false') + '"><b>' + esc(o.textContent) + '</b>' + (o.selected ? SEL_TILDE : '') + '</button>';
  }
  [].forEach.call(s.children, function(ch){
    if(ch.tagName === 'OPTGROUP'){ html += '<div class="combo-g">' + esc(ch.label || '') + '</div>'; [].forEach.call(ch.children, opt); }
    else if(ch.tagName === 'OPTION') opt(ch);
  });
  selPop = document.createElement('div');
  selPop.className = 'cal selpop';
  selPop.setAttribute('role', 'listbox');
  var lab = s.getAttribute('aria-label') || (s.id && document.querySelector('label[for="' + s.id + '"]') ? document.querySelector('label[for="' + s.id + '"]').textContent : '');
  if(lab) selPop.setAttribute('aria-label', lab);
  selPop.innerHTML = html || '<div class="combo-nada">No hay opciones</div>';
  document.body.appendChild(selPop);
  selPopUbicar();
  document.addEventListener('keydown', selPopTecla, true);
  window.addEventListener('resize', selPopUbicar);
  if(window.visualViewport) window.visualViewport.addEventListener('resize', selPopUbicar);
  window.addEventListener('scroll', selPopUbicar, true);
  var el = selPop.querySelector('[aria-selected="true"]') || selPop.querySelector('.combo-o:not(:disabled)');
  if(el){
    try{ el.scrollIntoView({ block:'nearest' }); }catch(x){}
    try{ el.focus({ preventScroll:true }); }catch(x){}
  }
}
/* v280: después de elegir con el dedo o el mouse NO se le devuelve el foco al
   <select>. En el iPhone, enfocar un <select> justo después de un toque abre la
   lista del sistema: era la "segunda lista" que aparecía al elegir una opción,
   en todos los desplegables. Con el teclado (Enter sobre una opción) sí vuelve,
   para no perder el lugar. */
function selElegir(i, teclado){
  var s = selAncla; if(!s) return;
  var cambia = s.selectedIndex !== i;
  s.selectedIndex = i;
  selPopCerrar(!!teclado);
  if(cambia){
    s.dispatchEvent(new Event('input', { bubbles:true }));
    s.dispatchEvent(new Event('change', { bubbles:true }));
  }
}
function selPopTecla(e){
  if(!selPop) return;
  var k = e.key, bs = [].slice.call(selPop.querySelectorAll('.combo-o:not(:disabled)')), i = bs.indexOf(document.activeElement);
  if(k === 'Escape' || k === 'Esc'){ e.preventDefault(); e.stopPropagation(); selPopCerrar(true); return; }
  if(k === 'Tab'){ selPopCerrar(); return; }
  if(k === 'ArrowDown' || k === 'ArrowUp' || k === 'Home' || k === 'End'){
    e.preventDefault(); e.stopPropagation();
    var n = k === 'Home' ? 0 : k === 'End' ? bs.length - 1 : (i < 0 ? 0 : Math.max(0, Math.min(bs.length - 1, i + (k === 'ArrowDown' ? 1 : -1))));
    if(bs[n]) try{ bs[n].focus(); bs[n].scrollIntoView({ block:'nearest' }); }catch(x){}
  }
}
// abrir: con el mouse, con un toque (sin haber arrastrado) o con el teclado
document.addEventListener('mousedown', function(e){
  if(e.button !== 0 || !e.target.closest) return;
  if(e.target.closest('.selpop')) return;
  var s = selEnPunto(e.target, e.clientX, e.clientY);
  if(!s) return;
  e.preventDefault();
  selPopAbrir(s);
}, true);
document.addEventListener('touchstart', function(e){
  if(e.touches.length !== 1 || (e.target.closest && e.target.closest('.selpop'))){ selToque = null; return; }
  var x = e.touches[0].clientX, y = e.touches[0].clientY;
  var s = selEnPunto(e.target, x, y);
  selToque = s ? { s:s, x:x, y:y } : null;
}, { capture:true, passive:true });
document.addEventListener('touchend', function(e){
  var t = selToque; selToque = null;
  if(!t || !e.changedTouches.length) return;
  var c = e.changedTouches[0];
  if(Math.abs(c.clientX - t.x) > 10 || Math.abs(c.clientY - t.y) > 10) return;   // venía scrolleando
  if(e.cancelable) e.preventDefault();
  selPopAbrir(t.s);
}, { capture:true, passive:false });
document.addEventListener('keydown', function(e){
  var s = e.target;
  if(selPop || !selSirve(s)) return;
  if(e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp' || e.key === 'F4'){ e.preventDefault(); selPopAbrir(s); }
}, true);
document.addEventListener('click', function(e){
  if(!selPop || !e.target.closest) return;
  var b = e.target.closest('.selpop .combo-o');
  if(b){ e.stopPropagation(); if(!b.disabled) selElegir(parseInt(b.getAttribute('data-si'), 10), e.detail === 0); return; }
  if(e.target.closest('.selpop')) return;
  if(selEnPunto(e.target, e.clientX, e.clientY) === selAncla) return;
  selPopCerrar();
}, true);
/* v280: red de seguridad. Si igual un desplegable recibe el foco justo después de
   un toque (algo que el iPhone hace por su cuenta), se lo saca enseguida: el foco
   es lo que abre la lista del sistema. Con el teclado no pasa, porque no hubo toque. */
var selUltToque = 0;
document.addEventListener('touchend', function(){ selUltToque = Date.now(); }, { capture:true, passive:true });
document.addEventListener('focusin', function(e){
  var s = e.target;
  if(!s || s.tagName !== 'SELECT' || !selSirve(s)) return;
  if(Date.now() - selUltToque > 1200) return;
  try{ s.blur(); }catch(x){}
}, true);
/* tocar la etiqueta de un desplegable ("Categoría") abre la lista nuestra, no la del sistema */
document.addEventListener('click', function(e){
  var l = e.target.closest ? e.target.closest('label') : null;
  if(!l || !l.control || l.control.tagName !== 'SELECT' || !selSirve(l.control)) return;
  e.preventDefault();
  if(selAncla !== l.control) selPopAbrir(l.control);
}, true);

/* Como el gráfico se dibuja al ancho real, hay que rehacerlo cuando cambia. */
var _redibujo = null;
window.addEventListener('resize', function(){
  clearTimeout(_redibujo);
  _redibujo = setTimeout(function(){ renderResumen(); pintarLupa(); }, 150);
});

/* fechas por defecto según el mes elegido */
function syncFechas(){
  $('#mFecha').value = defaultFecha();
  $('#qDesde').value = mes;
  if($('#fDesde')) $('#fDesde').value = mes;
  if($('#fFecha')) $('#fFecha').value = defaultFecha();
  pintarFechas();
  previewCuota();
}
