# Prepioner

Tema de Spicetify con la estética del PioneerVFD original (chasis cromado, LCD negro azulado, fósforo cian,
carátula con perilla, rueda, teclas y espectro), sin vídeos ni radio. Inspirado en
[adainstarks/PioneerVFD](https://github.com/adainstarks/PioneerVFD) (MIT). Ver `LICENSE-NOTICE.md`.

## Instalar / quitar

```powershell
.\scripts\install.ps1               # copia, respalda tu config y aplica (reinicia Spotify)
.\scripts\install.ps1 -DebugPort    # igual, y abre el puerto 9222 para inspeccionar con scripts\cdp.js
.\scripts\uninstall.ps1             # restaura tema, extensiones y flags tal como estaban
```

`install.ps1` guarda el estado previo en `%APPDATA%\spicetify\pvc-backup.json` (una sola vez) y desactiva, sin borrarla,
la extensión `pioneerVFDLite.js` de la otra prueba para que no se monten dos carátulas. `uninstall.ps1` la vuelve a activar.

## Qué hay

| Archivo | Función |
|---|---|
| `Themes\PioneerVFDClaude\user.css` | Aspecto global y carátula |
| `Themes\PioneerVFDClaude\color.ini` | Paleta (tomada del original) |
| `Extensions\pioneerVFDClaude.js` | Carátula: LCD, perilla, rueda, teclas, espectro |
| `tests\logic.test.js` | Pruebas de la lógica pura (`node --test tests\logic.test.js`) |
| `scripts\cdp.js` | Cliente de depuración: `eval`, `shot`, `perf`, `logs`, `reset` |
| `scripts\dev-sync.ps1` | Copia, refresca y reinicia Spotify; espera a que la extensión monte |
| `scripts\crop.ps1` | Recorta una captura PNG |
| `scripts\measure.ps1` | Tamaños y recuento de reglas costosas |

## Decisiones de diseño

- **Un solo elemento audaz: la pantalla LCD.** Máscara de rejilla de píxeles con viñeta y reflejo, bloom de fósforo que respira
  mientras suena música, progreso segmentado con `mask-image`, arco de volumen cónico segmentado alrededor de la perilla,
  luz orbitando la rueda mientras suena, encendido único (barrido cromado + apertura de la pantalla + autotest de las barras).
- **Movimiento barato:** lo continuo solo toca `opacity` y `transform`. Sin `blur` ni `backdrop-filter`. El brillo del espectro
  se dibuja con columnas de baja opacidad en el propio canvas.
- **Espectro real:** `Spicetify.getAudioData(uri)` (segmentos con `pitches` y `loudness_max`) sincronizado con la posición.
  Pistas sin análisis: la pantalla muestra `NO DATA`. No se inventa espectro.
- **Progreso inválido** (caso conocido de Liked Songs, valor del tamaño de `Date.now()`): se muestra `--:-- / --:--` y un
  `console.warn` con los valores.
- **Fuente:** `Consolas` (viene con Windows). No se incluye Musieer porque su licencia no está verificada.
- `prefers-reduced-motion` desactiva todas las animaciones.

## Notas de depuración (verificadas en Spotify real)

- `spicetify config extensions X` **añade** a la lista; `X-` quita. El comando imprime una extensión por línea.
- `spicetify config spotify_launch_flags --remote-debugging-port=9222` se ignora en silencio; el instalador escribe la clave en `config-xpui.ini`.
- No recargar la página por CDP (`Page.reload`): deja el árbol de React de Spotify roto. Usar `scripts\dev-sync.ps1`.
- `Page.captureScreenshot` con `clip` no vuelve en Spotify: capturar completo y recortar con `scripts\crop.ps1`.
- `Spicetify.Player.getProgress()` lanza hasta que el estado interno existe; la extensión espera con un sondeo.
