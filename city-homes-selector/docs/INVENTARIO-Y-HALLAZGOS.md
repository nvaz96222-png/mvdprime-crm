# City Homes — inventario de archivos y tabla maestra

Relevamiento hecho sobre el Google Drive de la cuenta antes de programar nada.
Fecha del relevamiento: 23/10/2026.

---

## 1. Archivos encontrados

### Carpeta `Drive > PROYECTOS > City Homes`

| Archivo | Tipo | Qué contiene | Uso en la app |
|---|---|---|---|
| `LISTA OFICIAL CITY HOMES.pdf` (115 KB, mod. 24/06/2026) | PDF, 5 páginas, texto | Lista oficial de las 158 unidades: nivel, apto., dormitorios, área habitable, terrazas de uso exclusivo, áreas comunes, %, área total y precio o VENDIDO. Además: conexiones 4%, forma de pago y 22 garajes a USD 20.000 | Fuente de precios/estado (histórica) y verificación cruzada de superficies |
| `BROCHURE-CITY-HOMES.pdf` (8 MB, 21 páginas) | PDF, páginas como imagen | Portada, memoria descriptiva, ubicación, amenities, renders (fachada, hall, gimnasio, barbacoas, interiores), plantas (2 subsuelos, planta baja, piso 1, pisos 2-9, piso 10, piso 11), terminaciones, beneficios fiscales y aviso legal | Renders, plantas interactivas, logotipo, textos del proyecto y PDF descargable |

### Fuera de esa carpeta

| Archivo | Tipo | Qué contiene | Uso en la app |
|---|---|---|---|
| `LISTAS PIRES BENLIAN` → hoja **CITY HOMES** (mod. 23/10/2026, compartida por sasapires2002) | Google Sheets | Misma lista que el PDF **más** cantidad de baños, sub total, y dos columnas de precio: la anterior y la vigente. Marca `VENDIDO` y, en garajes, también `RESERVADO` | **Fuente vigente** de precio y estado comercial; aporta los baños y el sub total |
| `Propuesta_City_Homes_808-908` (xN), `Propuesta CityHomes U 113-116`, `Propuesta City_Homes U 1004-216`, `Notas_-_Negociacion_City_Homes_808-908` | Sheets / Docs / PDF | Propuestas y negociaciones puntuales sobre unidades concretas | **No se usan**: son negociaciones particulares, no precio de lista. No deben publicarse |

### Material que **no** existe en Drive

- Planos individuales por apartamento (sólo hay plantas por piso).
- Alzado o elevación frontal del edificio con las unidades identificadas.
- Lista de precios y disponibilidad de los garajes 23 a 86.
- Cualquier documento con un estado «reservado» o «señado» de apartamentos.

---

## 2. Tabla maestra de unidades

158 apartamentos, coincidentes con el brochure («158 apartamentos: 20
monoambientes, 100 de 1 dormitorio, 38 de 2 dormitorios»).

**Archivo completo:** `datos-fuente/tabla-maestra-unidades.csv` (una fila por
unidad, con el precio y el estado de las dos listas) y
`src/datos/unidades.json` (lo que consume la web).

### Resumen por piso

| Piso | Unidades | Disponibles | Vendidas | Plano |
|---|---|---|---|---|
| 1 | 16 (101–116) | 16 | 0 | `piso-01` |
| 2 | 16 (201–216) | 15 | 1 | `pisos-02-09` |
| 3 | 16 | 15 | 1 | `pisos-02-09` |
| 4 | 16 | 13 | 3 | `pisos-02-09` |
| 5 | 16 | 15 | 1 | `pisos-02-09` |
| 6 | 16 | 11 | 5 | `pisos-02-09` |
| 7 | 16 | 7 | 9 | `pisos-02-09` |
| 8 | 16 | 6 | 10 | `pisos-02-09` |
| 9 | 16 | 6 | 10 | `pisos-02-09` |
| 10 | 14 (1001–1014) | 13 | 1 | `piso-10` |
| **Total** | **158** | **117** | **41** | |

### Tipologías (idénticas en las dos listas)

| Tipología | Cantidad | Área habitable | Terrazas uso exclusivo | Área total |
|---|---|---|---|---|
| Monoambiente | 20 | 26,39 m² | 2,79 – 15,54 m² | 33,24 – 45,64 m² |
| 1 dormitorio | 100 | 36,01 – 48,49 m² | 2,79 – 52,52 m² | 44,70 – 98,03 m² |
| 2 dormitorios | 38 | 51,28 – 61,90 m² | 4,67 – 52,01 m² | 63,84 – 114,63 m² |

Las terrazas grandes son del piso 1 (jardines) y del piso 10 (retiro).

### Precios (planilla vigente, 23/10/2026)

- Rango: **USD 85.239** (monoambiente 307) a **USD 199.200** (AP. 101, 2 dormitorios).
- Conexiones: 4% del precio de venta.
- Forma de pago: 25% compromiso · 6 trimestres de 10% · 15% entrega.
- Garajes cotizados: USD 20.000.
- Aviso de la propia lista: «Precios sujetos a ajuste por avance de ventas».

### Garajes

| Fuente | Dato |
|---|---|
| Plantas del brochure | 86 garajes numerados: PB 01–22, primer subsuelo 23–65, segundo subsuelo 66–86 |
| Listas de precios | Sólo los 22 de planta baja, a USD 20.000 |
| Planilla vigente | 1, 18, 19, 20, 21 vendidos · 13, 14, 15, 16, 17 reservados · el resto disponibles |

**Pendiente:** precio y disponibilidad de los garajes 23 a 86.

---

## 3. Verificación cruzada entre las dos listas

Se compararon unidad por unidad las 158 filas del PDF oficial y de la planilla.

| Campo | Resultado |
|---|---|
| Área habitable | **Coinciden las 158** |
| Área total | **Coinciden las 158** |
| Tipología / dormitorios | **Coinciden las 158** |
| Precio | 113 unidades con precio actualizado en la planilla (sube USD 1.200 en casi todos los casos) |
| Estado comercial | **15 apartamentos con estado distinto** |
| Garajes | 10 garajes con estado distinto |

### Los 15 apartamentos con estado en conflicto

| Unidad | Lista oficial PDF (24/06) | Planilla vigente (23/10) |
|---|---|---|
| 207, 404, 601, 713, 715, 716, 807, 808, 908, 913, 914 | disponible | **vendido** |
| 502, 503, 609, 915 | vendido | **disponible** |

La app muestra el dato de la planilla (la más reciente) y avisa del conflicto en
la ficha de cada una de esas unidades y en la sección «De dónde salen los
datos». **Hay que confirmarlos con la dirección comercial antes de publicar.**

---

## 4. Imágenes disponibles y cuál se usó para el selector

| Página del brochure | Imagen | Resolución original | Uso |
|---|---|---|---|
| 3 | Fachada sobre Fernández Crespo | 877 × 1240 | Portada |
| 4 | Hall de acceso | 1754 × 1240 | Galería |
| 7 | Gimnasio | 1755 × 1240 | Galería |
| 8 | Barbacoas con terraza | 1754 × 1240 | Galería |
| 17 / 18 | Interiores día y noche | 1754 × 1144 / 797 | Galería |
| 11 | Planta baja (local, hall, garajes 01–22) | 1364 × 943 | Planta informativa |
| 12 | **Piso 1** | 1294 × 949 | **Selector** |
| 13 | **Pisos 2 a 9** | 1280 × 947 | **Selector** |
| 14 | **Piso 10** | 1280 × 947 | **Selector** |
| 15 | Piso 11 — amenities | 1280 × 938 | Planta informativa |

### Por qué el selector va sobre las plantas y no sobre la fachada

El render de fachada es una perspectiva en escorzo: no permite delimitar
apartamento por apartamento sin inventar las zonas. Las plantas, en cambio,
identifican cada unidad con su número y sus muros, así que la selección es
exacta y verificable. Para hacer además un selector sobre la fachada hace falta
**un alzado frontal del edificio con las unidades identificadas**, que no está
en Drive.

### Cómo se trazaron las zonas

1. Imagen de la planta extraída del PDF a resolución original.
2. Proyección de píxeles oscuros por fila y columna → grilla real de muros.
3. Posición vectorial exacta de cada número de unidad leída del propio PDF
   (los números son vectores, no texto), para anclar cada polígono a su unidad.
4. Verificación visual superponiendo los 46 polígonos sobre las tres plantas.

Tres plantas cubren las 158 unidades: piso 1 (16 zonas), pisos 2–9 (16 zonas
reutilizadas en 8 pisos = 128 unidades) y piso 10 (14 zonas).
**Las 158 unidades quedaron mapeadas.**

---

## 5. Bloqueos y cosas a resolver

1. **Confirmar los 15 estados en conflicto** con la dirección comercial.
2. **Garajes 23 a 86**: falta lista de precios y disponibilidad.
3. **Planos individuales por unidad**: hoy la ficha muestra el recorte real de
   la unidad sobre la planta de su piso. Si aparecen los planos unitarios se
   agregan como imagen propia.
4. **Alzado frontal del edificio** si se quiere además selección sobre la fachada.
5. **Canal de contacto**: completar `contacto.email` / `contacto.whatsapp` en
   `src/datos/proyecto.ts`.
6. **Estado «reservado» en apartamentos**: la documentación sólo lo usa en
   garajes. La web ya tiene color, leyenda y filtro listos para cuando se use.
7. **Datos privados**: las propuestas por unidad (808-908, 113-116, 1004-216)
   son negociaciones particulares y quedaron deliberadamente fuera de la web.
