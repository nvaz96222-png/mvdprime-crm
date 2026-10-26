# City Homes · Campaña Meta del selector de unidades

Objetivo: que la gente entre a **mvdprime.uy/desarrollos/city-homes** y toque una
unidad. El activo no es el edificio, es *poder elegirlo vos*.

---

## La idea

Comprar en pozo en Uruguay arranca casi siempre igual: mandás un WhatsApp
preguntando qué queda y a cuánto, y esperás. El selector da vuelta eso — entrás
y lo ves: qué está disponible, en qué piso, cuánto mide y cuánto sale.

El anuncio no vende el apartamento. Vende **sacarse la duda sin preguntar**.

> **El plano, abierto.**
> 117 de 158 disponibles. Fijate cuál es el tuyo.

Tres ángulos para testear, en este orden:

1. **Transparencia** — "El precio de cada unidad, sin preguntar." Es lo más
   diferencial y lo que nadie más hace en el mercado local.
2. **Escasez real** — "Quedan 117 de 158." Es un dato verdadero de la lista
   vigente, no un apuro inventado. Se actualiza solo cuando cambia la planilla.
3. **Control** — "Elegí vos, no te lo eligen." Habla al que ya está buscando y
   está cansado de que le ofrezcan lo que el vendedor necesita colocar.

---

## Piezas

Todas en `piezas/`, generadas con `piezas.py` a partir de material real del
proyecto: el render de fachada del brochure y la planta original del piso 9 con
los polígonos reales de cada unidad. **No hay una sola imagen generada ni un
render inventado**, y los precios que aparecen salen de la lista vigente.

| Archivo | Formato | Dónde va |
|---|---|---|
| `01-feed-fachada.png` | 1080×1080 | Feed · ángulo transparencia |
| `02-feed-planta.png` | 1080×1080 | Feed · muestra verde/rojo, el ángulo escasez |
| `03-story.png` | 1080×1920 | Stories y Reels estáticos |
| `04-carrusel-1/2/3.png` | 1080×1080 | Carrusel: gancho → plano → ficha |

El carrusel es la pieza que más espero que rinda: cuenta la mecánica en tres
pasos y el tercero ya tiene el precio de una unidad concreta, que es el momento
en que la persona entiende que esto no es un folleto.

### Reel de 15" (guion)

Se graba con una captura de pantalla del selector. Sin voz: texto en pantalla y
música. Lo que convence es el gesto del dedo sobre el plano.

| Tiempo | Imagen | Texto en pantalla |
|---|---|---|
| 0-2" | Render de fachada, zoom lento | "City Homes · Cordón" |
| 2-4" | Corte al plano del piso 9, verde y rojo | "Esto es lo que queda" |
| 4-7" | El dedo toca la 909, se abre la ficha | "Tocás y ves el precio" |
| 7-10" | Scroll de la ficha: m², terraza, plan de pago | "USD 163.174 · 63,84 m²" |
| 10-13" | Vuelve al plano, cambia de piso con el rail | "10 pisos. 117 disponibles." |
| 13-15" | Logo MVD Prime sobre fondo verde | "Entrá y elegí el tuyo" |

Primeros 2 segundos sin logo: que se vea el edificio antes que la marca.

---

## Copies

### Texto principal

**A — transparencia**
> En City Homes podés ver el precio de cada apartamento sin preguntarle a nadie.
> Entrás al plano, tocás la unidad que te gusta y ahí está: metraje, terraza,
> piso y precio. Quedan 117 de 158.
> Fernández Crespo y Uruguay, Cordón.

**B — escasez**
> De los 158 apartamentos de City Homes quedan 117.
> En el plano están los que siguen disponibles, en verde, y los que ya se
> vendieron, en rojo. Sin llamar para preguntar qué queda.

**C — control**
> Elegir un apartamento en pozo no debería ser mandar un WhatsApp y esperar.
> Abrí el plano de City Homes, mirá piso por piso y quedate con el que te
> cierra. Monoambientes, 1 y 2 dormitorios, todos con terraza. Desde USD 85.239.

### Títulos (hasta 40 caracteres)

- Elegí tu apartamento en el plano
- 117 de 158 disponibles
- El precio de cada unidad, a la vista
- Mirá qué queda en City Homes
- Tocá el plano y mirá el precio

### Descripciones

- Monoambientes, 1 y 2 dormitorios. Desde USD 85.239.
- Cordón, a pasos de 18 de Julio. 100% IVA off.
- Precio, metraje y disponibilidad de cada unidad.

**CTA:** *Más información* (no *Comprar*, que asusta en un ticket de seis cifras).

---

## Segmentación

**Geo:** Montevideo + Ciudad de la Costa. 

**Edad:** 28-55. El monoambiente de USD 85.000 y el 2 dormitorios de USD 199.000
no le hablan a la misma persona: conviene separarlos en dos conjuntos con
creativos distintos, el monoambiente con el ángulo inversión y el 2 dormitorios
con el de vivienda.

**Públicos, en orden de prioridad:**

1. **Retargeting** — visitantes de mvdprime.uy de los últimos 30 días, y
   especialmente los que entraron a cualquier `/desarrollos/`. Es el público más
   barato y el que ya conoce la marca.
2. **Lookalike 1%** de la base de leads del CRM. Son compradores reales de
   inmuebles en Uruguay; vale más que cualquier interés de Meta.
3. **Intereses** — inversión inmobiliaria, bienes raíces, vivienda propia,
   cruzado con comportamiento de "mudanza reciente" y propietarios.

**Presupuesto de arranque:** poco y repartido. Dos conjuntos (retargeting y
lookalike), tres creativos cada uno, y dejar que Meta mate lo que no rinde antes
de subir. La métrica a mirar la primera semana no es el lead: es el **costo por
persona que abre una ficha de unidad**. Si eso está barato, el resto viene.

---

## Medición — hay algo para resolver antes de pautar

**El formulario de mvdprime.uy no captura nada.** Arma un mail a
contacto@mvdprime.uy y listo. Eso significa que, si pautás hoy, Meta no va a
poder atribuir un solo lead y vos no vas a saber qué anuncio funcionó. La
campaña va a estar optimizando a ciegas.

Tres cosas, de menor a mayor esfuerzo:

1. **Pixel de Meta en la web.** Sin esto no hay retargeting ni lookalike de
   visitantes. Es el paso uno y es media hora de trabajo.

2. **Evento propio cuando alguien abre una ficha de unidad.** El selector ya
   sabe exactamente qué unidad tocó la persona: se puede disparar un
   `ViewContent` con el número de unidad, el precio y la tipología. Eso le da a
   Meta una señal de intención mucho más fuerte que una visita, y a vos te dice
   qué unidades miran más — que es información comercial, no sólo de marketing.

3. **Que el formulario deje el lead en el CRM.** La página del CRM ya tiene el
   endpoint andando con captura de UTM y asignación de agente. Replicarlo en la
   web pública cierra el circuito: Meta → unidad → lead con UTM → agente.
   Mientras eso no exista, una salida provisoria es mandar el tráfico pago a la
   página del CRM, que sí captura, aunque el diseño sea otro.

**UTMs sugeridos** para que la trazabilidad arranque desde el día uno:

```
https://mvdprime.uy/desarrollos/city-homes?utm_source=meta&utm_medium=paid&utm_campaign=city-homes-selector&utm_content=carrusel-ficha
```

---

## Para después

Si el selector rinde, el mismo formato se puede replicar en **Jardines del Polo**
(selector sobre el plano de loteo, con las 18 casas) y en los desarrollos de
Vitrium, que tienen plantas por piso en Drive. Ver
[`docs/selector-proyectos-candidatos.md`](../../docs/selector-proyectos-candidatos.md).
