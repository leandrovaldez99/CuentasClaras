/* Cuentas Claras · js/viajes.js
   Gastos de viaje: los grupos, las cuentas del viaje y los códigos para compartir.

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

/* ============================================================
   gastos de viaje: grupos compartidos, sin cuentas y sin internet
   ============================================================
   Cada celular guarda su copia del viaje (`S.viajes`). No hay servidor: los
   datos viajan en "paquetes" de texto que se mandan por WhatsApp (o por donde
   sea) y que la app del otro suma sola. Sincronizar es juntar listas:

   · Cada gasto tiene un id único, quién lo cargó y la hora de su última
     corrección (`t`). Al juntar dos copias, de cada gasto queda la versión más
     nueva: nunca se pisan dos gastos distintos, y si dos corrigieron el mismo,
     gana la última corrección. Borrar es marcarlo (`b:1`) para que el borrado
     también viaje.
   · Un paquete lleva TODO lo que el que lo manda sabe del viaje, no sólo lo
     suyo: si Ana ya tiene lo de Juan, cuando Ana te manda lo suyo también te
     llega lo de Juan. Mandar dos veces el mismo paquete no cambia nada.
   · `vis` dice hasta cuándo tiene cada uno los datos de cada otro: así la app
     puede avisar "de Juan no tenés nada desde ayer" antes de cerrar cuentas.

   La invitación trae la clave del viaje. Los paquetes de gastos van cifrados
   con esa clave (AES-GCM): aunque pasen por un chat, sólo los abre quien tiene
   la invitación. Si el navegador no tiene cifrado ni compresión (WebView muy
   viejo), el paquete va sin ellos y lo marca en su encabezado. */
/* Generador de QR: qrcode-generator 1.4.4, (c) 2009 Kazuhiko Arase, licencia MIT.
   https://github.com/kazuhikoarase/qrcode-generator — minificado. */
var qrcode=function(){var t=function(t,r){var e=t,n=g[r],o=null,i=0,a=null,u=[],f={},c=function(t,r){o=function(t){for(var r=new Array(t),e=0;e<t;e+=1){r[e]=new Array(t);for(var n=0;n<t;n+=1)r[e][n]=null}return r}(i=4*e+17),l(0,0),l(i-7,0),l(0,i-7),s(),h(),d(t,r),e>=7&&v(t),null==a&&(a=p(e,n,u)),w(a,r)},l=function(t,r){for(var e=-1;e<=7;e+=1)if(!(t+e<=-1||i<=t+e))for(var n=-1;n<=7;n+=1)r+n<=-1||i<=r+n||(o[t+e][r+n]=0<=e&&e<=6&&(0==n||6==n)||0<=n&&n<=6&&(0==e||6==e)||2<=e&&e<=4&&2<=n&&n<=4)},h=function(){for(var t=8;t<i-8;t+=1)null==o[t][6]&&(o[t][6]=t%2==0);for(var r=8;r<i-8;r+=1)null==o[6][r]&&(o[6][r]=r%2==0)},s=function(){for(var t=B.getPatternPosition(e),r=0;r<t.length;r+=1)for(var n=0;n<t.length;n+=1){var i=t[r],a=t[n];if(null==o[i][a])for(var u=-2;u<=2;u+=1)for(var f=-2;f<=2;f+=1)o[i+u][a+f]=-2==u||2==u||-2==f||2==f||0==u&&0==f}},v=function(t){for(var r=B.getBCHTypeNumber(e),n=0;n<18;n+=1){var a=!t&&1==(r>>n&1);o[Math.floor(n/3)][n%3+i-8-3]=a}for(n=0;n<18;n+=1){a=!t&&1==(r>>n&1);o[n%3+i-8-3][Math.floor(n/3)]=a}},d=function(t,r){for(var e=n<<3|r,a=B.getBCHTypeInfo(e),u=0;u<15;u+=1){var f=!t&&1==(a>>u&1);u<6?o[u][8]=f:u<8?o[u+1][8]=f:o[i-15+u][8]=f}for(u=0;u<15;u+=1){f=!t&&1==(a>>u&1);u<8?o[8][i-u-1]=f:u<9?o[8][15-u-1+1]=f:o[8][15-u-1]=f}o[i-8][8]=!t},w=function(t,r){for(var e=-1,n=i-1,a=7,u=0,f=B.getMaskFunction(r),c=i-1;c>0;c-=2)for(6==c&&(c-=1);;){for(var g=0;g<2;g+=1)if(null==o[n][c-g]){var l=!1;u<t.length&&(l=1==(t[u]>>>a&1)),f(n,c-g)&&(l=!l),o[n][c-g]=l,-1==(a-=1)&&(u+=1,a=7)}if((n+=e)<0||i<=n){n-=e,e=-e;break}}},p=function(t,r,e){for(var n=A.getRSBlocks(t,r),o=b(),i=0;i<e.length;i+=1){var a=e[i];o.put(a.getMode(),4),o.put(a.getLength(),B.getLengthInBits(a.getMode(),t)),a.write(o)}var u=0;for(i=0;i<n.length;i+=1)u+=n[i].dataCount;if(o.getLengthInBits()>8*u)throw"code length overflow. ("+o.getLengthInBits()+">"+8*u+")";for(o.getLengthInBits()+4<=8*u&&o.put(0,4);o.getLengthInBits()%8!=0;)o.putBit(!1);for(;!(o.getLengthInBits()>=8*u||(o.put(236,8),o.getLengthInBits()>=8*u));)o.put(17,8);return function(t,r){for(var e=0,n=0,o=0,i=new Array(r.length),a=new Array(r.length),u=0;u<r.length;u+=1){var f=r[u].dataCount,c=r[u].totalCount-f;n=Math.max(n,f),o=Math.max(o,c),i[u]=new Array(f);for(var g=0;g<i[u].length;g+=1)i[u][g]=255&t.getBuffer()[g+e];e+=f;var l=B.getErrorCorrectPolynomial(c),h=k(i[u],l.getLength()-1).mod(l);for(a[u]=new Array(l.getLength()-1),g=0;g<a[u].length;g+=1){var s=g+h.getLength()-a[u].length;a[u][g]=s>=0?h.getAt(s):0}}var v=0;for(g=0;g<r.length;g+=1)v+=r[g].totalCount;var d=new Array(v),w=0;for(g=0;g<n;g+=1)for(u=0;u<r.length;u+=1)g<i[u].length&&(d[w]=i[u][g],w+=1);for(g=0;g<o;g+=1)for(u=0;u<r.length;u+=1)g<a[u].length&&(d[w]=a[u][g],w+=1);return d}(o,n)};f.addData=function(t,r){var e=null;switch(r=r||"Byte"){case"Numeric":e=M(t);break;case"Alphanumeric":e=x(t);break;case"Byte":e=m(t);break;case"Kanji":e=L(t);break;default:throw"mode:"+r}u.push(e),a=null},f.isDark=function(t,r){if(t<0||i<=t||r<0||i<=r)throw t+","+r;return o[t][r]},f.getModuleCount=function(){return i},f.make=function(){if(e<1){for(var t=1;t<40;t++){for(var r=A.getRSBlocks(t,n),o=b(),i=0;i<u.length;i++){var a=u[i];o.put(a.getMode(),4),o.put(a.getLength(),B.getLengthInBits(a.getMode(),t)),a.write(o)}var g=0;for(i=0;i<r.length;i++)g+=r[i].dataCount;if(o.getLengthInBits()<=8*g)break}e=t}c(!1,function(){for(var t=0,r=0,e=0;e<8;e+=1){c(!0,e);var n=B.getLostPoint(f);(0==e||t>n)&&(t=n,r=e)}return r}())},f.createTableTag=function(t,r){t=t||2;var e="";e+='<table style="',e+=" border-width: 0px; border-style: none;",e+=" border-collapse: collapse;",e+=" padding: 0px; margin: "+(r=void 0===r?4*t:r)+"px;",e+='">',e+="<tbody>";for(var n=0;n<f.getModuleCount();n+=1){e+="<tr>";for(var o=0;o<f.getModuleCount();o+=1)e+='<td style="',e+=" border-width: 0px; border-style: none;",e+=" border-collapse: collapse;",e+=" padding: 0px; margin: 0px;",e+=" width: "+t+"px;",e+=" height: "+t+"px;",e+=" background-color: ",e+=f.isDark(n,o)?"#000000":"#ffffff",e+=";",e+='"/>';e+="</tr>"}return e+="</tbody>",e+="</table>"},f.createSvgTag=function(t,r,e,n){var o={};"object"==typeof arguments[0]&&(t=(o=arguments[0]).cellSize,r=o.margin,e=o.alt,n=o.title),t=t||2,r=void 0===r?4*t:r,(e="string"==typeof e?{text:e}:e||{}).text=e.text||null,e.id=e.text?e.id||"qrcode-description":null,(n="string"==typeof n?{text:n}:n||{}).text=n.text||null,n.id=n.text?n.id||"qrcode-title":null;var i,a,u,c,g=f.getModuleCount()*t+2*r,l="";for(c="l"+t+",0 0,"+t+" -"+t+",0 0,-"+t+"z ",l+='<svg version="1.1" xmlns="http://www.w3.org/2000/svg"',l+=o.scalable?"":' width="'+g+'px" height="'+g+'px"',l+=' viewBox="0 0 '+g+" "+g+'" ',l+=' preserveAspectRatio="xMinYMin meet"',l+=n.text||e.text?' role="img" aria-labelledby="'+y([n.id,e.id].join(" ").trim())+'"':"",l+=">",l+=n.text?'<title id="'+y(n.id)+'">'+y(n.text)+"</title>":"",l+=e.text?'<description id="'+y(e.id)+'">'+y(e.text)+"</description>":"",l+='<rect width="100%" height="100%" fill="white" cx="0" cy="0"/>',l+='<path d="',a=0;a<f.getModuleCount();a+=1)for(u=a*t+r,i=0;i<f.getModuleCount();i+=1)f.isDark(a,i)&&(l+="M"+(i*t+r)+","+u+c);return l+='" stroke="transparent" fill="black"/>',l+="</svg>"},f.createDataURL=function(t,r){t=t||2,r=void 0===r?4*t:r;var e=f.getModuleCount()*t+2*r,n=r,o=e-r;return I(e,e,function(r,e){if(n<=r&&r<o&&n<=e&&e<o){var i=Math.floor((r-n)/t),a=Math.floor((e-n)/t);return f.isDark(a,i)?0:1}return 1})},f.createImgTag=function(t,r,e){t=t||2,r=void 0===r?4*t:r;var n=f.getModuleCount()*t+2*r,o="";return o+="<img",o+=' src="',o+=f.createDataURL(t,r),o+='"',o+=' width="',o+=n,o+='"',o+=' height="',o+=n,o+='"',e&&(o+=' alt="',o+=y(e),o+='"'),o+="/>"};var y=function(t){for(var r="",e=0;e<t.length;e+=1){var n=t.charAt(e);switch(n){case"<":r+="&lt;";break;case">":r+="&gt;";break;case"&":r+="&amp;";break;case'"':r+="&quot;";break;default:r+=n}}return r};return f.createASCII=function(t,r){if((t=t||1)<2)return function(t){t=void 0===t?2:t;var r,e,n,o,i,a=1*f.getModuleCount()+2*t,u=t,c=a-t,g={"██":"█","█ ":"▀"," █":"▄","  ":" "},l={"██":"▀","█ ":"▀"," █":" ","  ":" "},h="";for(r=0;r<a;r+=2){for(n=Math.floor((r-u)/1),o=Math.floor((r+1-u)/1),e=0;e<a;e+=1)i="█",u<=e&&e<c&&u<=r&&r<c&&f.isDark(n,Math.floor((e-u)/1))&&(i=" "),u<=e&&e<c&&u<=r+1&&r+1<c&&f.isDark(o,Math.floor((e-u)/1))?i+=" ":i+="█",h+=t<1&&r+1>=c?l[i]:g[i];h+="\n"}return a%2&&t>0?h.substring(0,h.length-a-1)+Array(a+1).join("▀"):h.substring(0,h.length-1)}(r);t-=1,r=void 0===r?2*t:r;var e,n,o,i,a=f.getModuleCount()*t+2*r,u=r,c=a-r,g=Array(t+1).join("██"),l=Array(t+1).join("  "),h="",s="";for(e=0;e<a;e+=1){for(o=Math.floor((e-u)/t),s="",n=0;n<a;n+=1)i=1,u<=n&&n<c&&u<=e&&e<c&&f.isDark(o,Math.floor((n-u)/t))&&(i=0),s+=i?g:l;for(o=0;o<t;o+=1)h+=s+"\n"}return h.substring(0,h.length-1)},f.renderTo2dContext=function(t,r){r=r||2;for(var e=f.getModuleCount(),n=0;n<e;n++)for(var o=0;o<e;o++)t.fillStyle=f.isDark(n,o)?"black":"white",t.fillRect(n*r,o*r,r,r)},f};t.stringToBytes=(t.stringToBytesFuncs={default:function(t){for(var r=[],e=0;e<t.length;e+=1){var n=t.charCodeAt(e);r.push(255&n)}return r}}).default,t.createStringToBytes=function(t,r){var e=function(){for(var e=S(t),n=function(){var t=e.read();if(-1==t)throw"eof";return t},o=0,i={};;){var a=e.read();if(-1==a)break;var u=n(),f=n()<<8|n();i[String.fromCharCode(a<<8|u)]=f,o+=1}if(o!=r)throw o+" != "+r;return i}(),n="?".charCodeAt(0);return function(t){for(var r=[],o=0;o<t.length;o+=1){var i=t.charCodeAt(o);if(i<128)r.push(i);else{var a=e[t.charAt(o)];"number"==typeof a?(255&a)==a?r.push(a):(r.push(a>>>8),r.push(255&a)):r.push(n)}}return r}};var r,e,n,o,i,a=1,u=2,f=4,c=8,g={L:1,M:0,Q:3,H:2},l=0,h=1,s=2,v=3,d=4,w=5,p=6,y=7,B=(r=[[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]],e=1335,n=7973,i=function(t){for(var r=0;0!=t;)r+=1,t>>>=1;return r},(o={}).getBCHTypeInfo=function(t){for(var r=t<<10;i(r)-i(e)>=0;)r^=e<<i(r)-i(e);return 21522^(t<<10|r)},o.getBCHTypeNumber=function(t){for(var r=t<<12;i(r)-i(n)>=0;)r^=n<<i(r)-i(n);return t<<12|r},o.getPatternPosition=function(t){return r[t-1]},o.getMaskFunction=function(t){switch(t){case l:return function(t,r){return(t+r)%2==0};case h:return function(t,r){return t%2==0};case s:return function(t,r){return r%3==0};case v:return function(t,r){return(t+r)%3==0};case d:return function(t,r){return(Math.floor(t/2)+Math.floor(r/3))%2==0};case w:return function(t,r){return t*r%2+t*r%3==0};case p:return function(t,r){return(t*r%2+t*r%3)%2==0};case y:return function(t,r){return(t*r%3+(t+r)%2)%2==0};default:throw"bad maskPattern:"+t}},o.getErrorCorrectPolynomial=function(t){for(var r=k([1],0),e=0;e<t;e+=1)r=r.multiply(k([1,C.gexp(e)],0));return r},o.getLengthInBits=function(t,r){if(1<=r&&r<10)switch(t){case a:return 10;case u:return 9;case f:case c:return 8;default:throw"mode:"+t}else if(r<27)switch(t){case a:return 12;case u:return 11;case f:return 16;case c:return 10;default:throw"mode:"+t}else{if(!(r<41))throw"type:"+r;switch(t){case a:return 14;case u:return 13;case f:return 16;case c:return 12;default:throw"mode:"+t}}},o.getLostPoint=function(t){for(var r=t.getModuleCount(),e=0,n=0;n<r;n+=1)for(var o=0;o<r;o+=1){for(var i=0,a=t.isDark(n,o),u=-1;u<=1;u+=1)if(!(n+u<0||r<=n+u))for(var f=-1;f<=1;f+=1)o+f<0||r<=o+f||0==u&&0==f||a==t.isDark(n+u,o+f)&&(i+=1);i>5&&(e+=3+i-5)}for(n=0;n<r-1;n+=1)for(o=0;o<r-1;o+=1){var c=0;t.isDark(n,o)&&(c+=1),t.isDark(n+1,o)&&(c+=1),t.isDark(n,o+1)&&(c+=1),t.isDark(n+1,o+1)&&(c+=1),0!=c&&4!=c||(e+=3)}for(n=0;n<r;n+=1)for(o=0;o<r-6;o+=1)t.isDark(n,o)&&!t.isDark(n,o+1)&&t.isDark(n,o+2)&&t.isDark(n,o+3)&&t.isDark(n,o+4)&&!t.isDark(n,o+5)&&t.isDark(n,o+6)&&(e+=40);for(o=0;o<r;o+=1)for(n=0;n<r-6;n+=1)t.isDark(n,o)&&!t.isDark(n+1,o)&&t.isDark(n+2,o)&&t.isDark(n+3,o)&&t.isDark(n+4,o)&&!t.isDark(n+5,o)&&t.isDark(n+6,o)&&(e+=40);var g=0;for(o=0;o<r;o+=1)for(n=0;n<r;n+=1)t.isDark(n,o)&&(g+=1);return e+=Math.abs(100*g/r/r-50)/5*10},o),C=function(){for(var t=new Array(256),r=new Array(256),e=0;e<8;e+=1)t[e]=1<<e;for(e=8;e<256;e+=1)t[e]=t[e-4]^t[e-5]^t[e-6]^t[e-8];for(e=0;e<255;e+=1)r[t[e]]=e;var n={glog:function(t){if(t<1)throw"glog("+t+")";return r[t]},gexp:function(r){for(;r<0;)r+=255;for(;r>=256;)r-=255;return t[r]}};return n}();function k(t,r){if(void 0===t.length)throw t.length+"/"+r;var e=function(){for(var e=0;e<t.length&&0==t[e];)e+=1;for(var n=new Array(t.length-e+r),o=0;o<t.length-e;o+=1)n[o]=t[o+e];return n}(),n={getAt:function(t){return e[t]},getLength:function(){return e.length},multiply:function(t){for(var r=new Array(n.getLength()+t.getLength()-1),e=0;e<n.getLength();e+=1)for(var o=0;o<t.getLength();o+=1)r[e+o]^=C.gexp(C.glog(n.getAt(e))+C.glog(t.getAt(o)));return k(r,0)},mod:function(t){if(n.getLength()-t.getLength()<0)return n;for(var r=C.glog(n.getAt(0))-C.glog(t.getAt(0)),e=new Array(n.getLength()),o=0;o<n.getLength();o+=1)e[o]=n.getAt(o);for(o=0;o<t.getLength();o+=1)e[o]^=C.gexp(C.glog(t.getAt(o))+r);return k(e,0).mod(t)}};return n}var A=function(){var t=[[1,26,19],[1,26,16],[1,26,13],[1,26,9],[1,44,34],[1,44,28],[1,44,22],[1,44,16],[1,70,55],[1,70,44],[2,35,17],[2,35,13],[1,100,80],[2,50,32],[2,50,24],[4,25,9],[1,134,108],[2,67,43],[2,33,15,2,34,16],[2,33,11,2,34,12],[2,86,68],[4,43,27],[4,43,19],[4,43,15],[2,98,78],[4,49,31],[2,32,14,4,33,15],[4,39,13,1,40,14],[2,121,97],[2,60,38,2,61,39],[4,40,18,2,41,19],[4,40,14,2,41,15],[2,146,116],[3,58,36,2,59,37],[4,36,16,4,37,17],[4,36,12,4,37,13],[2,86,68,2,87,69],[4,69,43,1,70,44],[6,43,19,2,44,20],[6,43,15,2,44,16],[4,101,81],[1,80,50,4,81,51],[4,50,22,4,51,23],[3,36,12,8,37,13],[2,116,92,2,117,93],[6,58,36,2,59,37],[4,46,20,6,47,21],[7,42,14,4,43,15],[4,133,107],[8,59,37,1,60,38],[8,44,20,4,45,21],[12,33,11,4,34,12],[3,145,115,1,146,116],[4,64,40,5,65,41],[11,36,16,5,37,17],[11,36,12,5,37,13],[5,109,87,1,110,88],[5,65,41,5,66,42],[5,54,24,7,55,25],[11,36,12,7,37,13],[5,122,98,1,123,99],[7,73,45,3,74,46],[15,43,19,2,44,20],[3,45,15,13,46,16],[1,135,107,5,136,108],[10,74,46,1,75,47],[1,50,22,15,51,23],[2,42,14,17,43,15],[5,150,120,1,151,121],[9,69,43,4,70,44],[17,50,22,1,51,23],[2,42,14,19,43,15],[3,141,113,4,142,114],[3,70,44,11,71,45],[17,47,21,4,48,22],[9,39,13,16,40,14],[3,135,107,5,136,108],[3,67,41,13,68,42],[15,54,24,5,55,25],[15,43,15,10,44,16],[4,144,116,4,145,117],[17,68,42],[17,50,22,6,51,23],[19,46,16,6,47,17],[2,139,111,7,140,112],[17,74,46],[7,54,24,16,55,25],[34,37,13],[4,151,121,5,152,122],[4,75,47,14,76,48],[11,54,24,14,55,25],[16,45,15,14,46,16],[6,147,117,4,148,118],[6,73,45,14,74,46],[11,54,24,16,55,25],[30,46,16,2,47,17],[8,132,106,4,133,107],[8,75,47,13,76,48],[7,54,24,22,55,25],[22,45,15,13,46,16],[10,142,114,2,143,115],[19,74,46,4,75,47],[28,50,22,6,51,23],[33,46,16,4,47,17],[8,152,122,4,153,123],[22,73,45,3,74,46],[8,53,23,26,54,24],[12,45,15,28,46,16],[3,147,117,10,148,118],[3,73,45,23,74,46],[4,54,24,31,55,25],[11,45,15,31,46,16],[7,146,116,7,147,117],[21,73,45,7,74,46],[1,53,23,37,54,24],[19,45,15,26,46,16],[5,145,115,10,146,116],[19,75,47,10,76,48],[15,54,24,25,55,25],[23,45,15,25,46,16],[13,145,115,3,146,116],[2,74,46,29,75,47],[42,54,24,1,55,25],[23,45,15,28,46,16],[17,145,115],[10,74,46,23,75,47],[10,54,24,35,55,25],[19,45,15,35,46,16],[17,145,115,1,146,116],[14,74,46,21,75,47],[29,54,24,19,55,25],[11,45,15,46,46,16],[13,145,115,6,146,116],[14,74,46,23,75,47],[44,54,24,7,55,25],[59,46,16,1,47,17],[12,151,121,7,152,122],[12,75,47,26,76,48],[39,54,24,14,55,25],[22,45,15,41,46,16],[6,151,121,14,152,122],[6,75,47,34,76,48],[46,54,24,10,55,25],[2,45,15,64,46,16],[17,152,122,4,153,123],[29,74,46,14,75,47],[49,54,24,10,55,25],[24,45,15,46,46,16],[4,152,122,18,153,123],[13,74,46,32,75,47],[48,54,24,14,55,25],[42,45,15,32,46,16],[20,147,117,4,148,118],[40,75,47,7,76,48],[43,54,24,22,55,25],[10,45,15,67,46,16],[19,148,118,6,149,119],[18,75,47,31,76,48],[34,54,24,34,55,25],[20,45,15,61,46,16]],r=function(t,r){var e={};return e.totalCount=t,e.dataCount=r,e},e={};return e.getRSBlocks=function(e,n){var o=function(r,e){switch(e){case g.L:return t[4*(r-1)+0];case g.M:return t[4*(r-1)+1];case g.Q:return t[4*(r-1)+2];case g.H:return t[4*(r-1)+3];default:return}}(e,n);if(void 0===o)throw"bad rs block @ typeNumber:"+e+"/errorCorrectionLevel:"+n;for(var i=o.length/3,a=[],u=0;u<i;u+=1)for(var f=o[3*u+0],c=o[3*u+1],l=o[3*u+2],h=0;h<f;h+=1)a.push(r(c,l));return a},e}(),b=function(){var t=[],r=0,e={getBuffer:function(){return t},getAt:function(r){var e=Math.floor(r/8);return 1==(t[e]>>>7-r%8&1)},put:function(t,r){for(var n=0;n<r;n+=1)e.putBit(1==(t>>>r-n-1&1))},getLengthInBits:function(){return r},putBit:function(e){var n=Math.floor(r/8);t.length<=n&&t.push(0),e&&(t[n]|=128>>>r%8),r+=1}};return e},M=function(t){var r=a,e=t,n={getMode:function(){return r},getLength:function(t){return e.length},write:function(t){for(var r=e,n=0;n+2<r.length;)t.put(o(r.substring(n,n+3)),10),n+=3;n<r.length&&(r.length-n==1?t.put(o(r.substring(n,n+1)),4):r.length-n==2&&t.put(o(r.substring(n,n+2)),7))}},o=function(t){for(var r=0,e=0;e<t.length;e+=1)r=10*r+i(t.charAt(e));return r},i=function(t){if("0"<=t&&t<="9")return t.charCodeAt(0)-"0".charCodeAt(0);throw"illegal char :"+t};return n},x=function(t){var r=u,e=t,n={getMode:function(){return r},getLength:function(t){return e.length},write:function(t){for(var r=e,n=0;n+1<r.length;)t.put(45*o(r.charAt(n))+o(r.charAt(n+1)),11),n+=2;n<r.length&&t.put(o(r.charAt(n)),6)}},o=function(t){if("0"<=t&&t<="9")return t.charCodeAt(0)-"0".charCodeAt(0);if("A"<=t&&t<="Z")return t.charCodeAt(0)-"A".charCodeAt(0)+10;switch(t){case" ":return 36;case"$":return 37;case"%":return 38;case"*":return 39;case"+":return 40;case"-":return 41;case".":return 42;case"/":return 43;case":":return 44;default:throw"illegal char :"+t}};return n},m=function(r){var e=f,n=t.stringToBytes(r),o={getMode:function(){return e},getLength:function(t){return n.length},write:function(t){for(var r=0;r<n.length;r+=1)t.put(n[r],8)}};return o},L=function(r){var e=c,n=t.stringToBytesFuncs.SJIS;if(!n)throw"sjis not supported.";!function(){var t=n("友");if(2!=t.length||38726!=(t[0]<<8|t[1]))throw"sjis not supported."}();var o=n(r),i={getMode:function(){return e},getLength:function(t){return~~(o.length/2)},write:function(t){for(var r=o,e=0;e+1<r.length;){var n=(255&r[e])<<8|255&r[e+1];if(33088<=n&&n<=40956)n-=33088;else{if(!(57408<=n&&n<=60351))throw"illegal char at "+(e+1)+"/"+n;n-=49472}n=192*(n>>>8&255)+(255&n),t.put(n,13),e+=2}if(e<r.length)throw"illegal char at "+(e+1)}};return i},D=function(){var t=[],r={writeByte:function(r){t.push(255&r)},writeShort:function(t){r.writeByte(t),r.writeByte(t>>>8)},writeBytes:function(t,e,n){e=e||0,n=n||t.length;for(var o=0;o<n;o+=1)r.writeByte(t[o+e])},writeString:function(t){for(var e=0;e<t.length;e+=1)r.writeByte(t.charCodeAt(e))},toByteArray:function(){return t},toString:function(){var r="";r+="[";for(var e=0;e<t.length;e+=1)e>0&&(r+=","),r+=t[e];return r+="]"}};return r},S=function(t){var r=t,e=0,n=0,o=0,i={read:function(){for(;o<8;){if(e>=r.length){if(0==o)return-1;throw"unexpected end of file./"+o}var t=r.charAt(e);if(e+=1,"="==t)return o=0,-1;t.match(/^\s$/)||(n=n<<6|a(t.charCodeAt(0)),o+=6)}var i=n>>>o-8&255;return o-=8,i}},a=function(t){if(65<=t&&t<=90)return t-65;if(97<=t&&t<=122)return t-97+26;if(48<=t&&t<=57)return t-48+52;if(43==t)return 62;if(47==t)return 63;throw"c:"+t};return i},I=function(t,r,e){for(var n=function(t,r){var e=t,n=r,o=new Array(t*r),i={setPixel:function(t,r,n){o[r*e+t]=n},write:function(t){t.writeString("GIF87a"),t.writeShort(e),t.writeShort(n),t.writeByte(128),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(0),t.writeByte(255),t.writeByte(255),t.writeByte(255),t.writeString(","),t.writeShort(0),t.writeShort(0),t.writeShort(e),t.writeShort(n),t.writeByte(0);var r=a(2);t.writeByte(2);for(var o=0;r.length-o>255;)t.writeByte(255),t.writeBytes(r,o,255),o+=255;t.writeByte(r.length-o),t.writeBytes(r,o,r.length-o),t.writeByte(0),t.writeString(";")}},a=function(t){for(var r=1<<t,e=1+(1<<t),n=t+1,i=u(),a=0;a<r;a+=1)i.add(String.fromCharCode(a));i.add(String.fromCharCode(r)),i.add(String.fromCharCode(e));var f,c,g,l=D(),h=(f=l,c=0,g=0,{write:function(t,r){if(t>>>r!=0)throw"length over";for(;c+r>=8;)f.writeByte(255&(t<<c|g)),r-=8-c,t>>>=8-c,g=0,c=0;g|=t<<c,c+=r},flush:function(){c>0&&f.writeByte(g)}});h.write(r,n);var s=0,v=String.fromCharCode(o[s]);for(s+=1;s<o.length;){var d=String.fromCharCode(o[s]);s+=1,i.contains(v+d)?v+=d:(h.write(i.indexOf(v),n),i.size()<4095&&(i.size()==1<<n&&(n+=1),i.add(v+d)),v=d)}return h.write(i.indexOf(v),n),h.write(e,n),h.flush(),l.toByteArray()},u=function(){var t={},r=0,e={add:function(n){if(e.contains(n))throw"dup key:"+n;t[n]=r,r+=1},size:function(){return r},indexOf:function(r){return t[r]},contains:function(r){return void 0!==t[r]}};return e};return i}(t,r),o=0;o<r;o+=1)for(var i=0;i<t;i+=1)n.setPixel(i,o,e(i,o));var a=D();n.write(a);for(var u=function(){var t=0,r=0,e=0,n="",o={},i=function(t){n+=String.fromCharCode(a(63&t))},a=function(t){if(t<0);else{if(t<26)return 65+t;if(t<52)return t-26+97;if(t<62)return t-52+48;if(62==t)return 43;if(63==t)return 47}throw"n:"+t};return o.writeByte=function(n){for(t=t<<8|255&n,r+=8,e+=1;r>=6;)i(t>>>r-6),r-=6},o.flush=function(){if(r>0&&(i(t<<6-r),t=0,r=0),e%3!=0)for(var o=3-e%3,a=0;a<o;a+=1)n+="="},o.toString=function(){return n},o}(),f=a.toByteArray(),c=0;c<f.length;c+=1)u.writeByte(f[c]);return u.flush(),"data:image/gif;base64,"+u};return t}();qrcode.stringToBytesFuncs["UTF-8"]=function(t){return function(t){for(var r=[],e=0;e<t.length;e++){var n=t.charCodeAt(e);n<128?r.push(n):n<2048?r.push(192|n>>6,128|63&n):n<55296||n>=57344?r.push(224|n>>12,128|n>>6&63,128|63&n):(e++,n=65536+((1023&n)<<10|1023&t.charCodeAt(e)),r.push(240|n>>18,128|n>>12&63,128|n>>6&63,128|63&n))}return r}(t)},function(t){"function"==typeof define&&define.amd?define([],t):"object"==typeof exports&&(module.exports=t())}(function(){return qrcode});

var VJ_URL = 'https://cuentasclarasfinanzas.netlify.app/';
var VJ_MAX_GASTOS = 800, VJ_MAX_MIEMBROS = 30;
var viajeSel = null, vjEdit = null, vjEntre = null, vjBorrar = null, vjCompartir = null;
/* vjEntreAuto: el gasto se divide entre los que estaban ese día (y se acomoda
   solo si alguien cambia desde cuándo está). Tocar un nombre lo vuelve a mano. */
/* vjForm: fecha, hora y noches del gasto que se está cargando. Vive fuera del
   DOM para que un redibujo (llega algo de otro celular) no los pise. */
var vjEntreAuto = true, vjForm = null, vjMiembroEdit = null, vjDesdeUI = null;

function vjLimpio(v){
  if(!v || typeof v !== 'object' || typeof v.id !== 'string' || !v.id) return null;
  var out = { id:v.id.slice(0,24), nombre:String(v.nombre||'Viaje').slice(0,40),
              clave:(typeof v.clave === 'string' ? v.clave.slice(0,64) : ''),
              yo:(typeof v.yo === 'string' ? v.yo.slice(0,24) : ''),
              creado:Number(v.creado)||0, miembros:[], gastos:[], vis:{}, cargado:null };
  (Array.isArray(v.miembros) ? v.miembros : []).forEach(function(m){
    if(!m || typeof m.i !== 'string' || !m.i || out.miembros.length >= VJ_MAX_MIEMBROS) return;
    if(out.miembros.some(function(x){ return x.i === m.i; })) return;
    out.miembros.push({ i:m.i.slice(0,24), n:String(m.n||'?').trim().slice(0,28) || '?', d:vjFechaOk(m.d), h:vjHoraOk(m.h), t:Number(m.t)||0,
                        ok:Number(m.ok)||0, okt:Number(m.okt)||0 });
  });
  (Array.isArray(v.gastos) ? v.gastos : []).forEach(function(g){ var c = vjGastoLimpio(g); if(c) out.gastos.push(c); });
  out.gastos = out.gastos.slice(-VJ_MAX_GASTOS);
  if(v.vis && typeof v.vis === 'object') Object.keys(v.vis).forEach(function(k){ var n = Number(v.vis[k]); if(n > 0) out.vis[k.slice(0,24)] = n; });
  if(v.cargado && typeof v.cargado === 'object') out.cargado = { monto:Number(v.cargado.monto)||0, fecha:String(v.cargado.fecha||'').slice(0,10), medio:String(v.cargado.medio||'').slice(0,28) };
  // qué fue lo último que este celular dejó en los relays (ver "sincronización automática")
  out.sync = (v.sync && typeof v.sync === 'object') ? { pub:String(v.sync.pub||'').slice(0,40), at:Number(v.sync.at)||0 } : null;
  out.cierre = vjCierreLimpio(v.cierre);
  var mo = vjMonsLimpio(v.mons); if(mo) out.mons = mo;
  return out;
}
/* ---- terminar el viaje ----
   Cada uno confirma "ya cargué todo lo mío" (`ok` en su renglón de la gente,
   con su propia hora `okt`, que se junta aparte del nombre y la fecha para que
   un cambio no pise al otro). Cuando confirmaron todos, el viaje se cierra
   solo. El cierre (`cierre`) no lo decide nadie: cada celular lo calcula igual
   con los mismos datos (la hora es la de la última confirmación), así que
   nunca hay dos cierres distintos. Se puede cerrar sin alguno (queda anotado
   quién faltaba en `f`) y reabrir durante 30 días: `e` dice si está cerrado y
   `t` cuándo fue el último cambio, y gana el más nuevo. Pasados los 30 días,
   el viaje se archiva: sale de los datos de todos los días y queda en el
   historial como un texto comprimido que se abre sólo si lo mirás. */
var VJ_REABRIR = 30 * 864e5;
var vjArchVista = null;          // el viaje archivado que estás mirando (no vive en S.viajes)
function vjCierreLimpio(c){
  if(!c || typeof c !== 'object' || !(Number(c.t) > 0)) return null;
  return { e:c.e ? 1 : 0, t:Number(c.t), por:String(c.por||'').slice(0,24),
           f:(Array.isArray(c.f) ? c.f : []).filter(function(x){ return typeof x === 'string' && x; }).slice(0,30).map(function(x){ return x.slice(0,24); }) };
}
function vjCerrado(v){ return !!(v && v.cierre && v.cierre.e === 1); }
function vjReabrible(v){ return vjCerrado(v) && !v.arch && Date.now() < v.cierre.t + VJ_REABRIR; }
function vjListo(m){ return !!(m && m.ok > 0); }
/* Si confirmaron todos (y nadie lo reabrió después), el viaje se cierra. */
function vjAutoCierre(v){
  if(!v.miembros.length || !v.miembros.every(vjListo)) return false;
  var tmax = 0, por = '';
  v.miembros.forEach(function(m){ var t = m.okt || m.ok; if(t > tmax || (t === tmax && m.i > por)){ tmax = t; por = m.i; } });
  if(v.cierre && v.cierre.t >= tmax) return false;
  v.cierre = { e:1, t:tmax, por:por, f:[] };
  return true;
}
/* Cambiaste algo del viaje: tu "ya cargué todo" deja de valer. */
function vjSinMi(v){
  var yo = vjMiembro(v, v.yo); if(!vjListo(yo)) return false;
  yo.ok = 0; yo.okt = Math.max(Date.now(), (yo.okt || 0) + 1);
  return true;
}
function vjDiaDe(ms){ var d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()); }
function vjHistLimpio(h){
  if(!h || typeof h.id !== 'string' || !h.id) return null;
  return { id:h.id.slice(0,24), n:String(h.n||'Viaje').slice(0,40), c:Number(h.c)||0, d:vjFechaOk(h.d), h:vjFechaOk(h.h),
           p:Math.max(0, Math.round(Number(h.p)||0)), tot:Number(h.tot)||0, mia:Number(h.mia)||0, car:Number(h.car)||0,
           g:Math.max(0, Math.round(Number(h.g)||0)) };
}
function vjResumen(v){
  var c = vjCuentas(v), d = '', h = '', vivos = vjVivos(v);
  vivos.forEach(function(g){ if(!d || g.f < d) d = g.f; var fin = g.f2 || g.f; if(fin > h) h = fin; });
  return vjHistLimpio({ id:v.id, n:v.nombre, c:v.cierre ? v.cierre.t : Date.now(), d:d, h:h, p:v.miembros.length,
    tot:Math.round(c.total*100)/100, mia:Math.round((c.toca[v.yo]||0)*100)/100, car:v.cargado ? v.cargado.monto : 0, g:vivos.length });
}
/* El viaje entero a un texto (comprimido si se puede) y de vuelta. */
function vjEmpaquetar(v){
  var o = JSON.parse(JSON.stringify(v)); delete o.sync; delete o.arch;
  var txt = JSON.stringify(o);
  var z = vjHayZip() ? vjComprimir(vjBytes(txt)).then(function(b){ return 'z.' + b64u(b); }) : Promise.resolve('');
  return z.catch(function(){ return ''; }).then(function(r){ return r || ('j.' + txt); });
}
function vjDesempaquetar(s){
  if(typeof s !== 'string') return Promise.reject(new Error('falta'));
  var p = s.slice(0,2) === 'z.' ? vjDescomprimir(deB64u(s.slice(2))).then(vjTexto) : Promise.resolve(s.slice(2));
  return p.then(function(t){ var v = vjLimpio(JSON.parse(t)); if(!v) throw new Error('roto'); v.arch = true; return v; });
}
function vjArchivar(v){
  return vjEmpaquetar(v).then(function(txt){
    S.vjArch = S.vjArch || {}; S.vjHist = S.vjHist || [];
    S.vjArch[v.id] = txt;
    S.vjHist = S.vjHist.filter(function(h){ return h.id !== v.id; });
    S.vjHist.push(vjResumen(v));
    S.viajes = (S.viajes || []).filter(function(x){ return x.id !== v.id; });
  });
}
var vjArchivando = false;
function vjArchivarViejos(){
  if(vjArchivando) return;
  var viejos = (S.viajes || []).filter(function(v){ return vjCerrado(v) && Date.now() >= v.cierre.t + VJ_REABRIR; });
  if(!viejos.length) return;
  vjArchivando = true;
  viejos.reduce(function(p, v){ return p.then(function(){ return vjArchivar(v); }); }, Promise.resolve())
  .then(function(){
    vjArchivando = false;
    if(viajeSel && !viajePorId(viajeSel)) viajeSel = null;
    save();
    if(vista === 'viaje') renderViaje();
  }, function(){ vjArchivando = false; });
}
/* Abre un viaje del historial: si está archivado, recién ahí se lee. */
function vjAbrirHist(id){
  if(viajePorId(id) && !(vjArchVista && vjArchVista.id === id)){ vjArchVista = null; viajeSel = id; vjReset(); renderViaje(); window.scrollTo(0,0); return; }
  var txt = (S.vjArch || {})[id];
  if(!txt){ toast('No encontré ese viaje'); return; }
  vjDesempaquetar(txt).then(function(v){
    vjArchVista = v; viajeSel = id; vjReset(); go('viaje'); renderViaje(); window.scrollTo(0,0);
  }).catch(function(){ toast('No pude abrir ese viaje'); });
}
function vjFechaOk(f){ return (typeof f === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(f)) ? f : ''; }
function vjHoraOk(h){ return (typeof h === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(h)) ? h : ''; }
function ahoraHM(){ var d = new Date(); return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
/* ¿Estaba esta persona en ese momento? Los que están desde el principio,
   siempre. Los que llegaron otro día, según el día. Si llegó ESE día, cuenta la
   hora: un gasto de las 13 no le toca a quien se sumó a las 15. Si a alguna de
   las dos cosas le falta la hora, vale el día entero. */
function vjEstaba(m, f, h){
  if(!m) return false;
  if(!m.d || m.d < f) return true;
  if(m.d > f) return false;
  return !m.h || !h || m.h <= h;
}
function vjPresentes(v, f, h){ return v.miembros.filter(function(m){ return vjEstaba(m, f, h || ''); }).map(function(m){ return m.i; }); }
/* Las noches de un gasto por varias noches: desde la entrada hasta el día antes
   de la salida (entrada el sábado y salida el sábado siguiente son 7 noches). */
function vjNoches(f, f2){
  var out = [], d = f, k = 0;
  if(!f || !f2) return out;
  while(d < f2 && k++ < 62){ out.push(d); d = sumarDias(d, 1); }
  return out;
}
/* Cuánto le toca a cada uno de un gasto: { idPersona: monto }.
   · Un gasto común se divide en partes iguales (ver vjEntreDe).
   · Uno por varias noches (la cabaña de la semana) se parte en noches, y cada
     noche se divide entre los que dormían ahí: si Fede llegó el martes, las
     noches de sábado a lunes se las reparten los otros, y desde el martes entra
     él también. Si el gasto se eligió a mano, sólo cuentan los elegidos (y
     siempre desde que llegaron). */
function vjPartes(v, g){
  var out = {};
  if(!(g.mo > 0)) return out;
  if(g.f2 && g.f2 > g.f){
    var base = g.a ? v.miembros.map(function(m){ return m.i; }) : g.e.filter(function(x){ return vjMiembro(v, x); });
    var noches = vjNoches(g.f, g.f2), cada = g.mo / noches.length;
    noches.forEach(function(D){
      var ahi = base.filter(function(x){ return vjEstaba(vjMiembro(v, x), D, ''); });
      if(!ahi.length) ahi = base.length ? base : (vjMiembro(v, g.pag) ? [g.pag] : []);
      ahi.forEach(function(x){ out[x] = (out[x] || 0) + cada / ahi.length; });
    });
    return out;
  }
  var entre = vjEntreDe(v, g);
  entre.forEach(function(x){ out[x] = (out[x] || 0) + g.mo / entre.length; });
  return out;
}
/* Entre quiénes se divide un gasto. Uno "automático" (a:1) se divide entre los
   que estaban ese día, calculado cada vez: si alguien corrige desde cuándo
   está, las cuentas se acomodan solas. Uno elegido a mano usa su lista. */
function vjEntreDe(v, g){
  if(g.a){ var p = vjPresentes(v, g.f, g.h); return p.length ? p : (vjMiembro(v, g.pag) ? [g.pag] : []); }
  return g.e.filter(function(x){ return vjMiembro(v, x); });
}
function vjGastoLimpio(g){
  if(!g || typeof g.i !== 'string' || !g.i) return null;
  var e = Array.isArray(g.e) ? g.e.filter(function(x){ return typeof x === 'string' && x; }).map(function(x){ return x.slice(0,24); }) : [];
  var r = { i:g.i.slice(0,24), por:String(g.por||'').slice(0,24), pag:String(g.pag||'').slice(0,24),
           mo:Math.max(0, Math.round((Number(g.mo)||0)*100)/100), d:String(g.d||'').slice(0,60),
           c:String(g.c||'').slice(0,28), f:(/^\d{4}-\d{2}-\d{2}$/.test(g.f) ? g.f : today()),
           e:e, t:Number(g.t)||0, b:g.b ? 1 : 0, a:g.a ? 1 : 0, h:vjHoraOk(g.h),
           f2:(vjFechaOk(g.f2) && g.f2 > g.f) ? g.f2 : '' };
  /* v202: un gasto en dólares. `mo` sigue siendo en pesos (así lo entiende
     también una versión vieja de la app que esté en el grupo); `mu` es lo que
     se pagó en dólares y `cot`, el dólar con que se pasó a pesos. */
  var mu = Math.round((Number(g.mu)||0)*100)/100, cot = Number(g.cot)||0;
  if(mu > 0 && cot > 0){ r.mu = mu; r.cot = Math.round(cot*10000)/10000; r.mm = VJ_MONS.indexOf(g.mm) > -1 ? g.mm : 'USD'; }
  return r;
}
/* v207: las monedas de cada viaje. Al crearlo se marcan las que van a usar
   (además del peso) y cualquiera del grupo puede cambiarlas: `v.mons` =
   { l:['BRL'], t:cuándo }, y gana el cambio más nuevo. Un viaje de antes no
   tiene `mons`: queda con pesos y dólares, como hasta v206. En un gasto, `mu` es
   lo que se pagó en esa moneda, `mm` cuál (USD si no dice) y `cot` a cuánto. */
var VJ_MONS = ['USD', 'EUR', 'BRL', 'CLP', 'UYU'];
function vjMonsLimpio(m){
  if(!m || typeof m !== 'object' || !Array.isArray(m.l)) return null;
  return { l:VJ_MONS.filter(function(c){ return m.l.indexOf(c) > -1; }), t:Number(m.t)||0 };
}
function vjMonedas(v){ return (v && v.mons) ? v.mons.l : ['USD']; }
function vjMonNombre(c){ return c === 'USD' ? 'Dólar' : ((monedaDef(c) || {}).n || c); }
function vjMonSim(c){ return c === 'USD' ? 'U$S' : ((monedaDef(c) || {}).sim || c); }
function vjFmt(n, c){ return (!c || c === 'USD') ? usd(n) : enOtra(n, vjMonSim(c)); }
function vjCotDe(c){
  if(c === 'USD') return cotDolar();
  var t = ((S.dolar && S.dolar.otras) || {})[c];
  return (t && t.venta > 0) ? t.venta : 0;
}
function vjFaltaCot(c){
  if(c === 'USD'){ cotParaGuardar(); return; }
  toast('Falta la cotización del ' + vjMonNombre(c).toLowerCase() + ': se baja sola con internet, o escribila en el conversor', { texto:'Llevame ahí', ir:'conv' });
}
function vjMonSegHtml(v){
  var F = vjForm || { mon:'ARS' };
  return ['ARS'].concat(vjMonedas(v)).map(function(c){
    return '<button type="button" data-vjmon="' + c + '" aria-pressed="' + (F.mon === c) + '">' + (c === 'ARS' ? '$' : esc(vjMonSim(c))) + '</button>';
  }).join('');
}
function vjMonChipsHtml(v){
  var l = vjMonedas(v);
  return VJ_MONS.map(function(c){
    return '<button type="button" data-vjmonsel="' + c + '" aria-pressed="' + (l.indexOf(c) > -1) + '">' + esc(vjMonNombre(c)) + '</button>';
  }).join('');
}
var vjNuevoMons = [];
function viajePorId(id){
  var r = null; (S.viajes||[]).forEach(function(v){ if(v.id === id) r = v; });
  if(!r && vjArchVista && vjArchVista.id === id) r = vjArchVista;
  return r;
}
function vjMiembro(v, id){ var r = null; v.miembros.forEach(function(m){ if(m.i === id) r = m; }); return r; }
function vjNombre(v, id){ var m = vjMiembro(v, id); return m ? m.n : '¿?'; }
function vjVivos(v){ return v.gastos.filter(function(g){ return !g.b; }); }
function vjIdCorto(){ return (uid() + uid()).replace(/[^a-z0-9]/gi,'').slice(0,12); }

/* ---- las cuentas del viaje ---- */
function vjCuentas(v){
  var puso = {}, toca = {}, total = 0;
  v.miembros.forEach(function(m){ puso[m.i] = 0; toca[m.i] = 0; });
  vjVivos(v).forEach(function(g){
    var p = vjPartes(v, g), ks = Object.keys(p);
    if(!ks.length) return;
    total += g.mo;
    puso[g.pag] = (puso[g.pag]||0) + g.mo;
    ks.forEach(function(x){ toca[x] = (toca[x]||0) + p[x]; });
  });
  // quién le pasa a quién: siempre el que más debe al que más tiene que cobrar,
  // así salen las menos transferencias posibles
  var deben = [], cobran = [];
  v.miembros.forEach(function(m){
    var d = Math.round(((puso[m.i]||0) - (toca[m.i]||0)) * 100) / 100;
    if(d < -0.009) deben.push({ i:m.i, m:-d }); else if(d > 0.009) cobran.push({ i:m.i, m:d });
  });
  deben.sort(function(a,b){ return b.m - a.m; }); cobran.sort(function(a,b){ return b.m - a.m; });
  var pases = [], a = 0, b = 0, vueltas = 0;
  while(a < deben.length && b < cobran.length && vueltas++ < 500){
    var x = Math.min(deben[a].m, cobran[b].m);
    if(x > 0.009) pases.push({ de:deben[a].i, a:cobran[b].i, monto:Math.round(x*100)/100 });
    deben[a].m -= x; cobran[b].m -= x;
    if(deben[a].m <= 0.009) a++;
    if(cobran[b].m <= 0.009) b++;
  }
  return { puso:puso, toca:toca, total:total, pases:pases };
}
/* Lo que me tocó, por categoría: es lo que entra a mis gastos. */
function vjMiParte(v){
  var por = {};
  vjVivos(v).forEach(function(g){
    var mia = vjPartes(v, g)[v.yo] || 0;
    if(!(mia > 0)) return;
    var c = (g.c && S.catGasto.indexOf(g.c) > -1) ? g.c : (S.catGasto.indexOf('Ocio') > -1 ? 'Ocio' : 'Otros');
    por[c] = (por[c]||0) + mia;
  });
  return por;
}

/* ---- paquetes: armar y abrir ---- */
function b64u(bytes){
  var s = ''; for(var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
function deB64u(t){
  t = String(t).replace(/-/g,'+').replace(/_/g,'/'); while(t.length % 4) t += '=';
  var s = atob(t), out = new Uint8Array(s.length);
  for(var i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}
function vjTexto(b){ return new TextDecoder().decode(b); }
function vjBytes(s){ return new TextEncoder().encode(s); }
function vjHayZip(){ return typeof CompressionStream === 'function' && typeof DecompressionStream === 'function'; }
function vjHayCifra(){ return !!(window.crypto && crypto.subtle && crypto.getRandomValues); }
function vjPasar(bytes, stream){
  return new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer().then(function(ab){ return new Uint8Array(ab); });
}
function vjComprimir(b){ return vjPasar(b, new CompressionStream('deflate-raw')); }
function vjDescomprimir(b){ return vjPasar(b, new DecompressionStream('deflate-raw')); }
function vjClave(v, uso){
  return crypto.subtle.importKey('raw', deB64u(v.clave), { name:'AES-GCM' }, false, [uso]);
}
/* Lo que el paquete lleva: todo lo que sé del viaje. */
function vjContenido(v, conClave, parte){
  var ahora = Date.now();
  if(v.yo) v.vis[v.yo] = ahora;
  var o = { v:1, g:v.id, n:v.nombre, de:v.yo || '', ts:ahora, m:v.miembros, x:v.gastos, vis:v.vis };
  if(v.cierre) o.c = v.cierre;
  if(v.mons) o.mo = v.mons;
  if(conClave) o.k = v.clave;
  /* Para el QR el paquete tiene que ser chico, así que puede ir recortado:
     sin gastos (una invitación que sólo trae el grupo) o sólo con los que
     cargué yo. Un paquete recortado (`p`) no puede decir "tengo todo lo de
     fulano hasta tal hora": sólo responde por lo que trae. */
  if(parte === 'nada'){ o.x = []; o.vis = {}; o.p = 1; }
  else if(parte === 'mios'){
    o.x = v.gastos.filter(function(g){ return g.por === v.yo; });
    o.vis = {}; if(v.yo) o.vis[v.yo] = ahora; o.p = 1;
  }
  return o;
}
/* Formato: CCV1.<tipo>.<viaje>.<modo>.<datos>. Tipo "i" invitación (trae la
   clave), "g" gastos (cifrado con la clave). Modo: z = comprimido, e = cifrado,
   p = texto plano. Todo en base64 de URL, así entra entero en un link. */
function vjArmar(v, tipo, parte){
  var json = vjBytes(JSON.stringify(vjContenido(v, tipo === 'i', parte)));
  var zip = vjHayZip() ? vjComprimir(json) : Promise.resolve(null);
  return zip.then(function(z){
    var datos = z || json, modo = (z ? 'z' : '');
    if(tipo === 'i' || !vjHayCifra() || !v.clave) return 'CCV1.' + tipo + '.' + v.id + '.' + (modo || 'p') + '.' + b64u(datos);
    var iv = crypto.getRandomValues(new Uint8Array(12));
    return vjClave(v, 'encrypt').then(function(k){
      return crypto.subtle.encrypt({ name:'AES-GCM', iv:iv }, k, datos);
    }).then(function(ct){
      var ctb = new Uint8Array(ct), todo = new Uint8Array(12 + ctb.length);
      todo.set(iv, 0); todo.set(ctb, 12);
      return 'CCV1.' + tipo + '.' + v.id + '.' + (modo || '') + 'e.' + b64u(todo);
    });
  });
}
function vjBuscarCodigo(txt){
  var m = String(txt || '').match(/CCV1\.[ig]\.[A-Za-z0-9]{4,24}\.[a-z]{1,3}\.[A-Za-z0-9_-]+/);
  return m ? m[0] : '';
}
function vjAbrir(codigo){
  var p = codigo.split('.'), tipo = p[1], gid = p[2], modo = p[3], datos;
  try{ datos = deB64u(p[4]); }catch(e){ return Promise.reject(new Error('roto')); }
  var paso = Promise.resolve(datos);
  if(modo.indexOf('e') > -1){
    var v = viajePorId(gid);
    if(!v || !v.clave) return Promise.reject(new Error('sinviaje'));
    if(!vjHayCifra()) return Promise.reject(new Error('sincifra'));
    paso = vjClave(v, 'decrypt').then(function(k){
      return crypto.subtle.decrypt({ name:'AES-GCM', iv:datos.slice(0,12) }, k, datos.slice(12));
    }).then(function(pt){ return new Uint8Array(pt); }, function(){ throw new Error('clave'); });
  }
  if(modo.indexOf('z') > -1) paso = paso.then(function(b){
    if(!vjHayZip()) throw new Error('sinzip');
    return vjDescomprimir(b);
  });
  return paso.then(function(b){
    var o = JSON.parse(vjTexto(b));
    if(!o || o.g !== gid) throw new Error('roto');
    o.tipo = tipo;
    return o;
  });
}
/* Junta lo que llegó con lo que tengo. Devuelve cuántos gastos son nuevos y
   cuántos cambiaron. */
function vjJuntar(v, o){
  var nuevos = 0, cambiados = 0, gente = 0;
  (Array.isArray(o.m) ? o.m : []).forEach(function(m){
    if(!m || typeof m.i !== 'string' || !m.i) return;
    var ya = vjMiembro(v, m.i), t = Number(m.t) || 0;
    if(ya){
      // gana el último cambio de esa persona (el nombre o desde cuándo está)
      if(t > (ya.t || 0)){ ya.n = String(m.n || ya.n).trim().slice(0,28) || ya.n; ya.d = vjFechaOk(m.d); ya.h = vjHoraOk(m.h); ya.t = t; gente++; }
      // y, aparte, su "ya cargué todo"
      var okt = Number(m.okt) || 0;
      if(okt > (ya.okt || 0)){ ya.ok = Number(m.ok) || 0; ya.okt = okt; gente++; }
      return;
    }
    if(v.miembros.length >= VJ_MAX_MIEMBROS) return;
    v.miembros.push({ i:m.i.slice(0,24), n:String(m.n||'?').trim().slice(0,28) || '?', d:vjFechaOk(m.d), h:vjHoraOk(m.h), t:t,
                      ok:Number(m.ok)||0, okt:Number(m.okt)||0 });
    gente++;
  });
  var porId = {};
  v.gastos.forEach(function(g, k){ porId[g.i] = k; });
  (Array.isArray(o.x) ? o.x : []).forEach(function(g0){
    var g = vjGastoLimpio(g0); if(!g) return;
    if(porId[g.i] === undefined){ if(v.gastos.length < VJ_MAX_GASTOS){ v.gastos.push(g); porId[g.i] = v.gastos.length - 1; if(!g.b) nuevos++; } }
    else if(g.t > v.gastos[porId[g.i]].t){ v.gastos[porId[g.i]] = g; cambiados++; }
  });
  if(o.vis && typeof o.vis === 'object') Object.keys(o.vis).forEach(function(k){
    var n = Number(o.vis[k]); if(n > (v.vis[k]||0) && k !== v.yo) v.vis[k] = n;
  });
  var mo2 = vjMonsLimpio(o.mo);
  if(mo2 && (!v.mons || mo2.t > v.mons.t)){ v.mons = mo2; gente++; }
  if(o.de && o.de !== v.yo && !o.p && Number(o.ts) > (v.vis[o.de]||0)) v.vis[o.de] = Number(o.ts);
  var cc = 0, c2 = vjCierreLimpio(o.c), eraC = vjCerrado(v);
  if(c2 && (!v.cierre || c2.t > v.cierre.t)){ v.cierre = c2; cc = 1; }
  if(vjAutoCierre(v)) cc = 1;
  // `cierre` sólo cuando se cerró o se reabrió (para avisar); `cc` si cambió algo
  return { nuevos:nuevos, cambiados:cambiados, gente:gente, cc:cc, cierre:(cc && vjCerrado(v) !== eraC) ? 1 : 0 };
}
/* Un código pegado o que llegó en el link. */
function vjRecibir(txt){
  if(dvCodigoDe(txt)){ dvPedir(txt); return Promise.resolve(true); }
  if(/CCW1\./.test(String(txt))){ dvQrUsar(txt); return Promise.resolve(true); }
  var codigo = vjBuscarCodigo(txt);
  if(!codigo){ toast('No encontré ningún viaje en ese texto'); return Promise.resolve(false); }
  var gidA = codigo.split('.')[2];
  if(!viajePorId(gidA) && (S.vjArch || {})[gidA]){
    vjAbrirHist(gidA); toast('Ese viaje ya terminó: está en tu historial');
    return Promise.resolve(true);
  }
  return vjAbrir(codigo).then(function(o){
    var v = viajePorId(o.g), era = !!v;
    if(!v){
      if(o.tipo !== 'i'){ toast('Primero abrí la invitación de ese viaje'); return false; }
      v = vjLimpio({ id:o.g, nombre:o.n, clave:o.k, yo:'', creado:Date.now() });
      S.viajes = S.viajes || []; S.viajes.push(v);
    }
    if(o.tipo === 'i' && !v.clave && o.k) v.clave = String(o.k).slice(0,64);
    var r = vjJuntar(v, o);
    save();
    viajeSel = v.id; vjReset();
    go('viaje'); renderViaje();
    var de = o.de ? vjNombre(v, o.de) : '';
    toast(!era ? (v.yo ? 'Te sumaste a "' + v.nombre + '"' : 'Te invitaron a "' + v.nombre + '": poné tu nombre para sumarte')
      : (r.nuevos || r.cambiados)
        ? ((r.nuevos ? r.nuevos + (r.nuevos === 1 ? ' gasto nuevo' : ' gastos nuevos') : '')
           + (r.nuevos && r.cambiados ? ' y ' : '') + (r.cambiados ? r.cambiados + (r.cambiados === 1 ? ' corregido' : ' corregidos') : '')
           + (de ? ' de ' + de : ''))
        : 'Ya tenías todo lo de ese paquete');
    return true;
  }).catch(function(e){
    var m = e && e.message;
    toast(m === 'sinviaje' ? 'Primero abrí la invitación de ese viaje'
      : m === 'clave' ? 'Ese paquete es de otro viaje con el mismo nombre, o se cortó al copiarlo'
      : (m === 'sincifra' || m === 'sinzip') ? 'Este navegador es muy viejo para abrir ese paquete'
      : 'Ese texto está cortado: copiá el mensaje entero');
    return false;
  });
}
/* El link que llega por WhatsApp abre la app con #cc=... */
function vjDelLink(){
  var h = '';
  try{ h = decodeURIComponent(location.hash || ''); }catch(e){ h = location.hash || ''; }
  if(h.indexOf('CCV1.') < 0 && h.indexOf('CCP1.') < 0 && h.indexOf('CCW1.') < 0) return;
  try{ history.replaceState(null, '', location.pathname + location.search); }catch(e){}
  vjRecibir(h);
}
function vjMensaje(v, codigo, tipo){
  var yo = v.yo ? vjNombre(v, v.yo) : '';
  var n = vjVivos(v).length;
  return (tipo === 'i'
      ? ('Te invito a "' + v.nombre + '" en Cuentas Claras, para anotar los gastos del viaje y dividirlos al final. Tocá el link para sumarte:')
      : ('Gastos de "' + v.nombre + '"' + (yo ? ', de ' + yo : '') + ' (' + n + (n === 1 ? ' gasto' : ' gastos') + '). Tocá el link para sumarlos a tu app:'))
    + '\n' + VJ_URL + '#cc=' + codigo
    + '\n\nSi el link no abre, copiá este mensaje entero y pegalo en Cuentas Claras › Herramientas › Grupo y gastos de viaje.';
}
function vjCompartirTexto(v, tipo){
  return vjArmar(v, tipo).then(function(codigo){
    save();
    var txt = vjMensaje(v, codigo, tipo);
    vjCompartir = { tipo:tipo, txt:txt };
    renderViaje();
    if(navigator.share && !AND()){
      navigator.share({ text:txt }).catch(function(){});
    }
    return txt;
  });
}

/* ---- el QR ----
   El QR lleva el mismo link que el mensaje de WhatsApp: el otro lo escanea con
   la cámara del teléfono y, si tiene la app de Android, se abre la app (y si
   no, la versión web). Un QR sólo se lee bien si no está muy cargado, así que
   se prueba de mayor a menor: con todo, con sólo mis gastos (o, en una
   invitación, sólo el grupo), y se usa el primero que entre. Lo que no viaja
   en el QR llega después, cuando cada uno manda los suyos. */
var VJ_QR_MAX = 1300;
function vjQrSvg(txt){
  var q = qrcode(0, 'L');
  q.addData(txt, 'Byte');
  q.make();
  var n = q.getModuleCount(), m = 4, d = '';
  for(var r = 0; r < n; r++) for(var c = 0; c < n; c++){
    if(q.isDark(r, c)) d += 'M' + (c + m) + ' ' + (r + m) + 'h1v1h-1z';
  }
  var t = n + m * 2;
  return '<svg xmlns="http://www.w3.org/2000/svg" class="vj-qrsvg" viewBox="0 0 ' + t + ' ' + t + '" shape-rendering="crispEdges" role="img" aria-label="Código QR">'
    + '<rect width="' + t + '" height="' + t + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
}
function vjArmarQr(v, tipo){
  var pasos = tipo === 'i' ? ['', 'nada'] : ['', 'mios'];
  var i = 0, ultimo = null;
  function probar(){
    return vjArmar(v, tipo, pasos[i]).then(function(codigo){
      var link = VJ_URL + '#cc=' + codigo;
      ultimo = { link:link, parte:pasos[i] };
      if(link.length <= VJ_QR_MAX || ++i >= pasos.length) return ultimo;
      return probar();
    });
  }
  return probar();
}
function vjMostrarQr(v){
  var tipo = vjCompartir ? vjCompartir.tipo : 'g';
  return vjArmarQr(v, tipo).then(function(r){
    save();
    var nota = (tipo === 'i')
      ? (r.parte === 'nada' ? 'Trae el grupo, sin los gastos: esos le llegan solos cuando tenga internet.' : 'Trae el grupo y todo lo que ya está cargado.')
      : (r.parte === 'mios' ? 'Lleva sólo los gastos que cargaste vos: los de los demás se los pasa cada uno.' : 'Lleva todo lo que tenés del viaje.');
    vjCompartir = vjCompartir || { tipo:tipo, txt:'' };
    vjCompartir.qr = vjQrSvg(r.link);
    vjCompartir.qrNota = nota + (r.link.length > VJ_QR_MAX ? ' Quedó muy cargado: si la cámara no lo lee, mandalo por WhatsApp.' : '');
    renderViaje();
    var q = $('.vj-qr'); if(q) try{ q.scrollIntoView({block:'center'}); }catch(x){}
  });
}
/* La app de Android llama acá cuando tocás un link del viaje con la app ya
   abierta (si estaba cerrada, el link llega en la dirección, como en la web). */
window.__ccLink = function(url){ vjRecibir(String(url || '')); };
// un link de invitación o de vinculación abierto con la app ya abierta en la misma pestaña
window.addEventListener('hashchange', function(){ vjDelLink(); });
