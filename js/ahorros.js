/* Cuentas Claras · js/ahorros.js
   Metas de ahorro y aportes.

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

/* ---- ahorros ---- */
function renderAhorro(){
  var total = 0, objetivo = 0, activas = 0, enDolares = 0;
  S.metas.forEach(function(m){
    var s = ahorradoEn(m);
    total += ahorradoEnPesos(m);
    objetivo += aPesos(m.objetivo, m.moneda, 0);
    if(s < (Number(m.objetivo)||0)) activas++;
    enDolares += usdDeMeta(m);          // los dólares pueden estar en cualquier meta
  });
  var hayUsd = enDolares > 0;
  // cada aporte se pasa a pesos con SU moneda, no con la del objetivo
  var delMes = aportesDe(mes).reduce(function(a,b){ return a + aportePesos(b.meta, b.ap); },0);
  $('#aTotal').textContent = money(total);
  $('#aTotalM').textContent = hayUsd
    ? ('Incluye ' + usd(enDolares) + (cotDolar() > 0 ? ' a ' + money(cotDolar()) + ' cada uno' : ' · falta cargar el dólar'))
    : (S.metas.length ? 'Sumado en todas tus metas' : 'Creá tu primera meta');
  $('#aMes').textContent = money(delMes);
  $('#aMesM').textContent = delMes < 0 ? ('Sacaste más de lo que guardaste en ' + ymLabel(mes, true)) : ymLabel(mes);
  $('#aMetas').textContent = String(activas);
  $('#aMetasM').textContent = S.metas.length ? 'de '+S.metas.length+' en total' : '—';
  $('#aFalta').textContent = money(Math.max(0, objetivo-total));
  $('#aFaltaM').textContent = objetivo ? Math.round(Math.min(100,total/objetivo*100))+'% completado' : '—';

  var el = $('#metaList');
  if(!S.metas.length){ el.innerHTML = '<div class="card">'+emptyBox('Sin metas todavía. Poné un objetivo arriba y empezá a juntar.')+'</div>'; return; }
  el.innerHTML = S.metas.map(function(m){
    var s = ahorradoEn(m);
    var obj = Number(m.objetivo)||0;
    var esUsd = m.moneda === 'USD';
    var fmt = esUsd ? usd : money;
    var enPesos = esUsd ? ahorradoEnPesos(m) : 0;
    var dolares = usdDeMeta(m);
    var pctv = obj ? Math.max(0, Math.min(100, s/obj*100)) : 0;
    var listo = obj && s >= obj;
    var aps = (m.aportes||[]).slice().sort(function(a,b){ return a.fecha<b.fecha?1:-1; }).slice(0,5);
    /* El progreso se lee en números grandes arriba de la barra: cuánto tenés,
       de cuánto, y el porcentaje. Antes iba en la línea gris chiquita de abajo
       del nombre y había que forzar la vista para encontrarlo. */
    var extra = esUsd ? (cotDolar() > 0 ? 'son ' + money(enPesos) + ' hoy' : 'cargá el dólar en Ajustes para verlo en pesos')
                      : (dolares > 0 ? 'adentro hay ' + usd(dolares) : '');
    return '<div class="card">'
      + '<div class="card-head"><div><h2>'+esc(m.nombre)+'</h2></div>'
      + '<div class="rowflex" style="gap:8px">'+(listo?'<span class="pill ok">Completa</span>':'')+delBtn('meta',m.id)+'</div></div>'
      + '<div class="mprog'+(listo?' listo':'')+'">'
      +   '<div class="mp-top"><span class="mp-num">'+esc(fmt(s))+'</span>'
      +     '<span class="mp-de">de '+esc(fmt(obj))+'</span>'
      +     '<span class="mp-pct">'+(listo ? 100 : (pctv > 0 && pctv < 1 ? '<1' : Math.min(99, Math.round(pctv))))+'%</span></div>'
      +   '<div class="prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="'+Math.round(pctv)+'"'
      +     ' aria-label="'+esc(m.nombre)+': '+Math.round(pctv)+'%"><i style="width:'+pctv.toFixed(1)+'%;background:'+(listo?'var(--in)':'var(--meta)')+'"></i></div>'
      +   '<div class="mp-bot"><span>'+(listo ? '¡Lo lograste!' : 'Faltan <b>'+esc(fmt(obj-s))+'</b>')+'</span>'
      +     (extra ? '<span>'+esc(extra)+'</span>' : '')+'</div>'
      + '</div>'
      /* Dos campos, no uno: lo que ya tenías puede ser una mezcla de pesos y
         dólares, y cada uno se guarda en su moneda. */
      /* El punto de partida se escribe UNA vez y después queda con llave: son dos
         campos que viven justo arriba del formulario de aportes, y escribirles
         encima sin querer te cambia el arranque de la meta sin que te enteres.
         Para tocarlos hay que pedirlo con el botón. */
      + (function(){
          var abierto = (iniEdit === m.id);
          function campo(mon, val, etiqueta){
            return '<span class="pctin plata"><i>'+(mon==='USD'?'U$S':'$')+'</i>'
              + '<input class="money-in" type="text" inputmode="decimal" data-inicial="'+esc(m.id)+'|'+mon+'"'
              + ' value="'+(val>0 ? esc(enCampo(val)) : '')+'" placeholder="0" autocomplete="off"'
              + (abierto ? '' : ' readonly tabindex="-1"')
              + ' aria-label="'+esc(etiqueta)+' que ya tenías en '+esc(m.nombre)+'"></span>';
          }
          return '<div class="previo dos'+(abierto?' abierto':'')+'">'
            + '<span class="k">Ya tenías ahorrado<small>'
            + (abierto
                ? 'Poné lo que tengas en cada moneda y tocá Listo.'
                : 'No cuenta como movimiento del mes.' + previosTexto(m))
            + '</small></span>'
            + campo('ARS', iniArs(m), 'Pesos')
            + campo('USD', iniUsd(m), 'Dólares')
            + '<button type="button" class="btn ghost sm btnini" data-iniedit="'+esc(m.id)+'">'
            + (abierto ? 'Listo' : 'Editar') + '</button>'
            + '</div>';
        })()
      + (function(){
          var ed = (apEdit && apEdit.meta === m.id) ? aportePorId(m, apEdit.ap) : null;
          var preg = (!ed && apPregunta && apPregunta.meta === m.id) ? apPregunta : null;
          var monF = preg ? preg.mon : (ed ? (monAp[m.id] || monAporte(m, ed)) : monDeAporte(m));
          var sacaEd = ed && (Number(ed.monto)||0) < 0;
          var montoV = preg ? enCampo(preg.monto) : (ed ? enCampo(Math.abs(Number(ed.monto)||0)) : '');
          var fechaV = preg ? preg.fecha : (ed ? ed.fecha : defaultFecha());
          var bloq = preg ? ' readonly' : '';
          var html = '<form class="form2 pairfecha" data-aporte="'+esc(m.id)+'" style="margin-top:14px">'
          +   '<div class="field"><label class="lab">'+(ed ? (sacaEd ? 'Retiro' : 'Aporte') : 'Aporte')+'</label>'
          +     '<span class="conmon">'
          +       '<input class="money-in" name="monto" type="text" inputmode="decimal" placeholder="0" autocomplete="off"'
          +         ' value="'+esc(montoV)+'" required'+bloq+'>'
          +       '<span class="seg mini" role="group" aria-label="Moneda del aporte">'
          +         '<button type="button" data-monap="'+esc(m.id)+'|ARS" aria-pressed="'+(monF==='ARS'?'true':'false')+'"'+(preg?' disabled':'')+'>$</button>'
          +         '<button type="button" data-monap="'+esc(m.id)+'|USD" aria-pressed="'+(monF==='USD'?'true':'false')+'"'+(preg?' disabled':'')+'>U$S</button>'
          +       '</span>'
          +     '</span></div>'
          +   '<div class="field fecha"><label class="lab">Fecha</label>'
          +     '<span class="datewrap"><input name="fecha" type="date" value="'+esc(fechaV)+'" aria-label="Fecha del aporte" tabindex="-1">'
          +     '<button type="button" class="datebtn" aria-label="Elegir fecha"'+(preg?' disabled':'')+'><svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.8\" aria-hidden=\"true\"><rect x=\"3\" y=\"5\" width=\"18\" height=\"16\" rx=\"2.5\"/><path d=\"M3 10h18M8 3v4M16 3v4\"/></svg><span class=\"d-lg\">—</span><span class=\"d-sm\">—</span></button></span></div>'
          +   (monF !== (m.moneda || 'ARS')
              ? '<p class="note full" style="margin:-2px 0 0">'
                + (cotDolar() > 0
                    ? esc((m.moneda === 'USD')
                        ? ('Al dólar que cargaste (' + money(cotDolar()) + '). Esos dólares quedan fijos: la cantidad ya no se mueve.')
                        : ('Al dólar que cargaste (' + money(cotDolar()) + '), y se actualiza si lo cambiás: son dólares que seguís teniendo.'))
                    : 'Falta cargar el dólar en Ajustes para poder convertirlo.')
                + '</p>'
              : '')
          +   (ed
              ? '<div class="field full"><button type="button" class="swi" data-apprevio="'+esc(m.id)+'" role="switch"'
                + ' aria-checked="'+(apEdit.previo ? 'true' : 'false')+'"><span class="swi-t"></span>'
                + '<span>Ya lo tenía ahorrado: no cuenta en el balance de ese mes</span></button></div>'
              : '');
          if(preg){
            var mesP = ymLabel(ymOf(preg.fecha));
            html += '<div class="field full preg-ap" role="group" aria-label="Plata de otro mes">'
              + '<p><b>Esta plata es de ' + esc(mesP) + '.</b> Te recomiendo sumarla a lo que ya tenías ahorrado: '
              + 'así no te cambia el balance de ' + esc(MESES[parseInt(preg.fecha.slice(5,7),10)-1] || mesP)
              + '.</p>'
              + '<div class="rowflex">'
              +   '<button class="btn" type="button" data-appreg="previo">Sumar a lo que ya tenía</button>'
              +   '<button class="btn ghost" type="button" data-appreg="mes">Cargarla en ' + esc(MESES[parseInt(preg.fecha.slice(5,7),10)-1] || mesP) + '</button>'
              +   '<button class="btn ghost sm preg-no" type="button" data-appreg="no">Cancelar</button>'
              + '</div></div>';
          } else {
            html += '<div class="field full rowflex" style="gap:8px;flex-wrap:nowrap;flex-direction:row">'
              +   '<button class="btn" type="submit" style="flex:1;min-width:0">'+(ed ? 'Guardar cambios' : 'Sumar al ahorro')+'</button>'
              +   (ed
                  ? '<button class="btn ghost" type="button" style="flex:none" data-apcancel="1">Cancelar</button>'
                  : '<button class="btn ghost" type="button" style="flex:none" data-sacar="'+esc(m.id)+'">Sacar</button>')
              + '</div>';
          }
          return html + '</form>';
        })()
      + (aps.length ? '<div class="hr"></div><p class="note" style="margin-bottom:6px">Tocá uno para corregirlo</p><div class="rows">'+aps.map(function(a){
            var saca = (Number(a.monto)||0) < 0;
            var enEd = !!(apEdit && apEdit.meta === m.id && apEdit.ap === a.id);
            return '<div class="row editable'+(enEd?' propuesta':'')+'" data-apedit="'+esc(m.id)+'|'+esc(a.id)+'" title="Tocá para corregirlo">'
              + '<span class="mark '+(saca?'saca':'meta')+'">'+iconFor(saca?'saca':'meta')+'</span>'
              + '<span class="t"><b>'+(saca?'− ':'')+esc(textoAporte(m, a))+'</b><small>'
              + (saca ? 'Retiro · ' : '') + (a.previo ? 'Ya lo tenía · ' : '') + esc(fechaLabel(a.fecha))
              + esc(conversionAporte(m, a)) + '</small></span>'
              + '<span class="acts">'+delBtn('aporte',m.id,a.id)+'</span></div>';
          }).join('')+'</div>' : '')
      + '</div>';
  }).join('');

  /* Los formularios de aporte se redibujan acá adentro, así que las etiquetas de
     los botones de fecha hay que volver a pintarlas: si no, el botón queda en
     "—" aunque el campo tenga la fecha de hoy puesta. */
  pintarFechas();
}

/* ---- grupos ---- */
function grupoDeCat(c){ var g = S.grupoDe[c]; return esGrupo(g) ? g : (GRUPO_CAT[c] || 'otros'); }
function nombreGrupo(id){ var g = grupoPorId(id); return g ? g.nombre : id; }
function gastosPorGrupo(ym){
  var por = {}, det = {};
  S.grupos.forEach(function(g){ por[g.id] = 0; det[g.id] = []; });
  gastosPorCat(ym).forEach(function(x){
    var g = grupoDeCat(x.cat);
    if(por[g] == null){ por[g] = 0; det[g] = []; }
    por[g] += x.monto;
    det[g].push(x);
  });
  return { por:por, det:det };
}

/* ---- categorías ---- */
var catTab = 'gasto', catConfirm = null, grupoConfirm = null, medioConfirm = null;
var fQuin = false;   // v255: el interruptor "Quincenal" de un ingreso fijo nuevo
var monMov = 'ARS', monFijo = 'ARS', fijoTab = 'gasto', verEnPesos = false, cuentaDelConfirm = null;
var pgConf = null;      // el fijo de "Pagos del mes" que está esperando que confirmes
try{ verEnPesos = localStorage.getItem('plata-clara-verpesos') === '1'; }catch(e){}
function pintarMon(){
  $$('#segMonMov button').forEach(function(b){ b.setAttribute('aria-pressed', b.getAttribute('data-mon')===monMov ? 'true':'false'); });
  $$('#segMonFijo button').forEach(function(b){ b.setAttribute('aria-pressed', b.getAttribute('data-mon')===monFijo ? 'true':'false'); });
  pintarCotMano('m', monMov === 'USD');
  pintarCotMano('f', monFijo === 'USD');
}
/* En dólares aparece el campo "A cuánto estaba el dólar", con el último que
   escribiste. La app no lo busca en internet: lo ponés vos. */
function pintarCotMano(pre, ver){
  var box = $('#' + pre + 'CotBox'), inp = $('#' + pre + 'Cot'); if(!box || !inp) return;
  var antes = box.hidden;
  box.hidden = !ver;
  if(ver && (antes || !inp.value)) inp.value = cotDolar() > 0 ? enCampo(cotDolar()) : '';
}
/* Un movimiento en dólares necesita una cotización para poder sumarse a los
   pesos. Sin ella no se guarda: valdría cero y ensuciaría todos los totales.
   La que escribiste en el formulario queda como la del dólar para la próxima. */
function cotParaGuardar(pre){
  var inp = pre ? $('#' + pre + 'Cot') : null;
  if(inp && !$('#' + pre + 'CotBox').hidden){
    var v = Math.max(0, parseMoney(inp.value));
    if(v > 0){
      if(v !== cotDolar() && !editando) S.dolar = { venta:v, fecha:today() };   // (corregir uno viejo no cambia el de hoy)
      return v;
    }
    toast('Poné a cuánto estaba el dólar'); try{ inp.focus(); }catch(e){}
    return 0;
  }
  var c = cotDolar();
  if(c > 0) return c;
  toast('Falta cargar el dólar',
        { texto:'Llevame ahí', ir:'ajustes', scroll:'#cardDolar', foco:'#dolarVenta' });
  return 0;
}
var fManual = false;
function pintarFManual(){
  var esIng = (fijoTab === 'ingreso'), b = $('#fManual'); if(!b) return;
  b.setAttribute('aria-checked', fManual ? 'true' : 'false');
  $('#fManualTxt').textContent = esIng ? 'Lo tacho yo cuando lo cobre' : 'Lo tacho yo cuando lo pague';
  $('#fManualNota').textContent = fManual
    ? 'No se suma solo: queda en ' + (esIng ? 'Cobros' : 'Pagos') + ' del mes, arriba, y se cuenta recién cuando lo tachás.'
    : 'Se suma solo el día que ' + (esIng ? 'entra' : 'vence') + '.';
}
function pintarFijoForm(){
  $$('#segFijo button').forEach(function(b){ b.setAttribute('aria-pressed', b.getAttribute('data-v')===fijoTab ? 'true':'false'); });
  var esIng = (fijoTab === 'ingreso');
  var lab = $('#fMontoLab'); if(lab) lab.textContent = esIng ? 'Cuánto entra' : 'Cuánto sale';
  var lm = $('#fMedioLab'); if(lm) lm.textContent = esIng ? 'Dónde te lo depositan' : 'Con qué se debita';
  var sub = $('#fSubmit'); if(sub) sub.textContent = esIng ? 'Guardar ingreso fijo' : 'Guardar gasto fijo';
  pintarFManual();
  var nt = $('#fNuevoTit'); if(nt) nt.textContent = esIng ? 'Nuevo ingreso fijo' : 'Nuevo gasto fijo';
  var ns = $('#fNuevoSub'); if(ns) ns.textContent = esIng
    ? 'Lo que entra todos los meses, como el sueldo'
    : 'Lo que sale todos los meses: elegí la fecha del primer cobro y se repite ese día';
  var nom = $('#fNombre');
  if(nom) nom.setAttribute('placeholder', esIng ? 'Ej: sueldo, alquiler que cobro' : 'Ej: gimnasio, Netflix, alquiler');
  var fqb = $('#fQuienBox .qb-med'); if(fqb) fqb.hidden = esIng;
  var cd = $('#campoDia'), cu = $('#fCuando');
  // un gasto va en una fecha (y, si querés, una hora); un ingreso, en un día
  // del mes, el primer o último día hábil, o por quincena
  // v254: un ingreso nuevo arranca en "Un día hábil" (ya no hay "Un día del mes"); un gasto va por fecha
  // v255: con "Quincenal" prendido, el desplegable pasa a ser cuántos días hábiles después de cada quincena
  // v256: con "Quincenal" prendido, en vez del desplegable va un número: cuántos días hábiles después de cada quincena (0 a 15)
  // v258: el diseño no se mueve: "Cuándo" pasa a decir "Por quincena" y el número va donde
  // estaba "Qué día hábil del mes", con su propio título
  var quin = fQuin && esIng;
  if(cu && cu.getAttribute('data-q') !== (quin ? '1' : '0')){
    var antes = cu.value;
    cu.setAttribute('data-q', quin ? '1' : '0');
    cu.innerHTML = quin ? '<option value="quincena" selected>Por quincena</option>'
      : '<option value="nHabil">Un día hábil</option><option value="primerHabil">El primer día hábil</option><option value="ultimoHabil">El último día hábil</option>';
    cu.value = quin ? 'quincena' : (cu.getAttribute('data-antes') || 'nHabil');
    if(quin) cu.setAttribute('data-antes', antes || 'nHabil');
  }
  // v259: con Quincenal, "Por quincena" queda bloqueado (se cambia sólo con el interruptor)
  if(cu){ cu.disabled = quin; cu.title = quin ? 'Para cambiarlo, apagá Quincenal' : ''; }
  var qsw = $('#fQuinSw'); if(qsw) qsw.setAttribute('aria-checked', quin ? 'true' : 'false');
  if(cu && esIng && !cu.value) cu.value = 'nHabil';
  var vis = { campoCuando:esIng, campoDia:esIng && cu && cu.value === 'dia', campoDesde:esIng,
              campoQhab:false, fQhabAyuda:false,
              campoNhab:esIng && !quin && cu && cu.value === 'nHabil', fNhabAyuda:esIng && !quin && cu && cu.value === 'nHabil',
              campoQuinHab:quin, fQuinAyuda:quin,
              campoFecha:!esIng, campoHora:!esIng };
  Object.keys(vis).forEach(function(id){ var el = document.getElementById(id); if(el) el.hidden = !vis[id]; });
  var ff = $('#fFecha'); if(ff && !ff.value){ ff.value = defaultFecha(); pintarFecha(ff); }
  var fc = $('#fCat');
  if(fc){
    var catAntes = fc.value, listaF = esIng ? S.catIng : S.catGasto;
    fc.innerHTML = listaF.map(function(c){ return '<option>'+esc(c)+'</option>'; }).join('');
    // cambiar "Cuándo" no tiene que devolver la categoría a la primera de la lista
    if(catAntes && listaF.indexOf(catAntes) > -1) fc.value = catAntes;
  }
  pintarSueldoAyudas();
  if(editandoFijo) pintarEditFijo();
}
/* Avisa, en el momento de cargar, que un sueldo va a contar en el mes siguiente:
   el fijo "el último día hábil" de categoría Sueldo, o un movimiento de Sueldo
   con fecha del último día hábil. */
function pintarSueldoAyudas(){
  var f = $('#fSueldoAyuda');
  if(f){
    var cu = $('#fCuando'), ca = $('#fCat');
    var siF = fijoTab === 'ingreso' && !!cu && cu.value === 'ultimoHabil' && !!ca && ca.value === 'Sueldo';
    f.hidden = !siF;
    if(siF) f.textContent = 'Un sueldo que entra el último día hábil cuenta como el del mes siguiente: aparece en los ingresos de ese mes, aunque la plata se acredite antes.';
  }
  var m = $('#mSueldoAyuda');
  if(m){
    var cm = $('#mCat'), fm = $('#mFecha');
    var siM = tipoMov === 'ingreso' && !!cm && cm.value === 'Sueldo' && !!fm && esUltimoHabilFecha(fm.value);
    m.hidden = !siM;
    if(siM) m.textContent = 'Como entra el último día hábil del mes, cuenta como sueldo de ' + ymLabel(ymAdd(ymOf(fm.value), 1)) + '. La fecha queda la que pusiste.';
  }
}
var monedaMeta = 'ARS';
/* Moneda elegida en el formulario de cada meta (por id), y el aporte que estoy
   editando. El formulario se redibuja entero en cada render, así que el estado
   no puede vivir en el DOM. */
var monAp = {}, apEdit = null, iniEdit = null;
/* `apPregunta`: el aporte de otro mes que está esperando que elijas si lo sumo
   a lo que ya tenías o lo cargo en ese mes. */
var apPregunta = null;
function listaY(l){ return l.length < 2 ? (l[0] || '') : (l.slice(0, -1).join(', ') + ' y ' + l[l.length - 1]); }
function monDeAporte(m){ return monAp[m.id] || m.moneda || 'ARS'; }
function salirApEdit(){ apEdit = null; }
/* Guarda un aporte nuevo. `previo`: es plata que ya tenías, sumada al punto de
   partida con su fecha. */
function crearAporte(meta, d, previo){
  var nuevo = { id:uid(), ts:Date.now(), monto:d.monto, fecha:d.fecha, cot:d.cot };
  if(d.mon !== (meta.moneda || 'ARS') || d.mon === 'USD') nuevo.mon = d.mon;
  if(previo) nuevo.previo = true;
  meta.aportes.push(nuevo);
  arrOlvidar();
  save(); render();
  toast(previo ? ('Sumado a lo que ya tenías: no toca el balance de ' + ymLabel(ymOf(d.fecha))) : 'Aporte sumado');
}
/* La meta ya no tiene "modo": el único selector que queda dice en qué unidad
   está escrito EL OBJETIVO. La plata que hay adentro no se elige: se carga en
   dos campos, uno por moneda, tanto al crearla como después. */
function pintarMoneda(){
  $$('#segMonObj button').forEach(function(b){
    b.setAttribute('aria-pressed', b.getAttribute('data-mon') === monedaMeta ? 'true':'false');
  });
}
/* El cartel que pregunta, una sola vez por mes, si querés pasar lo que sobró.
   Sólo aparece cuando estás parado en el mes en curso: preguntarte por un mes
   viejo mientras mirás otro no tendría sentido. */
function pintarAvisoArr(){
  var el = $('#avisoArr'); if(!el) return;
  var hoyM = ymNow();
  var mostrar = S.arrastreModo === 'preguntar' && !verDe()
    && mes === hoyM
    && !(S.arrastre && S.arrastre[hoyM] !== undefined)
    && hayQueArrastrar(hoyM);
  el.hidden = !mostrar;
  if(!mostrar) return;
  var prev = ymAdd(hoyM, -1), v = resumen(prev).bal;
  $('#avisoArrTit').textContent = v < 0 ? 'Arrancó ' + ymLabel(hoyM, true) : 'Te sobró plata en ' + ymLabel(prev, true);
  $('#avisoArrTxt').textContent = v < 0
    ? (ymLabel(prev, true) + ' cerró ' + money(v) + ' en rojo. ¿Lo arrastro a este mes para no perderlo de vista?')
    : (ymLabel(prev, true) + ' cerró con ' + money(v) + ' libres. ¿Los sumo a ' + ymLabel(hoyM, true) + '?');
}
