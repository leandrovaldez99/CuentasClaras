/* Cuentas Claras · js/ahorros.js
   Metas de ahorro, aportes y cuentas donde está la plata.

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
    ? ('Incluye ' + usd(enDolares) + (cotDolar() > 0 ? ' al ' + nombreDolar(tipoDolar()).toLowerCase() + ' de ' + money(cotDolar()) : ' · falta la cotización'))
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
    var aps = (m.aportes||[]).filter(function(a){ return !a.parte; }).sort(function(a,b){ return a.fecha<b.fecha?1:-1; }).slice(0,5);
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
            + campo('ARS', iniTotalArs(m), 'Pesos')
            + campo('USD', iniUsd(m), 'Dólares')
            + '<button type="button" class="btn ghost sm btnini" data-iniedit="'+esc(m.id)+'">'
            + (abierto ? 'Listo' : 'Editar') + '</button>'
            + '</div>';
        })()
      + filaRinde(m)
      + (function(){
          var ed = (apEdit && apEdit.meta === m.id) ? aportePorId(m, apEdit.ap) : null;
          var preg = (!ed && apPregunta && apPregunta.meta === m.id) ? apPregunta : null;
          var monF = preg ? preg.mon : (ed ? (monAp[m.id] || monAporte(m, ed)) : monDeAporte(m));
          var sacaEd = ed && (Number(ed.monto)||0) < 0;
          var lugarF = preg ? preg.lugar
            : (ed ? (apEdit.lugar !== undefined ? apEdit.lugar : lugarAporte(m, ed)) : dondeDeAporte(m));
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
                        ? ('Al ' + nombreDolar(tipoDolar()).toLowerCase() + ' de hoy (' + money(cotDolar()) + '). Esos dólares quedan fijos: la cantidad ya no se mueve.')
                        : ('Al ' + nombreDolar(tipoDolar()).toLowerCase() + ' de hoy (' + money(cotDolar()) + '), y se actualiza: son dólares que seguís teniendo.'))
                    : 'Falta la cotización del dólar para poder convertirlo.')
                + '</p>'
              : '')
          /* Si rinde y en qué cuenta. Sólo para pesos: los dólares no rinden. */
          +   ((monF !== 'USD')
              ? '<div class="field full"><span class="lab">' + (sacaEd ? 'De dónde sale' : 'Esta plata') + '</span>'
                + ctlRinde('ap:' + m.id, lugarF, { disabled:!!preg, label:(sacaEd ? 'Sale de una cuenta que rinde' : 'Rinde') })
                + '</div>'
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
              + (preg.lugar && tnaDe(cuentaPorId(preg.lugar)) > 0
                  ? ', y rinde igual desde el ' + esc(fechaLarga(preg.fecha)) : '')
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
            var lug = lugarAporte(m, a);
            var donde = (monAporte(m, a) === 'USD' || !hayDondeRendir()) ? ''
              : (lug ? ' · rinde en ' + nombreLugar(lug) : ' · no rinde');
            return '<div class="row editable'+(enEd?' propuesta':'')+'" data-apedit="'+esc(m.id)+'|'+esc(a.id)+'" title="Tocá para corregirlo">'
              + '<span class="mark '+(saca?'saca':'meta')+'">'+iconFor(saca?'saca':'meta')+'</span>'
              + '<span class="t"><b>'+(saca?'− ':'')+esc(textoAporte(m, a))+'</b><small>'
              + (saca ? 'Retiro · ' : '') + (a.previo ? 'Ya lo tenía · ' : '') + esc(fechaLabel(a.fecha))
              + esc(conversionAporte(m, a)) + esc(donde) + '</small></span>'
              + '<span class="acts">'+delBtn('aporte',m.id,a.id)+'</span></div>';
          }).join('')+'</div>' : '')
      + '</div>';
  }).join('');

  // el control de la meta nueva se rehace por si cambiaron las cuentas
  var gdN = $('#gDonde'); if(gdN) gdN.innerHTML = '';
  pintarNuevaDonde();
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
}
/* Un movimiento en dólares necesita una cotización para poder sumarse a los
   pesos. Sin ella no se guarda: valdría cero y ensuciaría todos los totales. */
function cotParaGuardar(){
  var c = cotDolar();
  if(c > 0) return c;
  toast('Falta la cotización del dólar',
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
/* `dondeAp`: el lugar elegido en el formulario de aporte de cada meta, mientras
   no lo guardás. `apPregunta`: el aporte de otro mes que está esperando que
   elijas si lo sumo a lo que ya tenías o lo cargo en ese mes. */
var dondeAp = {}, apPregunta = null;
/* La parte nueva de lo que ya tenías, mientras todavía no le pusiste el monto. */
var parteNueva = {}, parteNuevaLugar = {};
function lugarParteNueva(m){
  if(Object.prototype.hasOwnProperty.call(parteNuevaLugar, m.id)) return lugarValido(parteNuevaLugar[m.id]);
  // lo más probable es que la parte nueva esté donde NO está la primera
  return lugarInicial(m) ? '' : lugarPorDefecto();
}
/* ---- el interruptor "Rinde" ----
   Un solo control para decir dónde está la plata: prendido = en una cuenta que
   rinde (y cuál, tocando su botón); apagado = guardada aparte, sin rendir. El
   valor vive en un campo oculto `donde` —el id de la cuenta, o vacío—, así el
   formulario lo lee igual que antes leía el desplegable. */
var ultimoLugar = '', nuevaLugar, efecAbierto = {};
function lugarSugerido(){
  var u = lugarValido(ultimoLugar); if(u) return u;
  var d = lugarPorDefecto(); if(d) return d;
  var c = cuentas().filter(function(x){ return !!x.medio; })[0];
  return c ? c.id : '';
}
function ctlRinde(key, lugar, o){
  o = o || {};
  var etq = esc(o.label || 'Rinde');
  if(!hayDondeRendir()){
    return '<div class="rctl" data-rctl="' + esc(key) + '"><input type="hidden" name="donde" value="">'
      + '<button type="button" class="swi rsw" role="switch" aria-checked="false" disabled><span class="swi-t"></span><span>' + etq + '</span></button>'
      + '<span class="rnota">Para que rinda, cargá tu cuenta en Ajustes › Cuentas que rinden.</span></div>';
  }
  lugar = lugarValido(lugar);
  var otras = (o.otras || []).filter(function(id){ return id && id !== lugar; });
  var dis = o.disabled ? ' disabled' : '';
  var chips = cuentas().filter(function(c){ return !!c.medio; }).map(function(c){
    var t = tnaDe(c), on = (c.id === lugar || otras.indexOf(c.id) > -1);
    return '<button type="button" class="chip rchip" data-rchip="' + esc(c.id) + '" aria-pressed="' + (on ? 'true' : 'false') + '"' + dis + '>'
      + esc(c.medio) + ' <small>' + (t > 0 ? esc(fmtPct(t)) : 'sin tasa') + '</small></button>';
  }).join('');
  return '<div class="rctl' + (lugar ? ' on' : '') + '" data-rctl="' + esc(key) + '"' + (o.multi ? ' data-multi="1"' : '') + '>'
    + '<input type="hidden" name="donde" value="' + esc(lugar) + '">'
    + '<button type="button" class="swi rsw" role="switch" aria-checked="' + (lugar ? 'true' : 'false') + '"' + dis + '>'
    + '<span class="swi-t"></span><span>' + etq + '</span></button>'
    + '<div class="rchips" role="group" aria-label="En qué cuenta"' + (lugar ? '' : ' hidden') + '>' + chips + '</div>'
    + '</div>';
}
function pintarRctl(box, lugar, otras){
  otras = otras || [];
  var h = box.querySelector('input[name="donde"]'); if(h) h.value = lugar || '';
  box.classList.toggle('on', !!lugar);
  var sw = box.querySelector('.rsw'); if(sw) sw.setAttribute('aria-checked', lugar ? 'true' : 'false');
  var ch = box.querySelector('.rchips'); if(ch) ch.hidden = !lugar;
  $$('[data-rchip]', box).forEach(function(b){
    var id = b.getAttribute('data-rchip');
    b.setAttribute('aria-pressed', (id === lugar || (lugar && otras.indexOf(id) > -1)) ? 'true' : 'false');
  });
}
/* ---- lo que ya tenías, en más de una cuenta ----
   La primera cuenta elegida es la de la meta (`m.cuenta`) y se queda con lo que
   queda (`m.inicial`). Cada cuenta más es una "parte" que rinde en ESA cuenta:
   un aporte `previo` + `parte` con `cuenta`, con la fecha de la meta. Así rinde
   a su tasa desde el mismo día, no toca el balance de ningún mes y no le
   descuenta nada a la cuenta, igual que el efectivo. */
var ctaPend = {};            // cuentas tocadas adentro de una meta, todavía sin monto
var nuevaOtras = [];         // las cuentas de más del formulario de meta nueva: [{cid, v}]
function montoEn(m, cid){
  return partesDe(m).reduce(function(t, a){
    return t + ((a.rinde && lugarAporte(m, a) === cid) ? (Number(a.monto)||0) : 0);
  }, 0);
}
/* Las otras cuentas donde hay plata de lo que ya tenías, en el orden en que se
   agregaron, más las que tocaste y todavía no tienen monto. */
function otrasCuentasIni(m){
  var prim = lugarInicial(m), out = [];
  partesDe(m).forEach(function(a){
    if(!a.rinde) return;
    var c = lugarAporte(m, a);
    if(c && c !== prim && out.indexOf(c) === -1) out.push(c);
  });
  (ctaPend[m.id] || []).forEach(function(c){
    if(lugarValido(c) && c !== prim && out.indexOf(c) === -1) out.push(c);
  });
  return out;
}
/* Lo que queda en la cuenta principal: lo suelto más cualquier parte vieja que
   haya quedado en esa misma cuenta. */
function restoIni(m){ var p = lugarInicial(m); return iniArs(m) + (p ? montoEn(m, p) : 0); }
/* Devuelve a la cuenta principal lo que había en `cid`. */
function juntarCuenta(m, cid){
  var t = 0;
  m.aportes = (m.aportes||[]).filter(function(a){
    if(a.parte && a.rinde && lugarAporte(m, a) === cid){ t += Number(a.monto)||0; return false; }
    return true;
  });
  m.inicial = Math.round((iniArs(m) + t) * 100) / 100;
  return t;
}
function ponerEnCuenta(m, cid, v){
  var p = lugarInicial(m);
  if(p) juntarCuenta(m, p);             // una parte vieja en la principal pasa a ser "lo que queda"
  juntarCuenta(m, cid);
  v = Math.round(Math.min(Math.max(0, Number(v)||0), iniArs(m)) * 100) / 100;
  if(v > 0 && cid !== p){
    m.inicial = Math.round((iniArs(m) - v) * 100) / 100;
    m.aportes.push({ id:uid(), ts:Date.now(), monto:v, fecha:m.desde, cot:0, mon:'ARS',
                     previo:true, parte:true, rinde:true, cuenta:cid });
  } else v = 0;
  return v;
}
/* Todo lo que ya tenías vuelve a un solo lugar (se apagó el interruptor). */
function juntarTodo(m){
  var t = 0;
  m.aportes = (m.aportes||[]).filter(function(a){ if(a.parte){ t += Number(a.monto)||0; return false; } return true; });
  m.inicial = Math.round((iniArs(m) + t) * 100) / 100;
  delete ctaPend[m.id]; delete efecAbierto[m.id];
}
/* "Mercado Pago, Lemon y efectivo": el texto que dice cómo quedó repartido. */
function listaY(l){ return l.length < 2 ? (l[0] || '') : (l.slice(0, -1).join(', ') + ' y ' + l[l.length - 1]); }
function X_SVG(){ return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>'; }
/* La parte de lo que ya tenías que está en efectivo: son las partes guardadas
   aparte. Poner un monto nuevo las junta en una sola. */
function efectivoDe(m){
  return partesDe(m).reduce(function(t, a){ return t + (a.rinde ? 0 : (Number(a.monto)||0)); }, 0);
}
function ponerEfectivo(m, v){
  var ef = efectivoDe(m);
  m.inicial = iniArs(m) + ef;
  m.aportes = (m.aportes||[]).filter(function(a){ return !(a.parte && !a.rinde); });
  v = Math.round(Math.min(Math.max(0, Number(v)||0), m.inicial) * 100) / 100;
  if(v > 0){
    m.inicial = Math.round((m.inicial - v) * 100) / 100;
    m.aportes.push({ id:uid(), ts:Date.now(), monto:v, fecha:m.desde, cot:0, mon:'ARS', previo:true, parte:true, rinde:false });
  }
  return v;
}
/* El bloque de "¿dónde están esos pesos?" del formulario de meta nueva. */
function nuevaOtrasIds(){ return nuevaOtras.map(function(o){ return o.cid; }); }
function pintarNuevaDonde(){
  var w = $('#gDondeWrap'); if(!w) return;
  var pes = Math.max(0, parseMoney($('#gInicial').value));
  w.hidden = !(pes > 0);
  nuevaOtras = nuevaOtras.filter(function(o){ return lugarValido(o.cid) && o.cid !== nuevaLugar; });
  var box = $('#gDonde');
  if(box && !box.querySelector('[data-rctl]')){
    if(nuevaLugar === undefined) nuevaLugar = lugarSugerido();
    box.innerHTML = ctlRinde('nueva', nuevaLugar, { multi:true, otras:nuevaOtrasIds() });
  }
  var lug = nuevaLugar || '';
  if(!lug) nuevaOtras = [];
  /* Los renglones de las otras cuentas se rearman sólo cuando cambia CUÁLES
     son: si se rearmaran con cada tecla, el campo que estás escribiendo perdería
     el foco. */
  var ot = $('#gOtras'), firma = lug + '|' + nuevaOtrasIds().join(',');
  if(ot && ot.getAttribute('data-firma') !== firma){
    ot.setAttribute('data-firma', firma);
    ot.innerHTML = nuevaOtras.length
      ? '<div class="refec"><span class="lab">En ' + esc(nombreLugar(lug)) + '</span>'
        + '<span class="resto-v" id="gRestoV"></span><span></span></div>'
        + nuevaOtras.map(function(o){
            return '<div class="refec"><label class="lab" for="gc-' + esc(o.cid) + '">En ' + esc(nombreLugar(o.cid)) + '</label>'
              + '<span class="pctin plata"><i>$</i><input class="money-in" id="gc-' + esc(o.cid) + '" data-gcta="' + esc(o.cid) + '" type="text" inputmode="decimal"'
              + ' value="' + esc(o.v || '') + '" placeholder="0" autocomplete="off"></span>'
              + '<button type="button" class="iconbtn" data-gctasacar="' + esc(o.cid) + '" aria-label="Sacar ' + esc(nombreLugar(o.cid)) + '" title="Sacar ' + esc(nombreLugar(o.cid)) + '">' + X_SVG() + '</button></div>';
          }).join('')
      : '';
  }
  var efRow = $('#gEfRow'), efAb = $('#gEfAbrir');
  if(!lug){ efRow.hidden = true; efAb.hidden = true; }
  else { efAb.hidden = !efRow.hidden; }
  var ef = efRow.hidden ? 0 : Math.max(0, parseMoney($('#gEfectivo').value));
  var enOtras = nuevaOtras.reduce(function(t, o){ return t + Math.max(0, parseMoney(o.v || '')); }, 0);
  var resto = pes - ef - enOtras;
  var rv = $('#gRestoV');
  if(rv) rv.innerHTML = esc(money(Math.max(0, resto))) + '<small>lo que queda</small>';
  var p = $('#gDondePista'), t = '';
  if(!hayDondeRendir()) t = 'Quedan guardados aparte, sin rendir.';
  else if(!lug) t = 'Quedan guardados aparte: no rinden.';
  else if(resto < -0.005) t = 'Lo que repartiste pasa los ' + money(pes) + ' que pusiste.';
  else if(!nuevaOtras.length && !(ef > 0)){
    var tn = tnaDe(cuentaPorId(lug));
    t = 'Rinden en ' + nombreLugar(lug) + (tn > 0 ? ' al ' + fmtPct(tn) + ' anual' : ', que todavía no tiene tasa') + ', desde hoy.'
      + (cuentas().filter(function(c){ return !!c.medio; }).length > 1 ? ' Si una parte está en otra cuenta, tocala también.' : '');
  } else {
    var sinMonto = nuevaOtras.filter(function(o){ return !(parseMoney(o.v || '') > 0); })
      .map(function(o){ return nombreLugar(o.cid); });
    if(sinMonto.length){
      t = 'Poné cuánto hay en ' + listaY(sinMonto) + '; lo que queda sigue en ' + nombreLugar(lug) + '.';
    } else {
      var partes = [money(Math.max(0, resto)) + ' rinden en ' + nombreLugar(lug)];
      nuevaOtras.forEach(function(o){ partes.push(money(Math.max(0, parseMoney(o.v))) + ' en ' + nombreLugar(o.cid)); });
      if(ef > 0) partes.push(money(ef) + ' quedan en efectivo, sin rendir');
      t = listaY(partes) + '.';
    }
  }
  if(p) p.textContent = t;
}
/* Tocar una cuenta con el interruptor prendido. Si no estaba, se suma (y pide su
   monto); si ya estaba, sale y su plata vuelve a la principal. Si tocás la
   principal y hay otras, la siguiente pasa a ser la principal: así, para mudar
   todo de Mercado Pago a Lemon alcanza con tocar Lemon y después Mercado Pago. */
function tocarCuentaNueva(box, cid){
  var foco = '';
  if(cid === nuevaLugar){
    if(!nuevaOtras.length) return;
    nuevaLugar = nuevaOtras.shift().cid;
  } else {
    var i = nuevaOtrasIds().indexOf(cid);
    if(i > -1) nuevaOtras.splice(i, 1);
    else { nuevaOtras.push({ cid:cid, v:'' }); foco = cid; }
  }
  ultimoLugar = nuevaLugar;
  pintarRctl(box, nuevaLugar, nuevaOtrasIds());
  pintarNuevaDonde();
  var c = foco ? $('#gc-' + foco) : null;
  if(c) try{ c.focus(); }catch(x){}
}
function tocarCuentaIni(m, cid){
  var prim = lugarInicial(m), pend = ctaPend[m.id] || [];
  var otras = otrasCuentasIni(m);
  if(cid === prim){
    if(!otras.length) return;
    var nueva = otras[0];
    juntarCuenta(m, prim); juntarCuenta(m, nueva);
    ctaPend[m.id] = pend.filter(function(c){ return c !== nueva; });
    m.cuenta = nueva; m.rinde = true;
    save(); render();
    toast(nombreLugar(prim) + ' salió: lo que había ahí ahora está en ' + nombreLugar(nueva));
    return;
  }
  if(montoEn(m, cid) > 0){
    var t = juntarCuenta(m, cid);
    ctaPend[m.id] = pend.filter(function(c){ return c !== cid; });
    save(); render();
    toast('Los ' + money(t) + ' de ' + nombreLugar(cid) + ' vuelven a ' + nombreLugar(prim));
    return;
  }
  if(pend.indexOf(cid) > -1){ ctaPend[m.id] = pend.filter(function(c){ return c !== cid; }); renderAhorro(); return; }
  pend.push(cid); ctaPend[m.id] = pend;
  renderAhorro();
  var inp = $('#ic-' + m.id + '-' + cid);
  if(inp) try{ inp.focus(); }catch(x){}
}
function metaPorId(id){ var r = null; S.metas.forEach(function(x){ if(x.id === id) r = x; }); return r; }
function monDeAporte(m){ return monAp[m.id] || m.moneda || 'ARS'; }
function salirApEdit(){ apEdit = null; }
/* Dónde propongo guardar el próximo aporte: lo último que elegiste en esta meta;
   si todavía no elegiste nada, donde está su último aporte en pesos; y si no
   hay ninguno, donde está lo que ya tenías. */
function dondeDeAporte(m){
  if(Object.prototype.hasOwnProperty.call(dondeAp, m.id)) return lugarValido(dondeAp[m.id]);
  var ult = null;
  (m.aportes||[]).forEach(function(a){
    if(monAporte(m, a) === 'USD' || (Number(a.monto)||0) <= 0) return;
    if(!ult || (Number(a.ts)||0) >= (Number(ult.ts)||0)) ult = a;
  });
  return ult ? lugarAporte(m, ult) : lugarInicial(m);
}
/* El lugar elegido en el formulario. `null` si no hay dónde elegir (todavía no
   cargaste ninguna cuenta): ahí el aporte hereda lo que diga la meta. */
function lugarDelForm(frm, mon){
  if(mon === 'USD') return '';
  var sel = frm && frm.elements && frm.elements.donde;
  return sel ? lugarValido(sel.value) : null;
}
/* Le pone al aporte dónde está su plata. */
function ponerLugar(m, a, lugar){
  if(monAporte(m, a) === 'USD'){ a.rinde = false; delete a.cuenta; return; }
  if(lugar === null){ a.rinde = (m.rinde === true); delete a.cuenta; return; }
  a.rinde = !!lugar;
  if(lugar) a.cuenta = lugar; else delete a.cuenta;
}
/* Guarda un aporte nuevo. `previo`: es plata que ya tenías, sumada al punto de
   partida con su fecha. Si la fecha es de días atrás y la plata rinde, el aviso
   dice cuánto rindió ya en esos días: es la forma de ver que se contaron. */
function crearAporte(meta, d, previo){
  arrOlvidar();
  var antes = interesMetaArs(meta);
  var nuevo = { id:uid(), ts:Date.now(), monto:d.monto, fecha:d.fecha, cot:d.cot };
  if(d.mon !== (meta.moneda || 'ARS') || d.mon === 'USD') nuevo.mon = d.mon;
  ponerLugar(meta, nuevo, d.lugar);
  if(previo) nuevo.previo = true;
  meta.aportes.push(nuevo);
  arrOlvidar();
  var ya = interesMetaArs(meta) - antes;
  save(); render();
  var txt = previo
    ? ('Sumado a lo que ya tenías: no toca el balance de ' + ymLabel(ymOf(d.fecha)))
    : 'Aporte sumado';
  if(ya > 0.005 && d.fecha < today()) txt += ' · ya rindió ' + money(ya) + ' desde el ' + fechaLabel(d.fecha);
  toast(txt);
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
function opcionesEntidad(elegida){
  var bancos = (S.tasas||[]).filter(function(x){ return x.tipo === 'banco'; });
  var bill   = (S.tasas||[]).filter(function(x){ return x.tipo === 'billetera'; });
  function opts(lista){
    return lista.map(function(x){
      return '<option value="'+esc(x.api)+'" data-busca="'+esc(x.busca||'')+'"'+(x.api === elegida ? ' selected' : '')+'>'
        + esc(x.n) + ' · ' + esc(fmtPct(x.tna)) + '</option>';
    }).join('');
  }
  return '<option value=""'+(elegida ? '' : ' selected')+'>Ninguna</option>'
    + '<optgroup label="Billeteras y cuentas remuneradas">' + opts(bill) + '</optgroup>'
    + '<optgroup label="Bancos (plazo fijo)">' + opts(bancos) + '</optgroup>';
}
function notaCuenta(c){
  var v = tnaDe(c), ent = entidadDe(c);
  if(!c.medio){
    return 'Elegí tu banco o billetera: le pongo el nombre, y lo que cargues con ese medio entra y sale de acá.';
  }
  if(v <= 0){
    return 'Falta la tasa: elegí el banco o escribila vos, y empiezo a sumarte los intereses.';
  }
  var txt = (c.manual ? 'Tu tasa' : (ent ? ent.n : '—'))
    + ': ' + fmtPct(v) + ' al año, ' + (v/365).toFixed(4).replace('.', ',') + '% por día.'
    + ' Rinde lo que entra y sale con este medio.';
  if(c.manual) txt += ' Si la borrás, vuelvo a la de la lista.';
  else if(ent && ent.fija) txt += ' Esta la fijaste vos: no se actualiza sola. Para que vuelva a ser automática, tocá el lápiz y borrala.';
  else if(ent && ent.al) txt += ' Se actualiza sola: ' + (ent.al === today() ? 'última vez hoy.' : 'última vez el ' + ent.al.slice(8, 10) + '/' + ent.al.slice(5, 7) + '.');
  if(cuentaTieneUsd(c)) txt += ' Lo que está en dólares no rinde: la tasa es en pesos.';
  return txt;
}
var tnaEdit = {};
var LAPIZ_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>';
function renderCuentas(){
  var el = $('#cuentaList'); if(!el) return;
  var lista = cuentas();
  var varias = lista.length > 1;
  el.classList.toggle('varias', varias);

  el.innerHTML = lista.map(function(c, i){
    var ent = entidadDe(c);
    var tnaVis = ent ? ent.tna : Number(c.tna);
    /* El nombre ya lo dice el banco elegido, así que la casilla del nombre sólo
       aparece cuando el banco no está en la lista (ahí hay que ponérselo a mano).
       El tacho va en el mismo renglón que el banco y la tasa. */
    var borrar = varias
      ? (cuentaDelConfirm === c.id
        ? '<button class="confirm" type="button" data-cdel="'+esc(c.id)+'">Borrar</button>'
        : '<button class="iconbtn" type="button" data-cdel="'+esc(c.id)+'" aria-label="Borrar '+esc(c.medio||'esta cuenta')+'" title="Borrar esta cuenta">'
          + '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/></svg></button>')
      : '';
    return '<div class="ctacard'+(i?' sep':'')+'">'
      + ((ent || !(c.manual || c.medio)) ? '' : '<div class="field ctanomf" style="margin-bottom:10px;max-width:300px"><label class="lab" for="cNom-'+esc(c.id)+'">Nombre</label>'
        +   '<input class="ctanom" id="cNom-'+esc(c.id)+'" type="text" data-cmed="'+esc(c.id)+'" value="'+esc(c.medio||'')+'" maxlength="28"'
        +     ' autocomplete="off" placeholder="Ej: mi banco" aria-label="Nombre de la cuenta y del medio de pago"></div>')
      + '<div class="ctaform'+(varias ? ' conborrar' : '')+'">'
      +   '<div class="field"><label class="lab" for="cBusca-'+esc(c.id)+'">Banco o billetera</label>'
      +     '<div class="combo" data-cta="'+esc(c.id)+'" data-ph="Escribí para buscar" data-ph0="Buscá tu banco"'
      +          ' data-vacio="Ninguna" data-nada="Si no está, escribí la TNA a mano acá al lado y ponele el nombre vos.">'
      +       '<input id="cBusca-'+esc(c.id)+'" type="text" role="combobox" aria-expanded="false"'
      +            ' aria-controls="cLista-'+esc(c.id)+'" aria-autocomplete="list" autocomplete="off" spellcheck="false"'
      +            ' placeholder="Escribí para buscar">'
      +       '<div class="combo-pop" id="cLista-'+esc(c.id)+'" role="listbox" aria-label="Bancos y billeteras" hidden></div>'
      +       '<select data-cent="'+esc(c.id)+'" tabindex="-1" aria-hidden="true">'+opcionesEntidad(c.entidad)+'</select>'
      +     '</div></div>'
      +   (function(){
            /* Con tasa puesta, la casilla queda trabada y se edita con el lápiz.
               Vacía (una cuenta que no está en la lista) se puede escribir de una. */
            var trabada = tnaVis > 0 && !tnaEdit[c.id];
            var lapiz = tnaVis > 0
              ? '<button type="button" class="iconbtn lapiz" data-tnaedit="'+esc(c.id)+'" aria-pressed="'+(trabada ? 'false' : 'true')+'"'
                + ' aria-label="'+(trabada ? 'Cambiar la tasa' : 'Listo')+'" title="'+(trabada ? 'Cambiar la tasa' : 'Listo')+'">'
                + (trabada ? LAPIZ_SVG : TILDE_SVG) + '</button>'
              : '';
            return '<div class="field"><label class="lab" for="cTna-'+esc(c.id)+'">'+(ent ? 'TNA anual' : 'TNA a mano')+'</label>'
              + '<div class="tnawrap"><span class="pctin"><input id="cTna-'+esc(c.id)+'" data-ctna="'+esc(c.id)+'" type="text" inputmode="decimal"'
              + ' value="'+(tnaVis > 0 ? esc(fmtPct(tnaVis).replace('%','')) : '')+'" placeholder="0" autocomplete="off"'
              + (trabada ? ' readonly tabindex="-1" class="bloq"' : '')
              + ' aria-label="TNA, en porcentaje"><i>%</i></span>' + lapiz + '</div></div>';
          })()
      + (varias ? '<div class="ctaborrar">' + borrar + '</div>' : '')
      + '</div>'
      + '<p class="note" style="margin-top:9px">'+esc(notaCuenta(c))+'</p>'
      // v220: sin "Este mes generó": lo que rinden entre todas va abajo, en #cuentaTot
      + '</div>';
  }).join('');

  // el buscador muestra el nombre de la entidad elegida, no el value del select
  [].slice.call(el.querySelectorAll('.combo')).forEach(function(r){ comboEtiqueta(r); });

  var tot = $('#cuentaTot');
  if(tot){
    var suma = interesesPorCuenta(mes).reduce(function(a,b){ return a + b.monto; }, 0);
    tot.textContent = suma > 0
      ? ('Entre todas generaron ' + money(suma) + ' en ' + ymLabel(mes, true))
      : (lista.length >= MAX_CUENTAS ? 'Llegaste al máximo de ' + MAX_CUENTAS + ' cuentas' : '');
  }
  var add = $('#cuentaAdd');
  if(add) add.hidden = lista.length >= MAX_CUENTAS;
}
