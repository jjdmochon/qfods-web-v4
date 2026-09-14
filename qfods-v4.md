# QFDOS Portal v4 (modernist) — spec de diseño

Portal docente de la asignatura Química Farmacéutica II (UGR, Grado en Farmacia, Grupo E). SPA de una sola página con navegación por estados (sin router), construida como Design Component sobre el design system **Modernist**.

## Design system

- Sistema: Modernist — flat, arquitectónico, tipografía Archivo, acento rojo `#ec3013` sobre fondo claro `#f3f2f2`, radios a 0, reglas de 2px como único recurso decorativo.
- Bundle: `_ds/modernist-.../styles.css` + `_ds_bundle.js`. Componentes usados: `.btn` (`btn-primary`, `btn-secondary`, `btn-ghost`, `btn-block`), `.tag` (`tag-accent`, `tag-neutral`, `tag-outline`), `.card` (`card-kicker`, `card-title`, `card-body`, `card-meta`), `.field` + `.input`, `.table`, `.dialog-backdrop` + `.dialog`, `.hr`.
- Tokens vía `var(--color-*)`, `var(--font-*)`, `var(--space-*)` — nunca hex ni px hardcodeados.
- Links: `a { color: var(--color-accent) }`, hover `--color-accent-600`.

## Arquitectura

Un único componente con estado `screen` que conmuta entre pantallas (`login`, `hub`, `curso`, `temario`, `topic`, `practicas`). Header sticky + nav superior en desktop, nav inferior fija en móvil (breakpoint 780px, detectado por `resize` listener). Dos diálogos modales globales (buscador de fármacos, buzón de consultas) superpuestos a cualquier pantalla.

## Pantallas

1. **Login** — logo, tags de curso/grupo, título, botón primario "Continuar con Google" (demo → entra directo), botón secundario de acceso de revisión, dos cards informativas (estudiante/profesor).
2. **Hub** (home tras login) — hero con tags + título + descripción + CTAs; fila de 4 estadísticas (módulos, fármacos, preguntas, flashcards) separadas por reglas verticales; dos columnas: tablón de avisos (lista con fecha) y grid de 4 tarjetas de herramientas (curso, prácticas, buscador, buzón); preview de 4 temas + botón "ver todos".
3. **Curso** — info de asignatura, tabla de horario semanal, tutorías (horas + ubicaciones en cards), tabla de calendario de exámenes con tags de ponderación, enlaces externos.
4. **Temario** — buscador con filtro en vivo (título/subtítulo/fármacos), grid de cards de tema (número, estado, título, subtítulo, descripción corta, 3 tags de conceptos, contador de fármacos/preguntas/flashcards).
5. **Topic (detalle de tema)** — número+estado, título, subtítulo, descripción, conceptos clave (tags), diana estructural con link a RCSB PDB, lista de fármacos de referencia (nombre, rol, MW, LogP, HBD/HBA), dos cards de resumen (test/flashcards).
6. **Prácticas** (cuaderno de laboratorio) — grid de 8 módulos (cards con número, label, desc, estado: bloqueado/disponible/firmado); al seleccionar uno se abre panel expandido con contenido específico:
   - **00 Normas de seguridad** — gate: botón "aceptar normas" desbloquea el resto.
   - **01 Protocolos** — texto descriptivo (placeholder de contenido).
   - **02 Calculadora de rendimientos** — 6 inputs numéricos (masas/PM de A, B y producto + masa obtenida) → calcula reactivo limitante, rendimiento teórico y % de rendimiento en vivo.
   - **03 Disoluciones** — 4 inputs (C₁V₁=C₂V₂), rellenar 3 y calcula el cuarto automáticamente.
   - **04 Espectroscopia** — 2 image-slots (RMN, EM) + tabla editable de 4 filas (δ, integral, asignación).
   - **05 Material y montajes** — checklist de 8 ítems de equipo con contador de progreso.
   - **06 Simulador de examen** — 5 preguntas de opción múltiple (radio buttons), corrección instantánea con score X/5, botón reintentar.
   - **07 Cuaderno de parejas** — formulario (pareja, fecha, observaciones, resultado) → envío con confirmación.

## Modales

- **Buscador de fármacos**: input de texto, filtra fármacos de todos los temas por nombre, resultado navega al tema correspondiente.
- **Buzón de consultas**: select de tema + textarea de pregunta, envío con mensaje de confirmación.

## Datos (hardcoded en el componente, no backend)

- 8 temas (`TOPICS`) con estructura completa: id, number, title, subtitle, description, keyConcepts[], pdbTargetId/targetName/pdbUrl, drugs[] (name, role, mw, logP, hbd, hba), testCount, flashCount.
- Avisos, horario, tutorías, calendario de exámenes, enlaces, preguntas de examen, ítems de equipo, módulos de prácticas — todo como arrays de constantes en el `<script data-dc-script>`.

## Estado pendiente / no implementado

- **Visualización de estructuras moleculares (SMILES→imagen)**: no integrado. Pendiente decidir entre librería JS ligera (ej. RDKit.js, Indigo.js) o llamada a backend para renderizar estructuras 2D de los fármacos de referencia. Es el único de los 6 módulos de laboratorio con funcionalidad incompleta (el resto — rendimientos, disoluciones, espectroscopia, checklist, examen, cuaderno de parejas — están completos y funcionales).
- Protocolos de síntesis (módulo 01) es solo texto placeholder, sin contenido detallado aún.

## Notas de implementación para replicar

- Todo en un único archivo, sin router: un `state.screen` controla qué bloque `<sc-if>` se muestra.
- Todos los estilos son inline (obligatorio en este entorno); nada de hojas de estilo con clases propias.
- Formularios controlados: cada input tiene `value` + `onChange` conectado a `setState` inmutable.
- Cálculos (estequiometría, dilución, examen) se derivan en cada render a partir del estado — no hay lógica async ni validaciones de red.
