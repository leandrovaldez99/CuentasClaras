/* Cuentas Claras · js/voz.js
   Carga por voz: entender lo que dijiste y completar el formulario.

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

/* ============================================================
   carga por voz (v200; mantener el "+" desde v201)
   ============================================================
   Decís (o escribís) una frase como "gasté 15 mil en el súper con Mercado
   Pago" y la app arma el movimiento: tipo, monto, fecha, categoría, medio y
   detalle. No guarda nada: llena el formulario y vos confirmás.
   · La voz la pasa a texto el reconocimiento del teléfono (en la app de
     Android) o el del navegador (Chrome). El audio no se guarda.
   · La frase se lee acá, sin internet y sin ninguna IA: palabras sueltas,
     números dichos en letras ("quince mil", "dos lucas", "un palo"), fechas
     ("ayer", "el lunes", "el 3 de octubre"), cuotas ("en 6 cuotas").
   · La categoría sale de tres lados, en este orden de peso: lo que cargaste
     antes con esas mismas palabras (si "Coto" siempre fue Súper, va a Súper),
     el nombre de la categoría dicho tal cual, y una lista de palabras típicas
     (nafta, farmacia, Netflix…). Siempre entre TUS categorías. */
var VOZ_NUM = { cero:0, un:1, uno:1, una:1, dos:2, tres:3, cuatro:4, cinco:5, seis:6, siete:7, ocho:8, nueve:9,
  diez:10, once:11, doce:12, trece:13, catorce:14, quince:15, dieciseis:16, diecisiete:17, dieciocho:18, diecinueve:19,
  veinte:20, veintiun:21, veintiuno:21, veintiuna:21, veintidos:22, veintitres:23, veinticuatro:24, veinticinco:25,
  veintiseis:26, veintisiete:27, veintiocho:28, veintinueve:29, treinta:30, cuarenta:40, cincuenta:50, sesenta:60,
  setenta:70, ochenta:80, noventa:90, cien:100, ciento:100, doscientos:200, doscientas:200, trescientos:300,
  trescientas:300, cuatrocientos:400, cuatrocientas:400, quinientos:500, quinientas:500, seiscientos:600,
  seiscientas:600, setecientos:700, setecientas:700, ochocientos:800, ochocientas:800, novecientos:900, novecientas:900 };
var VOZ_MULT = { mil:1e3, luca:1e3, lucas:1e3, k:1e3, millon:1e6, millones:1e6, palo:1e6, palos:1e6 };
var VOZ_MESES = { enero:1, febrero:2, marzo:3, abril:4, mayo:5, junio:6, julio:7, agosto:8, septiembre:9, setiembre:9,
  octubre:10, noviembre:11, diciembre:12 };
var VOZ_DIAS = { domingo:0, lunes:1, martes:2, miercoles:3, jueves:4, viernes:5, sabado:6 };
/* Palabras que no dicen nada de en qué fue (para el detalle y para aprender). */
var VOZ_VACIAS = ('el la los las lo un una unos unas de del al a en con por para y o u que me mi mis te tu se le les '
  + 'es son fue era hoy ayer anteayer pesos peso mangos plata dinero guita $ como unos unas mas menos casi aprox '
  + 'aproximadamente ahi esto eso este esta ese esa nada algo todo varios varias tipo onda bueno listo che pago '
  + 'pague gaste gasto compre compra cobre cobro').split(' ');
/* Verbos: qué fue, un gasto o una entrada de plata. "me" + verbo va aparte
   porque "cobré" es un ingreso pero "me cobraron" es un gasto. */
var VOZ_GASTO = ['gaste','gastamos','gastaste','pague','pagamos','pagaste','compre','compramos','compraste','abone',
  'abonamos','cargue','cargamos','puse','pusimos','done','pedi','pedimos','invite','salio','costo','gasto','compra'];
var VOZ_INGRESO = ['cobre','cobramos','cobro','cobrado','recibi','recibimos','gane','ganamos','vendi','vendimos',
  'ingreso','ingresaron','ingresaron','entraron','entro','deposito','depositaron','reintegro','devolucion','cobranza'];
var VOZ_ME_GASTO = ['cobraron','cobro','cobran','salio','costo','descontaron','desconto','debitaron','debito','cobraste'];
var VOZ_ME_INGRESO = ['pagaron','pago','pagan','depositaron','deposito','transfirieron','transfirio','transfieren',
  'mandaron','mando','entro','entraron','dieron','dio','regalaron','regalo','devolvieron','devolvio','reintegraron',
  'reintegro','liquidaron','liquido','acreditaron','acredito','cayo','cayeron'];
/* Cómo se nombran los medios, para encontrarlos entre los tuyos. `a`: lo que
   decís; `m`: qué buscar en el nombre de tus medios, en ese orden. */
var VOZ_MEDIOS = [
  { a:['efectivo','en efectivo','cash','billete','billetes','en mano','plata en mano'], m:['efectivo'] },
  { a:['debito','tarjeta de debito','la de debito','con debito'], m:['debito'] },
  { a:['credito','tarjeta de credito','la de credito','visa','master','mastercard','amex','american express'], m:['credito','visa','master','tarjeta'] },
  { a:['tarjeta','la tarjeta'], m:['credito','tarjeta','debito'] },
  { a:['transferencia','transferi','transferimos','por transferencia','cbu','cvu','alias','transfirieron','transfirio','transferencia bancaria'], m:['transferencia','banco','cuenta'] },
  { a:['mercado pago','mercadopago','mp'], m:['mercado pago','mercadopago','mercado','billetera'] },
  { a:['uala'], m:['uala','billetera'] }, { a:['brubank'], m:['brubank','billetera'] }, { a:['naranja x','naranjax'], m:['naranja','billetera'] },
  { a:['lemon'], m:['lemon','billetera'] }, { a:['modo'], m:['modo'] }, { a:['cuenta dni'], m:['cuenta dni','dni','billetera'] },
  { a:['personal pay'], m:['personal','billetera'] }, { a:['prex'], m:['prex','billetera'] }, { a:['belo'], m:['belo','billetera'] },
  { a:['qr','con el qr','codigo qr','billetera','billetera virtual','la billetera'], m:['billetera','mercado pago','qr'] }
];
/* Palabras típicas de cada tipo de gasto o ingreso. `c`: cómo se suele llamar
   la categoría (se busca entre las tuyas); `p`: lo que se dice. */
var VOZ_CATS_G = [
  { c:['super','supermercado','mercado','almacen','alimentos'], p:['super','supermercado','chino','almacen','verduleria','verdura','verduras','fruta','frutas','carniceria','carne','pollo','panaderia','pan','fiambreria','dietetica','mayorista','coto','carrefour','jumbo','disco','vea','changomas','la anonima','makro','vital','mercaderia','mercaderias','yerba','leche','huevos','facturas','galletitas','kiosco','kiosko','maxikiosco'] },
  { c:['comida afuera','salidas','restaurant','delivery','comida'], p:['restaurante','restaurant','resto','bar','cafe','cafecito','cafeteria','pizza','pizzeria','hamburguesa','hamburguesas','burger','mcdonalds','mc donalds','mostaza','delivery','pedidos ya','pedidosya','rappi','empanadas','sushi','helado','helados','heladeria','almuerzo','almorzamos','cena','cenamos','merienda','desayuno','birra','birras','cerveza','cervezas','parrilla','lomito','milanesa','choripan','comimos','comida'] },
  { c:['alquiler','vivienda','casa','hogar'], p:['alquiler','expensas','inmobiliaria','depto','departamento'] },
  { c:['servicios','servicio','cuentas','facturas'], p:['luz','gas','agua','internet','wifi','telefono','celular','cable','netflix','spotify','disney','hbo','max','prime','youtube','edenor','edesur','metrogas','naturgy','aysa','telecentro','movistar','claro','fibertel','flow','directv','abono','factura','garrafa','seguro'] },
  { c:['transporte','auto','movilidad','nafta','viajes'], p:['nafta','combustible','gasoil','gnc','ypf','shell','axion','puma','colectivo','bondi','sube','subte','tren','uber','cabify','didi','taxi','remis','peaje','peajes','estacionamiento','cochera','mecanico','gomeria','service','lavadero','patente','vtv','moto','auto'] },
  { c:['salud','farmacia','medico'], p:['farmacia','remedio','remedios','medicamento','medicamentos','pastillas','ibuprofeno','medico','medica','doctor','doctora','dentista','odontologo','prepaga','osde','swiss medical','galeno','omint','obra social','analisis','estudios','psicologo','psicologa','terapia','kinesiologo','kinesiologia','optica','anteojos','lentes','turno','guardia','vacuna'] },
  { c:['deporte','deportes','gimnasio','gym'], p:['gimnasio','gym','club','futbol','padel','paddle','natacion','pileta','crossfit','yoga','pilates','tenis','cancha','entrenador','running'] },
  { c:['ocio','entretenimiento','salidas','diversion'], p:['cine','teatro','recital','show','entrada','entradas','juego','juegos','steam','playstation','play','xbox','nintendo','boliche','joda','fiesta','salida','paseo','museo','vacaciones','hotel','escapada','bowling','karaoke'] },
  { c:['ropa','indumentaria','vestimenta'], p:['ropa','remera','remeras','pantalon','pantalones','jean','jeans','zapatillas','zapatos','campera','buzo','camisa','vestido','pollera','medias','calzones','bombacha','corpiño','malla','zara','shopping'] },
  { c:['educacion','estudio','estudios','cursos','facultad'], p:['curso','cursos','facultad','universidad','colegio','escuela','jardin','libro','libros','libreria','fotocopias','apuntes','udemy','ingles','clase','clases','profesor','profesora','matricula','utiles'] },
  { c:['impuestos','impuesto','tasas'], p:['impuesto','impuestos','afip','arca','monotributo','abl','rentas','arba','agip','ganancias','municipal','tasa','tasas','bienes personales','multa'] },
  { c:['regalos','regalo'], p:['regalo','regalos','cumple','cumpleaños','cumpleanos','presente','aniversario'] },
  { c:['mascotas','mascota','perro','gato'], p:['veterinaria','veterinario','perro','perra','gato','gata','balanceado','alimento para el perro','petshop','pet shop','vacuna del perro'] },
  { c:['hogar','casa','limpieza'], p:['ferreteria','muebles','mueble','limpieza','lavandina','detergente','bazar','easy','sodimac','pintura','plomero','electricista','gasista','arreglo','colchon'] },
  { c:['belleza','cuidado personal','peluqueria'], p:['peluqueria','peluquero','barberia','barbero','corte de pelo','manicura','uñas','unas','depilacion','maquillaje','perfume','shampoo','crema'] },
  { c:['tecnologia','electronica'], p:['computadora','notebook','auriculares','cargador','mouse','teclado','tele','televisor','tablet','celular nuevo','monitor'] }
];
var VOZ_CATS_I = [
  { c:['sueldo','salario','trabajo'], p:['sueldo','salario','quincena','aguinaldo','horas extras','recibo','laburo','trabajo'] },
  { c:['freelance','extras','changas','trabajos'], p:['freelance','changa','changas','proyecto','cliente','clienta','trabajito'] },
  { c:['ventas','venta'], p:['vendi','vendimos','venta','ventas','mercado libre','marketplace'] },
  { c:['alquileres','alquiler'], p:['alquiler','inquilino','inquilina'] },
  { c:['intereses','inversiones','rendimientos'], p:['intereses','interes','plazo fijo','rendimiento','rendimientos','rindio','dividendos','fci'] },
  { c:['regalo','regalos'], p:['regalo','regalaron','cumple','cumpleaños','cumpleanos'] }
];

function vozNorm(s){ return sinTildes(s).replace(/[^a-z0-9$\/.,ñ ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function vozRaiz(w){ w = String(w || ''); return w.length > 4 ? w.replace(/(es|s)$/, '') : w; }
/* La frase en palabras: { o: como la dijiste, n: sin tildes, en minúscula }. */
function vozPalabras(txt){
  var out = [], re = /\$|u\$s|[0-9]+(?:[.,][0-9]+)*(?:\/[0-9]{1,2}(?:\/[0-9]{2,4})?)?|[A-Za-zÁÉÍÓÚáéíóúÑñÜü]+/gi, m;
  while((m = re.exec(String(txt || '')))) out.push({ o:m[0], n:sinTildes(m[0]).toLowerCase(), u:false });
  return out;
}
/* Un número con cifras: "15.000", "15000", "1,5", "2.500,50". */
function vozCifra(t){
  if(/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(t)) return parseFloat(t.replace(/\./g, '').replace(',', '.'));
  if(/^\d{1,3}(,\d{3})+$/.test(t)) return parseFloat(t.replace(/,/g, ''));
  if(/^\d+[.,]\d+$/.test(t)) return parseFloat(t.replace(',', '.'));
  if(/^\d+$/.test(t)) return parseInt(t, 10);
  return NaN;
}
/* Un número dicho desde la palabra i, en cifras o en letras: { v, i, f } (f: la
   palabra que sigue) o null. "un" y "una" sólo cuentan delante de "mil",
   "millón" o "luca": si no, es "una tele". */
function vozNumero(P, i){
  var total = 0, cur = 0, hay = false, prev = '', ultMult = 0, j = i;
  for(; j < P.length; j++){
    var w = P[j].n, sig = P[j + 1] ? P[j + 1].n : '';
    if(P[j].u) break;
    var c = vozCifra(w);
    if(!isNaN(c) && !/\//.test(w)){
      if(prev === 'num') break;
      cur += c; prev = 'num'; hay = true; continue;
    }
    if(VOZ_NUM[w] !== undefined){
      if((w === 'un' || w === 'una' || w === 'uno') && !VOZ_MULT[sig]) break;
      if(prev === 'num' && !(cur % 100 === 0 && VOZ_NUM[w] < 100) && !(cur % 10 === 0 && cur >= 20 && cur < 100 && VOZ_NUM[w] < 10)) break;
      cur += VOZ_NUM[w]; prev = 'num'; hay = true; continue;
    }
    if(VOZ_MULT[w]){
      if(w === 'k' && prev !== 'num') break;
      var mu = VOZ_MULT[w];
      if(mu === 1e3){ total += (cur || 1) * 1e3; cur = 0; }
      else { total = (total + cur || 1) * 1e6; cur = 0; }
      ultMult = mu; prev = 'mult'; hay = true; continue;
    }
    if(w === 'y' && hay && (VOZ_NUM[sig] !== undefined && VOZ_NUM[sig] < 10 || (sig === 'medio' && ultMult))) { prev = prev === 'num' ? 'num' : 'y'; continue; }
    if(w === 'medio' && ultMult && prev !== 'num'){ total += ultMult / 2; prev = 'num'; continue; }
    break;
  }
  if(!hay) return null;
  return { v:total + cur, i:i, f:j };
}
function vozBuscar(P, frase, desde){
  var f = frase.split(' ');
  for(var i = desde || 0; i + f.length <= P.length; i++){
    var ok = true;
    for(var k = 0; k < f.length; k++) if(P[i + k].u || P[i + k].n !== f[k]){ ok = false; break; }
    if(ok) return i;
  }
  return -1;
}
function vozMarcar(P, i, f, antes){
  for(var k = i; k < f; k++) P[k].u = true;
  // la preposición de adelante ("con Mercado Pago", "de 3 mil", "el lunes") se va con lo que encontré
  var a = i - 1;
  while(a >= 0 && !P[a].u && antes && antes.indexOf(P[a].n) > -1){ P[a].u = true; a--; }
}
function vozFecha(y, m, d){ return y + '-' + pad(m) + '-' + pad(d); }
function vozDiasMes(y, m){ return new Date(y, m, 0).getDate(); }

/* Lee la frase. Devuelve lo que entendió; lo que no sabe queda vacío. */
function vozLeer(txt){
  var P = vozPalabras(txt), r = { texto:String(txt || '').trim(), tipo:'', monto:0, mon:'ARS', n:0, cuota:0,
    fecha:'', fechaDicha:false, cat:'', catPor:'', catPista:'', medio:'', medioPor:'', nota:'', pase:false };
  if(!P.length) return r;
  var hoy = today(), hy = +hoy.slice(0,4), hm = +hoy.slice(5,7), hd = +hoy.slice(8,10), i, x;

  // ¿un pase entre medios? (sacar del cajero, pasar plata de un lado a otro)
  var todo = ' ' + P.map(function(p){ return p.n; }).join(' ') + ' ';
  if(/ (saque|retire|sacamos|extraje) .*(cajero|banco|cuenta)/.test(todo) || / (pase|pasamos|movi) (?!por )(.* )?(a|al|de|del) /.test(todo)) r.pase = true;

  // la hora no es un monto: "a las 9", "a las 21:30"
  for(i = 0; (i = vozBuscar(P, 'a las', i)) > -1; ){
    x = vozNumero(P, i + 2);
    if(x){ vozMarcar(P, i, x.f); if(P[x.f] && /^(y|media|hs|horas)$/.test(P[x.f].n)) P[x.f].u = true; } else i += 2;
  }

  // cuotas: "en 6 cuotas", "12 cuotas sin interés", "en cuotas de 50 mil"
  for(i = 0; i < P.length; i++){
    if(P[i].u || !/^cuotas?$/.test(P[i].n)) continue;
    var ini = i;
    for(var b = i - 1; b >= 0 && b >= i - 4; b--){
      x = vozNumero(P, b);
      if(x && x.f === i){ r.n = Math.round(x.v); ini = b; break; }
    }
    // "la cuota del gimnasio" es un pago, no una compra en cuotas
    if(P[i].n === 'cuota' && ini === i) continue;
    if(r.n < 1 || r.n > 120) r.n = 0;
    vozMarcar(P, ini, i + 1, ['en','a','de','las','los']);
    var s = i + 1;
    if(P[s] && P[s].n === 'sin' && P[s + 1] && P[s + 1].n === 'interes'){ P[s].u = P[s + 1].u = true; s += 2; }
    if(P[s] && /^(fijas|iguales|mensuales)$/.test(P[s].n)){ P[s].u = true; s++; }
    if(P[s] && P[s].n === 'de'){
      x = vozNumero(P, s + 1);
      if(x && x.v > 0){ r.cuota = x.v; vozMarcar(P, s, x.f); }
    }
    r.tipo = 'cuotas';
    break;
  }

  // la fecha
  function ponerFecha(f, desde, hasta, antes){ if(!r.fechaDicha){ r.fecha = f; r.fechaDicha = true; } vozMarcar(P, desde, hasta, antes); }
  var PRE_F = ['el','del','de','la','en','fue','para','hace','desde'];
  if((i = vozBuscar(P, 'antes de ayer')) > -1) ponerFecha(sumarDias(hoy, -2), i, i + 3, PRE_F);
  if((i = vozBuscar(P, 'anteayer')) > -1) ponerFecha(sumarDias(hoy, -2), i, i + 1, PRE_F);
  if((i = vozBuscar(P, 'ayer')) > -1) ponerFecha(sumarDias(hoy, -1), i, i + 1, PRE_F);
  if((i = vozBuscar(P, 'hoy')) > -1) ponerFecha(hoy, i, i + 1, PRE_F);
  if((i = vozBuscar(P, 'esta manana')) > -1 || (i = vozBuscar(P, 'esta tarde')) > -1 || (i = vozBuscar(P, 'esta noche')) > -1 || (i = vozBuscar(P, 'recien')) > -1)
    ponerFecha(hoy, i, i + (P[i].n === 'recien' ? 1 : 2), PRE_F);
  if((i = vozBuscar(P, 'manana')) > -1 && !(i > 0 && /^(la|de|esta|a)$/.test(P[i - 1].n))) ponerFecha(sumarDias(hoy, 1), i, i + 1, PRE_F);
  if((i = vozBuscar(P, 'hace')) > -1){
    x = vozNumero(P, i + 1) || (P[i + 1] && /^(un|una)$/.test(P[i + 1].n) ? { v:1, f:i + 2 } : null);
    if(x && P[x.f] && /^(dias?|semanas?)$/.test(P[x.f].n)){
      ponerFecha(sumarDias(hoy, -Math.round(x.v) * (/^semana/.test(P[x.f].n) ? 7 : 1)), i, x.f + 1, PRE_F);
    }
  }
  for(i = 0; i < P.length; i++){
    if(P[i].u) continue;
    var wd = VOZ_DIAS[P[i].n];
    if(wd === undefined) continue;
    var dow = new Date(hy, hm - 1, hd).getDay(), atras = (dow - wd + 7) % 7, fin = i + 1;
    if(P[fin] && /^(pasado|anterior)$/.test(P[fin].n)){ if(!atras) atras = 7; fin++; }
    ponerFecha(sumarDias(hoy, -atras), i, fin, PRE_F);
    break;
  }
  // "el 3", "el día 15", "el 3 de octubre", "el 3/10", "el primero"
  for(i = 0; i < P.length && !r.fechaDicha; i++){
    if(P[i].u) continue;
    var dd = 0, mm = 0, yy = 0, ff = i;
    var sl = P[i].n.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
    if(sl){ dd = +sl[1]; mm = +sl[2]; yy = sl[3] ? +sl[3] : 0; if(yy && yy < 100) yy += 2000; ff = i + 1; }
    else {
      var conEl = i > 0 && !P[i - 1].u && /^(el|del|dia)$/.test(P[i - 1].n);
      if(P[i].n === 'primero' && conEl){ dd = 1; ff = i + 1; }
      else {
        x = vozNumero(P, i);
        if(!x || x.v !== Math.round(x.v) || x.v < 1 || x.v > 31) continue;
        var mesSig = P[x.f] && P[x.f].n === 'de' && P[x.f + 1] && VOZ_MESES[P[x.f + 1].n];
        if(!conEl && !mesSig) continue;
        // "el 15 mil" es plata, no una fecha
        if(P[x.f] && (VOZ_MULT[P[x.f].n] || /^(pesos|mangos|dolares|cuotas?)$/.test(P[x.f].n))) continue;
        dd = x.v; ff = x.f;
      }
      if(P[ff] && P[ff].n === 'de' && P[ff + 1] && VOZ_MESES[P[ff + 1].n]){ mm = VOZ_MESES[P[ff + 1].n]; ff += 2;
        if(P[ff] && P[ff].n === 'de' && P[ff + 1] && /^\d{4}$/.test(P[ff + 1].n)){ yy = +P[ff + 1].n; ff += 2; } }
    }
    if(!dd) continue;
    var ym0 = (typeof mes === 'string' && mes && mes !== ymNow()) ? mes : '';
    if(!mm){
      if(ym0){ yy = +ym0.slice(0,4); mm = +ym0.slice(5,7); }
      else { yy = hy; mm = hm; if(dd > hd){ mm--; if(!mm){ mm = 12; yy--; } } }
    } else if(!yy){
      yy = hy;
      if(vozFecha(yy, mm, 1) > ymAdd(ymNow(), 1) + '-01') yy--;
    }
    dd = Math.min(dd, vozDiasMes(yy, mm));
    ponerFecha(vozFecha(yy, mm, dd), i, ff, ['el','del','dia','de','para']);
  }

  // la moneda
  for(i = 0; i < P.length; i++){
    if(P[i].u) continue;
    if(/^(dolares|dolar|usd|u\$s|verdes|dolarucos|dolaritos)$/.test(P[i].n)){ r.mon = 'USD'; P[i].u = true; }
    else if(/^(pesos|peso|mangos|ars|\$)$/.test(P[i].n)) P[i].u = true;
  }

  // el medio: primero los tuyos dichos por su nombre, después las formas de decirlo
  var ms = medios(), mejor = null;
  ms.forEach(function(m){
    var nm = vozNorm(m); if(!nm) return;
    var k = vozBuscar(P, nm);
    if(k < 0 && nm.split(' ').length === 1) k = vozBuscar(P, vozRaiz(nm));
    if(k > -1 && (!mejor || nm.length > mejor.l)) mejor = { m:m, i:k, f:k + nm.split(' ').length, l:nm.length };
  });
  if(!mejor){
    VOZ_MEDIOS.forEach(function(d){
      d.a.forEach(function(a){
        var k = vozBuscar(P, a); if(k < 0) return;
        if(mejor && mejor.l >= a.length) return;
        var cual = '';
        d.m.some(function(q){ return ms.some(function(m){ if(vozNorm(m).indexOf(q) > -1){ cual = m; return true; } return false; }); });
        if(cual) mejor = { m:cual, i:k, f:k + a.split(' ').length, l:a.length };
      });
    });
  }
  if(mejor){ r.medio = mejor.m; r.medioPor = 'dijiste'; vozMarcar(P, mejor.i, mejor.f, ['con','por','en','desde','de','la','el','mi','via','a','al','tarjeta']); }

  // el tipo, por el verbo (el primero que aparece manda)
  var tipoV = '', vi = -1;
  for(i = 0; i < P.length && !tipoV; i++){
    var w = P[i].n, w2 = P[i + 1] ? P[i + 1].n : '';
    if((w === 'me' || w === 'nos' || w === 'te') && VOZ_ME_GASTO.indexOf(w2) > -1){ tipoV = 'gasto'; vi = i; }
    else if((w === 'me' || w === 'nos') && VOZ_ME_INGRESO.indexOf(w2) > -1){ tipoV = 'ingreso'; vi = i; }
    else if(VOZ_GASTO.indexOf(w) > -1 && !P[i].u){ tipoV = 'gasto'; vi = i; }
    else if(VOZ_INGRESO.indexOf(w) > -1 && !P[i].u){ tipoV = 'ingreso'; vi = i; }
  }
  var verbo = [];
  if(vi > -1){ var vf = (P[vi].n === 'me' || P[vi].n === 'nos' || P[vi].n === 'te') ? vi + 2 : vi + 1; for(i = vi; i < vf; i++){ verbo.push(P[i]); if(!/^(gasto|compra|cobro)$/.test(P[i].n) || vf - vi > 1) P[i].u = true; } }

  // el monto: el que viene con "$" o con "pesos"/"dólares"; si no, el más grande
  var cands = [];
  for(i = 0; i < P.length; i++){
    if(P[i].u) continue;
    x = vozNumero(P, i);
    if(!x || !(x.v > 0)){ continue; }
    var marca = (i > 0 && /^(\$|u\$s)$/.test(P[i - 1].n)) || (P[x.f] && P[x.f].u && /^(pesos|peso|mangos|dolares|dolar|usd|lucas|luca)$/.test(P[x.f].n));
    cands.push({ x:x, marca:marca });
    i = x.f - 1;
  }
  if(cands.length){
    cands.sort(function(a, b){ return (b.marca - a.marca) || (b.x.v - a.x.v); });
    var cm = cands[0].x;
    r.monto = Math.round(cm.v * 100) / 100;
    vozMarcar(P, cm.i, cm.f, ['de','por','unos','unas','como','casi','en','son','fueron','fue','a']);
  }
  if(r.tipo === 'cuotas'){
    if(r.cuota > 0 && r.n > 0) r.monto = Math.round(r.cuota * r.n * 100) / 100;
    else if(r.cuota > 0 && !r.monto) r.monto = r.cuota;
  }

  // lo que queda es en qué fue
  var resto = P.filter(function(p){ return !p.u; });
  // el verbo también dice algo ("vendí" es una venta), pero no va al detalle
  var paraCat = resto.concat(verbo.filter(function(p){ return resto.indexOf(p) < 0; }));
  var cg = vozCategoria(paraCat, 'gasto'), ci = vozCategoria(paraCat, 'ingreso');
  // sin verbo, es un gasto salvo que las palabras sean claramente de un ingreso ("sueldo")
  if(!r.tipo) r.tipo = tipoV || ((ci.score >= 8 && (cg.score === 0 || ci.score >= cg.score + 8)) ? 'ingreso' : 'gasto');
  var elegida = r.tipo === 'ingreso' ? ci : cg;
  r.cat = elegida.cat; r.catPor = elegida.por; r.catPista = elegida.pista;

  // el detalle: lo que quedó, sin las palabras de relleno de los bordes
  var bordes = VOZ_VACIAS.concat(['y','e','tambien','despues','recien','dia','hoy']);
  while(resto.length && bordes.indexOf(resto[0].n) > -1) resto.shift();
  while(resto.length && bordes.indexOf(resto[resto.length - 1].n) > -1) resto.pop();
  var nota = resto.map(function(p){ return p.o; }).join(' ').slice(0, 60);
  r.nota = nota ? nota.charAt(0).toUpperCase() + nota.slice(1) : '';

  if(!r.fecha) r.fecha = defaultFecha();
  if(!r.medio){ r.medio = vozMedioHabitual(r.tipo === 'ingreso' ? 'ingreso' : 'gasto', r.cat); r.medioPor = 'supuesto'; }
  return r;
}

/* Lo que ya cargaste enseña: cada palabra del detalle, con la categoría que le pusiste. */
var _vozHist = null;
function vozHistorial(){
  var firma = (S.tx || []).length + ':' + (S.planes || []).length + ':' + (S.fijos || []).length + ':' + (S.updatedAt || 0);
  if(_vozHist && _vozHist.firma === firma) return _vozHist;
  var h = { firma:firma, gasto:{}, ingreso:{} };
  function sumar(tipo, texto, cat){
    if(!cat || !texto) return;
    var vistas = {};
    vozPalabras(texto).forEach(function(p){
      var w = vozRaiz(p.n);
      if(w.length < 3 || /^\d/.test(w) || VOZ_VACIAS.indexOf(p.n) > -1 || vistas[w]) return;
      vistas[w] = 1;
      var t = h[tipo][w] || (h[tipo][w] = { n:0, c:{} });
      t.n++; t.c[cat] = (t.c[cat] || 0) + 1;
    });
  }
  (S.tx || []).slice(-800).forEach(function(t){ if(!t.viaje && !t.sac && !t.hx) sumar(t.tipo === 'ingreso' ? 'ingreso' : 'gasto', t.nota, t.cat); });
  (S.planes || []).forEach(function(p){ sumar('gasto', p.desc, p.cat); });
  (S.fijos || []).forEach(function(f){ sumar(f.tipo === 'ingreso' ? 'ingreso' : 'gasto', f.nombre, f.cat); });
  return (_vozHist = h);
}
/* La categoría que mejor cuadra con esas palabras, entre las tuyas:
   { cat, por:'antes'|'nombre'|'palabra'|'', pista, score }. */
function vozCategoria(resto, tipo){
  var cats = (tipo === 'ingreso' ? S.catIng : S.catGasto) || [], pts = {}, por = {}, pista = {};
  function dar(c, n, motivo, w){ if(cats.indexOf(c) < 0) return; pts[c] = (pts[c] || 0) + n; if(!por[c] || n >= (por[c].n || 0)) { por[c] = { m:motivo, n:n }; pista[c] = w; } }
  var ws = resto.map(function(p){ return p.n; }), raices = ws.map(vozRaiz), frase = ' ' + ws.join(' ') + ' ';
  // 1) lo que cargaste antes
  var h = vozHistorial()[tipo], usadas = {};
  raices.forEach(function(w, k){
    if(w.length < 3 || VOZ_VACIAS.indexOf(ws[k]) > -1 || usadas[w]) return;
    usadas[w] = 1;
    var t = h[w]; if(!t) return;
    Object.keys(t.c).forEach(function(c){ var f = t.c[c] / t.n; if(f >= .34) dar(c, 6 + 8 * f * Math.min(1, t.n / 2), 'antes', resto[k].o); });
  });
  // 2) el nombre de la categoría dicho tal cual ("en la categoría Ocio", "comida afuera")
  cats.forEach(function(c){
    var nc = vozNorm(c); if(!nc || nc === 'otros') return;
    if(frase.indexOf(' ' + nc + ' ') > -1){ dar(c, 12, 'nombre', c); return; }
    nc.split(' ').forEach(function(p){
      if(p.length < 4) return;
      var k = raices.indexOf(vozRaiz(p));
      if(k > -1) dar(c, 9, 'nombre', resto[k].o);
    });
  });
  // 3) las palabras típicas
  (tipo === 'ingreso' ? VOZ_CATS_I : VOZ_CATS_G).forEach(function(g){
    var hit = '';
    g.p.some(function(p){
      if(p.indexOf(' ') > -1 ? frase.indexOf(' ' + p + ' ') > -1 : (ws.indexOf(p) > -1 || raices.indexOf(vozRaiz(p)) > -1)){ hit = p; return true; }
      return false;
    });
    if(!hit) return;
    // la categoría tuya que se llama como ese grupo (o como la palabra misma: "Nafta")
    var cual = '';
    cats.some(function(c){ var nc = vozNorm(c); if(nc === hit || vozRaiz(nc) === vozRaiz(hit)){ cual = c; return true; } return false; });
    if(!cual) g.c.some(function(q){ return cats.some(function(c){ var nc = vozNorm(c); if(nc === q || nc.indexOf(q) === 0 || q.indexOf(nc) === 0 && nc.length >= 4){ cual = c; return true; } return false; }); });
    if(cual){
      var orig = ''; resto.some(function(p){ if(p.n === hit || vozRaiz(p.n) === vozRaiz(hit) || hit.indexOf(p.n) === 0){ orig = p.o; return true; } return false; });
      dar(cual, 8, 'palabra', orig || hit);
    }
  });
  var mejor = '', mx = 0;
  cats.forEach(function(c){ if((pts[c] || 0) > mx){ mx = pts[c]; mejor = c; } });
  if(!mejor) return { cat:(cats.indexOf('Otros') > -1 ? 'Otros' : (cats[0] || '')), por:'', pista:'', score:0 };
  return { cat:mejor, por:por[mejor].m, pista:pista[mejor] || '', score:mx };
}
/* Si no dijiste con qué pagaste: el que más usás para esa categoría (o para ese tipo). */
function vozMedioHabitual(tipo, cat){
  var porCat = {}, porTipo = {}, ms = medios();
  (S.tx || []).slice(-300).forEach(function(t){
    if((t.tipo === 'ingreso' ? 'ingreso' : 'gasto') !== tipo || ms.indexOf(t.medio) < 0) return;
    porTipo[t.medio] = (porTipo[t.medio] || 0) + 1;
    if(t.cat === cat) porCat[t.medio] = (porCat[t.medio] || 0) + 1;
  });
  function top(o){ var b = '', n = 0; Object.keys(o).forEach(function(k){ if(o[k] > n){ n = o[k]; b = k; } }); return b; }
  return top(porCat) || top(porTipo) || (tipo === 'ingreso' ? medioPorDefecto('Transferencia') : medioPorDefecto('Débito'));
}

/* ---- la pantalla: el micrófono, el campo y lo que entendí ---- */
var vozRec = null, vozOyendo = false, vozUlt = null;
/* En la app de Android dicta el teléfono (el mismo dictado de Google del
   teclado); en el navegador, el reconocimiento de voz de Chrome. Una APK vieja
   no sabe dictar: queda el campo para escribirlo. */
function vozNativo(){ var a = AND(); return !!(a && typeof a.escuchar === 'function'); }
function vozSR(){ return window.SpeechRecognition || window.webkitSpeechRecognition || null; }
function vozHayMic(){ return vozNativo() || (!AND() && !!vozSR()); }
/* v216: para que se sepa que el "+" también dicta. El globito sale al abrir la
   app, hasta 3 veces o hasta que lo uses o toques "Entendido"; queda en este
   teléfono (no viaja con los datos). */
var VOZ_PISTA_KEY = 'plata-clara-vozpista';
function vozPistaEstado(){ try{ var o = JSON.parse(localStorage.getItem(VOZ_PISTA_KEY) || 'null'); return (o && typeof o === 'object') ? o : { n:0 }; }catch(e){ return { n:0 }; } }
function vozPistaGuardar(o){ try{ localStorage.setItem(VOZ_PISTA_KEY, JSON.stringify(o)); }catch(e){} }
function vozPistaListo(){ var o = vozPistaEstado(); if(!o.listo){ o.listo = 1; vozPistaGuardar(o); } vozPistaOcultar(); vozPintar(); }
var vozPistaT = null;
function vozPistaOcultar(){ var b = $('#vozPista'); if(b) b.hidden = true; if(vozPistaT){ clearTimeout(vozPistaT); vozPistaT = null; } }
function vozPistaMostrar(){
  var b = $('#vozPista'), f = $('.tabs .fab'), o = vozPistaEstado();
  if(!b || !f || !vozHayMic() || o.listo || (o.n || 0) >= 3 || !f.offsetParent || vozOyendo) return;
  o.n = (o.n || 0) + 1; vozPistaGuardar(o);
  b.hidden = false;
  vozPistaT = setTimeout(vozPistaOcultar, 10000);
}
function vozPintar(){
  // el "+" de la barra se vuelve micrófono mientras te escucho
  var fab = $('.tabs .fab');
  var bdg = fab && fab.querySelector('.fab-badge'); if(bdg) bdg.hidden = !vozHayMic();
  var tip = $('#vozTip'); if(tip) tip.hidden = !vozHayMic() || !!vozPistaEstado().listo || !(fab && fab.offsetParent);
  if(fab){
    fab.classList.toggle('oyendo', !!vozOyendo);
    fab.setAttribute('aria-label', vozOyendo ? 'Te escucho' : (vozHayMic() ? 'Cargar (mantené apretado para dictar)' : 'Cargar'));
  }
  var box = $('#vozBox'); if(!box) return;
  box.hidden = !!editando || !!editandoPlan || cargaTab === 'viaje';
  var mic = $('#vozMic'), hay = vozHayMic();
  if(mic){
    mic.hidden = !hay || box.hidden;
    mic.setAttribute('aria-pressed', vozOyendo ? 'true' : 'false');
    mic.setAttribute('aria-label', vozOyendo ? 'Dejar de escuchar' : 'Dictar el gasto o el ingreso');
    mic.title = vozOyendo ? 'Te escucho: tocá para terminar' : 'Dictalo';
  }
  var vv = $('#vozVivo');
  if(vv){ vv.hidden = !vozOyendo || vozNativo(); if(vozOyendo && !vv.textContent) vv.textContent = 'Te escucho… decí, por ejemplo, «gasté 15 mil en el súper»'; if(!vozOyendo) vv.textContent = ''; }
  vozCaja();
}
/* la caja de la voz se esconde entera cuando no tiene nada que mostrar */
function vozCaja(){
  var box = $('#vozBox'); if(!box) return;
  var algo = [].slice.call(box.children).some(function(el){ return el.type !== 'hidden' && !el.hidden; });
  box.classList.toggle('vacia', !algo);
}
function vozEscuchar(mantener){
  if(vozOyendo && vozRec){ vozParar(); return; }
  if(vozNativo()){
    // el dictado del teléfono abre su ventanita y termina solo cuando dejás de hablar
    vozOyendo = true; vozPintar();
    try{ AND().escuchar(); }catch(e){ vozError('otro'); }
    return;
  }
  var SR = vozSR(); if(!SR){ toast('Este navegador no puede dictar: cargalo a mano'); return; }
  var rec, alts = [], fin = false, t = $('#vozTxt');
  try{ rec = new SR(); }catch(e){ toast('Este navegador no puede dictar: cargalo a mano'); return; }
  /* v238: en el iPhone, Safari corta el dictado apenas hay un silencio (y a veces
     antes de que empieces a hablar). Ahí se escucha en modo continuo y lo corto
     yo: 1,6 s después de lo último que dijiste, a los 8 s si no dijiste nada,
     o cuando tocás el micrófono o el +. */
  var largo = VOZ_IOS, tSil = null, tMax = null, t0 = Date.now(), oyo = false;
  function cortar(){ if(vozRec === rec) try{ rec.stop(); }catch(x){} }
  function silencio(ms){ if(!largo) return; if(tSil) clearTimeout(tSil); tSil = setTimeout(cortar, ms); }
  rec.lang = 'es-AR'; rec.interimResults = true; rec.maxAlternatives = 3; rec.continuous = largo;
  rec.onresult = function(e){
    oyo = true; silencio(1600);
    var txt = '';
    for(var k = 0; k < e.results.length; k++){
      txt += (k ? ' ' : '') + e.results[k][0].transcript.trim();
      if(e.results[k].isFinal) fin = true;
    }
    // con un solo tramo, las otras formas en que pudo haberte entendido también sirven
    alts = [];
    if(e.results.length === 1) for(var a = 1; a < e.results[0].length; a++) alts.push(e.results[0][a].transcript.trim());
    if(t) t.value = txt;
    var vv = $('#vozVivo'); if(vv && txt) vv.textContent = '«' + txt + '»';
  };
  rec.onerror = function(e){
    var c = e && e.error;
    if(tSil) clearTimeout(tSil); if(tMax) clearTimeout(tMax);
    if(largo && c === 'aborted' && vozRec !== rec) return;
    vozError(c === 'not-allowed' || c === 'service-not-allowed' ? 'permiso' : c === 'no-speech' ? 'nada'
      : c === 'network' ? 'red' : c === 'audio-capture' ? 'mic' : c === 'aborted' ? 'cancelado' : 'otro');
    if(VOZ_IOS && c && ['not-allowed','service-not-allowed','no-speech','network','audio-capture','aborted'].indexOf(c) < 0) setTimeout(function(){ toast('No pude escucharte (' + c + '). Probá de nuevo o cargalo a mano'); }, 0);
  };
  rec.onend = function(){
    if(tSil) clearTimeout(tSil); if(tMax) clearTimeout(tMax);
    var era = vozRec === rec;
    vozOyendo = false; vozRec = null; vozPintar();
    var txt = t ? t.value.trim() : '';
    if(era && txt) vozUsar([txt].concat(alts));
    else if(era && largo && !oyo && Date.now() - t0 < 1500) toast('El iPhone cortó el micrófono enseguida. Probá de nuevo, o tocá el micrófono de arriba');
    else if(era && mantener) toast(vozAlSoltar() ? 'No te escuché. Mantené apretado el +, soltalo y hablá' : 'No te escuché. Mantené apretado el + y hablá');
  };
  try{ rec.start(); }catch(e){ vozError('otro'); return; }
  vozRec = rec; vozOyendo = true;
  if(largo){ silencio(8000); tMax = setTimeout(cortar, 25000); }
  if(t) t.value = '';
  vozPintar();
}
function vozParar(){ if(vozRec) try{ vozRec.stop(); }catch(e){} }
function vozError(c){
  if(vozRec){ var r0 = vozRec; vozRec = null; try{ r0.abort(); }catch(e){} }
  vozOyendo = false; vozPintar();
  var m = { permiso:'No tengo permiso para usar el micrófono. Podés cargarlo a mano',
            nada:'No te escuché. Tocá "Dictar" y hablá',
            red:'Para dictar hace falta internet. Podés cargarlo a mano',
            mic:'No encontré un micrófono. Podés cargarlo a mano',
            sin:'Este teléfono no tiene el dictado de Google. Podés cargarlo a mano',
            otro:'No pude escucharte. Probá de nuevo o cargalo a mano' }[c];
  if(m) toast(m);
}
/* La app de Android: el dictado del teléfono vuelve acá, con las formas en que
   te entendió (la primera es la más probable). */
window.__ccVoz = function(lista){
  var l; try{ l = JSON.parse(lista); }catch(e){ l = [String(lista || '')]; }
  if(!Array.isArray(l)) l = [String(l)];
  l = l.map(function(x){ return String(x || '').trim(); }).filter(Boolean);
  vozOyendo = false; vozPintar();
  if(!l.length){ vozError('nada'); return; }
  if(vista !== 'cargar') go('cargar');
  vozUsar(l);
};
window.__ccVozError = function(c){ vozError(String(c || 'otro')); };
window.__ccVozLeer = function(t){ return vozLeer(t); };

/* De las formas en que te entendió, la primera que tenga un monto. */
function vozUsar(lista){
  var rs = lista.map(vozLeer), r = rs[0];
  rs.some(function(x){ if(x.monto > 0){ r = x; return true; } return false; });
  var t = $('#vozTxt'); if(t) t.value = r.texto;
  vozAplicar(r);
}
function vozLimpiarMarcas(){ $$('.voz-lleno').forEach(function(el){ el.classList.remove('voz-lleno'); }); }
/* Llena el formulario con lo que entendí. No guarda: eso lo hacés vos. */
function vozAplicar(r){
  if(editando) salirEdit();
  if(editandoPlan) salirEditPlan();
  vozLimpiarMarcas();
  var cuotas = r.tipo === 'cuotas', marcar = [];
  cargaTab = cuotas ? 'cuotas' : r.tipo;
  if(!cuotas) tipoMov = r.tipo;
  pintarCarga(); fillSelects();
  if(cuotas){
    $('#qDesc').value = r.nota || ''; if(r.nota) marcar.push('#qDesc');
    $('#qTotal').value = r.monto ? enCampo(r.monto) : ''; if(r.monto) marcar.push('#qTotal');
    if(r.n){ $('#qN').value = String(r.n); marcar.push('#qN'); }
    if(r.cat && S.catGasto.indexOf(r.cat) > -1){ $('#qCat').value = r.cat; marcar.push('#qCat'); }
    if(r.medio && r.medioPor === 'dijiste'){ $('#qMedio').value = r.medio; marcar.push('#qMedio'); }
    previewCuota();
  } else {
    monMov = r.mon === 'USD' ? 'USD' : 'ARS'; pintarMon();
    $('#mMonto').value = r.monto ? enCampo(r.monto) : ''; if(r.monto) marcar.push('#mMonto');
    $('#mFecha').value = r.fecha || defaultFecha(); if(r.fechaDicha) marcar.push('#fMov .datebtn');
    if(r.cat){ $('#mCat').value = r.cat; marcar.push('#mCat'); }
    if(r.medio){ $('#mMedio').value = r.medio; marcar.push('#mMedio'); }
    $('#mNota').value = r.nota || ''; if(r.nota) marcar.push('#mNota');
    pintarFechas();
  }
  marcar.forEach(function(s){ var el = $(s); if(el) el.classList.add('voz-lleno'); });
  vozUlt = r;
  vozResumen(r);
  // el teclado se va (si escribiste la frase) y queda a la vista el botón de guardar
  var tx = $('#vozTxt'); if(tx && document.activeElement === tx) tx.blur();
  var form = cuotas ? $('#fCuota') : $('#fMov'), btn = form && form.querySelector('button[type=submit]');
  if(!r.monto){ var mi = cuotas ? $('#qTotal') : $('#mMonto'); if(mi) try{ mi.focus({ preventScroll:true }); }catch(x){} }
  if(btn) setTimeout(function(){ try{ btn.scrollIntoView({ block:'nearest' }); }catch(x){} }, 30);
}
function vozResumen(r){
  var res = $('#vozRes'); if(!res) return;
  var cuotas = r.tipo === 'cuotas', ch = [];
  ch.push('<span class="' + (cuotas ? 'q' : r.tipo === 'ingreso' ? 'i' : 'g') + '">' + (cuotas ? 'En cuotas' : r.tipo === 'ingreso' ? 'Ingreso' : 'Gasto') + '</span>');
  ch.push(r.monto ? '<span>' + esc(r.mon === 'USD' ? usd(r.monto) : money(r.monto)) + (cuotas && r.n ? ' en ' + r.n + ' cuotas' : '') + '</span>'
                  : '<span class="falta">Falta el monto</span>');
  if(r.cat) ch.push('<span>' + esc(r.cat)
    + (r.catPor === 'antes' ? ' <small>como lo cargaste antes</small>' : r.catPor === 'palabra' && r.pista ? ' <small>por “' + esc(r.pista) + '”</small>' : !r.catPor ? ' <small>no supe cuál</small>' : '')
    + '</span>');
  if(!cuotas || r.medioPor === 'dijiste') ch.push('<span>' + esc(r.medio) + (r.medioPor === 'supuesto' ? ' <small>el que más usás</small>' : '') + '</span>');
  if(!cuotas) ch.push('<span>' + esc(r.fecha === today() ? 'hoy' : fechaLabel(r.fecha)) + '</span>');
  var boton = cuotas ? '“Guardar compra en cuotas”' : '“Agregar movimiento”';
  var nota = r.pase ? 'Parece un pase entre medios, y eso no es gasto ni ingreso. <button type="button" class="linkbtn" data-pasenuevo>Anotalo como pase</button>.'
    : (r.monto ? 'Revisá abajo y, si está bien, tocá ' + boton + '. No se guarda nada hasta que lo confirmes.'
               : 'No entendí el monto: escribilo abajo.');
  res.innerHTML = '<p class="voz-dijo">“' + esc(r.texto) + '”</p><div class="voz-chips">' + ch.join('') + '</div>'
    + '<div class="voz-pie"><p class="note">' + nota + '</p><button type="button" class="linkbtn" data-vozno>Descartar</button></div>';
  res.hidden = false;
  vozCaja();
}
function vozLimpiar(borrar){
  vozLimpiarMarcas();
  var res = $('#vozRes'); if(res){ res.hidden = true; res.innerHTML = ''; }
  var t = $('#vozTxt'); if(t) t.value = '';
  if(borrar && vozUlt){
    if(vozUlt.tipo === 'cuotas'){ $('#qDesc').value = ''; $('#qTotal').value = ''; $('#qN').value = '12'; previewCuota(); }
    else { $('#mMonto').value = ''; $('#mNota').value = ''; $('#mFecha').value = defaultFecha(); monMov = 'ARS'; pintarMon(); fillSelects(); pintarFechas(); }
  }
  vozUlt = null;
  vozCaja();
}
document.addEventListener('click', function(e){
  if(!e.target.closest) return;
  if(e.target.closest('#vozMic')){ vozEscuchar(); return; }
  if(e.target.closest('[data-vozno]')){ vozLimpiar(true); return; }
  // un pase: el monto que dijiste ya va en el formulario del pase
  if(e.target.closest('#vozRes [data-pasenuevo]') && vozUlt && vozUlt.monto){
    var r = vozUlt; setTimeout(function(){ var pm = $('#paseMonto'); if(pm && !pm.value) pm.value = enCampo(r.monto); }, 0);
  }
});
document.addEventListener('submit', function(e){
  var id = e.target.id;
  if(id === 'vozForm'){
    e.preventDefault();
    if(vozOyendo) vozParar();
    var v = ($('#vozTxt').value || '').trim();
    if(!v){ toast('Escribí qué gastaste o cobraste, por ejemplo: gasté 15 mil en el súper'); $('#vozTxt').focus(); return; }
    vozUsar([v]);
    return;
  }
  // se guardó (el formulario quedó vacío): lo que entendí ya no hace falta
  if((id === 'fMov' || id === 'fCuota') && vozUlt){
    setTimeout(function(){ if(id === 'fMov' ? !$('#mMonto').value : !$('#qTotal').value) vozLimpiar(false); }, 0);
  }
});
['input', 'change'].forEach(function(ev){
  document.addEventListener(ev, function(e){ if(e.target.classList && e.target.classList.contains('voz-lleno')) e.target.classList.remove('voz-lleno'); });
});

/* Mantener apretado el "+" de la barra: el "+" se vuelve un micrófono y te
   escucho. En el navegador escucho mientras lo tenés apretado y, al soltar,
   lleno la carga; en la app del teléfono se abre el dictado de Google, que
   termina solo cuando dejás de hablar. Un toque corto sigue siendo el de
   siempre: abre la carga. */
var VOZ_LARGO = 400, vozFab = { t:null, x:0, y:0, largo:false, sujeto:false, espera:false };
/* v235: en el iPhone, Safari sólo deja prender el micrófono justo después de un
   toque terminado (al levantar el dedo), no a los 0,4 s de estar apretando: si
   se prende ahí, se corta al instante. Así que en el iPhone se mantiene apretado
   el +, se suelta, y recién ahí escucho; se corta solo cuando dejás de hablar. */
var VOZ_IOS = (function(){ var ua = navigator.userAgent || ''; return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1); })();
function vozAlSoltar(){ return VOZ_IOS && !vozNativo(); }
function vozFabDe(e){ return e.target && e.target.closest ? e.target.closest('.tabs .fab') : null; }
function vozFabAnillo(on){ var f = $('.tabs .fab'); if(f) f.classList.toggle('carga', !!on); }
function vozFabEmpezar(){
  vozFab.largo = true;
  vozFabAnillo(false);
  vozPistaListo();
  try{ if(navigator.vibrate) navigator.vibrate(20); }catch(x){}
  if(editando) salirEdit();
  if(editandoPlan) salirEditPlan();
  if(cargaTab === 'viaje'){ cargaTab = tipoMov === 'ingreso' ? 'ingreso' : 'gasto'; tipoMov = cargaTab; }
  if(vista !== 'cargar') go('cargar'); else { pintarCarga(); window.scrollTo(0, 0); }
  vozLimpiar(false);
  if(vozAlSoltar()){
    // iPhone: el micrófono se prende al soltar (ver arriba)
    vozFab.espera = true;
    var fb = $('.tabs .fab'); if(fb) fb.classList.add('oyendo');
    toast('Soltá y hablá');
    return;
  }
  vozEscuchar(true);
  if(vozOyendo && vozRec) toast('Te escucho. Soltá cuando termines');
}
function vozFabSoltar(e){
  vozFabAnillo(false);
  if(vozFab.t){ clearTimeout(vozFab.t); vozFab.t = null; }
  if(vozFab.espera){
    // con dedo, se espera al touchend, que es el que Safari cuenta como toque
    if(e && e.type === 'pointerup' && e.pointerType === 'touch' && ('ontouchend' in document)) return;
    vozFab.espera = false; vozFab.sujeto = false;
    if(e && e.type === 'pointercancel' || e && e.type === 'touchcancel'){ vozPintar(); toast('Tocá el micrófono de arriba para dictar'); return; }
    vozEscuchar(true);
    if(vozOyendo && vozRec) toast('Te escucho. Cuando termines, esperá un segundo o tocá el +');
    return;
  }
  if(!vozFab.sujeto) return;
  vozFab.sujeto = false;
  if(vozFab.largo && vozRec) vozParar();
}
document.addEventListener('pointerdown', function(e){
  var f = vozFabDe(e);
  vozFab.largo = false;
  if(f || (e.target.closest && !e.target.closest('#vozPista'))) vozPistaOcultar();
  if(!f || (e.button && e.button !== 0) || !vozHayMic() || vozOyendo) return;
  if(vozFab.t) clearTimeout(vozFab.t);
  vozFab.sujeto = true; vozFab.x = e.clientX; vozFab.y = e.clientY;
  f.classList.add('carga');
  vozFab.t = setTimeout(function(){ vozFab.t = null; if(vozFab.sujeto) vozFabEmpezar(); }, VOZ_LARGO);
});
document.addEventListener('pointermove', function(e){
  // si el dedo se fue para otro lado antes de tiempo, no era para dictar
  if(vozFab.t && (Math.abs(e.clientX - vozFab.x) > 14 || Math.abs(e.clientY - vozFab.y) > 14)){
    clearTimeout(vozFab.t); vozFab.t = null; vozFab.sujeto = false; vozFabAnillo(false);
  }
});
document.addEventListener('pointerup', vozFabSoltar);
document.addEventListener('pointercancel', vozFabSoltar);
// en el iPhone el permiso para el micrófono va con el touchend: por las dudas, también desde ahí
document.addEventListener('touchend', vozFabSoltar, { passive:true });
document.addEventListener('touchcancel', vozFabSoltar, { passive:true });
if(VOZ_IOS){
  var vpT = document.querySelector('#vozPista .vp-txt');
  if(vpT) vpT.innerHTML = '<b>Cargá con la voz</b>Mantené apretado el +, soltalo y decí, por ejemplo, «gasté 15 mil en el súper».';
  var vTip = document.getElementById('vozTip');
  if(vTip) vTip.innerHTML = 'Desde cualquier pantalla, mantené apretado el <b>+</b> de abajo, soltalo y dictalo.';
}
// al soltar después de mantenerlo, no cuenta como un toque
document.addEventListener('click', function(e){
  if(vozFab.largo && vozFabDe(e)){ vozFab.largo = false; e.preventDefault(); e.stopPropagation(); return; }
  // v238: en el iPhone, tocar el + mientras te escucho es "listo, terminé"
  if(VOZ_IOS && vozOyendo && vozRec && vozFabDe(e)){ e.preventDefault(); e.stopPropagation(); vozParar(); }
}, true);
document.addEventListener('contextmenu', function(e){ if(vozFabDe(e)) e.preventDefault(); });
document.addEventListener('click', function(e){ if(e.target.closest && e.target.closest('[data-vozpistaok]')) vozPistaListo(); });
