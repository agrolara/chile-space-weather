# Chile Space Weather

Monitor de sismos, clima espacial (índice Kp) y volcanes activos en Chile.

- URL: https://agrolara.github.io/chile-space-weather/
- Datos actualizados cada 5 minutos via cron.

## Estructura

- `index.html` – Página principal (Leaflet + vanilla JS)
- `poll.js` – Script que obtiene datos de USGS, NOAA y volcanes
- `data/` – JSON generados (`sismos.json`, `space-weather.json`, `volcanes.json`)
- `package.json` – Dependencias (axios, date-fns)

## Instalación local

```bash
npm install
npm run poll   # genera datos y hace push a main
```

Despliegue automático: Los datos se suben a `main`; GitHub Pages los sirve.

## APIs utilizadas

- USGS Earthquake Catalog (sismos en Chile, magnitud ≥ 4.4)
- NOAA Space Weather Prediction Center (índice Kp)
- Datos de volcanes (estáticos)

## Configuración

Para pushes automáticos desde el cron, define la variable de entorno `GITHUB_TOKEN` con un token personal de GitHub que tenga permisos de escritura en el repo.

Ejemplo en crontab:
```bash
*/5 * * * * cd /home/ubuntu/chile-space-weather && npm run poll >> cron.log 2>&1
```

## Licencia

MIT
