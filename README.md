# Cuentas Claras

App web para llevar las finanzas personales: gastos, ingresos, compras en cuotas, gastos fijos, ahorros y metas, todo en un mismo lugar.

Cada usuario entra con su cuenta (email y contraseña) y sus datos se guardan en una base de datos PostgreSQL, en [Supabase](https://supabase.com).

## Qué hace

- Carga de gastos e ingresos (también por voz) con categoría, medio de pago y fecha.
- Compras en cuotas y gastos/ingresos fijos que se suman solos cada mes.
- Saldo por medio de pago y cuentas que rinden (TNA de bancos y billeteras).
- Metas de ahorro, presupuestos por grupo de categorías y resumen del mes.
- Cuenta por usuario: los datos están en la base y se ven desde cualquier navegador.
- Grupo familiar con gastos a medias y pendientes entre las personas: se invita con un código y cada uno entra con su cuenta.
- Gastos de viaje compartidos y división de gastos.
- Calculadoras: cuotas o contado, conversor de monedas y horas extras.

## Cómo está organizado el código

No usa frameworks ni paso de compilación: se abre `index.html` y funciona.

```
index.html              La estructura de las pantallas (HTML) y la carga de estilos y código
css/                    Los estilos, de lo general a lo particular
  tema.css                colores, tipografías y fondo (tema claro y oscuro)
  estructura.css          barra de arriba y menús
  tarjetas.css · formularios.css · listas.css · graficos.css
  pantallas.css           lo propio de cada pantalla
  cuenta.css              la pantalla para entrar o crear la cuenta
  intro-y-paseo.css · ios.css
js/                     El código, un archivo por tema
  configuracion.js        la dirección y la clave pública de la base de datos
  utilidades.js           fechas, formato de plata, ids
  estado.js               el estado de la app y los datos de fábrica
  persistencia.js         guardar, leer y validar los datos
  tasas-y-dolar.js        datos de afuera: tasas y cotizaciones
  calculos.js             cuotas, fijos, días hábiles, metas y resumen del mes
  cuentas-y-saldos.js     intereses de las cuentas que rinden y saldo por medio
  render.js               dibujar la pantalla
  resumen.js · movimientos.js · cuotas.js · gastos-fijos.js · ahorros.js · ajustes.js
  colores-y-paneles.js · interaccion.js · calendario-y-avisos.js
  eventos.js              qué pasa al tocar cada botón o guardar un formulario
  calculadoras.js · dividir-gastos.js
  viajes.js · viajes-pantalla.js
  grupo-familiar.js · dispositivos.js · sincronizacion.js
  voz.js · paseo.js · controles.js
  base-de-datos.js        la capa de datos: pasa lo de la app a las tablas y al revés
  cuenta.js               entrar, crear la cuenta y cerrar sesión
  arranque.js             lo último que corre: prepara todo y carga los datos
  lib/                    librerías de terceros (el cliente de Supabase, entre otras)
sql/
  esquema.sql             las tablas, las relaciones y los permisos de la base de datos
```

Los archivos de `js/` se cargan en orden desde `index.html` y comparten el mismo espacio de nombres: lo que define uno lo pueden usar los que siguen.

## La base de datos

Es PostgreSQL. Todo el esquema está en [`sql/esquema.sql`](sql/esquema.sql).

**Usuarios y espacios.** El login lo resuelve Supabase Auth (tabla `auth.users`). Al crearse una cuenta, un disparador (`alta_usuario`) le arma su fila en `perfiles` y un `espacio` propio, que es donde viven sus datos. Un grupo familiar es un espacio con más de un miembro (`espacio_miembros`): todos leen y cargan en el mismo.

**Tablas de datos.** Todas llevan `espacio_id` y su clave primaria es `(espacio_id, id)`.

| Tabla | Qué guarda | Se relaciona con |
|---|---|---|
| `personas` | la gente del grupo familiar | `espacios` |
| `medios_pago` | efectivo, tarjetas, billeteras | `espacios` |
| `grupos_categorias`, `categorias` | las categorías de gastos e ingresos y cómo se agrupan | `espacios` |
| `movimientos` | cada gasto o ingreso | `categorias`, `medios_pago`, `personas` |
| `compras_cuotas` | las compras en cuotas | `categorias`, `medios_pago`, `personas` |
| `gastos_fijos`, `precios_fijo` | lo que se repite todos los meses, y su precio a lo largo del tiempo | `categorias`, `medios_pago`, `personas` |
| `pases` | plata que pasa de un medio a otro | `medios_pago` (origen y destino) |
| `cuentas_rinden` | las cuentas que dan interés (TNA) | `medios_pago` |
| `metas_ahorro`, `aportes` | las metas y lo que se fue poniendo | `cuentas_rinden`, `personas` |
| `horas_extras` | las horas extras anotadas | `personas` |
| `viajes`, `viaje_miembros`, `viaje_gastos` | los gastos de un viaje compartido | entre sí |
| `ajustes` | la configuración del espacio (presupuestos, orden de los paneles, reparto) | `espacios` |

Las columnas guardan lo que hace falta para consultar y relacionar (montos, fechas, claves foráneas). Los datos internos de la app que no se consultan van en una columna `extra` de tipo `jsonb`.

**Seguridad.** Todas las tablas tienen *Row Level Security*: una política deja leer y escribir una fila sólo si el usuario es miembro de ese espacio (función `es_miembro`). Por eso la clave que está en `js/configuracion.js` puede ser pública: sin una sesión iniciada no se llega a ningún dato, y con sesión sólo a los propios.

**Grupo familiar.** Quien arma el grupo genera un código. Otro usuario lo carga y la función `unirse_a_espacio` lo agrega como miembro; `salir_del_espacio` lo devuelve a su espacio propio.

### Cómo trabaja la app con la base

1. Al entrar, `js/base-de-datos.js` lee las filas del espacio y arma con ellas el estado de la app en memoria.
2. Al guardar, convierte el estado en filas, lo compara con lo que ya está en la base y sube sólo lo que cambió (alta, cambio o baja de cada fila), respetando el orden de las relaciones.
3. Si se corta internet, lo cargado queda en el navegador y se sube cuando vuelve.
4. Cuando alguien del grupo cambia algo, los demás reciben un aviso (Supabase Realtime) y vuelven a leer.

### Usar una base propia

1. Crear un proyecto en Supabase.
2. En el editor de SQL, pegar y correr `sql/esquema.sql`.
3. Poner la dirección del proyecto y su clave pública (*publishable key*) en `js/configuracion.js`.

Si `DB_URL` queda vacío en ese archivo, la app funciona sin cuentas y guarda sólo en el navegador.

## Probarla

Servir la carpeta con cualquier servidor estático y abrirla en el navegador:

```
npx serve .
```
