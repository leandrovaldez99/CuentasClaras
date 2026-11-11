/* Cuentas Claras · js/eventos.js
   Los clics y formularios: qué pasa cuando tocás cada botón o guardás algo.

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

function irA(sel){
  var el = $(sel);
  if(!el) return;
  var top = $('.topbar');
  var margen = (top ? top.getBoundingClientRect().height : 0) + 12;
  var y = el.getBoundingClientRect().top + window.pageYOffset - margen;
  var suave = !window.matchMedia || !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  try{ window.scrollTo({ top: Math.max(0, y), behavior: suave ? 'smooth' : 'auto' }); }
  catch(x){ window.scrollTo(0, Math.max(0, y)); }
}
document.addEventListener('click', function(e){
  var tacc = e.target.closest('#toastAcc');
  if(tacc){
    var irVista = tacc.getAttribute('data-ir');
    var destino2 = tacc.getAttribute('data-scroll');
    var foco = tacc.getAttribute('data-foco');
    cerrarToast();
    if(irVista) go(irVista);
    setTimeout(function(){
      if(destino2) irA(destino2);
      var el = foco ? $(foco) : null;
      if(el) try{ el.focus({preventScroll:true}); }catch(x){}
    }, 80);
    return;
  }

  if(e.target.closest('[data-volver]')){ volver(); return; }
  var goEl = e.target.closest('[data-go]');
  if(goEl){
    // algunos botones además dicen con qué solapa abrir la pantalla de carga
    var conSolapa = goEl.getAttribute('data-carga');
    if(conSolapa){
      if(editando) salirEdit();
      if(editandoPlan) salirEditPlan();
      cargaTab = conSolapa;
      if(cargaTab !== 'cuotas') tipoMov = cargaTab;
      pintarCarga(); fillSelects();
    }
    if(goEl.getAttribute('data-pagos')){ fijoTab = 'gasto'; pintarFijoForm(); renderFijos(); }
    go(goEl.getAttribute('data-go'));
    // en la versión de celular, además, bajamos hasta la tarjeta que interesa
    var destino = goEl.getAttribute('data-scroll');
    if(destino && window.innerWidth < 920) setTimeout(function(){ irA(destino); }, 60);
    return;
  }

  var m = e.target.closest('[data-mes]');
  if(m){ mes = ymAdd(mes, parseInt(m.getAttribute('data-mes'),10)); confirmId=null; render(); syncFechas(); pintarLupa(); return; }

  var seg = e.target.closest('#segCarga button');
  if(seg){
    if(editando){ salirEdit(); }
    if(editandoPlan){ salirEditPlan(); }
    cargaTab = seg.getAttribute('data-v');
    if(cargaTab === 'viaje'){
      var vv = vjViajeCarga();
      if(vv){ viajeSel = vv.id; vjEdit = null; vjEntre = null; vjForm = null; vjCompartir = null; vjBorrar = null; }
    } else if(cargaTab !== 'cuotas') tipoMov = cargaTab;
    pintarCarga(); fillSelects();
    if(cargaTab === 'viaje'){ var mv = $('#vjMonto'); if(mv) try{ mv.focus(); }catch(x){} }
    return;
  }
  var segr = e.target.closest('#segRango button');
  if(segr){
    rangoMeses = parseInt(segr.getAttribute('data-v'),10)===12 ? 12 : 6;
    try{ localStorage.setItem('plata-clara-rango', String(rangoMeses)); }catch(x){}
    renderResumen(); pintarLupa(); return;
  }
  var cerrar = e.target.closest('[data-cerrar-lupa]');
  if(cerrar){
    if(cerrar.closest('#lupaDia')) cerrarDia();
    else if(cerrar.closest('#lupaMed')) cerrarMedios();
    else cerrarLupa();
    return;
  }
  var elDia = e.target.closest('[data-dia]');
  if(elDia){ abrirDia(elDia.getAttribute('data-dia')); return; }
  var pasoDia = e.target.closest('[data-diapaso]');
  if(pasoDia){ moverDia(parseInt(pasoDia.getAttribute('data-diapaso'), 10)); return; }
  if(e.target.closest('[data-medios]')){ abrirMedios(); return; }
  if(e.target.closest('#chMes') || e.target.closest('[data-ampliar]')){ abrirLupa(); return; }
  var segrl = e.target.closest('#segRangoLupa button');
  if(segrl){
    rangoMeses = parseInt(segrl.getAttribute('data-v'),10)===12 ? 12 : 6;
    try{ localStorage.setItem('plata-clara-rango', String(rangoMeses)); }catch(x){}
    pintarLupa(); renderResumen();
    return;
  }
  if(e.target.closest('#cancelarEdit')){
    if(editandoPlan){ salirEditPlan(); go('cuotas'); return; }
    salirEdit(); go('mov'); return;
  }
  var sumP = e.target.closest('[data-sumplan]');
  if(sumP){ sumarmePlan(sumP.getAttribute('data-sumplan')); return; }
  if(sumArmado){ sumArmado = ''; if(vista === 'cuotas') renderCuotas(); }
  var filaPlan = e.target.closest('[data-plan]');
  if(filaPlan && !e.target.closest('[data-del]')){
    entrarEditPlan(filaPlan.getAttribute('data-plan'));
    return;
  }
  var filaPase = e.target.closest('[data-pase]');
  if(filaPase && !e.target.closest('.acts')){
    var pp = null; (S.pases||[]).forEach(function(x){ if(x.id === filaPase.getAttribute('data-pase')) pp = x; });
    if(pp){ abrirMedios(); abrirPase(pp); }
    return;
  }
  if(e.target.closest('[data-pasenuevo]')){ abrirMedios(); abrirPase(null); return; }
  if(e.target.closest('#paseAbrir')){ abrirPase(null); return; }
  if(e.target.closest('#paseCancelar')){ cerrarPase(); return; }
  var fila = e.target.closest('#movList .row.editable');
  if(fila && !e.target.closest('.acts')){
    entrarEdit(fila.getAttribute('data-tx'));
    return;
  }
  /* Tachar a mano un pago del mes (lo pagaste antes de su día) o destacharlo:
     primero se pregunta, en el mismo renglón. */
  var pgSi = e.target.closest('[data-pgsi]');
  if(pgSi){
    var partesP = String(pgSi.getAttribute('data-pgsi')).split('|'), fP = null, ocP = null;
    (S.fijos || []).forEach(function(x){ if(x.id === partesP[0]) fP = x; });
    pgConf = null;
    if(fP) ocurrenciasImp(fP, mes).forEach(function(o){ if(o.clave === partesP[1]) ocP = o; });
    var esteP = ocP && ymOf(ocP.vence) === ymNow();
    if(!fP || !ocP || !(esteP || (ocP.man && ymOf(ocP.vence) < ymNow()))){ renderPagos(); return; }
    var esIngP = (fP.tipo === 'ingreso'), venceP = ocP.vence;
    if(ocP.aMano){
      ponerAdelanto(fP, ocP.clave, '');
      save(); render();
      toast(ocP.man ? fP.nombre + ' queda sin tachar: no se cuenta hasta que lo taches' : fP.nombre + ' vuelve a quedar para el ' + fechaLabel(venceP));
    } else {
      // en un mes que ya pasó, cuenta el día que vencía
      var fT = esteP ? today() : venceP;
      ponerAdelanto(fP, ocP.clave, fT);
      save(); render();
      toast(fP.nombre + (fT === today() ? (esIngP ? ': cobrado hoy, ya suma a tus ingresos' : ': pagado hoy, ya suma a tus gastos')
                                       : (esIngP ? ': cobrado, suma a tus ingresos del ' : ': pagado, suma a tus gastos del ') + fechaLabel(fT)));
    }
    return;
  }
  if(e.target.closest('[data-pgno]')){ pgConf = null; renderPagos(); return; }
  var pgF = e.target.closest('[data-pgfijo]');
  if(pgF){
    var idPg = pgF.getAttribute('data-pgfijo');
    // se puede tachar lo que cae este mes calendario, aunque cuente para el próximo
    // (el sueldo del último día hábil)
    var parPg = String(idPg).split('|'), hayEsteMes = false;
    (S.fijos || []).forEach(function(x){
      if(x.id === parPg[0]) ocurrenciasImp(x, mes).forEach(function(o){ if(o.clave === parPg[1] && (ymOf(o.vence) === ymNow() || (o.man && ymOf(o.vence) < ymNow()))) hayEsteMes = true; });
    });
    if(!hayEsteMes){
      toast(mes > ymNow() ? 'Lo podés tachar cuando llegue ' + ymLabel(mes) : 'Ese mes ya pasó');
      return;
    }
    pgConf = (pgConf === idPg) ? null : idPg;
    renderPagos();
    var bSi = $('#pgList [data-pgsi]'); if(bSi) try{ bSi.focus({preventScroll:true}); }catch(x){}
    return;
  }
  if(pgConf && !e.target.closest('#pgList')){ pgConf = null; renderPagos(); }
  if(e.target.closest('#pgMas')){
    irA('#cardFijoNuevo');
    var fn = $('#fNombre'); if(fn) setTimeout(function(){ try{ fn.focus({preventScroll:true}); }catch(x){} }, 350);
    return;
  }
  var fb = e.target.closest('[data-fbaja]');
  if(fb){
    var idb = fb.getAttribute('data-fbaja');
    S.fijos.forEach(function(f){ if(f.id === idb) f.hasta = mes; });
    save(); render();
    toast('Dado de baja después de ' + ymLabel(mes));
    return;
  }
  var fr = e.target.closest('[data-freanudar]');
  if(fr){
    var idr = fr.getAttribute('data-freanudar');
    S.fijos.forEach(function(f){ if(f.id === idr) f.hasta = ''; });
    save(); render();
    toast('Reanudado');
    return;
  }
  var sac = e.target.closest('[data-sacar]');
  if(sac){
    var idS = sac.getAttribute('data-sacar');
    var frm = sac.closest('[data-aporte]');
    if(!frm) return;
    var meta = null;
    S.metas.forEach(function(mm){ if(mm.id === idS) meta = mm; });
    if(!meta) return;
    var mto = parseMoney(frm.elements.monto.value);
    if(mto <= 0){ toast('Poné cuánto querés sacar'); frm.elements.monto.focus(); return; }
    var hay = ahorradoEn(meta);
    var mtoEnMeta = aporteEnMeta(meta, { monto:mto, mon:monDeAporte(meta), cot:0 });
    if(mtoEnMeta > hay + 0.005){
      toast('En esta meta tenés ' + ((meta.moneda === 'USD') ? usd(hay) : money(hay)));
      return;
    }
    var monS = monDeAporte(meta);
    var cotS = guardarCotAporte(meta, monS);
    if(cotS === null){ frm.elements.monto.focus(); return; }
    var salida = { id:uid(), ts:Date.now(), monto:-mto,
      fecha: frm.elements.fecha.value || defaultFecha(), cot:cotS };
    if(monS !== (meta.moneda || 'ARS') || monS === 'USD') salida.mon = monS;
    ponerLugar(meta, salida, lugarDelForm(frm, monS));   // sale de donde elegiste
    meta.aportes.push(salida);
    save(); render();
    toast('Sacaste ' + (monS === 'USD' ? usd(mto) : money(mto)) + ' de ' + meta.nombre);
    return;
  }
  var mAp = e.target.closest('[data-monap]');
  if(mAp){
    var pr2 = mAp.getAttribute('data-monap').split('|');
    monAp[pr2[0]] = pr2[1];
    renderAhorro();
    return;
  }
  var apEd = e.target.closest('[data-apedit]');
  if(apEd && !e.target.closest('[data-del]')){
    var pa = apEd.getAttribute('data-apedit').split('|');
    if(apEdit && apEdit.meta === pa[0] && apEdit.ap === pa[1]) salirApEdit();
    else {
      apEdit = { meta:pa[0], ap:pa[1] };
      apPregunta = null;
      var mm2 = null; S.metas.forEach(function(x){ if(x.id === pa[0]) mm2 = x; });
      var aa2 = mm2 ? aportePorId(mm2, pa[1]) : null;
      if(mm2 && aa2){ monAp[pa[0]] = monAporte(mm2, aa2); apEdit.previo = !!aa2.previo; }
    }
    renderAhorro();
    if(apEdit){
      var campo = $('[data-aporte="'+pa[0]+'"] [name="monto"]');
      if(campo) try{ campo.focus(); campo.select(); }catch(x){}
    }
    return;
  }
  if(e.target.closest('[data-apcancel]')){ salirApEdit(); renderAhorro(); return; }

  var iniB = e.target.closest('[data-iniedit]');
  if(iniB){
    var idIni = iniB.getAttribute('data-iniedit');
    iniEdit = (iniEdit === idIni) ? null : idIni;
    renderAhorro();
    if(iniEdit){
      var c0 = $('[data-inicial="'+idIni+'|ARS"]');
      if(c0) try{ c0.focus(); c0.select(); }catch(x){}
    }
    return;
  }

  var rsw = e.target.closest('[data-rctl] .rsw'), rch = e.target.closest('[data-rctl] [data-rchip]');
  if(rsw || rch){
    var rbox = (rsw || rch).closest('[data-rctl]'), rkey = rbox.getAttribute('data-rctl');
    var rah = rbox.querySelector('input[name="donde"]').value;
    /* Con el interruptor prendido, en lo que ya tenías se puede tocar más de una
       cuenta: la plata puede estar repartida. */
    if(rch && rah && rbox.hasAttribute('data-multi')){
      var rcid = rch.getAttribute('data-rchip');
      if(rkey === 'nueva'){ tocarCuentaNueva(rbox, rcid); return; }
      var rmm = metaPorId(rkey.split(':')[1]);
      if(rmm) tocarCuentaIni(rmm, rcid);
      return;
    }
    var rnu = rch ? rch.getAttribute('data-rchip') : (rah ? '' : lugarSugerido());
    if(rnu) ultimoLugar = rnu;
    pintarRctl(rbox, rnu);
    if(rkey === 'nueva'){ nuevaLugar = rnu; if(!rnu) nuevaOtras = []; pintarNuevaDonde(); return; }
    var rpar = rkey.split(':'), rm = metaPorId(rpar[1]);
    if(rpar[0] === 'ap'){
      if(apEdit && apEdit.meta === rpar[1]) apEdit.lugar = rnu; else dondeAp[rpar[1]] = rnu;
      return;
    }
    if(rpar[0] === 'ini' && rm){
      if(!rnu) juntarTodo(rm);
      rm.rinde = !!rnu;
      if(rnu) rm.cuenta = rnu; else delete rm.cuenta;
      save(); render();
      toast(rnu ? ('Lo que ya tenías rinde en ' + nombreLugar(rnu)) : 'Lo que ya tenías queda guardado aparte, sin rendir');
    }
    return;
  }
  var gcs = e.target.closest('[data-gctasacar]');
  if(gcs){
    var gcid = gcs.getAttribute('data-gctasacar');
    nuevaOtras = nuevaOtras.filter(function(o){ return o.cid !== gcid; });
    var gbox = $('#gDonde [data-rctl]'); if(gbox) pintarRctl(gbox, nuevaLugar, nuevaOtrasIds());
    pintarNuevaDonde();
    return;
  }
  var cs = e.target.closest('[data-ctasacar]');
  if(cs){
    var kcs = cs.getAttribute('data-ctasacar').split('|'), mcs = metaPorId(kcs[0]);
    if(!mcs) return;
    tocarCuentaIni(mcs, kcs[1]);
    return;
  }
  if(e.target.closest('#gEfAbrir')){
    $('#gEfRow').hidden = false; pintarNuevaDonde();
    try{ $('#gEfectivo').focus(); }catch(x){}
    return;
  }
  if(e.target.closest('#gEfCerrar')){
    $('#gEfRow').hidden = true; $('#gEfectivo').value = ''; pintarNuevaDonde();
    return;
  }
  var efA = e.target.closest('[data-efabrir]');
  if(efA){
    var idEa = efA.getAttribute('data-efabrir');
    efecAbierto[idEa] = true; renderAhorro();
    var cEa = $('[data-iefec="' + idEa + '"]'); if(cEa) try{ cEa.focus(); }catch(x){}
    return;
  }
  var efC = e.target.closest('[data-efcerrar]');
  if(efC){
    var mEc = metaPorId(efC.getAttribute('data-efcerrar'));
    if(!mEc) return;
    var tenia = efectivoDe(mEc);
    ponerEfectivo(mEc, 0); delete efecAbierto[mEc.id];
    if(tenia > 0){ save(); render(); toast('Los ' + money(tenia) + ' vuelven a rendir en ' + nombreLugar(lugarInicial(mEc))); }
    else renderAhorro();
    return;
  }
  var pAdd = e.target.closest('[data-padd]');
  if(pAdd){
    var idPa = pAdd.getAttribute('data-padd');
    parteNueva[idPa] = true;
    renderAhorro();
    var cN = $('#metaList [data-pmonto="' + idPa + '|"]');
    if(cN) try{ cN.focus(); }catch(x){}
    return;
  }
  var pUn = e.target.closest('[data-punir]');
  if(pUn){
    var kU = pUn.getAttribute('data-punir').split('|'), mU = metaPorId(kU[0]);
    if(!kU[1]){ delete parteNueva[kU[0]]; delete parteNuevaLugar[kU[0]]; renderAhorro(); return; }
    if(!mU) return;
    var aU = aportePorId(mU, kU[1]);
    if(!aU) return;
    var vU = Number(aU.monto)||0;
    mU.inicial = iniArs(mU) + vU;
    mU.aportes = mU.aportes.filter(function(a){ return a.id !== aU.id; });
    save(); render();
    toast('Junté ' + money(vU) + ' con el primer renglón');
    return;
  }

  /* "Ya lo tenía" en un aporte que estás corrigiendo. Se pinta en el lugar y no
     se redibuja el formulario: si no, se perdería lo que venías escribiendo. */
  var apPrev = e.target.closest('[data-apprevio]');
  if(apPrev){
    if(!apEdit) return;
    apEdit.previo = !apEdit.previo;
    apPrev.setAttribute('aria-checked', apEdit.previo ? 'true' : 'false');
    return;
  }
  /* La respuesta a "esta plata es de otro mes". */
  var apReg = e.target.closest('[data-appreg]');
  if(apReg){
    var pq = apPregunta, que = apReg.getAttribute('data-appreg');
    apPregunta = null;
    var metaP = null;
    if(pq) S.metas.forEach(function(mm){ if(mm.id === pq.meta) metaP = mm; });
    if(!pq || !metaP || que === 'no'){ renderAhorro(); return; }
    crearAporte(metaP, pq, que === 'previo');
    return;
  }
  var arrb = e.target.closest('[data-arr]');
  if(arrb){
    var ymA = arrb.getAttribute('data-ym') || ymNow();
    S.arrastre = S.arrastre || {};
    S.arrastre[ymA] = arrb.getAttribute('data-arr') === 'si';
    save(); render();
    toast(S.arrastre[ymA]
      ? 'Listo, el saldo de ' + ymLabel(ymAdd(ymA,-1), true) + ' pasa a ' + ymLabel(ymA, true)
      : ymLabel(ymA, true) + ' arranca de cero');
    return;
  }
  var avOn = e.target.closest('#avisoOn');
  if(avOn){
    S.aviso = avisoCfg();
    S.aviso.on = !S.aviso.on;
    if(S.aviso.on) pedirPermisoAviso();
    save(); sincronizarAviso(); renderAviso();
    toast(S.aviso.on ? ('Listo, te aviso a las ' + hhmm(S.aviso.hora, S.aviso.min)) : 'Recordatorio apagado');
    return;
  }
  var avDias = e.target.closest('#segAvisoDias button');
  if(avDias){
    S.aviso = avisoCfg();
    S.aviso.dias = avDias.getAttribute('data-v') === 'habiles' ? 'habiles' : 'todos';
    save(); sincronizarAviso(); renderAviso();
    return;
  }
  if(e.target.closest('#avisoSaltar')){
    S.aviso = avisoCfg();
    S.aviso.saltar = !S.aviso.saltar;
    save(); sincronizarAviso(); renderAviso();
    return;
  }

  var sega = e.target.closest('#segArr button');
  if(sega){
    S.arrastreModo = sega.getAttribute('data-v');
    save(); render();
    return;
  }
  var segm = e.target.closest('#segMonObj button');
  if(segm){
    monedaMeta = segm.getAttribute('data-mon') === 'USD' ? 'USD' : 'ARS';
    pintarMoneda(); return;
  }
  var segf = e.target.closest('#segFiltro button');
  if(segf){
    filtroMov = segf.getAttribute('data-v');
    $$('#segFiltro button').forEach(function(b){ b.setAttribute('aria-pressed', b===segf ? 'true':'false'); });
    renderMov(); return;
  }

  var del = e.target.closest('[data-del]');
  if(del){
    var kind = del.getAttribute('data-del'), id = del.getAttribute('data-id'), x = del.getAttribute('data-x')||'';
    var key = kind+':'+id+x;
    if(confirmId !== key){ confirmId = key; render(); return; }
    confirmId = null;
    if(kind==='tx') S.tx = S.tx.filter(function(t){ return t.id !== id; });
    if(kind==='pase'){ S.pases = (S.pases||[]).filter(function(p){ return p.id !== id; }); pintarMedios(); }
    if(kind==='plan') S.planes = S.planes.filter(function(p){ return p.id !== id; });
    if(kind==='meta') S.metas = S.metas.filter(function(mm){ return mm.id !== id; });
    if(kind==='arrastre'){ S.arrastre = S.arrastre || {}; S.arrastre[id] = false; }
    if(kind==='fijo'){ var cad = cadenaFijo(id); S.fijos = S.fijos.filter(function(f){ return cad.indexOf(f.id) < 0; }); if(cad.indexOf(editandoFijo) > -1) salirEditFijo(); }
    if(kind==='hx'){ S.hx = (S.hx||[]).filter(function(x){ return x.id !== id; }); if(hxEdit === id) hxSalirEdit(); }
    if(kind==='aporte'){
      S.metas.forEach(function(mm){ if(mm.id===id) mm.aportes = mm.aportes.filter(function(a){ return a.id !== x; }); });
    }
    save(); render(); toast('Listo, lo borré');
    return;
  }
  if(!e.target.closest('[data-del]') && confirmId){ confirmId = null; render(); }

  var gadd = e.target.closest('#grupoAdd');
  if(gadd){
    var gnom = $('#grupoNuevo').value.trim().replace(/\s+/g,' ').slice(0,28);
    if(!gnom){ toast('Escribí un nombre'); $('#grupoNuevo').focus(); return; }
    if(S.grupos.length >= MAX_GRUPOS){ toast('Con '+MAX_GRUPOS+' grupos ya es difícil distinguirlos de un vistazo'); return; }
    for(var gk=0; gk<S.grupos.length; gk++){
      if(S.grupos[gk].nombre.toLowerCase() === gnom.toLowerCase()){ toast('Ya tenés un grupo con ese nombre'); return; }
    }
    S.grupos.push({ id:'g'+uid(), nombre:gnom, color: colorNuevo || colorLibre() });
    colorNuevo = null;
    $('#grupoNuevo').value = '';
    save(); renderPresuEdit(); renderCats(); renderResumen();
    toast('Agregué el grupo "'+gnom+'"');
    return;
  }
  var swat = e.target.closest('[data-gcolorv]');
  if(swat){
    elegirColor(swat.getAttribute('data-gcolorid'), swat.getAttribute('data-gcolorv'));
    return;
  }
  var palN = e.target.closest('[data-palnuevo]');
  if(palN){ abrirRueda(palN.getAttribute('data-palnuevo')); return; }
  var palU = e.target.closest('[data-palusar]');
  if(palU){ usarColorRueda(palU.getAttribute('data-palusar')); return; }
  var gpick = e.target.closest('[data-gcolor]');
  if(gpick){
    var pid = gpick.getAttribute('data-gcolor');
    if(paletaAbierta === pid) cerrarPaleta(); else abrirPaleta(pid);
    return;
  }
  // un clic en cualquier otro lado la cierra, pero adentro de ella no
  if(paletaAbierta && !e.target.closest('.paleta')) cerrarPaleta();
  var gdel = e.target.closest('[data-gdel]');
  if(gdel){
    var gid2 = gdel.getAttribute('data-gdel');
    if(grupoConfirm !== gid2){ grupoConfirm = gid2; renderPresuEdit(); return; }
    grupoConfirm = null;
    var msg2 = borrarGrupo(gid2);
    save(); renderPresuEdit(); renderCats(); renderResumen();
    toast(msg2);
    return;
  }
  if(grupoConfirm){ grupoConfirm = null; renderPresuEdit(); }

  var segc = e.target.closest('#segCat button');
  if(segc){ catTab = segc.getAttribute('data-v'); catConfirm = null; renderCats(); return; }

  var cadd = e.target.closest('#catAdd');
  if(cadd){
    var nom = $('#catNueva').value.trim().replace(/\s+/g,' ');
    if(!nom){ toast('Escribí un nombre'); $('#catNueva').focus(); return; }
    if(existeCat(catTab, nom, -1)){ toast('Ya tenés una categoría con ese nombre'); return; }
    var l = listaCat(catTab), pos = l.indexOf('Otros');
    if(pos > -1) l.splice(pos, 0, nom); else l.push(nom);
    if(catTab === 'gasto'){
      var gsel = $('#catGrupoNueva');
      S.grupoDe[nom] = (gsel && esGrupo(gsel.value)) ? gsel.value : (S.grupos[S.grupos.length-1] || {}).id;
    }
    desmarcarQuitada(nom);
    $('#catNueva').value = '';
    save(); fillSelects(); renderCats(); renderPresuEdit(); renderResumen();
    toast('Agregué "'+nom+'"');
    return;
  }

  var cdel = e.target.closest('[data-catdel]');
  if(cdel){
    var ci = parseInt(cdel.getAttribute('data-catdel'), 10);
    var clave = catTab+':'+ci;
    if(catConfirm !== clave){ catConfirm = clave; renderCats(); return; }
    catConfirm = null;
    var msg = borrarCat(catTab, ci);
    save(); fillSelects(); renderCats(); renderPresuEdit(); renderResumen(); renderMov();
    toast(msg);
    return;
  }
  if(catConfirm){ catConfirm = null; renderCats(); }

  var madd = e.target.closest('#medioAdd');
  if(madd){
    var mnom = $('#medioNuevo').value.trim().replace(/\s+/g,' ');
    if(!mnom){ toast('Escribí un nombre'); $('#medioNuevo').focus(); return; }
    if(existeMedio(mnom, -1)){ toast('Ya tenés un medio de pago con ese nombre'); return; }
    S.medios.push(mnom);
    desmarcarMedioQuitado(mnom);
    $('#medioNuevo').value = '';
    save(); fillSelects(); renderMedios(); renderResumen();
    toast('Agregué "'+mnom+'"');
    return;
  }
  var mdel = e.target.closest('[data-mediodel]');
  if(mdel){
    var mi = parseInt(mdel.getAttribute('data-mediodel'), 10);
    if(medioConfirm !== mi){ medioConfirm = mi; renderMedios(); return; }
    medioConfirm = null;
    var msgm = borrarMedio(mi);
    save(); fillSelects(); renderMedios(); renderResumen(); renderMov();
    toast(msgm);
    return;
  }
  if(medioConfirm !== null){ medioConfirm = null; renderMedios(); }

  var smm = e.target.closest('#segMonMov button');
  if(smm){ monMov = smm.getAttribute('data-mon'); pintarMon(); pintarCarga(); return; }
  var smf = e.target.closest('#segMonFijo button');
  if(smf){ monFijo = smf.getAttribute('data-mon'); pintarMon(); return; }
  if(e.target.closest('#fQuinSw')){ fQuin = !fQuin; pintarFijoForm(); return; }
  var sfj = e.target.closest('#segFijo button');
  if(sfj){ fijoTab = sfj.getAttribute('data-v'); pintarFijoForm(); renderFijos(); return; }

  var cadd = e.target.closest('#cuentaAdd');
  if(cadd){
    if(cuentas().length >= MAX_CUENTAS){ toast('Ya tenés ' + MAX_CUENTAS + ' cuentas'); return; }
    S.cuentas.push({ id:uid(), entidad:'', tna:0, manual:false, medio:'' });
    save(); render();
    toast('Agregué una cuenta: elegí su banco y le pongo el nombre');
    return;
  }
  var cdel = e.target.closest('[data-cdel]');
  if(cdel){
    var idc = cdel.getAttribute('data-cdel');
    if(cuentas().length <= 1){ toast('Tiene que quedar al menos una cuenta'); return; }
    if(cuentaDelConfirm !== idc){ cuentaDelConfirm = idc; renderCuentas(); return; }
    cuentaDelConfirm = null;
    var nomBorrada = (cuentaPorId(idc)||{}).medio || 'la cuenta';
    S.cuentas = cuentas().filter(function(c){ return c.id !== idc; });
    S.metas.forEach(function(m){
      if(m.cuenta === idc) delete m.cuenta;
      (m.aportes||[]).forEach(function(a){ if(a.cuenta === idc) delete a.cuenta; });
    });
    save(); render();
    // el medio de pago queda: tiene movimientos cargados y no son de nadie más
    toast('Borré "' + nomBorrada + '". El medio de pago sigue en la lista.');
    return;
  }
  if(cuentaDelConfirm){ cuentaDelConfirm = null; renderCuentas(); }
  var tnB = e.target.closest('[data-tnaedit]');
  if(tnB){
    var idTn = tnB.getAttribute('data-tnaedit');
    if(tnaEdit[idTn]){
      // "Listo": si quedó algo escrito sin confirmar, se guarda antes de trabar
      var inTn = $('[data-ctna="' + idTn + '"]');
      delete tnaEdit[idTn];
      if(inTn && inTn.value !== inTn.defaultValue){ inTn.dispatchEvent(new Event('change', {bubbles:true})); return; }
      renderCuentas();
      return;
    }
    tnaEdit[idTn] = true; renderCuentas();
    var inTn2 = $('[data-ctna="' + idTn + '"]');
    if(inTn2) try{ inTn2.focus(); inTn2.select(); }catch(x){}
    return;
  }

  var swp = e.target.closest('#swPesos');
  if(swp){
    verEnPesos = !verEnPesos;
    try{ localStorage.setItem('plata-clara-verpesos', verEnPesos ? '1' : '0'); }catch(x){}
    renderResumen();
    return;
  }

  var segt = e.target.closest('#segTema button');
  if(segt){
    tema = segt.getAttribute('data-v');
    try{ localStorage.setItem('plata-clara-tema', tema); }catch(x){}
    aplicarTema(tema);
    // los colores de los grupos se retocan según el tema: hay que redibujarlos
    render();
    return;
  }
  var wipe = e.target.closest('#wipe');
  if(wipe){
    if(wipe.getAttribute('data-armed') !== '1'){
      wipe.setAttribute('data-armed','1'); wipeTxt(wipe, true);
      setTimeout(function(){ if(wipe.getAttribute('data-armed')==='1'){ wipe.removeAttribute('data-armed'); wipeTxt(wipe, false); } }, 5000);
      return;
    }
    wipe.removeAttribute('data-armed'); wipeTxt(wipe, false);
    // borrar todo desvincula: si no, el borrado viajaría a los otros dispositivos
    var dvHabia = dvActivo();
    var gente = S.personas, marca = S.dbMarca;
    S = emptyState();
    if(dbActiva()){ S.personas = gente; S.dbMarca = marca; }      // en la base: se borran los datos, no la gente del grupo
    save(); render(); nsRevisar(); toast('Listo, quedó todo en cero' + (dvHabia ? '. Este dispositivo quedó desvinculado' : ''));
    return;
  }
  if(e.target.closest('#avisoLlenoOk')){ espacio.oculto = true; pintarEspacio(); return; }
  var act = e.target.closest('[data-act]');
  if(act){
    if(act.getAttribute('data-act')==='export') exportar();
    if(act.getAttribute('data-act')==='import') $('#fileIn').click();
    return;
  }
});

/* tooltip */
(function(){
  var tip = $('#tip');
  document.addEventListener('mousemove', function(e){
    var el = e.target.closest ? e.target.closest('[data-tip]') : null;
    if(!el){ tip.classList.remove('on'); return; }
    tip.textContent = el.getAttribute('data-tip');
    tip.classList.add('on');
    var x = Math.min(e.clientX + 14, window.innerWidth - tip.offsetWidth - 10);
    var y = e.clientY - tip.offsetHeight - 12;
    if(y < 6) y = e.clientY + 18;
    tip.style.left = Math.max(6,x)+'px'; tip.style.top = y+'px';
  });
  document.addEventListener('mouseleave', function(){ tip.classList.remove('on'); });
})();

/* formulario movimiento */
$('#fMov').addEventListener('submit', function(e){
  e.preventDefault();
  var monto = parseMoney($('#mMonto').value);
  if(monto <= 0){ toast('Poné un monto mayor a cero'); $('#mMonto').focus(); return; }
  var datos = { tipo:tipoMov, monto:monto, cat:$('#mCat').value, fecha:$('#mFecha').value || defaultFecha(),
                medio:$('#mMedio').value, nota:$('#mNota').value.trim() };
  if(monMov === 'USD'){
    var cotM = cotParaGuardar();
    if(!cotM){ $('#mMonto').focus(); return; }
    datos.mon = 'USD'; datos.cot = cotM;
  }
  // el mes al que cuenta (un sueldo del último día hábil cuenta en el que viene)
  var f = mesDeTx(datos), cuentaOtro = (f !== ymOf(datos.fecha));
  var gq = grupoDelForm('m', tipoMov === 'gasto');
  if(gq.quien) datos.quien = gq.quien;
  if(gq.med) datos.med = gq.med;
  if(gq.med && gq.rep) datos.rep = gq.rep;
  if(gq.med && datos.tipo === 'gasto') datos.pend = 1;   // v284: lo del otro queda pendiente hasta que pague

  if(editando){
    // editar: conservo el id y el sello de carga, cambio el resto
    S.tx.forEach(function(t){
      if(t.id !== editando) return;
      t.tipo = datos.tipo; t.monto = datos.monto; t.cat = datos.cat;
      t.fecha = datos.fecha; t.medio = datos.medio; t.nota = datos.nota;
      if(hayGrupo()){ if(gq.med && !esMedias(t)) t.pend = 1; t.quien = gq.quien || t.quien; if(gq.med) t.med = gq.med; else { delete t.med; delete t.pend; delete t.sal; } if(gq.med && gq.rep) t.rep = gq.rep; else delete t.rep; }
      // si ya venía en dólares y sigue en dólares, se respeta su cotización original
      if(datos.mon === 'USD'){ if(t.mon !== 'USD') t.cot = datos.cot; t.mon = 'USD'; }
      else { delete t.mon; delete t.cot; }
    });
    save();
    if(f && f !== mes) mes = f;
    salirEdit();
    render(); go('mov');
    toast('Movimiento actualizado' + (cuentaOtro ? ': cuenta como sueldo de ' + ymLabel(f) : ''));
    return;
  }

  datos.id = uid(); datos.ts = Date.now();
  // v282: quién lo cargó (puede no ser de quien es)
  if(hayGrupo() && miPersona()) datos.por = miPersona();
  S.tx.push(datos);
  save();
  if(f && f !== mes) mes = f;
  $('#mMonto').value=''; $('#mNota').value=''; ponerQuien('m', miPersona(), null);
  render(); $('#mMonto').focus();
  toast((tipoMov==='ingreso' ? 'Ingreso cargado' : 'Gasto cargado') + (cuentaOtro ? ': como entró el último día hábil, cuenta como sueldo de ' + ymLabel(f) : '') + (gq.med ? ': a medias, ' + textoReparto(gq.med, f, montoPesos(datos), gq.rep) : ''));
});

/* formulario del pase entre medios */
$('#fPase').addEventListener('submit', function(e){
  e.preventDefault();
  var monto = Math.round(parseMoney($('#paseMonto').value) * 100) / 100;
  if(!(monto > 0)){ toast('Poné cuánto pasaste'); $('#paseMonto').focus(); return; }
  var de = $('#paseDe').value, a = $('#paseA').value;
  if(!de || !a || de === a){ toast('Elegí dos medios distintos'); $('#paseA').focus(); return; }
  var datos = { fecha:$('#paseFecha').value || defaultFecha(), monto:monto, de:de, a:a,
                nota:$('#paseNota').value.trim().slice(0,60) };
  S.pases = S.pases || [];
  var ed = null;
  if(paseEdit) S.pases.forEach(function(p){ if(p.id === paseEdit) ed = p; });
  if(ed) Object.keys(datos).forEach(function(k){ ed[k] = datos[k]; });
  else { datos.id = uid(); datos.ts = Date.now(); S.pases.push(datos); }
  save();
  cerrarPase();
  render(); pintarMedios();
  toast((ed ? 'Pase corregido: ' : 'Pasaste ') + money(monto) + ' de ' + de + ' a ' + a + '. No cuenta como ingreso ni gasto');
});

/* formulario de gastos fijos */
$('#fFijo').addEventListener('submit', function(e){
  e.preventDefault();
  var esIng = (fijoTab === 'ingreso');
  var monto = parseMoney($('#fMonto').value);
  if(monto <= 0){ toast(esIng ? 'Poné cuánto entra' : 'Poné cuánto sale'); $('#fMonto').focus(); return; }
  var cotF = 0;
  if(monFijo === 'USD'){
    cotF = cotParaGuardar();
    if(!cotF){ $('#fMonto').focus(); return; }
  }
  var cuando = esIng ? $('#fCuando').value : 'dia';
  if(esIng && fQuin){
    var qn = parseInt($('#fQuinHab').value, 10);   // vacío = 0, lo que muestra
    $('#fQhab').value = String(Math.min(15, Math.max(0, qn >= 0 ? qn : 0)));
    cuando = 'quincena';
  }
  var fechaG = esIng ? '' : ($('#fFecha').value || defaultFecha());
  var desde = esIng ? ($('#fDesde').value || mes) : ymOf(fechaG);
  var diaG = esIng ? Math.min(31, Math.max(1, parseInt($('#fDia').value,10) || 1)) : parseInt(fechaG.slice(8,10), 10);
  var horaG = esIng ? '' : vjHoraOk($('#fHora').value);
  var qhabG = Math.min(15, Math.max(0, parseInt($('#fQhab').value, 10)));
  if(!(qhabG >= 0)) qhabG = 4;
  var nhabG = Math.min(20, Math.max(1, parseInt($('#fNhab').value, 10) || 4));
  var tramo = { desde:desde, monto:monto };
  if(cotF) tramo.cot = cotF;
  if(editandoFijo){
    var gqE = grupoDelForm('f', !esIng);
    guardarEdicionFijo({
      mon: cotF ? 'USD' : undefined,
      nombre: $('#fNombre').value.trim() || (esIng ? 'Ingreso fijo' : 'Gasto fijo'),
      dia: (cuando === 'dia') ? diaG : cuando,
      hora: horaG || undefined,
      qhab: (cuando === 'quincena') ? qhabG : undefined,
      nhab: (cuando === 'nHabil') ? nhabG : undefined,
      cat: $('#fCat').value, medio: $('#fMedio').value,
      quien: gqE.quien, med: gqE.med, rep: gqE.rep
    }, monto, cotF);
    return;
  }
  S.fijos.push({
    id: uid(),
    tipo: esIng ? 'ingreso' : 'gasto',
    mon: cotF ? 'USD' : undefined,
    nombre: $('#fNombre').value.trim() || (esIng ? 'Ingreso fijo' : 'Gasto fijo'),
    dia: (cuando === 'dia') ? diaG : cuando,
    hora: horaG || undefined,
    qhab: (cuando === 'quincena') ? qhabG : undefined,
    nhab: (cuando === 'nHabil') ? nhabG : undefined,
    cat: $('#fCat').value,
    medio: $('#fMedio').value,
    desde: desde,
    hasta: '',
    precios: [tramo],
    quien: grupoDelForm('f', !esIng).quien,
    med: grupoDelForm('f', !esIng).med,
    rep: grupoDelForm('f', !esIng).rep,
    pend: (!esIng && grupoDelForm('f', true).med) ? 1 : undefined,
    por: (hayGrupo() && miPersona()) ? miPersona() : undefined,
    man: fManual ? desde : undefined
  });
  var eraManual = fManual; fManual = false; pintarFManual();
  ponerQuien('f', miPersona(), null);
  save();
  $('#fNombre').value = ''; $('#fMonto').value = ''; if($('#fHora')) $('#fHora').value = '';
  render();
  toast((esIng ? (cuando === 'quincena' ? 'Ingreso por quincena guardado' : 'Ingreso fijo guardado')
               : 'Gasto fijo guardado: se repite el ' + diaG + ' de cada mes' + (horaG ? ' a las ' + horaG : ''))
        + (eraManual ? '. Se cuenta cuando lo tachás arriba' : ''));
});

/* formulario cuotas */
function diaDelForm(){ return Math.min(31, Math.max(1, parseInt($('#qDia').value,10) || 1)); }
/* Cada tarjeta vence un día distinto, así que al elegirla propongo el día que
   usaste la última vez con ella. Se puede pisar a mano en el mismo formulario. */
function proponerDiaDeMedio(){
  if(editandoPlan) return;
  // sólo sobre un formulario en blanco: si ya estás cargando algo, no le piso el día
  if($('#qTotal').value || $('#qDesc').value || document.activeElement === $('#qDia')) return;
  var m = $('#qMedio') ? $('#qMedio').value : '';
  var d = (S.diaMedio && S.diaMedio[m]) ? S.diaMedio[m] : 0;
  if(d >= 1 && d <= 31){ $('#qDia').value = String(d); previewCuota(); }
}
function previewCuota(){
  var t = parseMoney($('#qTotal').value), n = parseInt($('#qN').value,10)||0;
  if(t>0 && n>0){
    var fin = ymAdd($('#qDesde').value || mes, n-1);
    $('#qPreview').innerHTML = '<b style="color:var(--ink)">'+esc(money(t/n))+'</b> por mes, '+n+' veces, '
      + 'los '+diaDelForm()+' de cada mes · última cuota en '+esc(ymLabel(fin));
  } else {
    $('#qPreview').textContent = 'Cargá el total y las cuotas y te digo cuánto es cada una. El día es el del vencimiento de tu tarjeta.';
  }
}
['#qTotal','#qN','#qDesde','#qDia'].forEach(function(s){ $(s).addEventListener('input', previewCuota); });
$('#qMedio').addEventListener('change', proponerDiaDeMedio);

$('#fCuota').addEventListener('submit', function(e){
  e.preventDefault();
  var total = parseMoney($('#qTotal').value), n = parseInt($('#qN').value,10)||0;
  if(total <= 0){ toast('Poné el total de la compra'); $('#qTotal').focus(); return; }
  if(n < 1){ toast('¿En cuántas cuotas la pagás?'); $('#qN').focus(); return; }
  var datos = { desc:$('#qDesc').value.trim() || 'Compra en cuotas', total:total, n:n, dia:diaDelForm(),
                desde:$('#qDesde').value || mes, cat:$('#qCat').value, medio:$('#qMedio').value };
  var gqc = grupoDelForm('q', true);
  if(gqc.quien) datos.quien = gqc.quien;
  if(gqc.med) datos.med = gqc.med;
  if(gqc.med && gqc.rep) datos.rep = gqc.rep;
  if(gqc.med) datos.pend = 1;
  // me acuerdo del día de esta tarjeta para la próxima compra
  S.diaMedio = S.diaMedio || {};
  if(datos.medio) S.diaMedio[datos.medio] = datos.dia;
  if(editandoPlan){
    S.planes.forEach(function(p){
      if(p.id !== editandoPlan) return;
      p.desc = datos.desc; p.total = datos.total; p.n = datos.n; p.dia = datos.dia;
      p.desde = datos.desde; p.cat = datos.cat; p.medio = datos.medio;
      if(hayGrupo()){ if(gqc.med && !esMedias(p)) p.pend = 1; p.quien = gqc.quien || p.quien; if(gqc.med) p.med = gqc.med; else { delete p.med; delete p.medDesde; delete p.pend; delete p.sal; } if(gqc.med && gqc.rep) p.rep = gqc.rep; else delete p.rep; }
    });
    save(); salirEditPlan(); render(); go('cuotas');
    toast('Compra en cuotas actualizada');
    return;
  }
  datos.id = uid();
  if(hayGrupo() && miPersona()) datos.por = miPersona();
  S.planes.push(datos);
  save();
  $('#qDesc').value=''; $('#qTotal').value=''; $('#qN').value='12';
  ponerQuien('q', miPersona(), null);
  previewCuota(); render();
  toast('Compra en cuotas guardada');
});

/* metas */
$('#fMeta').addEventListener('submit', function(e){
  e.preventDefault();
  var obj = parseMoney($('#gObj').value);
  if(obj <= 0){ toast('Poné cuánto querés juntar'); $('#gObj').focus(); return; }
  /* Dos importes independientes: el que ya venía ahorrando puede tener las dos
     monedas a la vez, y ninguna se convierte a la otra al guardarla. */
  var ini    = Math.max(0, parseMoney($('#gInicial').value));
  var iniUsd = Math.max(0, parseMoney($('#gInicialUsd').value));
  /* Dónde están los pesos: lo que diga el interruptor. Si una parte está en
     efectivo, esa parte queda aparte y el resto rinde en la cuenta elegida. */
  var lugN = (ini > 0) ? lugarValido(nuevaLugar || '') : '';
  var efN = (lugN && !$('#gEfRow').hidden) ? Math.max(0, parseMoney($('#gEfectivo').value)) : 0;
  var otN = lugN ? nuevaOtras.filter(function(o){ return lugarValido(o.cid) && o.cid !== lugN; })
                              .map(function(o){ return { cid:o.cid, v:Math.max(0, parseMoney(o.v || '')) }; })
                              .filter(function(o){ return o.v > 0; }) : [];
  var enOt = otN.reduce(function(t, o){ return t + o.v; }, 0);
  if(efN + enOt > ini + 0.005){
    toast('Lo que repartiste pasa los ' + money(ini) + ' que pusiste');
    var fx = otN.length ? $('#gc-' + otN[otN.length - 1].cid) : $('#gEfectivo'); if(fx) fx.focus();
    return;
  }
  var nueva = { id:uid(), nombre:$('#gNombre').value.trim() || 'Meta de ahorro', objetivo:obj,
                inicial: ini, inicialUsd: iniUsd,
                moneda:monedaMeta, desde:today(), rinde:!!lugN, aportes:[] };
  if(lugN) nueva.cuenta = lugN;
  otN.forEach(function(o){ ponerEnCuenta(nueva, o.cid, o.v); });
  if(efN > 0) ponerEfectivo(nueva, efN);
  S.metas.push(nueva);
  save(); $('#gNombre').value=''; $('#gObj').value=''; $('#gInicial').value=''; $('#gInicialUsd').value='';
  $('#gEfectivo').value = ''; $('#gEfRow').hidden = true;
  nuevaLugar = undefined; nuevaOtras = []; var gd = $('#gDonde'); if(gd) gd.innerHTML = '';
  render(); pintarNuevaDonde();
  var frN = [money(ini - efN - enOt) + ' rinden en ' + nombreLugar(lugN)];
  otN.forEach(function(o){ frN.push(money(o.v) + ' en ' + nombreLugar(o.cid)); });
  if(efN > 0) frN.push(money(efN) + ' en efectivo');
  toast('Meta creada' + (ini > 0 ? (lugN ? ((efN > 0 || otN.length) ? ': ' + listaY(frN)
                                                   : ': tus pesos rinden en ' + nombreLugar(lugN))
                                         : ': tus pesos quedan aparte, sin rendir') : ''));
});
document.addEventListener('input', function(e){
  var gc = e.target.closest && e.target.closest('[data-gcta]');
  if(gc){
    var gcid2 = gc.getAttribute('data-gcta');
    nuevaOtras.forEach(function(o){ if(o.cid === gcid2) o.v = gc.value; });
    pintarNuevaDonde();
    return;
  }
  if(e.target.id === 'gInicial' || e.target.id === 'gEfectivo') pintarNuevaDonde();
});
document.addEventListener('submit', function(e){
  var f = e.target.closest('[data-aporte]');
  if(!f) return;
  e.preventDefault();
  var id = f.getAttribute('data-aporte');
  var meta = null;
  S.metas.forEach(function(m){ if(m.id === id) meta = m; });
  if(!meta) return;
  var monto = parseMoney(f.elements.monto.value);
  if(monto <= 0){ toast('Poné cuánto aportás'); return; }
  var mon = (apEdit && apEdit.meta === id)
    ? (monAp[id] || monAporte(meta, aportePorId(meta, apEdit.ap) || {}))
    : monDeAporte(meta);
  var cot = guardarCotAporte(meta, mon);
  if(cot === null){ f.elements.monto.focus(); return; }
  var fecha = f.elements.fecha.value || defaultFecha();
  var lugar = lugarDelForm(f, mon);

  if(apEdit && apEdit.meta === id){
    var ap = aportePorId(meta, apEdit.ap);
    if(ap){
      var saca = (Number(ap.monto)||0) < 0;
      ap.monto = saca ? -monto : monto;
      ap.fecha = fecha;
      if(mon === (meta.moneda || 'ARS')) delete ap.mon; else ap.mon = mon;
      // si cambió de moneda, la cotización se vuelve a tomar; si no, se respeta
      if(cot > 0) ap.cot = cot;
      ponerLugar(meta, ap, lugar);
      if(apEdit.previo) ap.previo = true; else delete ap.previo;
    }
    salirApEdit();
    save(); render(); toast('Aporte corregido');
    return;
  }
  var datos = { monto:monto, mon:mon, cot:cot, fecha:fecha, lugar:lugar };
  /* Plata de un mes que ya pasó: cargarla como aporte de ese mes le cambia el
     balance a un mes cerrado. Lo más probable es que sea plata que ya tenías,
     así que antes de guardar pregunto, recomendando sumarla a lo que ya tenías. */
  if(ymOf(fecha) < ymNow()){
    apPregunta = { meta:id, monto:monto, mon:mon, cot:cot, fecha:fecha, lugar:lugar };
    renderAhorro();
    var b = $('[data-aporte="'+id+'"] [data-appreg="previo"]');
    if(b) try{ b.focus({preventScroll:true}); }catch(x){}
    return;
  }
  crearAporte(meta, datos, false);
});

document.addEventListener('keydown', function(e){
  if(e.key === 'Escape' && !$('#lupaDia').hidden){ cerrarDia(); return; }
  if(e.key === 'Escape' && !$('#lupaMed').hidden){ cerrarMedios(); return; }
  if(e.key === 'Escape' && !$('#lupa').hidden){ cerrarLupa(); return; }
  if(e.key === 'Enter' && e.target.id === 'convCot' && convCotEdit){ e.preventDefault(); convCotEdit = false; e.target.blur(); renderConv(); return; }
  if(e.key === 'Enter' && e.target.id === 'cycInf'){ e.preventDefault(); cycInfTrabar(); e.target.blur(); return; }
  if((e.key === 'Enter' || e.key === ' ') && e.target.id === 'chMes'){ e.preventDefault(); abrirLupa(); return; }
  if((e.key === 'Enter' || e.key === ' ') && e.target.hasAttribute && e.target.hasAttribute('data-pgfijo')){ e.preventDefault(); e.target.click(); return; }
  if(e.key === 'Enter' && e.target.id === 'catNueva'){ e.preventDefault(); $('#catAdd').click(); }
  if(e.key === 'Enter' && e.target.id === 'grupoNuevo'){ e.preventDefault(); $('#grupoAdd').click(); }
  if(e.key === 'Enter' && e.target.matches && e.target.matches('[data-cat],[data-medio],[data-cmed],[data-gname],[data-pct],[data-money],[data-inicial],[data-pmonto],[data-iefec],[data-icta]')){ e.preventDefault(); e.target.blur(); }
});

/* presupuestos */
function campoPlata(id){ return $('#presuEdit [data-money="'+String(id).replace(/"/g,'')+'"]'); }
function campoPct(id){ return $('#presuEdit [data-pct="'+String(id).replace(/"/g,'')+'"]'); }
function filaTope(id){ return $('#presuEdit [data-fila="'+String(id).replace(/"/g,'')+'"]'); }
/* Marca cuál de los dos campos de la fila manda. Es sólo pintura —el dato es
   S.presuFijo—, pero se aplica en cuanto empezás a escribir para que veas al
   toque en qué modo quedó el grupo. */
function marcarModo(id, fijo){
  var f = filaTope(id);
  if(f) f.classList.toggle('fijo', !!fijo);
}
function pintarPlataDe(pctInput){
  var base = baseDelMes(mes), id = pctInput.getAttribute('data-pct');
  var v = pctDelCampo(id, pctInput.value);
  var mi = campoPlata(id);
  if(mi) mi.value = (v > 0 && base > 0) ? enCampo(topeEnPesos(v, base)) : '';
}
function pintarPctDe(monInput){
  var base = baseDelMes(mes), id = monInput.getAttribute('data-money');
  var plata = Math.max(0, parseMoney(monInput.value));
  var pi = campoPct(id);
  if(!pi) return;
  var pc = (base > 0 && plata > 0) ? Math.min(100, plata / base * 100) : 0;
  pi.value = pc > 0 ? fmtPct(pc).replace('%','') : '';
}
document.addEventListener('input', function(e){
  var pct = e.target.closest('[data-pct]');
  if(pct){
    marcarModo(pct.getAttribute('data-pct'), false);
    pintarPlataDe(pct);
    vistaPreviaAlloc();
    actualizarSumaPresu();
    return;
  }
  var mon = e.target.closest('[data-money]');
  if(mon){
    // en pesos se puede escribir aunque no haya base: el tope fijo no la necesita
    marcarModo(mon.getAttribute('data-money'), true);
    pintarPctDe(mon);
    vistaPreviaAlloc();
    actualizarSumaPresu();
    return;
  }
  if(e.target.id === 'baseIng'){
    S.baseIngreso = Math.max(0, parseMoney(e.target.value));
    // los porcentuales recalculan sus pesos; los fijos se quedan como están
    $$('#presuEdit [data-pct]').forEach(function(i){
      if(!esTopeFijo(i.getAttribute('data-pct'))) pintarPlataDe(i);
    });
    $$('#presuEdit [data-money]').forEach(function(i){
      if(esTopeFijo(i.getAttribute('data-money'))) pintarPctDe(i);
    });
    actualizarSumaPresu();
  }
});
document.addEventListener('change', function(e){
  var cin = e.target.closest('[data-cat]');
  if(cin){
    var idx = parseInt(cin.getAttribute('data-cat'), 10);
    var lista = listaCat(catTab), viejo = lista[idx];
    var nuevo = cin.value.trim().replace(/\s+/g,' ');
    if(!nuevo){ cin.value = viejo; toast('El nombre no puede quedar vacío'); return; }
    if(nuevo === viejo) return;
    if(existeCat(catTab, nuevo, idx)){ cin.value = viejo; toast('Ya tenés una categoría con ese nombre'); return; }
    renombrarCat(catTab, idx, nuevo);
    save(); fillSelects(); renderCats(); renderPresuEdit(); renderResumen(); renderMov();
    toast('Ahora se llama "'+nuevo+'"');
    return;
  }
  if(e.target.id === 'fCuando'){ pintarFijoForm(); return; }
  // v256: los días hábiles de la quincena, de 0 a 15 (después ya empieza la otra)
  if(e.target.id === 'fQuinHab'){ var qv = parseInt(e.target.value, 10); if(qv > 15) e.target.value = '15'; else if(qv < 0) e.target.value = '0'; return; }
  if(e.target.id === 'fCat' || e.target.id === 'mCat'){ pintarSueldoAyudas(); return; }
  if(e.target.id === 'catFiltro'){ catFiltro = e.target.value; renderMov(); return; }
  if(e.target.id === 'medFiltro'){ medFiltro = e.target.value; renderMov(); return; }
  var min = e.target.closest('[data-medio]');
  if(min){
    var midx = parseInt(min.getAttribute('data-medio'), 10);
    var mviejo = S.medios[midx];
    var mnuevo = min.value.trim().replace(/\s+/g,' ');
    if(!mnuevo){ min.value = mviejo; toast('El nombre no puede quedar vacío'); return; }
    if(mnuevo === mviejo) return;
    if(existeMedio(mnuevo, midx)){ min.value = mviejo; toast('Ya tenés un medio de pago con ese nombre'); return; }
    renombrarMedio(midx, mnuevo);
    save(); fillSelects(); renderMedios(); renderResumen(); renderMov();
    toast('Ahora se llama "'+mnuevo+'"');
    return;
  }
  var gname = e.target.closest('[data-gname]');
  if(gname){
    var gid = gname.getAttribute('data-gname');
    var nom = gname.value.trim().replace(/\s+/g,' ').slice(0,28);
    if(!nom){ gname.value = nombreGrupo(gid); toast('El nombre no puede quedar vacío'); return; }
    if(nom === nombreGrupo(gid)) return;
    var gobj = grupoPorId(gid); if(!gobj) return;
    gobj.nombre = nom;
    save(); renderCats(); renderPresuEdit(); renderResumen();
    toast('Ahora el grupo se llama "'+nom+'"');
    return;
  }
  var cgru = e.target.closest('[data-catgrupo]');
  if(cgru){
    var ci2 = parseInt(cgru.getAttribute('data-catgrupo'), 10);
    var cat2 = listaCat('gasto')[ci2];
    if(cat2){
      S.grupoDe[cat2] = cgru.value;
      save(); renderResumen();
      toast('"'+cat2+'" pasó a '+nombreGrupo(cgru.value));
    }
    return;
  }
  var pct = e.target.closest('[data-pct]');
  if(pct){
    /* Escribiste en el campo de %: el grupo pasa a ser porcentual y deja de
       tener tope fijo. El `change` sólo salta si el texto cambió de verdad, así
       que pasar por el campo sin tocarlo no le cambia el modo a nadie. */
    var c = pct.getAttribute('data-pct'), v = pctDelCampo(c, pct.value);
    S.presuFijo = S.presuFijo || {};
    delete S.presuFijo[c];
    if(v > 0) S.presuGrupo[c] = v; else delete S.presuGrupo[c];
    pct.value = v > 0 ? fmtPctFino(v).replace('%','') : '';
    marcarModo(c, false);
    pintarPlataDe(pct);
    save(); renderResumen(); pintarAlloc(); actualizarSumaPresu();
    if(v > 0) toast(nombreGrupo(c) + ': ' + fmtPct(v) + ' de lo que entra, así que se mueve con tu ingreso');
    return;
  }
  var ini2 = e.target.closest('[data-inicial]');
  if(ini2){
    var pi = ini2.getAttribute('data-inicial').split('|');
    var mid = pi[0], monI = pi[1] === 'USD' ? 'USD' : 'ARS';
    var nuevo2 = Math.max(0, parseMoney(ini2.value));
    S.metas.forEach(function(mm){
      if(mm.id !== mid) return;
      if(monI === 'USD') mm.inicialUsd = nuevo2; else ponerTotalIni(mm, nuevo2);
    });
    save(); render();
    toast(nuevo2 > 0
      ? ('Punto de partida: ' + (monI === 'USD' ? usd(nuevo2) : money(nuevo2)))
      : ('Saqué los ' + (monI === 'USD' ? 'dólares' : 'pesos') + ' del punto de partida'));
    return;
  }
  var mon2 = e.target.closest('[data-money]');
  if(mon2){
    /* Escribiste el tope en pesos: queda FIJO. Se guarda el monto tal cual, sin
       pasarlo por un porcentaje —que era lo que hacía que subiera solo cuando te
       entraba más plata—, y por eso tampoco hace falta que haya una base. */
    var gid3 = mon2.getAttribute('data-money');
    var plata3 = Math.max(0, parseMoney(mon2.value));
    plata3 = Math.round(plata3 * 100) / 100;
    S.presuFijo = S.presuFijo || {};
    delete S.presuGrupo[gid3];
    if(plata3 > 0) S.presuFijo[gid3] = plata3; else delete S.presuFijo[gid3];
    mon2.value = plata3 > 0 ? enCampo(plata3) : '';
    marcarModo(gid3, plata3 > 0);
    pintarPctDe(mon2);
    save(); renderResumen(); pintarAlloc(); actualizarSumaPresu();
    if(plata3 > 0) toast(nombreGrupo(gid3) + ': ' + money(plata3) + ' fijos, entre lo que entre');
    return;
  }
  if(e.target.id === 'baseIng'){
    S.baseIngreso = Math.max(0, parseMoney(e.target.value));
    e.target.value = S.baseIngreso > 0 ? enCampo(S.baseIngreso) : '';
    save(); renderResumen(); actualizarSumaPresu();
  }
  var fp = e.target.closest('[data-fprecio]');
  if(fp){
    var idf = fp.getAttribute('data-fprecio');
    var nuevo = Math.max(0, parseMoney(fp.value));
    S.fijos.forEach(function(f){
      if(f.id !== idf) return;
      var actual = precioFijo(f, mes);
      if(nuevo <= 0 || Math.abs(nuevo - actual) < 0.005) return;
      // si ya había un tramo que arranca este mes, lo piso; si no, agrego uno
      var usdF = esUSD(f), cotN = 0;
      if(usdF){
        cotN = cotParaGuardar();
        if(!cotN) return;
      }
      var yaEste = null;
      f.precios.forEach(function(x){ if(x.desde === mes) yaEste = x; });
      if(yaEste){ yaEste.monto = nuevo; if(usdF) yaEste.cot = cotN; }
      else { var tr = { desde:mes, monto:nuevo }; if(usdF) tr.cot = cotN; f.precios.push(tr); }
      f.precios.sort(function(a,b){ return a.desde < b.desde ? -1 : 1; });
      if(mes < f.desde) f.desde = mes;
      toast('Desde ' + ymLabel(mes) + ((f.tipo === 'ingreso') ? ' entran ' : ' sale ')
            + (usdF ? usd(nuevo) : money(nuevo)));
    });
    save(); render();
    return;
  }
  if(e.target.id === 'mesInput'){
    var vm = e.target.value;
    if(vm && vm !== mes){ mes = vm; confirmId = null; render(); syncFechas(); pintarLupa(); }
    return;
  }
  var cent = e.target.closest('[data-cent]');
  if(cent){
    var cE = cuentaPorId(cent.getAttribute('data-cent'));
    if(cE){
      cE.entidad = cent.value;
      cE.manual = false;
      var aviso = aplicarMedioDeCuenta(cE);   // el medio de pago toma el nombre del banco
      save(); fillSelects(); render();
      if(aviso) toast(aviso);
    }
    return;
  }
  var ctna = e.target.closest('[data-ctna]');
  if(ctna){
    var cT = cuentaPorId(ctna.getAttribute('data-ctna'));
    if(!cT) return;
    var vt = Math.max(0, Math.min(500, parseMoney(ctna.value)));
    var ee = null;
    (S.tasas||[]).forEach(function(x){ if(x.api === cT.entidad) ee = x; });
    // v287: si quedó el mismo número que se veía, no la toqué: no se fija
    if(ee && vt > 0 && Math.abs(vt - Math.round(ee.tna * 100) / 100) < 0.005){ delete tnaEdit[cT.id]; renderCuentas(); return; }
    if(ee){
      // editaste la tasa de una entidad: queda fija y no la pisa la actualización
      if(vt > 0){ ee.tna = vt; ee.fija = true; }
      else {
        delete ee.fija;
        var orig = null;
        TASAS_DEF.forEach(function(d){ if(d.api === ee.api) orig = d; });
        if(orig) ee.tna = orig.tna;
        delete ee.al;
        setTimeout(traerTasas, 0);   // v287: vuelve a ser automática: que se actualice ya
      }
      cT.manual = false;
    } else {
      cT.tna = vt;
      cT.manual = vt > 0;
    }
    delete tnaEdit[cT.id];
    save(); render();
    if(vt > 0) toast('Tasa de ' + (cT.medio || 'la cuenta') + ': ' + fmtPct(vt) + ' anual' + (ee ? '. Queda fija: la actualización diaria no la pisa' : ''));
    return;
  }
  var cnom = e.target.closest('[data-cmed]');
  if(cnom){
    var cN = cuentaPorId(cnom.getAttribute('data-cmed'));
    if(!cN) return;
    var nn = cnom.value.trim().replace(/\s+/g,' ').slice(0,28);
    if(!nn){ cnom.value = cN.medio || ''; toast('El nombre no puede quedar vacío'); return; }
    if(nn === cN.medio) return;
    var iN = cN.medio ? S.medios.indexOf(cN.medio) : -1;
    if(existeMedio(nn, iN)){ cnom.value = cN.medio || ''; toast('Ya tenés un medio de pago con ese nombre'); return; }
    if(iN > -1){
      renombrarMedio(iN, nn);       // deja cN.medio = nn y arrastra los movimientos
    } else {
      S.medios.push(nn); desmarcarMedioQuitado(nn); cN.medio = nn;
    }
    save(); fillSelects(); render();
    toast('Ahora se llama "' + nn + '"');
    return;
  }
  if(e.target.id === 'avisoHora' || e.target.id === 'avisoMin'){
    S.aviso = avisoCfg();
    var vAv = parseInt(e.target.value, 10) || 0;
    if(e.target.id === 'avisoHora') S.aviso.hora = Math.min(23, Math.max(0, vAv));
    else S.aviso.min = Math.min(55, Math.max(0, vAv));
    save(); sincronizarAviso(); renderAviso();
    toast('Te aviso a las ' + hhmm(S.aviso.hora, S.aviso.min));
    return;
  }
  var dAp = e.target.closest('[data-dondeap]');
  if(dAp){
    var idD = dAp.getAttribute('data-dondeap'), vD = lugarValido(dAp.value);
    if(apEdit && apEdit.meta === idD) apEdit.lugar = vD;
    else dondeAp[idD] = vD;
    return;
  }
  var iCt = e.target.closest('[data-icta]');
  if(iCt){
    var kCt = iCt.getAttribute('data-icta').split('|'), mCt = metaPorId(kCt[0]), cCt = kCt[1];
    if(!mCt || !lugarValido(cCt)) return;
    var pidio = Math.max(0, parseMoney(iCt.value));
    var puso = ponerEnCuenta(mCt, cCt, pidio);
    ctaPend[mCt.id] = (ctaPend[mCt.id] || []).filter(function(c){ return c !== cCt; });
    save(); render();
    var pr = lugarInicial(mCt);
    toast(puso > 0
      ? (money(puso) + ' en ' + nombreLugar(cCt) + ' y ' + money(restoIni(mCt)) + ' en ' + nombreLugar(pr)
         + (pidio > puso + 0.005 ? ' (no puede ser más que lo que queda)' : ''))
      : ('Lo de ' + nombreLugar(cCt) + ' vuelve a ' + nombreLugar(pr)));
    return;
  }
  var iEf = e.target.closest('[data-iefec]');
  if(iEf){
    var mEf = metaPorId(iEf.getAttribute('data-iefec'));
    if(!mEf) return;
    if(lugarInicial(mEf)) juntarCuenta(mEf, lugarInicial(mEf));
    var pedido = Math.max(0, parseMoney(iEf.value));
    var puesto = ponerEfectivo(mEf, pedido);
    if(!(puesto > 0)) delete efecAbierto[mEf.id];
    save(); render();
    toast(puesto > 0
      ? (money(puesto) + ' en efectivo y ' + money(iniArs(mEf)) + ' rindiendo en ' + nombreLugar(lugarInicial(mEf))
         + (pedido > puesto + 0.005 ? ' (no puede ser más que lo que tenías)' : ''))
      : 'Todo lo que ya tenías rinde en ' + nombreLugar(lugarInicial(mEf)));
    return;
  }
  var pMo = e.target.closest('[data-pmonto]');
  if(pMo){
    var kM = pMo.getAttribute('data-pmonto').split('|'), mM = metaPorId(kM[0]);
    if(!mM) return;
    var vM2 = Math.round(Math.max(0, parseMoney(pMo.value)) * 100) / 100;
    var aM = kM[1] ? aportePorId(mM, kM[1]) : null;
    var viejo = aM ? (Number(aM.monto)||0) : 0;
    var tope = iniArs(mM) + viejo;
    if(vM2 > tope + 0.005){
      pMo.value = aM ? enCampo(viejo) : '';
      toast('No puede ser más de ' + money(tope) + ': es todo lo que queda en el primer renglón');
      return;
    }
    if(!aM){
      if(!(vM2 > 0)) return;
      var nuevaP = { id:uid(), ts:Date.now(), monto:vM2, fecha:mM.desde, cot:0, mon:'ARS', previo:true, parte:true };
      ponerLugar(mM, nuevaP, lugarParteNueva(mM));
      mM.aportes.push(nuevaP);
      mM.inicial = iniArs(mM) - vM2;
      delete parteNueva[mM.id]; delete parteNuevaLugar[mM.id];
      save(); render();
      var lg = lugarAporte(mM, nuevaP);
      toast(money(vM2) + (lg ? ' en ' + nombreLugar(lg) : ' guardados aparte') + '. El resto sigue en el primer renglón.');
      return;
    }
    if(!(vM2 > 0)){
      mM.inicial = iniArs(mM) + viejo;
      mM.aportes = mM.aportes.filter(function(a){ return a.id !== aM.id; });
    } else {
      aM.monto = vM2;
      mM.inicial = tope - vM2;
    }
    save(); render();
    return;
  }
  var pDo = e.target.closest('[data-pdonde]');
  if(pDo){
    var kD = pDo.getAttribute('data-pdonde').split('|'), mD2 = metaPorId(kD[0]);
    if(!mD2) return;
    if(!kD[1]){ parteNuevaLugar[mD2.id] = lugarValido(pDo.value); return; }
    var aD = aportePorId(mD2, kD[1]);
    if(!aD) return;
    ponerLugar(mD2, aD, lugarValido(pDo.value));
    save(); render();
    var lD = lugarAporte(mD2, aD);
    toast(money(Number(aD.monto)||0) + (lD ? ' ahora están en ' + nombreLugar(lD) : ' ahora están guardados aparte'));
    return;
  }
  var mDo = e.target.closest('[data-mdonde]');
  if(mDo){
    var vM = lugarValido(mDo.value), metaD = null;
    S.metas.forEach(function(mm){ if(mm.id === mDo.getAttribute('data-mdonde')) metaD = mm; });
    if(!metaD) return;
    metaD.rinde = !!vM;
    if(vM) metaD.cuenta = vM; else delete metaD.cuenta;
    save(); render();
    toast(vM ? ('Lo que ya tenías está en ' + nombreLugar(vM)) : 'Lo que ya tenías está guardado aparte');
    return;
  }
  if(e.target.id === 'dolarTipo'){ elegirDolar(e.target.value); return; }
  if(e.target.id === 'dolarVenta'){
    var cot = Math.max(0, parseMoney(e.target.value));
    S.dolar = S.dolar || {}; S.dolar.tipos = S.dolar.tipos || {};
    S.dolar.venta = cot;
    S.dolar.fecha = today();
    S.dolar.auto = false;
    // la escrita a mano queda guardada en su tipo, así no se pierde al cambiar
    if(cot > 0) S.dolar.tipos[tipoDolar()] = { venta:cot, fecha:today() };
    else delete S.dolar.tipos[tipoDolar()];
    save(); render();
  }
});

function sumarDias(fecha, n){
  var y = parseInt(fecha.slice(0,4),10), m = parseInt(fecha.slice(5,7),10)-1, d = parseInt(fecha.slice(8,10),10);
  var t = new Date(y, m, d + n);
  return t.getFullYear()+'-'+pad(t.getMonth()+1)+'-'+pad(t.getDate());
}
function fechaLarga(f){
  return parseInt(f.slice(8,10),10) + ' de ' + (MESES[parseInt(f.slice(5,7),10)-1]||'') + ' de ' + f.slice(0,4);
}
function kv(k, v, color, sub){
  return '<div class="kv"><span class="k">'+esc(k)+(sub?'<small>'+esc(sub)+'</small>':'')+'</span>'
    + '<b'+(color?' style="color:'+color+'"':'')+'>'+esc(v)+'</b></div>';
}
