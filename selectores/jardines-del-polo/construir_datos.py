"""
construir_datos.py — datos del selector de Jardines del Polo.

Genera, a partir de los documentos originales del desarrollo:

  salida/unidades.json   las 18 casas con precio, estado, superficies y la
                         trazabilidad de cada dato (de qué documento salió)
  salida/plantas.json    el polígono de cada casa sobre el masterplan,
                         normalizado 0..1
  salida/masterplan.webp el masterplan sin los números, para que el selector
                         dibuje sus propias etiquetas

Fuentes (en datos-fuente/):
  · LISTA-JARDINES-DEL-POLO-3.pdf  — lista oficial del desarrollador
  · LISTAS-PIRES-BENLIAN.xlsx      — hoja "JARDINES DEL POLO" (misma lista en
                                     planilla; se usa para cruzar y detectar
                                     diferencias)
  · JDP-BROCHURE.pdf               — masterplan (pág. 5) y fichas por tipo

Las dos listas se cruzan casa por casa. Si difieren en precio o estado, la
diferencia NO se resuelve sola: queda en `discrepancias` y en una observación
de la unidad, igual que se hizo en City Homes.

Uso:  python -I construir_datos.py
"""

import json
import math
import re
import sys
import unicodedata
from pathlib import Path

# La consola de Windows usa cp1252 y se traga los acentos y las flechas.
sys.stdout.reconfigure(encoding="utf-8")

import numpy as np
import openpyxl
import pymupdf
from PIL import Image
from scipy import ndimage

RAIZ = Path(__file__).resolve().parent
FUENTE = RAIZ / "datos-fuente"
SALIDA = RAIZ / "salida"

PDF_LISTA = FUENTE / "LISTA-JARDINES-DEL-POLO-3.pdf"
XLSX = FUENTE / "LISTAS-PIRES-BENLIAN.xlsx"
BROCHURE = FUENTE / "JDP-BROCHURE.pdf"

DOC_PDF = "LISTA JARDINES DEL POLO #3.pdf (Drive > Jardines del Polo)"
DOC_XLSX = 'LISTAS PIRES BENLIAN.xlsx, hoja "JARDINES DEL POLO" (2026-10-23)'
DOC_BROCHURE = "JDP-brochure-21nov.pdf (Drive > Jardines del Polo)"

# Páginas del brochure con la planta de cada casa: (planta baja, planta alta).
# Leídas de los títulos de cada página ("CASA 07 / TIPO A / 4D · PLANTA BAJA").
# El agrupamiento confirma por tercera vez los tipos de la lista: las páginas
# del tipo A son las de las casas 01, 02, 07, 08, 09, 10, 15 y 16, que son
# exactamente las ocho que la lista marca como A.
PAGINAS_CASA = {
    "01": (15, 16), "02": (17, 18), "07": (19, 20), "08": (21, 22),
    "09": (23, 24), "10": (25, 26), "15": (27, 28), "16": (29, 30),
    "03": (32, 33), "04": (34, 35), "05": (36, 37), "06": (38, 39),
    "11": (40, 41), "12": (42, 43), "13": (44, 45), "14": (46, 47),
    "17": (49, 50), "18": (51, 52),
}

# El metraje de la parcela que imprime cada planta del brochure, leído de esas
# mismas páginas. Sirve para cruzarlo con la lista de precios y coincide en 16
# de 18 casas.
#
# Las dos que no son la 01 (303 en la lista, 313 en el brochure) y la 02 (357 y
# 351). El 30/10/2026 la dirección comercial resolvió darlo por error del
# brochure: vale la lista, y la web no muestra ninguna advertencia. La
# diferencia queda registrada acá y en `discrepancias`, que es el motivo de que
# este diccionario siga existiendo: explica por qué el número publicado es el
# que es, sin ensuciar la ficha del comprador.
PARCELA_BROCHURE = {
    "01": 313, "02": 351, "03": 222, "04": 222, "05": 372, "06": 191,
    "07": 287, "08": 314, "09": 282, "10": 231, "11": 348, "12": 203,
    "13": 352, "14": 217, "15": 293, "16": 354, "17": 250, "18": 225,
}

# Ancho máximo de las plantas que se publican. Son para mirar y hacer zoom, no
# para imprimir: más que esto es peso sin lectura ganada.
ANCHO_PLANTA = 1200

# Página del brochure donde está el masterplan, y xref de su imagen de fondo.
# La imagen NO trae los números: están dibujados encima como vectores. Eso es
# justo lo que se quiere — el selector pone sus propias etiquetas.
PAGINA_MASTERPLAN = 5

# ── Tipos de casa ───────────────────────────────────────────────────────────
# Del brochure, páginas "CASAS TIPO A/B/C". El desglose suma exacto el total
# en los tres casos, que es la verificación de que está bien leído. Va como
# lista y no como diccionario para conservar el orden del documento: jsonb
# reordena las claves de un objeto, pero respeta el orden de un array.
TIPOS = {
    "A": {
        "nombre": "Tipo A · 4 dormitorios",
        "dormitorios": 4,
        "construidos": 208,
        "desglose": [["Planta baja", 84], ["Planta alta", 98], ["Lavadero", 5], ["Galería", 21]],
    },
    "B": {
        "nombre": "Tipo B · 3 dormitorios",
        "dormitorios": 3,
        "construidos": 168,
        "desglose": [["Planta baja", 62], ["Planta alta", 79], ["Lavadero", 5], ["Galería", 22]],
    },
    "C": {
        "nombre": "Tipo C · 3 dormitorios",
        "dormitorios": 3,
        "construidos": 166,
        "desglose": [["Planta baja", 66], ["Planta alta", 80], ["Lavadero", 4], ["Galería", 16]],
    },
}

# El propio brochure aclara esto debajo de cada metraje. Se arrastra a la ficha
# para no publicar una superficie como si fuera definitiva.
AVISO_SUPERFICIES = "Metraje a cotejar con Ing. Agrimensor (según el brochure del desarrollo)."


def sin_tildes(t):
    return "".join(c for c in unicodedata.normalize("NFD", t) if unicodedata.category(c) != "Mn")


# ─────────────────────────────────────────────────── listas de precios

FILA = re.compile(r"^(\d{2})([ABC])$")


def leer_pdf_lista():
    """La lista sale del PDF como una línea por celda, en orden de lectura."""
    doc = pymupdf.open(PDF_LISTA)
    lineas = [l.strip() for l in doc[0].get_text().splitlines() if l.strip()]

    casas = {}
    i = 0
    while i < len(lineas):
        m = FILA.match(lineas[i])
        # Cada casa ocupa 5 líneas: código · parcela · construidos · "U$S" ·
        # precio (o VENDIDA) y repite el código al final de la fila.
        if m and i + 4 < len(lineas):
            numero, tipo = m.group(1), m.group(2)
            parcela, construidos, _moneda, valor = lineas[i + 1 : i + 5]
            casas[numero] = {
                "tipo": tipo,
                "parcela": float(parcela),
                "construidos": float(construidos),
                "valor": valor,
            }
            i += 6 if i + 5 < len(lineas) and lineas[i + 5] == lineas[i] else 5
            continue
        i += 1
    return casas


def leer_xlsx_lista():
    wb = openpyxl.load_workbook(XLSX, data_only=True)
    ws = wb["JARDINES DEL POLO"]
    casas = {}
    for fila in ws.iter_rows(values_only=True):
        if not fila or not isinstance(fila[0], str):
            continue
        m = FILA.match(fila[0].strip())
        if not m:
            continue
        numero, tipo = m.group(1), m.group(2)
        casas[numero] = {
            "tipo": tipo,
            "parcela": float(fila[1]),
            "construidos": float(fila[2]),
            "valor": fila[4],
        }
    return casas


def interpretar(valor):
    """'VENDIDA' o un número → (estado, precio)."""
    if isinstance(valor, (int, float)):
        return "disponible", float(valor)
    texto = sin_tildes(str(valor)).strip().upper()
    if texto.startswith("VENDID"):
        return "vendido", None
    if texto.startswith("RESERVAD"):
        return "reservado", None
    # Un número escrito como texto ("760.790,00")
    try:
        return "disponible", float(texto.replace(".", "").replace(",", "."))
    except ValueError:
        return "consultar", None


# ─────────────────────────────────────────────── polígonos sobre el masterplan


def casco_convexo(puntos):
    """Monotone chain. puntos: array (n,2). Devuelve el casco en sentido horario."""
    p = sorted(map(tuple, puntos))
    if len(p) < 3:
        return np.array(p)

    def media(seq):
        salida = []
        for q in seq:
            while len(salida) >= 2:
                (x1, y1), (x2, y2) = salida[-2], salida[-1]
                if (x2 - x1) * (q[1] - y1) - (y2 - y1) * (q[0] - x1) <= 0:
                    salida.pop()
                else:
                    break
            salida.append(q)
        return salida

    return np.array(media(p)[:-1] + media(reversed(p))[:-1], dtype=float)


def rectangulo_minimo(puntos):
    """Rectángulo de área mínima que contiene los puntos (rotating calipers).

    Los techos del masterplan son rectángulos girados: devolver el rectángulo
    mínimo no agrega ni recorta superficie, sólo le saca el borde dentado que
    deja la segmentación por color.
    """
    h = casco_convexo(puntos)
    mejor = None
    for i in range(len(h)):
        borde = h[(i + 1) % len(h)] - h[i]
        largo = math.hypot(*borde)
        if largo < 1e-9:
            continue
        u = borde / largo
        v = np.array([-u[1], u[0]])
        pu, pv = h @ u, h @ v
        area = (pu.max() - pu.min()) * (pv.max() - pv.min())
        if mejor is None or area < mejor[0]:
            mejor = (area, u, v, pu.min(), pu.max(), pv.min(), pv.max())

    _, u, v, u0, u1, v0, v1 = mejor
    esquinas = [u0 * u + v0 * v, u1 * u + v0 * v, u1 * u + v1 * v, u0 * u + v1 * v]
    return np.array(esquinas)


def techos(imagen):
    """Segmenta los techos de teja del masterplan.

    Son el único elemento terracota del render: el resto es verde (césped,
    árboles), gris (losas, autos) o beige (senderos). Una máscara por color y
    componentes conexas alcanzan.
    """
    a = np.asarray(imagen.convert("RGB")).astype(int)
    R, G, B = a[:, :, 0], a[:, :, 1], a[:, :, 2]
    mascara = (R > 80) & (R < 190) & (R - G > 18) & (G - B > 5) & (G > 40) & (B < 120)

    etiquetas, n = ndimage.label(mascara)
    tamanos = ndimage.sum(mascara, etiquetas, range(1, n + 1))
    # Los techos rondan los 4.000 px; lo que sigue es ruido de tejas sueltas.
    grandes = [i + 1 for i in range(n) if tamanos[i] > 2000]

    salida = []
    for lab in grandes:
        ys, xs = np.where(etiquetas == lab)
        salida.append(
            {
                "px": int(len(xs)),
                "centro": (float(xs.mean()), float(ys.mean())),
                "rect": rectangulo_minimo(np.column_stack([xs, ys])),
            }
        )
    return salida


# Qué número lleva cada techo. Leído del masterplan del brochure (pág. 5), que
# imprime el número de cada casa sobre su techo. Son las coordenadas en píxeles
# de la imagen de fondo (1326x903).
#
# No es un dato inventado ni una posición estimada: cada ancla se verifica
# después contra la segmentación —tiene que caer dentro de un techo y de uno
# solo— y, sobre todo, contra la lista de precios, porque el área de los techos
# se agrupa exactamente por tipo (A, B y C miden distinto) y esa agrupación
# tiene que coincidir con la letra que la lista le da a cada casa.
ANCLAS = {
    "01": (1029, 615), "02": (1195, 615), "03": (1108, 481), "04": (1107, 355),
    "05": (1130, 219), "06": (1004, 218), "07": (875, 250),  "08": (709, 250),
    "09": (564, 212),  "10": (398, 212),  "11": (228, 168),  "12": (207, 292),
    "13": (175, 414),  "14": (299, 437),  "15": (424, 475),  "16": (587, 504),
    "17": (732, 644),  "18": (753, 521),
}


def asignar(blobs):
    """Cada ancla a su techo, exigiendo que la correspondencia sea 1 a 1."""
    asignado = {}
    for numero, (ax, ay) in ANCLAS.items():
        dist = sorted(
            (math.hypot(b["centro"][0] - ax, b["centro"][1] - ay), k)
            for k, b in enumerate(blobs)
        )
        if dist[0][0] > 40:
            raise SystemExit(f"La casa {numero} no cae sobre ningún techo (a {dist[0][0]:.0f} px).")
        if dist[1][0] < dist[0][0] * 2.5:
            raise SystemExit(f"La casa {numero} queda entre dos techos; el anclaje es ambiguo.")
        asignado[numero] = dist[0][1]

    if len(set(asignado.values())) != len(ANCLAS):
        raise SystemExit("Dos casas quedaron sobre el mismo techo.")
    return asignado


def verificar_por_tipo(blobs, asignado, casas):
    """El área del techo tiene que agruparse por tipo de casa.

    A, B y C son casas de distinto tamaño, así que sus techos miden distinto en
    el render. Si la asignación número→techo estuviera corrida, los grupos se
    mezclarían. Es la comprobación que vuelve objetivo el anclaje.
    """
    por_tipo = {}
    for numero, idx in asignado.items():
        por_tipo.setdefault(casas[numero]["tipo"], []).append(blobs[idx]["px"])

    print("\nÁrea del techo por tipo (px):")
    rangos = {}
    for tipo in sorted(por_tipo):
        v = por_tipo[tipo]
        rangos[tipo] = (min(v), max(v))
        disp = (max(v) - min(v)) / (sum(v) / len(v))
        print(f"  {tipo}: {len(v)} casas · {min(v)}–{max(v)} · dispersión {disp:.1%}")
        if disp > 0.15:
            raise SystemExit(f"Los techos del tipo {tipo} no se parecen entre sí; revisar el anclaje.")

    orden = sorted(rangos.items(), key=lambda kv: kv[1][0])
    for (t1, r1), (t2, r2) in zip(orden, orden[1:]):
        if r1[1] >= r2[0]:
            raise SystemExit(f"Los tipos {t1} y {t2} se superponen en área; el anclaje no queda probado.")
    print("  Los tres grupos quedan separados: la asignación casa-techo cierra con la lista.")


# ───────────────────────────────────────────────── plantas de cada casa


def exportar_plantas_casas(brochure):
    """Recorta la planta baja y la planta alta de cada casa del brochure.

    Se renderiza la región de la página en vez de extraer la imagen de fondo,
    porque la página de planta alta dibuja el piso superior ENCIMA del mismo
    render del terreno: quedarse con la imagen incrustada más grande traería el
    fondo sin la planta.
    """
    destino = SALIDA / "casas"
    destino.mkdir(exist_ok=True)

    fichas = {}
    for casa, paginas in sorted(PAGINAS_CASA.items()):
        imagenes = []
        for rotulo, numero in zip(("Planta baja", "Planta alta"), paginas):
            pagina = brochure[numero - 1]
            rects = [r for x in pagina.get_images(full=True) for r in pagina.get_image_rects(x[0])]
            if not rects:
                raise SystemExit(f"La página {numero} (casa {casa}) no tiene plano.")
            caja = rects[0]
            for r in rects[1:]:
                caja = caja | r
            caja = pymupdf.Rect(caja.x0 - 6, caja.y0 - 6, caja.x1 + 6, caja.y1 + 6) & pagina.rect

            # dpi tal que el lado largo quede en ANCHO_PLANTA.
            lado = max(caja.width, caja.height)
            pm = pagina.get_pixmap(dpi=int(72 * ANCHO_PLANTA / lado), clip=caja)
            im = Image.frombytes("RGB", (pm.width, pm.height), pm.samples)

            archivo = f"{casa}-{rotulo.lower().replace(' ', '-')}.webp"
            im.save(destino / archivo, "WEBP", quality=80, method=6)
            imagenes.append(
                {"titulo": rotulo, "imagen": f"/desarrollos/jardines-del-polo/casas/{archivo}"}
            )
        fichas[casa] = imagenes

    peso = sum(f.stat().st_size for f in destino.glob("*.webp")) / 1024
    print(f"Plantas por casa: {len(fichas) * 2} imágenes · {peso:.0f} KB en total")
    return fichas


# ───────────────────────────────────────────────────────────────── main

def main():
    SALIDA.mkdir(exist_ok=True)

    pdf = leer_pdf_lista()
    xlsx = leer_xlsx_lista()
    if len(pdf) != 18:
        raise SystemExit(f"El PDF de la lista dio {len(pdf)} casas, se esperaban 18.")
    if set(pdf) != set(xlsx):
        raise SystemExit("Las dos listas no traen las mismas casas.")

    # ── Cruce de las dos fuentes ─────────────────────────────────────────
    discrepancias = []
    for numero in sorted(pdf):
        a, b = pdf[numero], xlsx[numero]
        for campo in ("tipo", "parcela", "construidos"):
            if a[campo] != b[campo]:
                discrepancias.append(
                    {"casa": numero, "campo": campo, "listaPdf": a[campo], "planilla": b[campo]}
                )
        ea, pa = interpretar(a["valor"])
        eb, pb = interpretar(b["valor"])
        if ea != eb:
            discrepancias.append({"casa": numero, "campo": "estado", "listaPdf": ea, "planilla": eb})
        if pa != pb:
            discrepancias.append({"casa": numero, "campo": "precio", "listaPdf": pa, "planilla": pb})

        # Tercera fuente para la parcela: el metraje impreso en la planta del
        # brochure. No decide nada —manda la lista— pero si no coincide hay que
        # avisarlo, no elegir en silencio.
        if PARCELA_BROCHURE.get(numero) != b["parcela"]:
            discrepancias.append(
                {
                    "casa": numero,
                    "campo": "parcela",
                    "planilla": b["parcela"],
                    "brochure": PARCELA_BROCHURE.get(numero),
                }
            )

    # ── Masterplan y polígonos ───────────────────────────────────────────
    br = pymupdf.open(BROCHURE)
    pagina = br[PAGINA_MASTERPLAN - 1]
    xref = pagina.get_images(full=True)[0][0]
    pm = pymupdf.Pixmap(br.extract_image(xref)["image"])
    if pm.colorspace and pm.colorspace.n == 4:
        pm = pymupdf.Pixmap(pymupdf.csRGB, pm)
    masterplan = Image.frombytes("RGB", (pm.width, pm.height), pm.samples)
    masterplan.save(SALIDA / "masterplan.webp", "WEBP", quality=88, method=6)

    fichas = exportar_plantas_casas(br)

    blobs = techos(masterplan)
    print(f"Techos detectados: {len(blobs)}")
    if len(blobs) != 18:
        raise SystemExit("Se esperaban 18 techos en el masterplan.")

    asignado = asignar(blobs)
    verificar_por_tipo(blobs, asignado, pdf)

    ancho, alto = masterplan.size
    zonas = {}
    for numero, idx in asignado.items():
        rect = blobs[idx]["rect"]
        zonas[numero] = [
            [round(float(x) / ancho, 4), round(float(y) / alto, 4)] for x, y in rect
        ]

    plantas = {
        "planos": [
            {
                "id": "masterplan",
                "titulo": "Masterplan",
                "imagen": "/desarrollos/jardines-del-polo/masterplan.webp",
                "ancho": ancho,
                "alto": alto,
                # Un solo plano y casas en planta baja: no hay rail de pisos.
                "pisos": [],
                "zonas": zonas,
            }
        ],
        # Las plantas de cada casa viajan con los planos y no con la base: son
        # material del brochure, no dato comercial.
        "fichas": fichas,
    }
    (SALIDA / "plantas.json").write_text(
        json.dumps(plantas, ensure_ascii=False, indent=1), encoding="utf-8"
    )

    # ── Unidades ─────────────────────────────────────────────────────────
    unidades = []
    for numero in sorted(pdf):
        base = xlsx[numero]  # la planilla es la lectura vigente
        tipo = base["tipo"]
        ficha = TIPOS[tipo]
        estado, precio = interpretar(base["valor"])
        estado_pdf, precio_pdf = interpretar(pdf[numero]["valor"])

        observaciones = [AVISO_SUPERFICIES]
        if estado != estado_pdf or precio != precio_pdf:
            observaciones.insert(
                0,
                "Estado o precio a confirmar: la lista oficial y la planilla no "
                "coinciden. Se muestra lo que dice la planilla.",
            )

        unidades.append(
            {
                "id": f"casa-{numero}",
                "unidad": numero,
                "etiqueta": f"Casa {numero}",
                "tipo": "casa",
                "nivel": None,
                "piso": None,
                "tipologia": ficha["nombre"],
                "dormitorios": ficha["dormitorios"],
                "banos": None,
                "superficies": {
                    "parcela": base["parcela"],
                    "construidos": base["construidos"],
                    "desglose": ficha["desglose"],
                },
                "precio": precio,
                "moneda": "USD",
                "estado": estado,
                "plano": "masterplan",
                "zona": numero,
                "observaciones": observaciones,
                "fuentes": {
                    "estadoYPrecio": DOC_XLSX,
                    "superficies": f"{DOC_XLSX} (parcela y construidos) · {DOC_BROCHURE} (desglose por tipo)",
                    "plano": f"{DOC_BROCHURE} — masterplan, página {PAGINA_MASTERPLAN}",
                },
                "historico": {
                    "listaOficialPdf": {
                        "estado": estado_pdf,
                        "precio": precio_pdf,
                        "documento": DOC_PDF,
                    }
                },
            }
        )

    salida = {
        "generado": "selectores/jardines-del-polo/construir_datos.py",
        "proyecto": "jardines-del-polo",
        "fuentes": {"listaOficialPdf": DOC_PDF, "planillaVigente": DOC_XLSX, "brochure": DOC_BROCHURE},
        "reglaDePrecedencia": (
            "Ante diferencias entre documentos vale el más reciente (la planilla). "
            "La lectura de la lista oficial se conserva en historico.listaOficialPdf "
            "y la diferencia queda listada en discrepancias."
        ),
        "condiciones": {
            "gastos": "Gastos: 5% del precio de venta.",
            "formaDePago": "25% compromiso · 6 trimestres de 10% · 15% a la entrega",
            "avisoPrecios": "Precios sujetos a ajuste por avance de ventas.",
        },
        "tipos": TIPOS,
        "unidades": unidades,
        "discrepancias": discrepancias,
    }
    (SALIDA / "unidades.json").write_text(
        json.dumps(salida, ensure_ascii=False, indent=1), encoding="utf-8"
    )

    # ── Resumen ──────────────────────────────────────────────────────────
    from collections import Counter

    print(f"\nCasas: {len(unidades)} · {dict(Counter(u['estado'] for u in unidades))}")
    print(f"Tipos: {dict(Counter(u['tipologia'][:6] for u in unidades))}")
    precios = [u["precio"] for u in unidades if u["precio"]]
    print(f"Precios: {len(precios)} con valor · USD {min(precios):,.0f} – {max(precios):,.0f}")
    print(f"Discrepancias entre las dos listas: {len(discrepancias)}")
    print(f"\n→ {SALIDA / 'unidades.json'}")
    print(f"-> {SALIDA / 'plantas.json'}")
    print(f"-> {SALIDA / 'masterplan.webp'}  ({ancho}x{alto})")


if __name__ == "__main__":
    main()
