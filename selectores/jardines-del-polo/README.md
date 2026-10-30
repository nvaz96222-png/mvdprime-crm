# Jardines del Polo — datos del selector

18 casas en Carrasco, sobre calle Carlos Stajano. Desarrolla Pires Benlian.

El selector se elige sobre el **masterplan del brochure**, no sobre el plano
CAD del arquitecto. La razón es simple: el masterplan es un render donde cada
casa está dibujada y numerada, y es el mismo dibujo que el comprador ya vio en
el folleto. El CAD trae el loteo exacto, pero las parcelas están exportadas
como miles de segmentos sueltos, sin un contorno cerrado por lote, así que
recortar zonas de ahí habría sido reconstruir a ojo lo que el render ya
resuelve.

## De dónde sale cada dato

| Dato | Documento |
|---|---|
| Precio y estado | `LISTAS PIRES BENLIAN.xlsx`, hoja JARDINES DEL POLO (23/10/2026) |
| Área de parcela y metros construidos | la misma planilla |
| Desglose por ambiente, dormitorios | brochure, páginas "CASAS TIPO A / B / C" |
| Masterplan y polígonos | brochure, página 5 |
| Plantas de cada casa | brochure, páginas 15 a 52 (dos por casa) |
| Contraste de precio y estado | `LISTA JARDINES DEL POLO #3.pdf` |

Las dos listas —la planilla y el PDF oficial— se cruzan casa por casa y **hoy
coinciden en todo**: ninguna unidad con el estado en disputa, a diferencia de
City Homes.

Donde sí hay diferencia es en la parcela, contra una tercera fuente: **el
metraje que imprime la planta de cada casa en el brochure**. Coincide en 16 de
18, pero no en estas dos:

| Casa | Lista de precios | Planta del brochure |
|---|---|---|
| 01 | 303 m² | 313 m² |
| 02 | 357 m² | 351 m² |

**Resuelto el 30/10/2026:** la dirección comercial lo dio por error del
brochure. Vale la lista de precios, y la web no muestra ninguna advertencia al
respecto. La diferencia sigue registrada en `PARCELA_BROCHURE` y en
`discrepancias` —no se borra— porque es lo que explica por qué el número
publicado es el que es, si alguien lo compara con el folleto dentro de un año.

## Las tres verificaciones

El trazado de zonas es la parte que más fácil se hace mal, así que no se
confía en una sola comprobación:

1. **El desglose suma.** Tipo A: 84 + 98 + 5 + 21 = 208 m². Tipo B: 62 + 79 +
   5 + 22 = 168. Tipo C: 66 + 80 + 4 + 16 = 166. Los tres dan exacto el total
   que publica el brochure, lo que confirma que los números están bien leídos.
2. **El área del techo se agrupa por tipo.** Las casas A, B y C miden distinto,
   y sus techos en el render también: A ronda los 4.400 px, B los 4.000 y C los
   5.400, sin solaparse. Que los tres grupos caigan justo donde la lista dice
   que están las A, las B y las C es lo que prueba que cada número quedó sobre
   su casa. Si la asignación estuviera corrida, los grupos se mezclarían.
   `construir_datos.py` lo chequea y aborta si no se cumple.
3. **Mirarlo.** `verificar_zonas.py` pinta cada casa de su color de estado con
   el número encima, sobre el plano original.

## Regenerar

```bash
# Hacen falta los documentos en datos-fuente/. El brochure y la planilla no se
# versionan (pesan o traen precios de otros desarrollos): bajalos de Drive.
python -I construir_datos.py      # → salida/
python -I verificar_zonas.py      # → salida/verificacion-zonas.png

# Y desde la raíz del CRM:
node scripts/cargar-unidades.js jardines-del-polo --aplicar
```

El masterplan y `plantas.json` se copian a mano a los dos repos:

```
salida/masterplan.webp  →  public/desarrollos/jardines-del-polo/masterplan.webp   (CRM)
                        →  ../web-nico/public/desarrollos/jardines-del-polo/…
salida/casas/*.webp     →  public/desarrollos/jardines-del-polo/casas/            (CRM)
                        →  ../web-nico/public/desarrollos/jardines-del-polo/casas/
salida/plantas.json     →  lib/desarrollos/jardines-del-polo/plantas.json         (CRM)
                        →  ../web-nico/lib/selector/jardines-del-polo.json
```

`plantas.json` lleva los polígonos **y** la lista de plantas de cada casa
(`fichas`), porque las dos cosas son material del proyecto y no dato comercial.
Precio y estado **no** se copian: viven en Supabase y se editan en el CRM.

Si cambia algo descriptivo —una superficie, una observación nueva— se vuelca a
la base sin tocar lo comercial:

```bash
node scripts/cargar-unidades.js jardines-del-polo --aplicar --sincronizar-fichas
```

## Lo que falta

- **Baños por tipo.** Ni la lista ni las páginas de tipo los dicen. La ficha
  muestra "A confirmar" en vez de inventar un número.
- **Fecha de la lista oficial en PDF.** El archivo se llama "#3" y no trae
  fecha adentro. Se usa sólo para contrastar, así que no bloquea nada.
