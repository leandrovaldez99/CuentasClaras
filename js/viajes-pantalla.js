/* Cuentas Claras · js/viajes-pantalla.js
   La pantalla de los viajes: lista, detalle, formulario de gastos y cierre.

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

/* ---- pantalla ---- */
function fechaHoraCorta(ms){
  if(!ms) return '';
  var d = new Date(ms), f = d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate());
  return (f === today() ? 'hoy' : fechaLabel(f)) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
}
/* Los viajes que se ofrecen en el "+": los tuyos (ya elegiste quién sos), con
   movimiento en los últimos dos meses, el más reciente primero. */
function vjViajesCarga(){
  return (S.viajes || []).filter(function(v){ return v.yo && vjMiembro(v, v.yo) && nsActivo(v) && !vjCerrado(v); })
    .sort(function(a, b){ return vjUltimoMov(b) - vjUltimoMov(a); });
}
function vjViajeCarga(){
  var l = vjViajesCarga(); if(!l.length) return null;
  var s2 = viajeSel ? l.filter(function(v){ return v.id === viajeSel; })[0] : null;
  return s2 || l[0];
}
function vjEnCarga(){ return vista === 'cargar' && cargaTab === 'viaje'; }
function vjCont(){ return vjEnCarga() ? $('#cargaViaje') : $('#viajeCuerpo'); }
/* El formulario del viaje vive en uno de dos lugares: la pantalla del viaje o
   la de carga. Si el que se ve no es el que está dibujado, se redibuja. */
function vjSincContenedor(){
  var c = $('#cargaViaje'), vc = $('#viajeCuerpo');
  if(vjEnCarga() ? !(c && c.firstChild) : ((c && c.firstChild) || (vista === 'viaje' && vc && !vc.firstChild))) renderViaje();
}
function vjCargaHtml(v){
  var l = vjViajesCarga(), html = '';
  if(l.length > 1){
    html += '<div class="chips vj-cual" role="group" aria-label="Qué viaje">'
      + l.map(function(x){ return '<button type="button" data-vjcarga="' + esc(x.id) + '" aria-pressed="' + (x.id === v.id ? 'true' : 'false') + '">' + esc(x.nombre) + '</button>'; }).join('')
      + '</div>';
  }
  return html + nsEstadoHtml(v) + vjFormHtml(v, null)
    + '<div class="rowflex" style="margin-top:12px"><button class="btn ghost sm" type="button" data-vjver="' + esc(v.id) + '">Ver el viaje y cómo se salda</button></div>';
}
function renderViaje(){
  var enC = vjEnCarga(), el = enC ? $('#cargaViaje') : $('#viajeCuerpo'), otro = enC ? $('#viajeCuerpo') : $('#cargaViaje');
  if(!el) return;
  if(otro) otro.innerHTML = '';
  if(ns) ns.repintar = false;
  if(enC){
    var vc = vjViajeCarga();
    if(!vc){ el.innerHTML = ''; cargaTab = 'gasto'; pintarCarga(); return; }
    viajeSel = vc.id;
    el.innerHTML = vjCargaHtml(vc);
    pintarFechas();
    return;
  }
  var v = viajeSel ? viajePorId(viajeSel) : null;
  if(!v){ viajeSel = null; vjArchVista = null; el.innerHTML = vjInicioHtml(); vjArchivarViejos(); return; }
  el.innerHTML = vjDetalleHtml(v);
  pintarFechas();
}
/* Pegar a mano: quedó de cuando los gastos se pasaban por WhatsApp. Con la
   sincronización sola ya no hace falta, así que sólo aparece donde todavía
   sirve: en "Tus viajes", por si el link de una invitación no abrió la app, y
   adentro de un viaje únicamente si ese viaje no se puede sincronizar solo. */
function vjPegarHtml(tipo){
  var inv = tipo === 'inv';
  return '<details class="vj-pegar"><summary>' + (inv ? '¿El link de la invitación no te abrió la app? Pegalo acá' : '¿Te mandaron gastos por WhatsApp? Pegalos acá') + '</summary>'
    + '<textarea id="vjPegar" rows="3" placeholder="Pegá el mensaje entero de WhatsApp"></textarea>'
    + '<div class="rowflex" style="margin-top:8px"><button class="btn" type="button" data-vjsumar>Sumar</button></div></details>';
}
function vjManual(v){ return !nsHay() || !nsActivo(v); }
function vjInicioHtml(){
  var lista = (S.viajes||[]).filter(function(v){ return !vjCerrado(v); }).sort(function(a,b){ return (b.creado||0) - (a.creado||0); });
  var html = '<div class="card" style="margin-bottom:14px"><div class="card-head"><div><h2>Grupo y gastos de viaje</h2>'
    + '<p class="sub">Un grupo para un viaje o una salida. Cada uno anota lo que paga y al final la app dice quién le pasa a quién. Mandás la invitación una vez y, con internet, los gastos les llegan solos a los demás, cifrados. Sin cuentas: cada celular tiene su copia.</p></div>'
    + '<button class="btn ghost sm" data-volver type="button">Volver</button></div>'
    + vjPegarHtml('inv') + '</div>';
  html += '<div class="card" style="margin-bottom:14px"><div class="card-head"><div><h2>Nuevo viaje</h2>'
    + '<p class="sub">Después mandás el link al grupo: cada uno se suma y pone su nombre.</p></div></div>'
    + '<form class="form2" id="vjNuevo">'
    + '<div class="field full"><label class="lab" for="vjNom">Nombre</label><input id="vjNom" type="text" maxlength="40" placeholder="Ej: Bariloche 2026" autocomplete="off"></div>'
    + '<div class="field full"><label class="lab" for="vjYo">Tu nombre</label><input id="vjYo" type="text" maxlength="28" placeholder="Como te conocen" autocomplete="off"></div>'
    + '<div class="field full vj-nmon"><span class="lab">¿Van a usar otra moneda además del peso?</span><div class="chips" role="group" aria-label="Monedas del viaje">'
    +   VJ_MONS.map(function(c){ return '<button type="button" data-vjnmon="' + c + '" aria-pressed="' + (vjNuevoMons.indexOf(c) > -1) + '">' + esc(vjMonNombre(c)) + '</button>'; }).join('')
    +   '</div><small class="pista" id="vjNuevoMonsPista">' + (vjNuevoMons.length ? 'Van a poder anotar gastos en pesos y en ' + esc(vjLista(vjNuevoMons.map(function(c){ return vjMonNombre(c).toLowerCase(); }))) + '.' : 'Sólo pesos. Para la costa, por ejemplo, no hace falta ninguna; las podés sumar después.') + '</small></div>'
    + '<div class="field full"><button class="btn" type="submit">Crear viaje</button></div></form></div>';
  if(lista.length){
    html += '<div class="card"><div class="card-head"><div><h2>Tus viajes</h2></div></div><div class="rows">'
      + lista.map(function(v){
          var c = vjCuentas(v), n = vjVivos(v).length;
          var listos = v.miembros.filter(vjListo).length;
          return '<div class="row editable" data-vjabrir="' + esc(v.id) + '"><span class="mark meta">' + VJ_ICONO + '</span>'
            + '<span class="t"><b>' + esc(v.nombre) + '</b><small>' + v.miembros.length + ' personas · ' + n + (n === 1 ? ' gasto' : ' gastos')
            + (listos ? ' · ' + listos + ' de ' + v.miembros.length + ' ya cargaron todo' : '') + '</small></span>'
            + '<span class="amt neu">' + esc(money(c.total)) + '</span></div>';
        }).join('') + '</div></div>';
  }
  html += vjHistorialHtml();
  return html;
}
/* Los viajes terminados: los de los últimos 30 días todavía están enteros en
   S.viajes; los más viejos, sólo con su resumen (el detalle se lee al abrirlo). */
function vjHistorialHtml(){
  var hist = (S.viajes || []).filter(vjCerrado).map(function(v){ var r = vjResumen(v); r.vivo = vjReabrible(v); return r; })
    .concat((S.vjHist || []).filter(function(h){ return !viajePorId(h.id) || (vjArchVista && vjArchVista.id === h.id); }))
    .sort(function(a, b){ return b.c - a.c; });
  if(!hist.length) return '';
  return '<div class="card" style="margin-top:14px"><div class="card-head"><div><h2>Historial</h2>'
    + '<p class="sub">Los viajes que ya terminaron' + (hist.length > 1 ? ' · ' + hist.length : '') + '</p></div></div><div class="rows">'
    + hist.map(function(h){
        var cuando = h.d ? (h.h && h.h !== h.d ? fechaLabel(h.d) + ' → ' + fechaLabel(h.h) : fechaLabel(h.d)) : 'terminado el ' + fechaLabel(vjDiaDe(h.c));
        return '<div class="row editable" data-vjhist="' + esc(h.id) + '"><span class="mark carry">' + VJ_ICONO + '</span>'
          + '<span class="t"><b>' + esc(h.n) + '</b><small>' + esc(cuando) + ' · ' + h.p + ' personas · tu parte ' + esc(money(h.mia))
          + (h.mia > 0 && !h.car ? ' · <span class="warn">falta sumarla a tus gastos</span>' : '')
          + (h.vivo ? ' · se puede reabrir' : '') + '</small></span>'
          + '<span class="amt neu">' + esc(money(h.tot)) + '</span></div>';
      }).join('') + '</div></div>';
}
var VJ_ICONO = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="7" width="14" height="13" rx="2.2"/><path d="M9 7V5.4A1.4 1.4 0 0110.4 4h3.2A1.4 1.4 0 0115 5.4V7M9 11v5M15 11v5"/></svg>';
function vjDetalleHtml(v){
  var yo = v.yo, c = vjCuentas(v);
  var nm = v.miembros.length, cerr = vjCerrado(v), arch = !!v.arch;
  var html = '<div class="card" style="margin-bottom:14px"><div class="card-head"><div><h2>' + esc(v.nombre) + '</h2>'
    + '<p class="sub">' + (yo ? 'Vos sos <b>' + esc(vjNombre(v, yo)) + '</b> · ' + nm + (nm === 1 ? ' persona' : ' personas')
                              : 'En el grupo: ' + v.miembros.map(function(m){ return esc(m.n); }).join(', '))
    + (cerr ? ' · <b class="vj-term">terminado el ' + esc(fechaLabel(vjDiaDe(v.cierre.t))) + '</b>' : '') + '</p></div>'
    + '<button class="btn ghost sm" type="button" data-vjvolver>Tus viajes</button></div>';
  if(!yo && !cerr){
    if(!vjDesdeUI || vjDesdeUI.para !== 'yo') vjDesdeUI = { para:'yo', modo:'f', fecha:today(), hora:ahoraHM() };
    html += '<div class="vj-quien"><p><b>Sumate al viaje.</b> Poné tu nombre y desde cuándo estás: los gastos de antes de que llegues no te tocan.</p>'
      + '<div class="field"><label class="lab" for="vjSoyNuevo">Tu nombre</label><input id="vjSoyNuevo" type="text" maxlength="28" placeholder="Como te conocen" autocomplete="off" style="max-width:320px"></div>'
      + '<div class="field" style="margin-top:12px"><span class="lab">Estás</span>' + vjDesdeHtml() + '</div>'
      + '<button class="btn" type="button" data-vjsoynuevo style="margin-top:14px">Sumarme</button>'
      + (nm ? '<p class="note" style="margin:18px 0 8px">¿Ya estabas en el grupo y cambiaste de celular? Tocá tu nombre:</p><div class="chips">'
        + v.miembros.map(function(m){ return '<button type="button" data-vjsoy="' + esc(m.i) + '">' + esc(m.n) + '</button>'; }).join('') + '</div>' : '')
      + '</div></div>';
    return html;
  }
  if(!arch) html += nsEstadoHtml(v);
  if(!cerr) html += '<div class="rowflex vj-acciones">'
    + '<button class="btn" type="button" data-vjinvitar>Invitar</button>'
    + (vjManual(v) ? '<button class="btn ghost" type="button" data-vjmandar>Mandar mis gastos por WhatsApp</button>' : '') + '</div>';
  if(vjCompartir && !cerr){
    var wa = 'https://wa.me/?text=' + encodeURIComponent(vjCompartir.txt);
    html += '<div class="vj-caja"><p class="note" style="margin:0 0 6px">' + (vjCompartir.tipo === 'i' ? 'La invitación' : 'Tus gastos') + ', lista para mandar:</p>'
      + '<textarea readonly rows="4" id="vjSalida">' + esc(vjCompartir.txt) + '</textarea>'
      + '<div class="rowflex" style="margin-top:8px"><a class="btn" href="' + esc(wa) + '" target="_blank" rel="noopener">Abrir WhatsApp</a>'
      + '<button class="btn ghost" type="button" data-vjcopiar>Copiar</button>'
      + '<button class="btn ghost" type="button" data-vjqr>' + (vjCompartir.qr ? 'Ocultar QR' : 'Mostrar QR') + '</button>'
      + '<button class="btn ghost sm" type="button" data-vjcerrarcaja>Listo</button></div>'
      + (vjCompartir.qr
          ? '<div class="vj-qr">' + vjCompartir.qr + '<p class="note">Que lo escanee con la cámara del teléfono: si tiene la app, se abre sola. '
            + esc(vjCompartir.qrNota || '') + '</p></div>'
          : '')
      + '</div>';
  }
  // quiénes están, desde cuándo, y hasta cuándo tengo lo de cada uno
  var otros = v.miembros.filter(function(m){ return m.i !== yo; });
  html += '<div class="vj-gente"><div class="lab">En el viaje</div>' + v.miembros.map(function(m){
      var t = v.vis[m.i], desde = m.d ? (m.d > today() ? 'llega el ' : 'desde el ') + fechaLabel(m.d) + (m.h ? ' a las ' + m.h : '') : 'desde el principio';
      var datos = m.i === yo ? '' : ' · ' + (t ? 'lo suyo hasta ' + esc(fechaHoraCorta(t)) : '<span class="falta">todavía no mandó nada</span>');
      var ed = vjMiembroEdit === m.i;
      return '<div class="vj-per" data-vjper="' + esc(m.i) + '"><span class="vj-per-n"><b>' + esc(m.n) + '</b>' + (m.i === yo ? '<i>vos</i>' : '') + '</span>'
        + (ed || cerr ? '' : '<button type="button" class="linkbtn" data-vjmedit="' + esc(m.i) + '" aria-label="Cambiar desde cuándo está ' + esc(m.n) + '">Cambiar</button>')
        + '<small>' + esc(desde) + (arch ? '' : datos) + (!cerr && vjListo(m) ? ' · <span class="listo">ya cargó todo</span>' : '') + '</small>'
        + (ed ? '<div class="vj-per-ed"><span class="lab">' + esc(m.n) + ' está</span>' + vjDesdeHtml()
            + '<div class="rowflex" style="gap:8px"><button class="btn sm" type="button" data-vjmguardar="' + esc(m.i) + '">Guardar</button>'
            + '<button class="btn ghost sm" type="button" data-vjmcancelar>Cancelar</button></div></div>' : '')
        + '</div>';
    }).join('')
    + (cerr ? '' : '<p class="note" style="margin:8px 0 0">Los gastos de antes de que alguien llegue no le tocan, salvo que lo agregues a mano en ese gasto.</p>') + '</div>';
  html += (cerr ? vjTerminadoHtml(v) : (vjManual(v) ? vjPegarHtml('g') : '')) + '</div>';

  // formulario
  var g = vjEdit ? vjGastoPorId(v, vjEdit) : null;
  if(!cerr) html += '<div class="card" style="margin-bottom:14px"><div class="card-head"><div><h2>' + (g ? 'Corregir gasto' : 'Anotar un gasto') + '</h2>'
    + '<p class="sub">' + (g ? 'Cargado por ' + esc(vjNombre(v, g.por)) : 'Lo que pagó cualquiera del grupo') + '</p></div></div>'
    + vjFormHtml(v, g) + '</div>';

  // lista
  var vivos = vjVivos(v).slice().sort(function(a,b){ return a.f === b.f ? b.t - a.t : (a.f < b.f ? 1 : -1); });
  var lh = '<div class="card" style="margin-bottom:14px"><div class="card-head"><div><h2>Gastos</h2><p class="sub">'
    + (vivos.length ? vivos.length + (vivos.length === 1 ? ' gasto' : ' gastos') + ' · ' + esc(money(c.total)) + ' en total' + (cerr ? '' : ' · tocá uno para corregirlo') : 'Todavía no hay gastos') + '</p></div></div>';
  lh += vivos.length ? '<div class="rows">' + vivos.map(function(x){
      var n = Object.keys(vjPartes(v, x)).length, noc = x.f2 ? vjNoches(x.f, x.f2).length : 0;
      var todos = n === v.miembros.length;
      return '<div class="row' + (cerr ? '' : ' editable') + (vjEdit === x.i ? ' propuesta' : '') + '"' + (cerr ? '' : ' data-vjgasto="' + esc(x.i) + '"') + '><span class="mark meta">' + iconFor('out') + '</span>'
        + '<span class="t"><b>' + esc(x.d || x.c || 'Gasto') + '</b><small>'
        + (noc ? esc(fechaLabel(x.f) + ' → ' + fechaLabel(x.f2)) + ' · ' + noc + (noc === 1 ? ' noche' : ' noches')
               : esc(fechaLabel(x.f)) + (x.h ? ' ' + esc(x.h) : ''))
        + ' · pagó ' + esc(vjNombre(v, x.pag))
        + ' · ' + (noc ? 'cada noche entre los que estaban' : todos ? 'entre todos' : x.a ? 'entre los ' + n + ' que estaban' : 'entre ' + n)
        + (x.mu > 0 ? ' · ' + esc(money(x.mo)) + ' con el ' + esc(vjMonNombre(x.mm || 'USD').toLowerCase()) + ' a ' + esc(moneyCot(x.cot)) : '') + '</small></span>'
        + '<span class="acts"><span class="amt neu">' + esc(x.mu > 0 ? vjFmt(x.mu, x.mm || 'USD') : money(x.mo)) + '</span>'
        + (cerr ? '' : vjBorrar === x.i ? '<button class="confirm" type="button" data-vjborrar="' + esc(x.i) + '">Borrar</button>'
            : '<button class="iconbtn" type="button" data-vjborrar="' + esc(x.i) + '" aria-label="Borrar"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg></button>')
        + '</span></div>';
    }).join('') + '</div>' : emptyBox(cerr ? 'Este viaje terminó sin gastos' : 'Anotá el primero arriba');
  lh += '</div>';

  // cuentas
  var ch = '', ph = '';
  if(vivos.length){
    var miParte = c.toca[yo] || 0, puse = c.puso[yo] || 0;
    ch += '<div class="card" style="margin-bottom:14px"><div class="card-head"><div><h2>' + (cerr ? 'Cuentas finales' : 'Cómo se salda') + '</h2><p class="sub">'
      + (cerr ? 'Así quedó el viaje: quién le pasa a quién' : 'Con lo que tenés hasta ahora' + (otros.some(function(m){ return !v.vis[m.i]; }) ? ' · <span class="warn">todavía te faltan los gastos de alguien</span>' : '')) + '</p></div></div>'
      + '<div class="grid g4 vj-tiles"><div class="tile bal"><span class="stripe"></span><div class="lab">Total</div><div class="num">' + esc(money(c.total)) + '</div></div>'
      + '<div class="tile meta-c"><span class="stripe"></span><div class="lab">Tu parte</div><div class="num">' + esc(money(miParte)) + '</div></div>'
      + '<div class="tile out"><span class="stripe"></span><div class="lab">Pusiste</div><div class="num">' + esc(money(puse)) + '</div></div>'
      + '<div class="tile ' + (puse - miParte >= 0 ? 'in' : 'out') + '"><span class="stripe"></span><div class="lab">' + (puse - miParte >= 0 ? 'Te deben' : 'Debés') + '</div><div class="num">' + esc(money(Math.abs(puse - miParte))) + '</div></div></div>';
    ch += c.pases.length ? '<div class="rows" style="margin-top:12px">' + c.pases.map(function(p){
        var mio = (p.de === yo || p.a === yo);
        return '<div class="settle' + (mio ? ' vj-mio' : '') + '"><span class="who"><em>' + esc(vjNombre(v, p.de)) + '</em><span class="arrow">le pasa a</span><em>' + esc(vjNombre(v, p.a)) + '</em></span>'
          + '<span class="amt2">' + esc(money(p.monto)) + '</span></div>';
      }).join('') + '</div>' : '<div class="empty">Está parejo: nadie le debe nada a nadie.</div>';
    // cargar mi parte
    var hecho = v.cargado;
    ph = '<p class="note" style="margin:0 0 10px">' + (hecho
        ? ('Ya cargaste ' + esc(money(hecho.monto)) + ' el ' + esc(fechaLabel(hecho.fecha)) + '. Si después llegaron gastos nuevos, actualizalo: se reemplaza, no se suma dos veces.')
        : ('Entra lo que te tocó (' + esc(money(miParte)) + '), repartido por categoría, no lo que pusiste. Lo que te pasen o pases para saldar no es un gasto.')) + '</p>'
      + '<div class="rowflex"><select id="vjMedio" style="max-width:220px">' + opcionesMedio(hecho && hecho.medio ? hecho.medio : 'Efectivo') + '</select>'
      + '<button class="btn' + (hecho ? ' ghost' : '') + '" type="button" data-vjcargar>' + (hecho ? 'Actualizar mi parte' : 'Cargar mi parte en mis gastos') + '</button></div>';
    if(cerr){
      // terminado: tu parte va arriba de todo y, si falta, te la pide
      var pide = !hecho && miParte > 0;
      ph = '<div class="card vj-tuparte' + (pide ? ' pide' : '') + '" style="margin-bottom:14px"><div class="card-head"><div><h2>'
        + (pide ? 'El viaje terminó: ¿sumás tu parte a tus gastos?' : 'Tu parte en tus gastos') + '</h2>'
        + '<p class="sub">Te tocaron ' + esc(money(miParte)) + ' del viaje</p></div></div>' + ph + '</div>';
    } else {
      ch += '<div class="hr"></div><div class="lab" style="margin-bottom:8px">Tu parte en tus gastos</div>' + ph;
      ph = '';
    }
    ch += '</div>';
  }
  html += cerr ? ph + ch + lh : lh + ch + vjTerminarHtml(v);
  html += '<div class="rowflex" style="justify-content:flex-end"><button class="btn ghost sm" type="button" data-vjsalir style="color:var(--out);border-color:var(--out)">'
    + (vjBorrar === '@viaje' ? (arch ? 'Tocá otra vez para borrarlo del historial' : 'Tocá otra vez para borrar el viaje de este celular')
                             : (arch ? 'Borrar del historial' : 'Borrar el viaje de este celular')) + '</button></div>';
  return html;
}
/* Abierto: cada uno confirma que ya cargó lo suyo. Con todos, se cierra solo. */
function vjTerminarHtml(v){
  var yoM = vjMiembro(v, v.yo); if(!yoM) return '';
  var listos = v.miembros.filter(vjListo), faltan = v.miembros.filter(function(m){ return !vjListo(m); });
  var html = '<div class="card vj-terminar" style="margin-bottom:14px"><div class="card-head"><div><h2>Terminar el viaje</h2>'
    + '<p class="sub">Cuando todos confirman que ya cargaron lo suyo, el viaje se cierra solo y pasa al historial.</p></div></div>'
    + '<div class="vj-listos">' + v.miembros.map(function(m){
        return '<span class="' + (vjListo(m) ? 'si' : '') + '">' + (vjListo(m) ? '✓ ' : '') + esc(m.n) + (m.i === v.yo ? ' (vos)' : '') + '</span>';
      }).join('') + '</div>'
    + '<p class="note" style="margin:0 0 10px">' + (listos.length ? 'Confirmaron ' + listos.length + ' de ' + v.miembros.length + '. ' : '')
    + (faltan.length ? 'Falta' + (faltan.length > 1 ? 'n ' : ' ') + vjLista(faltan.map(function(m){ return m.i === v.yo ? 'vos' : m.n; })) + '.' : '') + '</p>';
  if(vjListo(yoM)){
    html += '<p class="note" style="margin:0 0 10px">Confirmaste ' + esc(fechaHoraCorta(yoM.ok)) + '. Si te acordás de algo, anotalo igual: tu confirmación se saca sola hasta que vuelvas a confirmar.</p>'
      + '<div class="rowflex"><button class="btn ghost sm" type="button" data-vjnolisto>Todavía no terminé</button></div>';
    // si falta poco y alguno no aparece, se puede cerrar igual
    if(faltan.length && faltan.length <= 2 && listos.length >= faltan.length){
      var nf = vjLista(faltan.map(function(m){ return m.n; }));
      html += '<div class="vj-forzar"><p class="note" style="margin:0 0 8px">Si ' + esc(nf) + ' no ' + (faltan.length > 1 ? 'van' : 'va') + ' a confirmar, podés cerrarlo igual: queda anotado que ' + (faltan.length > 1 ? 'faltaban' : 'faltaba') + '.</p>'
        + '<button class="btn ghost sm" type="button" data-vjforzar>' + (vjBorrar === '@forzar' ? 'Tocá otra vez para cerrarlo sin ' + esc(nf) : 'Cerrar igual') + '</button></div>';
    }
  } else {
    html += '<button class="btn" type="button" data-vjlisto>Ya cargué todo lo mío</button>';
  }
  return html + '</div>';
}
/* Terminado: cómo se cerró y, durante 30 días, la opción de reabrirlo. */
function vjTerminadoHtml(v){
  var c = v.cierre, f = c.f.filter(function(i){ return vjMiembro(v, i); });
  var txt = f.length
    ? (c.por === v.yo ? 'Lo cerraste vos' : 'Lo cerró ' + esc(vjNombre(v, c.por)))
      + (f.length === 1 && f[0] === v.yo ? ' sin tu confirmación'
         : ' sin la confirmación de ' + esc(vjLista(f.map(function(i){ return i === v.yo ? 'vos' : vjNombre(v, i); }))))
    : 'Confirmaron todos que ya habían cargado lo suyo';
  var html = '<div class="vj-fin"><div class="lab">Terminado el ' + esc(fechaLabel(vjDiaDe(c.t))) + '</div><p class="note" style="margin:4px 0 0">' + txt + '.</p>';
  if(v.arch) html += '<p class="note" style="margin:6px 0 0">Está archivado: ya no se sincroniza, y se lee sólo cuando lo abrís.</p>';
  else if(vjReabrible(v)) html += '<p class="note" style="margin:6px 0 10px">Si alguien se olvidó de un gasto, se puede reabrir hasta el '
      + esc(fechaLabel(vjDiaDe(c.t + VJ_REABRIR))) + '. Después queda archivado en el historial.</p>'
      + '<button class="btn ghost sm" type="button" data-vjreabrir>' + (vjBorrar === '@reabrir' ? 'Tocá otra vez para reabrirlo' : 'Reabrir el viaje') + '</button>';
  return html + '</div>';
}
function vjLista(l){ return l.length < 2 ? (l[0] || '') : l.slice(0, -1).join(', ') + ' y ' + l[l.length - 1]; }
/* El formulario de un gasto del viaje. Es el mismo en la pantalla del viaje y en
   la de carga (el "+"): nunca están los dos a la vez en la página, así que los
   ids no se repiten (ver renderViaje). */
// si la moneda elegida ya no está entre las del viaje (alguien la sacó), vuelve a pesos
function F0mon(v){ return vjForm && vjForm.mon !== 'ARS' && vjMonedas(v).indexOf(vjForm.mon) < 0 && !(vjEdit && (vjGastoPorId(v, vjEdit) || {}).mm === vjForm.mon); }
function vjFormHtml(v, g){
  if(!vjForm) vjForm = g ? { fecha:g.f, hora:g.h || '', horaMano:true, noches:!!g.f2, hasta:g.f2 || '', mon:g.mu > 0 ? (g.mm || 'USD') : 'ARS' }
                         : { fecha:today(), hora:'', horaMano:false, noches:false, hasta:'', mon:vjMonedas(v).indexOf(vjMonUlt[v.id]) > -1 ? vjMonUlt[v.id] : 'ARS' };
  if(F0mon(v)) vjForm.mon = 'ARS';
  var F = vjForm, fForm = F.fecha, hForm = vjHoraForm();
  if(!vjEntre){
    if(g && !g.a){ vjEntre = g.e.filter(function(x){ return vjMiembro(v, x); }); vjEntreAuto = false; }
    else vjEntreAuto = true;
  }
  // "entre los que estaban" se recalcula siempre: si alguien se sumó o cambió
  // su fecha mientras la pantalla estaba abierta, ya aparece marcado
  if(vjEntreAuto) vjEntre = vjAutoEntre(v);
  return '<form class="form2 pairfecha" id="vjGasto">'
    + '<div class="field full"><label class="lab" for="vjMonto">Monto</label><span class="conmon vj-conmon' + (vjMonedas(v).length >= 2 ? ' muchas' : '') + '">'
    +   '<input class="money-in" id="vjMonto" type="text" inputmode="decimal" placeholder="0" autocomplete="off" value="' + (g ? esc(enCampo(g.mu > 0 ? g.mu : g.mo)) : '') + '">'
    +   '<span class="seg mini" role="group" aria-label="Moneda del gasto" id="vjMonSeg"' + (vjMonedas(v).length || F.mon !== 'ARS' ? '' : ' hidden') + '>' + vjMonSegHtml(v) + '</span></span>'
    +   '<button type="button" class="linkbtn vj-monmas" data-vjmonmas aria-expanded="false">' + (vjMonedas(v).length ? 'Monedas del viaje' : '¿Otra moneda?') + '</button></div>'
    // las monedas del viaje, a lo ancho (se abren con "Monedas del viaje")
    + '<div class="field full vj-mons" id="vjMonPanel" hidden><small class="pista">Las que usan en este viaje, además del peso. Si cambiás algo, les cambia a todos.</small>'
    +   '<div class="chips">' + vjMonChipsHtml(v) + '</div></div>'
    // cuándo: fecha y hora lado a lado; si es un alojamiento, entrada y salida
    + '<div class="field full vj-cuando"><div class="vj-cuando-fila">'
    +   '<div class="vj-celda"><label class="lab" id="vjFechaLab">' + (F.noches ? 'Entrada' : 'Fecha') + '</label><span class="datewrap"><input name="fecha" id="vjFecha" type="date" value="' + esc(fForm) + '" tabindex="-1" aria-label="Fecha del gasto">'
    +     '<button type="button" class="datebtn" aria-label="Elegir fecha">' + VJ_CAL + '<span class="d-lg">—</span><span class="d-sm">—</span></button></span></div>'
    +   '<div class="vj-celda vj-hora"' + (F.noches ? ' hidden' : '') + '><label class="lab" for="vjHora">Hora</label>'
    +     '<input id="vjHora" type="time" value="' + esc(hForm) + '" aria-label="Hora del gasto"></div>'
    +   '<div class="vj-celda vj-hasta"' + (F.noches ? '' : ' hidden') + '><span class="lab">Salida</span><span class="datewrap">'
    +     '<input id="vjHasta" type="date" value="' + esc(F.hasta || '') + '" tabindex="-1" aria-label="Día de salida">'
    +     '<button type="button" class="datebtn" aria-label="Elegir el día de salida">' + VJ_CAL + '<span class="d-lg">—</span><span class="d-sm">—</span></button></span></div>'
    + '</div>'
    + '<button type="button" class="swi vj-noches" role="switch" data-vjnoches aria-checked="' + (F.noches ? 'true' : 'false') + '"><span class="swi-t"></span>'
    +   '<span class="swi-x"><b>Es un alojamiento de varias noches</b><small>Hotel, cabaña o depto: en vez de la hora ponés entrada y salida, y se reparte noche por noche entre los que durmieron ahí.</small></span></button>'
    + '</div>'
    + '<div class="field full"><label class="lab" for="vjDesc">Qué fue</label><input id="vjDesc" type="text" maxlength="60" placeholder="Ej: cena, nafta, cabaña" autocomplete="off" value="' + (g ? esc(g.d) : '') + '"></div>'
    + '<div class="field fullsm"><label class="lab" for="vjPago">Pagó</label><select id="vjPago">'
    + v.miembros.map(function(m){ return '<option value="' + esc(m.i) + '"' + ((g ? g.pag : v.yo) === m.i ? ' selected' : '') + '>' + esc(m.n) + '</option>'; }).join('') + '</select></div>'
    + '<div class="field fullsm"><label class="lab" for="vjCat">Categoría</label><select id="vjCat">'
    + S.catGasto.map(function(k){ var sel = g ? (g.c === k) : (k === (S.catGasto.indexOf('Ocio') > -1 ? 'Ocio' : 'Otros')); return '<option' + (sel ? ' selected' : '') + '>' + esc(k) + '</option>'; }).join('') + '</select></div>'
    + '<div class="field full"><span class="lab">Entre quiénes</span><div class="chips">'
    + v.miembros.map(function(m){ return '<button type="button" data-vjentre="' + esc(m.i) + '" aria-pressed="' + (vjEntre.indexOf(m.i) > -1 ? 'true' : 'false') + '">' + esc(m.n) + '</button>'; }).join('')
    + '</div><small class="pista" id="vjEntrePista">' + esc(vjPistaEntre(v)) + '</small></div>'
    + '<div class="field full rowflex" style="gap:8px;flex-wrap:nowrap;flex-direction:row"><button class="btn" type="submit" style="flex:1;min-width:0">' + (g ? 'Guardar cambios' : 'Agregar gasto') + '</button>'
    + (g ? '<button class="btn ghost" type="button" data-vjcancelar style="flex:none">Cancelar</button>' : '') + '</div>'
    + '</form>';
}
var vjMonUlt = {};   // la moneda del último gasto que anotaste en cada viaje: el próximo arranca igual
function vjReset(){ vjEdit = null; vjEntre = null; vjEntreAuto = true; vjForm = null; vjCompartir = null; vjBorrar = null; vjMiembroEdit = null; vjDesdeUI = null; }
var VJ_CAL = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
/* "Desde el principio" o "desde una fecha": al sumarse y al corregir a alguien. */
function vjDesdeHtml(){
  var u = vjDesdeUI || { modo:'f', fecha:today(), hora:'' };
  return '<div class="vj-desde"><div class="chips" role="group" aria-label="Desde cuándo">'
    + '<button type="button" data-vjdesde="p" aria-pressed="' + (u.modo === 'p') + '">Desde el principio</button>'
    + '<button type="button" data-vjdesde="f" aria-pressed="' + (u.modo === 'f') + '">Desde un día</button></div>'
    + '<span class="vj-desde-f"' + (u.modo === 'f' ? '' : ' hidden') + '>'
    +   '<span class="datewrap"><input id="vjDesdeIn" type="date" value="' + esc(u.fecha || today()) + '" tabindex="-1" aria-label="Desde qué día">'
    +   '<button type="button" class="datebtn" aria-label="Elegir desde qué día">' + VJ_CAL + '<span class="d-lg">—</span><span class="d-sm">—</span></button></span>'
    +   '<label class="vj-alas"><span>a las</span><input id="vjDesdeHora" type="time" value="' + esc(u.hora || '') + '" aria-label="Desde qué hora"></label>'
    + '</span></div>';
}
/* {d:'', h:''} = desde el principio; {d, h} = desde ese día (y esa hora, si
   tiene); null si eligió "un día" y no hay día. */
function vjDesdeElegido(){
  if(!vjDesdeUI || vjDesdeUI.modo === 'p') return { d:'', h:'' };
  var f = vjFechaOk(($('#vjDesdeIn') || {}).value || vjDesdeUI.fecha);
  if(!f) return null;
  var he = $('#vjDesdeHora');
  return { d:f, h:vjHoraOk(he ? he.value : (vjDesdeUI.hora || '')) };
}
function vjDesdeTexto(d){
  return d.d ? ((d.d > today() ? 'llega el ' : 'desde el ') + fechaLabel(d.d) + (d.h ? ' a las ' + d.h : '')) : 'desde el principio';
}
/* La hora del gasto que se está cargando: la que pusiste, o, si no la tocaste y
   el gasto es de hoy, la de este momento (el formulario puede estar abierto un
   rato largo). */
function vjHoraForm(){
  var F = vjForm; if(!F) return '';
  if(!F.horaMano) return F.fecha === today() ? ahoraHM() : '';
  return F.hora || '';
}
/* Quiénes se marcan solos en "Entre quiénes": los que estaban a esa hora, o, si
   es por varias noches, todos los que durmieron ahí al menos una noche. */
function vjAutoEntre(v){
  var F = vjForm || { fecha:today() };
  if(F.noches){
    var ns2 = vjNoches(F.fecha, F.hasta), al = {};
    ns2.forEach(function(D){ vjPresentes(v, D, '').forEach(function(x){ al[x] = 1; }); });
    if(ns2.length) return v.miembros.map(function(m){ return m.i; }).filter(function(x){ return al[x]; });
  }
  return vjPresentes(v, F.fecha, vjHoraForm());
}
/* Pinta en el lugar lo que depende de la fecha, la hora y las noches, sin
   redibujar el formulario (se perdería lo que venís escribiendo). */
function vjPintarCuando(v){
  var F = vjForm; if(!F) return;
  var lab = $('#vjFechaLab'); if(lab) lab.textContent = F.noches ? 'Entrada' : 'Fecha';
  var bh = $('.vj-hora'), bs = $('.vj-hasta');
  if(bh) bh.hidden = !!F.noches;
  if(bs) bs.hidden = !F.noches;
  var ch = $('[data-vjnoches]'); if(ch) ch.setAttribute('aria-checked', F.noches ? 'true' : 'false');
  var hi = $('#vjHasta'); if(hi && hi.value !== (F.hasta || '')){ hi.value = F.hasta || ''; pintarFecha(hi); }
  var hr = $('#vjHora'); if(hr && document.activeElement !== hr && hr.value !== vjHoraForm()) hr.value = vjHoraForm();
  if(vjEntreAuto){
    vjEntre = vjAutoEntre(v);
    $$('[data-vjentre]').forEach(function(b){ b.setAttribute('aria-pressed', vjEntre.indexOf(b.getAttribute('data-vjentre')) > -1 ? 'true' : 'false'); });
  }
  var pi = $('#vjEntrePista'); if(pi) pi.textContent = vjPistaEntre(v);
}
/* El monto del formulario, en pesos: si lo escribiste en dólares se pasa con
   el dólar de Ajustes (o, si estás corrigiendo un gasto que ya era en
   dólares, con el que tenía, así no cambia solo). */
function vjCotForm(){
  var g = vjEdit && viajeSel ? vjGastoPorId(viajePorId(viajeSel) || { gastos:[] }, vjEdit) : null, c = (vjForm && vjForm.mon) || 'ARS';
  return (g && g.mu > 0 && g.cot > 0 && (g.mm || 'USD') === c) ? g.cot : vjCotDe(c);
}
function vjMontoForm(){
  var m = parseMoney(($('#vjMonto')||{}).value || '');
  if(!(m > 0)) return 0;
  return (vjForm && vjForm.mon && vjForm.mon !== 'ARS') ? m * vjCotForm() : m;
}
function vjGastoPorId(v, id){ var r = null; v.gastos.forEach(function(g){ if(g.i === id) r = g; }); return r; }
function vjPistaEntre(v){
  var t0 = vjPistaEntre0(v);
  var mc = vjForm && vjForm.mon;
  if(!mc || mc === 'ARS') return t0;
  var u = parseMoney(($('#vjMonto')||{}).value || ''), c = vjCotForm(), nm = vjMonNombre(mc).toLowerCase();
  if(!(c > 0)) return 'Para anotarlo así falta la cotización del ' + nm + (mc === 'USD' ? ': ponela en Ajustes, en Dólar. ' : ': se baja sola con internet, o escribila en el conversor. ') + t0;
  return (u > 0 ? vjFmt(u, mc) + ' son ' + money(u * c) : 'Se pasa a pesos') + ' con el ' + nm + ' a ' + moneyCot(c) + '. ' + t0;
}
function vjPistaEntre0(v){
  var n = (vjEntre||[]).length;
  if(!n) return vjEntreAuto ? 'Ese día no estaba nadie del grupo: elegí a mano entre quiénes.' : 'Elegí al menos uno.';
  var m = vjMontoForm(), cada = m > 0 ? ': ' + money(m / n) + ' cada uno' : '';
  if(vjForm && vjForm.noches){
    var nn = vjNoches(vjForm.fecha, vjForm.hasta).length;
    if(!nn) return 'Elegí el día de salida: tiene que ser después de la entrada.';
    var txt = nn + (nn === 1 ? ' noche' : ' noches') + ', del ' + fechaLabel(vjForm.fecha) + ' al ' + fechaLabel(vjForm.hasta) + ': cada noche se divide entre los que estaban';
    if(m > 0){
      var pp = vjPartes(v, { mo:m, f:vjForm.fecha, f2:vjForm.hasta, a:vjEntreAuto ? 1 : 0, e:vjEntre, pag:'' });
      txt += '. ' + v.miembros.filter(function(x){ return pp[x.i] > 0; }).map(function(x){ return x.n + ' ' + money(pp[x.i]); }).join(' · ');
    }
    return txt;
  }
  if(n === v.miembros.length) return 'Entre todos' + cada;
  return (vjEntreAuto ? 'Entre los ' + n + ' que estaban ese día' : 'Entre ' + n) + cada;
}

document.addEventListener('click', function(e){
  if(!e.target.closest) return;
  var t;
  if((t = e.target.closest('[data-vjabrir]'))){ viajeSel = t.getAttribute('data-vjabrir'); vjReset(); renderViaje(); window.scrollTo(0,0); return; }
  if(e.target.closest('[data-vjvolver]')){ viajeSel = null; vjArchVista = null; vjReset(); renderViaje(); window.scrollTo(0,0); return; }
  if((t = e.target.closest('[data-vjhist]'))){ vjAbrirHist(t.getAttribute('data-vjhist')); return; }
  if((t = e.target.closest('[data-vjver]'))){ viajeSel = t.getAttribute('data-vjver'); vjReset(); go('viaje'); renderViaje(); return; }
  if((t = e.target.closest('[data-vjcarga]'))){
    viajeSel = t.getAttribute('data-vjcarga'); vjEdit = null; vjEntre = null; vjForm = null; vjCompartir = null;
    renderViaje(); pintarCarga(); return;
  }
  if(e.target.closest('[data-vjsumar]')){
    var ta = $('#vjPegar'); var txt = ta ? ta.value : '';
    vjRecibir(txt);
    return;
  }
  if((t = e.target.closest('[data-vjnmon]'))){
    var cn = t.getAttribute('data-vjnmon'), kn = vjNuevoMons.indexOf(cn);
    if(kn > -1) vjNuevoMons.splice(kn, 1); else vjNuevoMons.push(cn);
    t.setAttribute('aria-pressed', kn > -1 ? 'false' : 'true');
    var pnn = $('#vjNuevoMonsPista');
    if(pnn) pnn.textContent = vjNuevoMons.length ? 'Van a poder anotar gastos en pesos y en ' + vjLista(VJ_MONS.filter(function(c){ return vjNuevoMons.indexOf(c) > -1; }).map(function(c){ return vjMonNombre(c).toLowerCase(); })) + '.'
                                                 : 'Sólo pesos. Para la costa, por ejemplo, no hace falta ninguna; las podés sumar después.';
    return;
  }
  var v = viajeSel ? viajePorId(viajeSel) : null;
  if(!v) return;
  if((t = e.target.closest('[data-vjsoy]'))){ v.yo = t.getAttribute('data-vjsoy'); vjEntre = null; vjDesdeUI = null; save(); renderViaje(); toast('Listo, sos ' + vjNombre(v, v.yo)); return; }
  if((t = e.target.closest('[data-vjdesde]'))){
    if(!vjDesdeUI) return;
    vjDesdeUI.modo = t.getAttribute('data-vjdesde');
    var cont = t.closest('.vj-desde');
    $$('[data-vjdesde]', cont).forEach(function(b){ b.setAttribute('aria-pressed', b === t ? 'true' : 'false'); });
    var fw = cont.querySelector('.vj-desde-f'); if(fw) fw.hidden = vjDesdeUI.modo !== 'f';
    return;
  }
  if(e.target.closest('[data-vjsoynuevo]')){
    var nn = (($('#vjSoyNuevo')||{}).value || '').trim().replace(/\s+/g,' ').slice(0,28);
    if(!nn){ toast('Escribí tu nombre'); $('#vjSoyNuevo').focus(); return; }
    var desde = vjDesdeElegido();
    if(desde === null){ toast('Elegí desde qué día estás'); return; }
    var ya = null; v.miembros.forEach(function(m){ if(m.n.toLowerCase() === nn.toLowerCase()) ya = m; });
    if(ya){ v.yo = ya.i; }
    else {
      if(v.miembros.length >= VJ_MAX_MIEMBROS){ toast('El grupo ya tiene ' + VJ_MAX_MIEMBROS + ' personas'); return; }
      var id = vjIdCorto(); v.miembros.push({ i:id, n:nn, d:desde.d, h:desde.h, t:Date.now() }); v.yo = id;
    }
    vjEntre = null; vjDesdeUI = null; save(); renderViaje();
    toast(ya ? 'Listo, sos ' + ya.n : ('Listo, ' + nn + '. ' + (desde.d ? 'Los gastos desde el ' + fechaLabel(desde.d) + (desde.h ? ' a las ' + desde.h : '') + ' se dividen también con vos' : 'Estás desde el principio')));
    return;
  }
  if((t = e.target.closest('[data-vjmedit]'))){
    var me = vjMiembro(v, t.getAttribute('data-vjmedit')); if(!me) return;
    vjMiembroEdit = me.i; vjDesdeUI = { para:'m:' + me.i, modo:me.d ? 'f' : 'p', fecha:me.d || today(), hora:me.h || '', horaMano:true };
    renderViaje(); return;
  }
  if(e.target.closest('[data-vjmcancelar]')){ vjMiembroEdit = null; vjDesdeUI = null; renderViaje(); return; }
  if((t = e.target.closest('[data-vjmguardar]'))){
    var mg = vjMiembro(v, t.getAttribute('data-vjmguardar')); if(!mg) return;
    var dg = vjDesdeElegido();
    if(dg === null){ toast('Elegí el día'); return; }
    if(dg.d !== (mg.d || '') || dg.h !== (mg.h || '')){ mg.d = dg.d; mg.h = dg.h; mg.t = Math.max(Date.now(), (mg.t || 0) + 1); }
    vjMiembroEdit = null; vjDesdeUI = null;
    if(vjEntreAuto) vjEntre = null;      // el formulario vuelve a calcular quiénes estaban
    save(); renderViaje();
    toast(mg.n + ' ' + vjDesdeTexto(dg).replace(/^desde/, 'está desde') + (dg.d ? ': lo de antes no le toca' : ''));
    return;
  }
  if(e.target.closest('[data-vjlisto]')){
    var yl = vjMiembro(v, v.yo); if(!yl || vjCerrado(v)) return;
    yl.ok = Date.now(); yl.okt = Math.max(yl.ok, (yl.okt || 0) + 1);
    var cerro = vjAutoCierre(v);
    save(); renderViaje(); window.scrollTo(0, 0);
    toast(cerro ? 'Confirmaron todos: el viaje terminó' : 'Listo. Cuando confirmen todos, el viaje se cierra solo');
    return;
  }
  if(e.target.closest('[data-vjnolisto]')){
    if(vjSinMi(v)){ save(); renderViaje(); toast('Listo: cuando termines de cargar, confirmá de nuevo'); }
    return;
  }
  if(e.target.closest('[data-vjforzar]')){
    if(vjCerrado(v)) return;
    if(vjBorrar !== '@forzar'){ vjBorrar = '@forzar'; renderViaje(); return; }
    var faltan = v.miembros.filter(function(m){ return !vjListo(m); }).map(function(m){ return m.i; });
    v.cierre = { e:1, t:Math.max(Date.now(), v.cierre ? v.cierre.t + 1 : 0), por:v.yo, f:faltan };
    vjBorrar = null; save(); renderViaje(); window.scrollTo(0, 0);
    toast('Cerraste el viaje. Queda anotado que ' + (faltan.length > 1 ? 'faltaban ' : 'faltaba ') + vjLista(faltan.map(function(i){ return vjNombre(v, i); })));
    return;
  }
  if(e.target.closest('[data-vjreabrir]')){
    if(!vjReabrible(v)) return;
    if(vjBorrar !== '@reabrir'){ vjBorrar = '@reabrir'; renderViaje(); return; }
    v.cierre = { e:0, t:Math.max(Date.now(), v.cierre.t + 1), por:v.yo, f:[] };
    // el que lo reabre va a cargar algo: su confirmación se saca
    var yr = vjMiembro(v, v.yo); if(yr){ yr.ok = 0; yr.okt = Math.max(v.cierre.t, (yr.okt || 0) + 1); }
    vjBorrar = null; save(); renderViaje(); window.scrollTo(0, 0);
    toast(nsHay() ? 'Reabriste el viaje: a los demás les vuelve a aparecer abierto. Cuando termines, confirmá de nuevo'
                  : 'Reabriste el viaje. Cuando termines, confirmá de nuevo');
    return;
  }
  if((t = e.target.closest('[data-vjmon]'))){
    if(!vjForm) return;
    var cm = t.getAttribute('data-vjmon');
    vjForm.mon = (cm === 'ARS' || VJ_MONS.indexOf(cm) > -1) ? cm : 'ARS';
    $$('[data-vjmon]').forEach(function(b){ b.setAttribute('aria-pressed', b === t ? 'true' : 'false'); });
    var piM = $('#vjEntrePista'); if(piM) piM.textContent = vjPistaEntre(v);
    if(vjForm.mon !== 'ARS' && !(vjCotForm() > 0)) vjFaltaCot(vjForm.mon);
    return;
  }
  if((t = e.target.closest('[data-vjmonmas]'))){
    var pn = $('#vjMonPanel'); if(!pn) return;
    pn.hidden = !pn.hidden; t.setAttribute('aria-expanded', pn.hidden ? 'false' : 'true');
    return;
  }
  if((t = e.target.closest('[data-vjmonsel]'))){
    if(vjCerrado(v)) return;
    var cs = t.getAttribute('data-vjmonsel'), l0 = vjMonedas(v).slice(), k0 = l0.indexOf(cs);
    if(k0 > -1) l0.splice(k0, 1); else l0.push(cs);
    v.mons = { l:VJ_MONS.filter(function(c){ return l0.indexOf(c) > -1; }), t:Math.max(Date.now(), v.mons ? v.mons.t + 1 : 0) };
    if(vjForm && F0mon(v)) vjForm.mon = 'ARS';
    save();
    var sg = $('#vjMonSeg'); if(sg){ sg.innerHTML = vjMonSegHtml(v); sg.hidden = !(vjMonedas(v).length || (vjForm && vjForm.mon !== 'ARS'));
      var fm = sg.closest('.field'); if(fm) fm.classList.toggle('full', vjMonedas(v).length > 0);
      var cmn = sg.closest('.vj-conmon'); if(cmn) cmn.classList.toggle('muchas', vjMonedas(v).length >= 2); }
    $$('[data-vjmonsel]').forEach(function(b){ b.setAttribute('aria-pressed', vjMonedas(v).indexOf(b.getAttribute('data-vjmonsel')) > -1 ? 'true' : 'false'); });
    var mm2 = $('[data-vjmonmas]'); if(mm2) mm2.textContent = vjMonedas(v).length ? 'Monedas del viaje' : '¿Otra moneda?';
    var piS = $('#vjEntrePista'); if(piS) piS.textContent = vjPistaEntre(v);
    toast(k0 > -1 ? 'Saqué el ' + vjMonNombre(cs).toLowerCase() + ' del viaje' : 'Ahora pueden anotar gastos en ' + vjMonNombre(cs).toLowerCase() + (nsHay() && nsActivo(v) ? '. A los demás les llega solo' : ''));
    if(k0 < 0 && !(vjCotDe(cs) > 0)) setTimeout(function(){ vjFaltaCot(cs); }, 1600);
    return;
  }
  if(e.target.closest('[data-vjnoches]')){
    if(!vjForm) return;
    vjForm.noches = !vjForm.noches;
    if(vjForm.noches && !(vjForm.hasta > vjForm.fecha)) vjForm.hasta = sumarDias(vjForm.fecha, 1);
    vjPintarCuando(v);
    return;
  }
  if(e.target.closest('[data-vjmandar]')){ vjCompartirTexto(v, 'g'); return; }
  if(e.target.closest('[data-vjinvitar]')){ vjCompartirTexto(v, 'i'); return; }
  if(e.target.closest('[data-vjcerrarcaja]')){ vjCompartir = null; renderViaje(); return; }
  if(e.target.closest('[data-vjqr]')){
    if(vjCompartir && vjCompartir.qr){ vjCompartir.qr = null; renderViaje(); return; }
    vjMostrarQr(v); return;
  }
  if(e.target.closest('[data-vjcopiar]')){
    var s = $('#vjSalida'); if(!s) return;
    var ok = function(){ toast('Copiado: pegalo en WhatsApp'); };
    if(navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(s.value).then(ok, function(){ s.select(); try{ document.execCommand('copy'); ok(); }catch(x){} });
    else { s.select(); try{ document.execCommand('copy'); ok(); }catch(x){} }
    return;
  }
  if((t = e.target.closest('[data-vjentre]'))){
    var mid = t.getAttribute('data-vjentre'), k = vjEntre.indexOf(mid);
    if(k > -1) vjEntre.splice(k, 1); else vjEntre.push(mid);
    vjEntreAuto = false;                  // lo elegiste a mano: queda así
    t.setAttribute('aria-pressed', k > -1 ? 'false' : 'true');
    var pi = $('#vjEntrePista'); if(pi) pi.textContent = vjPistaEntre(v);
    return;
  }
  if(e.target.closest('[data-vjcancelar]')){ vjEdit = null; vjEntre = null; vjForm = null; renderViaje(); return; }
  if((t = e.target.closest('[data-vjborrar]'))){
    var bid = t.getAttribute('data-vjborrar');
    if(vjBorrar !== bid){ vjBorrar = bid; renderViaje(); return; }
    var gb = vjGastoPorId(v, bid);
    if(vjCerrado(v)) return;
    if(gb){ gb.b = 1; gb.t = Math.max(Date.now(), gb.t + 1); gb.por = v.yo; }
    var sacoB = vjSinMi(v);
    vjBorrar = null; if(vjEdit === bid){ vjEdit = null; vjEntre = null; }
    save(); renderViaje(); toast((nsHay() && nsActivo(v) ? 'Borrado. También se borra en los demás' : 'Borrado. Cuando mandes tus gastos, se borra también en los demás')
      + (sacoB ? '. Cuando termines, volvé a confirmar que cargaste todo' : ''));
    return;
  }
  if((t = e.target.closest('[data-vjgasto]')) && !e.target.closest('.acts')){
    var gid = t.getAttribute('data-vjgasto');
    vjEdit = (vjEdit === gid) ? null : gid; vjEntre = null; vjForm = null; vjBorrar = null;
    renderViaje();
    var f = $('#vjGasto'); if(f && vjEdit) try{ f.scrollIntoView({block:'center'}); $('#vjMonto').focus(); }catch(x){}
    return;
  }
  if(e.target.closest('[data-vjcargar]')){
    var por = vjMiParte(v), medio = ($('#vjMedio')||{}).value || 'Efectivo';
    var ult = ''; vjVivos(v).forEach(function(g){ if((vjPartes(v, g)[v.yo] || 0) > 0 && g.f > ult) ult = g.f; });
    var fecha = ult || today(), total = 0;
    S.tx = S.tx.filter(function(x){ return x.viaje !== v.id; });
    Object.keys(por).forEach(function(cat){
      var m = Math.round(por[cat] * 100) / 100; if(!(m > 0)) return;
      total += m;
      S.tx.push({ id:uid(), ts:Date.now(), tipo:'gasto', monto:m, cat:cat, fecha:fecha, medio:medio,
                  nota:v.nombre + ' (mi parte)', viaje:v.id });
    });
    v.cargado = { monto:Math.round(total*100)/100, fecha:today(), medio:medio };
    if(v.arch) vjArchivar(v).then(function(){ save(); });
    save(); render(); renderViaje();
    toast(total > 0 ? ('Cargué ' + money(total) + ' en tus gastos de ' + ymLabel(ymOf(fecha))) : 'No te tocó nada en este viaje');
    return;
  }
  if(e.target.closest('[data-vjsalir]')){
    if(vjBorrar !== '@viaje'){ vjBorrar = '@viaje'; renderViaje(); return; }
    if(v.arch){
      delete S.vjArch[v.id]; S.vjHist = (S.vjHist || []).filter(function(h){ return h.id !== v.id; });
      vjArchVista = null; viajeSel = null; vjBorrar = null; save(); renderViaje();
      toast('Lo borré del historial. Lo que cargaste en tus gastos queda');
      return;
    }
    S.viajes = (S.viajes||[]).filter(function(x){ return x.id !== v.id; });
    viajeSel = null; vjBorrar = null; save(); renderViaje();
    toast('Borré el viaje de este celular. Los gastos que ya cargaste en tus gastos quedan');
    return;
  }
  if(vjBorrar && !e.target.closest('[data-vjborrar]') && !e.target.closest('[data-vjsalir]')
     && !e.target.closest('[data-vjforzar]') && !e.target.closest('[data-vjreabrir]')){ vjBorrar = null; renderViaje(); }
});
document.addEventListener('change', function(e){
  if(e.target.id === 'vjDesdeIn' && vjDesdeUI){
    vjDesdeUI.fecha = e.target.value;
    // la hora de "ahora" sólo tiene sentido si es hoy; para otro día, el día entero
    if(!vjDesdeUI.horaMano){
      vjDesdeUI.hora = (e.target.value === today()) ? ahoraHM() : '';
      var dh = $('#vjDesdeHora'); if(dh) dh.value = vjDesdeUI.hora;
    }
    return;
  }
  if(e.target.id === 'vjDesdeHora' && vjDesdeUI){ vjDesdeUI.hora = vjHoraOk(e.target.value); vjDesdeUI.horaMano = true; return; }
  if(!viajeSel || !vjForm) return;
  var v = viajePorId(viajeSel); if(!v) return;
  if(e.target.id === 'vjFecha'){
    vjForm.fecha = e.target.value || today();
    if(vjForm.noches && !(vjForm.hasta > vjForm.fecha)) vjForm.hasta = sumarDias(vjForm.fecha, 1);
    vjPintarCuando(v);                   // cambió el día: cambian los que estaban
    return;
  }
  if(e.target.id === 'vjHasta'){ vjForm.hasta = e.target.value; vjPintarCuando(v); return; }
  if(e.target.id === 'vjHora'){ vjForm.hora = vjHoraOk(e.target.value); vjForm.horaMano = true; vjPintarCuando(v); return; }
});
document.addEventListener('input', function(e){
  if(e.target.id === 'vjMonto' && viajeSel){ var v = viajePorId(viajeSel), pi = $('#vjEntrePista'); if(v && pi) pi.textContent = vjPistaEntre(v); }
});
document.addEventListener('submit', function(e){
  if(e.target.id === 'vjNuevo'){
    e.preventDefault();
    var nom = ($('#vjNom').value || '').trim().slice(0,40), yo = ($('#vjYo').value || '').trim().replace(/\s+/g,' ').slice(0,28);
    if(!nom){ toast('Ponele un nombre al viaje'); $('#vjNom').focus(); return; }
    if(!yo){ toast('Poné tu nombre'); $('#vjYo').focus(); return; }
    var clave = '';
    try{ clave = b64u(crypto.getRandomValues(new Uint8Array(16))); }catch(x){}
    var v = vjLimpio({ id:vjIdCorto(), nombre:nom, clave:clave, creado:Date.now(),
                       mons:{ l:vjNuevoMons.slice(), t:Date.now() } });
    vjNuevoMons = [];
    var yoId = vjIdCorto(); v.miembros.push({ i:yoId, n:yo, d:'', t:Date.now() }); v.yo = yoId;
    S.viajes = S.viajes || []; S.viajes.push(v);
    save(); viajeSel = v.id; vjEntre = null; vjEntreAuto = true; vjForm = null; vjCompartir = null; renderViaje(); window.scrollTo(0,0);
    // el link para sumarse sale al toque: es lo primero que hay que hacer
    vjCompartirTexto(v, 'i').then(function(){ toast('Viaje creado. Mandá este link al grupo: cada uno se suma y pone su nombre'); });
    return;
  }
  if(e.target.id === 'vjGasto'){
    e.preventDefault();
    var v2 = viajePorId(viajeSel); if(!v2 || vjCerrado(v2)) return;
    var mo = parseMoney($('#vjMonto').value);
    if(!(mo > 0)){ toast('Poné cuánto fue'); $('#vjMonto').focus(); return; }
    if(!vjEntre || !vjEntre.length){ toast('Elegí entre quiénes se divide'); return; }
    var F2 = vjForm || {}, fch = $('#vjFecha').value || today(), f2 = '';
    if(F2.noches){
      f2 = vjFechaOk(($('#vjHasta') || {}).value || F2.hasta);
      if(!(f2 > fch)){ toast('La salida tiene que ser después de la entrada'); return; }
      if(vjNoches(fch, f2).length > 60){ toast('Hasta 60 noches por gasto'); return; }
    }
    var hh = F2.noches ? '' : vjHoraOk(F2.horaMano ? (($('#vjHora') || {}).value || '') : vjHoraForm());
    var enUsd = !!(F2.mon && F2.mon !== 'ARS'), cotG = enUsd ? vjCotForm() : 0, mu = 0;
    if(enUsd){
      if(!(cotG > 0)){ vjFaltaCot(F2.mon); return; }
      mu = Math.round(mo*100)/100; mo = mu * cotG;
    }
    var datos = { mo:Math.round(mo*100)/100, d:($('#vjDesc').value || '').trim().slice(0,60), c:$('#vjCat').value,
                  f:fch, h:hh, f2:f2, pag:$('#vjPago').value, e:vjEntre.slice(), t:Date.now(), por:v2.yo, b:0,
                  a:vjEntreAuto ? 1 : 0 };
    var g = vjEdit ? vjGastoPorId(v2, vjEdit) : null;
    // la corrección siempre queda "más nueva" que lo que había, aunque el reloj
    // de este celular esté atrasado respecto del que lo cargó
    if(enUsd){ datos.mu = mu; datos.cot = Math.round(cotG*10000)/10000; datos.mm = F2.mon; }
    if(!g) vjMonUlt[v2.id] = enUsd ? F2.mon : 'ARS';
    if(g){ datos.t = Math.max(datos.t, g.t + 1); delete g.mu; delete g.cot; delete g.mm; Object.keys(datos).forEach(function(k){ g[k] = datos[k]; }); }
    else {
      if(v2.gastos.length >= VJ_MAX_GASTOS){ toast('Llegaste al máximo de ' + VJ_MAX_GASTOS + ' gastos en un viaje'); return; }
      datos.i = vjIdCorto(); v2.gastos.push(datos);
    }
    var sacoG = vjSinMi(v2);
    vjEdit = null; vjEntre = null; vjForm = null;
    save(); renderViaje();
    toast((g ? 'Gasto corregido' : (vjEnCarga() ? 'Anotado en ' + v2.nombre : 'Anotado')) + (nsHay() && nsActivo(v2) ? '. A los demás les llega solo' : '. Cuando puedas, mandá tus gastos al grupo')
      + (sacoG ? '. Cuando termines, volvé a confirmar que cargaste todo' : ''));
    var mm = $('#vjMonto'); if(mm && !g) try{ mm.focus(); }catch(x){}
  }
});
