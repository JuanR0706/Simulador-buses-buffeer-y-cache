# Simulador interactivo de arquitectura de computadores

## Ejecutar
Abre `index.html` en un navegador moderno (doble clic; no necesita servidor ni dependencias).
Pruebas de lógica: `node tests/logic.test.js`

## Estructura
- `js/simulations/simulation-base.js`: motor (estados, pausa, paso a paso, velocidad, reinicio).
- `js/simulations/*-simulation.js`, `bandwidth-calculator.js`: reglas de cada escenario.
- `js/components/`: diagrama SVG, explicaciones/registro/estadísticas y controles.
- `js/main.js`: navegación; `js/utils/formatters.js`: formatos.
Se usan scripts clásicos con el espacio de nombres `window.ArqSim` para que funcione al abrir el archivo localmente (los módulos ES no cargan desde `file://` en Chrome).

## Estado
| Módulo | Estado |
|---|---|
| Buses: transferencia/DMA, bus mastering, arbitraje, ancho de banda | Implementado y probado |
| Buffers: simple, simple frente a doble, circular, productor-consumidor con mutex y semáforos | Implementado y probado |
| Cachés: jerarquía L1/L2/L3 con hit/miss y LRU, localidad temporal y espacial, calculadora EAT | Implementado y probado |

Limitaciones conocidas: en buffers y cachés los cambios se resaltan con colores, etiquetas y destellos breves, sin bloques que viajen por un bus; la concurrencia de la sincronización es conceptual (planificador por turnos, no hilos reales). No se ha probado en Safari ni en dispositivos táctiles reales.

Velocidades: lenta 3,5 s, normal 2 s, rápida 1 s por paso. Los tiempos simulados son estimaciones didácticas, no mediciones de hardware.
