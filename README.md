# Cuentas Claras

App para llevar tus finanzas personales: gastos, ingresos, compras en cuotas, gastos fijos, ahorros y metas, todo en un mismo lugar.

**Usala online:** https://cuentasclarasfinanzas.netlify.app

## Qué hace

- Cargás gastos e ingresos (también por voz) con categoría, medio de pago y fecha.
- Compras en cuotas y gastos/ingresos fijos que se suman solos cada mes.
- Saldo por medio de pago y cuentas que rinden (TNA de bancos y billeteras, actualizada todos los días).
- Metas de ahorro, presupuestos por grupo de categorías y resumen del mes.
- Grupo familiar: varias personas, cada una desde su celular, con gastos a medias y pendientes entre ustedes.
- Gastos de viaje compartidos y división de gastos.
- Calculadoras: cuotas o contado, conversor de monedas y horas extras.
- Se instala como app (PWA) y funciona sin internet. Los datos quedan en tu dispositivo.

## Cómo está hecha

Es una sola página (`index.html`) con HTML, CSS y JavaScript, sin dependencias ni paso de compilación. Los datos se guardan en el almacenamiento del navegador como un objeto JSON organizado en listas (movimientos, cuotas, fijos, medios de pago, metas, etc.), cada elemento con su id.

| Archivo | Para qué es |
|---|---|
| `index.html` | La app completa |
| `manifest.webmanifest`, `icono.png`, `favicon.ico` | Instalación como app (PWA) |
| `_redirects`, `_headers` | Configuración de Netlify (incluye `/tasas`, que trae las tasas de las billeteras) |
| `assetlinks.json`, `.well-known/` | Vínculo con la app de Android |

## Probarla en tu compu

Abrí `index.html` en el navegador, o serví la carpeta con cualquier servidor estático:

```
npx serve .
```

Para el deploy se sube la carpeta tal cual a Netlify.
