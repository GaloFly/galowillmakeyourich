# Bloques — Portfolio + Comparador

App de gestión de cartera por bloques (B0 Liquidez · B1 Core · B2 Income · B3 High Risk).
Historial de versiones: ver `CHANGELOG.md`.

## Cómo se trabaja en este repo

**Se edita un solo archivo: `index.html`.** Igual que siempre — se cambia, se sube, y ya.

Al subirlo a `main`, un robot (GitHub Actions, ver `.github/workflows/build-and-deploy.yml`)
hace el resto solo:

1. **Compila el JSX** una sola vez (`build.mjs`), para que el teléfono no tenga que descargar
   Babel (~3 MB) ni traducir 12.000 líneas en cada arranque.
2. **Sirve React desde `vendor/`** en lugar del CDN — la app no depende de webs ajenas.
3. **Añade el modo sin conexión** (service worker + manifest): una vez abierta con red,
   la app arranca también en modo avión.
4. **Conserva el auto-update**: deja en el HTML compilado el marcador
   `const APP_VERSION = "…"` que el script de auto-actualización busca por regex
   (la constante real vive ahora en `app.js`; sin el marcador ninguna actualización
   se detectaría).

El resultado se publica en GitHub Pages desde `dist/`. **Nunca edites `dist/` a mano** —
se regenera entero en cada build.

## Probar en un ordenador

```
npm ci
npm run build
cd dist && python3 -m http.server 8125
```

y abrir http://localhost:8125
