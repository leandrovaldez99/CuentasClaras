/* Cuentas Claras · js/arranque.js
   Lo último que corre: prepara las pantallas y carga los datos.

   Todos los archivos de js/ comparten el mismo espacio de nombres: se cargan en
   orden desde index.html y lo que define uno lo pueden usar los que siguen. */
"use strict";

/* ============================================================
   arranque
   ============================================================ */
fillSelects();
pintarCarga();
pintarMon();
pintarFijoForm();
renderCats();
syncFechas();
aplicarTema(tema);
renderAmigos();
initStore();
cuentaArrancar();               // si hay base de datos: ¿quién entró? (ver cuenta.js)
sincronizarAviso();
