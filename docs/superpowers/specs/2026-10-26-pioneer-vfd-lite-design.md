# PioneerVFD Lite — Diseño

Fecha: 2026-10-26 · Estado: aprobado por el usuario (enfoque A) · Escrito para: quien implemente el plan.

## Objetivo

Tema de Spicetify que conserve el aspecto del tema PioneerVFD (adainstarks, MIT) pero sea mucho más ligero:
chasis cromado, interior negro azulado tipo LCD, fósforo cian, tipografía monoespaciada, y una carátula inferior
con pantalla de texto, perilla de volumen, rueda de navegación, botones, espectro y fondo animado.

## Referencia verificada (repo original)

| Pieza | Original | Fuente |
|---|---|---|
| `user.css` | 736 143 B, 15 830 líneas, 3 346 `!important`, 203 `box-shadow`, 202 `text-shadow`, 41 `blur/drop-shadow`, 118 KB en `data:` | descarga y medición propias, 2026-10-26 |
| `pioneerVFD.js` | 566 583 B, 12 680 líneas (radio archive.org, PULSE, vídeos) | idem |
| Vídeos `.webm` | ~50 MB | listado de la API de GitHub |
| Paleta | `color.ini` del original (hex citados en el plan) | `Themes/PioneerVFD/color.ini` |

## Decisiones aprobadas

1. **Enfoque A**: tres artefactos sin build: `user.css`, `color.ini`, y una extensión de un solo archivo.
2. **Carátula** (extensión mínima) con: pantalla LCD de texto, perilla y rueda y botones, espectro, fondo animado ligero.
3. **Espectro real**: `Spicetify.getAudioData(uri)` (documentado en spicetify.app) sincronizado con la posición de reproducción.
   Si la pista no tiene análisis (local, podcast, error 404), la LCD muestra `NO DATA`. No hay espectro inventado.
4. **Sin**: vídeos, radio, PULSE, fuentes no latinas, instalación por Marketplace, macOS/Linux.
5. **Convivencia**: el player nativo de Spotify se deja vivo y oculto (`opacity: 0`), como hace el original,
   porque otras extensiones (letras, etc.) se enganchan ahí.

## Presupuesto (objetivos de diseño, a medir; no son resultados)

- `user.css` ≤ 40 KB · extensión ≤ 30 KB · sin vídeos · fuente opcional ≤ 20 KB.
- Coste de CPU durante reproducción: ≤ 3 puntos porcentuales por encima del tema actual del usuario (`marketplace` / `catppuccin-mocha`), medido con `Performance.getMetrics`.
- Efectos permitidos: `text-shadow` solo en título, reloj y cabecera de álbum. Prohibidos `backdrop-filter` y `filter: blur`.
- Un solo `<canvas>` a ≤ 30 fps, detenido con la ventana oculta o sin reproducción.

## Manejo de errores

- Fallar explícito: `waitFor` lanza con el nombre de lo que faltó; `formatClock`, `findSegmentIndex`, `spectrumLevels` lanzan con los datos de entrada.
- Progreso inválido (caso conocido de Liked Songs, donde Spicetify devuelve un valor del tamaño de `Date.now()`): la LCD muestra `--:-- / --:--` y se registra un `console.warn` con los valores. No se sustituye por 0.
- Fallo de `getAudioData`: `console.error` con URI y error, y etiqueta `NO DATA` visible.

## Fuera de alcance / riesgos

- Los selectores de Spotify (`Root__*`, `main-*`) pueden cambiar entre versiones de Spotify. Mitigación: lista de selectores verificada en el plan y comprobación en vivo.
- Licencia de la fuente Musieer: **sin verificar**. El plan decide en la Tarea 4; por defecto se usa `Consolas`.
- La forma exacta de `getAudioData` (campos `segments[].start`, `pitches`, `loudness_max`) se asume por la API Web de Spotify y se comprueba en vivo en la Tarea 3.
- Atribución: si se reutilizan paleta o estructura, se incluye el aviso MIT de William Starks.
