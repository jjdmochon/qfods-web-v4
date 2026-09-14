# QFDOS Portal v4 (Modernist)

Portal docente oficial y cuaderno digital de laboratorio de la asignatura **Química Farmacéutica II (2627 QFDOS E)**, Grado en Farmacia, Grupo E (Turno de Tarde), Universidad de Granada.

Diseñado como alternativa arquitectónica sobre el design system **Modernist** a partir de la especificación `qfods-v4.md`, manteniendo el 100% de las funcionalidades, contenidos, simuladores y datos de `qfdos-web-v3`.

---

## 1. Identidad de Diseño — Modernist Design System

- **Estética:** Flat, arquitectónica, minimalismo suizo de alta precisión.
- **Tipografía:** [Archivo](https://fonts.google.com/specimen/Archivo) (Google Fonts, 300 a 900) para interfaz de usuario y títulos; [JetBrains Mono](https://fonts.google.com/specimen/JetBrains+Mono) para datos numéricos, constantes y fórmulas.
- **Paleta cromática:**
  - Fondo arquitectónico: `#f3f2f2`
  - Superficies de tarjetas y paneles: `#ffffff`
  - Acento rojo primario: `#ec3013` (hover `#c8240c`)
  - Bordes y reglas estructurales: `#111111`
- **Geometría estricta:** `border-radius: 0px` en todos los elementos (botones, tarjetas, modales, etiquetas, inputs). Cero esquinas redondeadas.
- **Estructuración:** Reglas estructurales de **2px sólidos** (`border: 2px solid #111111`) como único recurso gráfico decorativo y separador de módulos.
- **Tipografía científica:** Texto plano y caracteres Unicode limpios directos (cero LaTeX crudo: 1H RMN, 13C, C₁V₁=C₂V₂, δ, Da, %).

---

## 2. Pantallas & Funcionalidades

1. **Login:** Acceso universitario (Google UGR), acceso de revisión/invitado, acceso en modo profesor/docente, y tarjetas informativas de rol.
2. **Hub (Inicio):** Hero arquitectónico con tags del Grupo E, barra de 4 estadísticas con divisores de 2px (11 temas, 54 fármacos, 136 preguntas FIR, 80+ flashcards), tablón oficial de avisos, herramientas rápidas y preview de temas.
3. **Curso:** Ficha de la asignatura (6 ECTS), horario semanal detallado en **Aula 7** (L, M, J 17:00 h), calendario oficial de exámenes con ponderaciones oficiales (70%, 20%, 5%, 5%), y horarios y despachos de tutorías del Dr. Juan José Díaz-Mochón (Cartuja y GENYO) y la Dra. Ana Sousa (Prácticas).
4. **Temario:** Catálogo completo de las 11 unidades temáticas con buscador en vivo por palabra clave, conceptos y fármacos.
5. **Topic (Detalle de Tema):** Objetivos formativos, diana terapéutica cristalográfica (código PDB y enlace directo a RCSB 3D), monografías completas con parámetros moleculares (MW, LogP, HBD, HBA, TPSA) y **visualizador de estructuras químicas 2D vectoriales (SVG) vía RDKit MinimalLib**.
6. **Prácticas (Cuaderno Digital de Laboratorio — 8 Módulos):**
   - **00 Normas de seguridad:** Protocolos de bioseguridad, EPIs, y compuerta de firma digital obligatoria del estudiante que desbloquea el acceso al cuaderno.
   - **01 Protocolos de síntesis:** Procedimientos detallados de laboratorio (Propranolol vía apertura de oxirano, Dihidropiridinas DHPP vía Reacción de Hantzsch, y Paracetamol).
   - **02 Calculadora de rendimientos en vivo:** 6 inputs numéricos (Masa A, PM A, Masa B, PM B, PM Prod, Masa Obtenida) con determinación automática del reactivo limitante, masa teórica esperada y porcentaje de rendimiento real con diagnóstico. Presets rápidos incluidos.
   - **03 Calculadora de disoluciones (C₁V₁ = C₂V₂):** Selector de incógnita interactivo y cálculo instantáneo del volumen o concentración requerida.
   - **04 Taller de espectroscopia interactivo:** Asignación de picos de RMN ¹H y EM con tabla editable (δ ppm, multiplicidad, integral, asignación) y verificación automática.
   - **05 Material y montajes:** Checklist interactivo de 8 ítems de aparataje de laboratorio con barra de progreso.
   - **06 Simulador de examen de prácticas:** 5 preguntas tipo test de técnicas de laboratorio con corrección instantánea y explicaciones razonadas.
   - **07 Cuaderno de parejas:** Formulario de entrega oficial con número de pareja, lote, datos experimentales, observaciones, guardado local y opción de exportación/impresión.
7. **Afinidad (Simulador Biofísico):** Curvas de saturación ligando-receptor según la ley de acción de masas ($B = \frac{B_{max} \cdot [L]}{K_D + [L]}$) con sliders interactivos de $K_D$, $B_{max}$ y $[L]$.
8. **Evaluación Continua:** Desglose del sistema 70/20/5/5 y calculadora de calificación final estimada con comprobación de la nota mínima de 5,0 en el examen oficial.
9. **Glosario:** Diccionario de términos farmacológicos con buscador y categorías.
10. **Enlaces:** Catálogo de recursos científicos (RCSB, DrugBank, PubChem, ChEMBL, FIR, UGR).

### Modales Globales
- **Buscador de fármacos & global (⌘K / Ctrl+K):** Búsqueda instantánea en vivo de cualquier principio activo, mecanismo o tema con navegación directa.
- **Buzón de consultas:** Formulario para remitir dudas específicas al profesorado.
- **Reproductor de podcast:** Píldoras de audio de repaso de QFDOS.
- **Test de autoevaluación interactivo:** Preguntas tipo test por unidad temática con retroalimentación razonada.
- **Flashcards de memorización activa:** Tarjetas con efecto volteo interactivo.
- **Simulador oficial FIR:** Banco de preguntas de convocatorias oficiales del Ministerio de Sanidad (2020-2025).

---

## 3. Modos de Ejecución

### Opción A: Modo Zero-Build Inmediato (Recomendado para Google Drive)
Para evitar problemas de bloqueos de ficheros de `npm install` en unidades virtuales de Drive:
```powershell
.\dev.ps1 -Static
# O bien directamente:
python -m http.server 3004 --directory .
```
Abre en el navegador: [http://localhost:3004](http://localhost:3004)

### Opción B: Entorno de Desarrollo Vite en Disco Local
Sincroniza el código al disco local (`$USERPROFILE\qfdos-v4-node`) y ejecuta Vite:
```powershell
.\serve.ps1
# O bien:
.\dev.ps1
```
