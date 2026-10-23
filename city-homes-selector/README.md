# City Homes — selector interactivo de apartamentos

Herramienta comercial para que un comprador explore el edificio **City Homes**
(Fernández Crespo 1664/1676, Cordón, Montevideo — Pires Benlian), elija un
apartamento sobre la planta real del proyecto y consulte su tipología,
superficies, precio y estado.

React + TypeScript + Vite, sin dependencias de más. Los polígonos de cada unidad
son una capa SVG sobre las plantas originales del brochure.

---

## Ejecutar

```bash
npm install
npm run dev        # http://localhost:5177
```

```bash
npm run build      # genera dist/ (sitio estático)
npm run preview    # sirve dist/ para revisarlo
```

## Publicar

`npm run build` deja un sitio estático en `dist/`. Sirve tal cual en Vercel,
Netlify, Cloudflare Pages o cualquier hosting estático:

| Hosting | Build command | Output |
|---|---|---|
| Vercel / Netlify / Cloudflare Pages | `npm run build` | `dist` |

`vite.config.ts` usa `base: "./"`, así que también funciona servido desde un
subdirectorio (por ejemplo `mvdprime.uy/city-homes/`) sin tocar nada.

**Antes de publicar:** completá `contacto.email` y/o `contacto.whatsapp` en
[`src/datos/proyecto.ts`](src/datos/proyecto.ts). Mientras queden en `null`, el
formulario arma la consulta y la ofrece para copiar, pero no la envía.

---

## Inventario del material y hallazgos

[`docs/INVENTARIO-Y-HALLAZGOS.md`](docs/INVENTARIO-Y-HALLAZGOS.md) tiene el
relevamiento completo del Drive, la tabla maestra resumida, la verificación
cruzada entre las dos listas de precios y la lista de bloqueos.

## De dónde salen los datos

Todo sale de documentos del proyecto; no hay ningún dato inventado.

| Documento | Qué aporta | Copia local |
|---|---|---|
| `LISTA OFICIAL CITY HOMES.pdf` (Drive > City Homes, 24/06/2026) | lista oficial: unidades, superficies, precios, vendidos, garajes | `datos-fuente/LISTA-OFICIAL-CITY-HOMES.pdf` |
| `LISTAS PIRES BENLIAN.xlsx`, hoja **CITY HOMES** (23/10/2026) | lista vigente: agrega cantidad de baños, sub total y precios actualizados | `datos-fuente/LISTAS-PIRES-BENLIAN.xlsx` — **no versionado**, ver abajo |
| `BROCHURE-CITY-HOMES.pdf` (Drive > City Homes) | renders, plantas, amenities, terminaciones, beneficios fiscales | `public/medios/documentos/brochure-city-homes.pdf` |

**Regla de precedencia.** Cuando los dos listados difieren vale el más reciente
(la planilla del 23/10/2026). La lectura anterior queda guardada en
`historico.listaOficialPdf` de cada unidad, la diferencia aparece listada en
`discrepancias` y, si es una diferencia de *estado*, se muestra como aviso en la
ficha de esa unidad y en la sección «De dónde salen los datos» de la web.

> **La planilla `.xlsx` no está en el repositorio.** Además de City Homes trae
> las listas de precios de ICON 26, Jardines del Polo, SHE-Pocitos y Deco
> Maggiolo, y este repositorio es público. Está ignorada en `.gitignore`: se usa
> en local. Para regenerar los datos hay que copiarla a
> `datos-fuente/LISTAS-PIRES-BENLIAN.xlsx`. Los datos ya generados de City Homes
> viven en `src/datos/unidades.json`, que sí está versionado.

### Regenerar los datos

```bash
npm run datos      # python -I scripts/construir_datos.py
```

Lee los dos documentos de `datos-fuente/` y reescribe
`src/datos/unidades.json`. Requiere Python con `openpyxl` y `pymupdf`:

```bash
pip install openpyxl pymupdf
```

### Actualizar un precio o un estado sin tocar código

Dos caminos, los dos sin pasar por los componentes:

1. **Recomendado** — reemplazá el `.xlsx` en `datos-fuente/` por la planilla
   nueva y corré `npm run datos`.
2. **Puntual** — editá a mano la unidad en `src/datos/unidades.json`
   (`precio`, `estado`, `observaciones`).

---

## Estructura

```
datos-fuente/            documentos originales (no se tocan, son la fuente)
scripts/construir_datos.py   genera src/datos/unidades.json desde esos documentos
public/medios/
  plantas/               plantas del brochure (webp, resolución original)
  renders/               renders del brochure (webp)
  documentos/            brochure en PDF, enlazado desde la web
  marca/                 logotipo City Homes recortado del brochure
src/
  datos/unidades.json    158 unidades + 22 garajes + trazabilidad (generado)
  datos/plantas.json     polígonos de cada unidad, coordenadas normalizadas
  datos/proyecto.ts      textos del proyecto y configuración de contacto
  componentes/           Selector, PlanoInteractivo, FichaUnidad, Filtros,
                         VistaLista, Contacto, EditorZonas
```

### Cómo se trazaron los polígonos

No se dibujaron a ojo. Para cada planta:

1. Se extrajo la imagen original de la planta del PDF (sin reescalar).
2. Se proyectaron los píxeles oscuros por fila y por columna para obtener la
   grilla real de muros del edificio.
3. Se leyó del propio PDF la posición vectorial exacta de cada número de unidad
   (`101`, `02`, `1007`…) y se ancló cada polígono al número que le corresponde.
4. Se verificó el resultado superponiendo los polígonos sobre la planta.

Las coordenadas se guardan normalizadas (0 a 1) sobre la imagen original, así
que la capa SVG acompaña a la imagen a cualquier tamaño de pantalla.

### Editor de zonas

Agregá `?editor=1` a la URL (`http://localhost:5177/?editor=1`), elegí una
unidad en la planta y arrastrá los vértices. El panel de abajo a la derecha
muestra el JSON de la planta y lo copia al portapapeles para pegarlo en
`src/datos/plantas.json` → `planos[].zonas`.

---

## Qué falta / pendientes

- **Selección sobre la fachada.** El render de fachada es una perspectiva: no
  permite delimitar apartamento por apartamento sin inventar zonas. Para
  replicar eso haría falta un **alzado (elevación) frontal del edificio** con las
  unidades identificadas. Hoy la selección se hace sobre las plantas, que sí
  identifican cada unidad con certeza.
- **Planos individuales por unidad.** El brochure sólo trae plantas por piso. La
  ficha muestra el recorte real de la unidad sobre la planta de su piso; si
  aparecen los planos unitarios, se agregan como imagen propia en la ficha.
- **Garajes.** Las plantas numeran 86 garajes (PB 01–22, primer subsuelo 23–65,
  segundo subsuelo 66–86) pero la lista de precios sólo cotiza los 22 de planta
  baja. Falta la lista de precios y disponibilidad de los 64 restantes.
- **Estados.** La documentación sólo distingue *disponible*, *vendido* y
  *reservado* (este último hoy aparece únicamente en garajes). Si el equipo
  comercial maneja «reservado» o «señado» en apartamentos, alcanza con ponerlo
  en la planilla: la web ya tiene el color y el filtro.
- **15 apartamentos (y 10 garajes) con el estado en conflicto** entre la lista
  oficial en PDF y la planilla vigente, listados en la sección «De dónde salen
  los datos» y en [`docs/INVENTARIO-Y-HALLAZGOS.md`](docs/INVENTARIO-Y-HALLAZGOS.md).
  Hay que confirmarlos con la dirección comercial.
- **Canal de contacto** sin configurar (ver arriba).
