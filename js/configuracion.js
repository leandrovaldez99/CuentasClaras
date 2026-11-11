/* Cuentas Claras · js/configuracion.js
   Dónde está la base de datos (Supabase).

   La clave de acá es la "publicable": está pensada para ir en el código de la
   página. Lo que protege los datos no es esconderla sino los permisos por fila
   de la base (RLS): cada usuario sólo llega a lo suyo y a lo de su grupo.

   Si DB_URL queda vacío, la app funciona sin cuentas y guarda sólo en el navegador. */
"use strict";

var DB_URL = 'https://lmxuispxqlynawcetazh.supabase.co';
var DB_CLAVE = 'sb_publishable_0jm3stcVyMk9Wg7MN6k7zA_B-3SRfPg';
