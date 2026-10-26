# ¿A qué otros proyectos les podemos hacer el selector?

Relevamiento del Drive hecho el 24/10/2026, sobre la carpeta PROYECTOS y las
carpetas compartidas por Vitrium Capital.

El selector necesita **dos cosas**, y sólo dos:

1. Una **lista de precios por unidad** (precio y estado de cada apartamento).
2. Un **plano donde cada unidad esté identificada**, preferentemente vectorial,
   para poder anclar los polígonos sin inventar nada.

Lo que sobra —renders, brochures, videos— suma para la página, pero no habilita
el selector.

---

## Se puede hacer ya

| Proyecto | Lista | Plano | Nota |
|---|---|---|---|
| **City Homes** | ✅ | ✅ | **Hecho y publicado** |
| **Jardines del Polo** | ✅ `LISTA JARDINES DEL POLO #3.pdf` + planilla (18 casas) | ✅ `planos de polo piscinas.pdf` | El mejor candidato que queda |
| **01 Sync** | ✅ `Lista Octubre 2026` | ✅ carpeta PLANTAS, un PDF por piso | 104 unidades |
| **01 Vista** | ✅ carpeta LISTAS DE PRECIOS | ✅ carpeta PLANTAS por piso | 179 unidades, la más grande |
| **01 Vila** | ✅ | ✅ | 81 unidades |
| **01 Libertador** | ✅ | ✅ | 80 unidades |
| **Rotunda al Lago** | ✅ | ✅ | 168 unidades |

### Jardines del Polo es el próximo

Es el que más se destaca y por una razón concreta: no son apartamentos sino
**18 casas**, así que el selector va sobre el **plano de loteo**, no sobre
plantas. Visualmente es lo más parecido a lo que hace JM, y es una pieza que
ningún competidor local tiene.

El plano (`planos de polo piscinas.pdf`) es un CAD exportado a PDF: 85.000
objetos vectoriales, con el número de cada casa como texto en su posición exacta
y el límite de cada parcela como trazo. Es mejor fuente que la de City Homes —
ahí tuve que deducir los muros de los píxeles; acá las parcelas vienen
dibujadas.

### Los cinco de Vitrium

Todos comparten la misma estructura de carpeta: LISTA DE PRECIOS, PLANTAS,
TIPOLOGÍAS, RENDERS. Revisé la planta del piso 4 de 01 Sync: es un PDF vectorial
con las unidades numeradas como texto (401 a 411) y 10.862 objetos de dibujo.
O sea, la misma calidad de fuente que Jardines del Polo.

Si hacemos uno, los otros cuatro salen casi en cadena: el trabajo pesado es el
pipeline, que ya está escrito, y cambiar el parser de la lista de precios de
cada desarrolladora.

**01 Del Centro** y **01 Parque Batlle** quedan afuera: las carpetas compartidas
están vacías y los dos figuran como vendidos/terminados.

---

## Falta material

| Proyecto | Lista | Plano | Qué hay que pedir |
|---|---|---|---|
| **ICON 26** | ✅ `LISTA ICON #6.pdf`, 12 páginas | ❌ | Las plantas por piso. En Drive sólo está el plano de los locales destacados y el del piso corporativo |
| **Déco Maggiolo** | ✅ `LISTA DECO #5.pdf` + planilla | ❌ | Las plantas. Hoy sólo hay un render |
| **SHE-Pocitos** | ✅ sólo en la planilla de Pires | ❌ | Todo el material gráfico: no tiene carpeta en Drive |
| **Alive Residences** | ✅ ventas y alquileres en PDF | ❌ | Las plantas. Hay sólo fotos de marketing. Además no está publicado en la web todavía |

A ICON, Déco y Alive les falta exactamente lo mismo y es un pedido de un
renglón a cada desarrolladora: **el PDF de las plantas por piso con las unidades
numeradas**. Si es el PDF que usó el arquitecto, mejor; si es una imagen
escaneada, también sirve pero el trazado lleva más tiempo.

---

## Cuánto cuesta cada uno

Con el pipeline ya escrito, por proyecto:

- **Parsear la lista de precios** — cada desarrolladora tiene su formato, así
  que es un parser nuevo cada vez. Es la parte más aburrida y la más propensa a
  errores silenciosos; conviene siempre cruzar dos fuentes como hicimos en City
  Homes, que fue lo que destapó las 15 unidades con el estado en conflicto.
- **Trazar los polígonos** — en los vectoriales es casi automático. En City
  Homes fue a mano sobre la grilla de muros porque la planta venía como imagen.
- **Publicar** — ya está resuelto: se agrega el slug en `lib/city-homes` y
  aparece solo.

Los proyectos de Vitrium tienen una ventaja extra: **01 Vista trae hasta la
numeración de cocheras**, así que ahí se puede vender el garaje desde el mismo
plano, que es algo que en City Homes quedó pendiente por falta de datos.
