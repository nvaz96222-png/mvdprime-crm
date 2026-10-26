"""
piezas.py — compone las piezas de Meta para la campaña del selector.

Todo lo visual sale de material real del proyecto: el render de fachada del
brochure de City Homes y la planta original del piso 1 con los polígonos
reales de cada unidad (los mismos que usa la web). No hay imágenes generadas.

Uso:  python -I marketing/selector-city-homes/piezas.py
Salida: marketing/selector-city-homes/piezas/*.png
"""

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

RAIZ = Path(__file__).resolve().parent.parent.parent
SALIDA = Path(__file__).resolve().parent / "piezas"
SALIDA.mkdir(parents=True, exist_ok=True)

PLANTA = RAIZ / "public/desarrollos/city-homes/plantas/piso-01.webp"
ZONAS = json.loads((RAIZ / "lib/desarrollos/city-homes/plantas.json").read_text("utf-8"))
UNIDADES = json.loads((RAIZ / "lib/desarrollos/city-homes/unidades.json").read_text("utf-8"))
FACHADA = RAIZ / "city-homes-selector/public/medios/renders/fachada.webp"
LOGO_CH = RAIZ / "city-homes-selector/public/medios/marca/city-homes.png"

VERDE = (11, 46, 30)
VERDE_UI = (26, 77, 55)
ROJO_UI = (154, 59, 48)
ORO = (200, 162, 74)
HUESO = (248, 247, 244)
BLANCO = (255, 255, 255)

F = "C:/Windows/Fonts/"
serif = lambda s: ImageFont.truetype(F + "georgiab.ttf", s)
serif_r = lambda s: ImageFont.truetype(F + "georgia.ttf", s)
sans = lambda s: ImageFont.truetype(F + "arial.ttf", s)
sans_b = lambda s: ImageFont.truetype(F + "arialbd.ttf", s)


def recortar(img, w, h):
    """Recorte centrado al ratio pedido y resize."""
    r_dst, r_src = w / h, img.width / img.height
    if r_src > r_dst:
        nw = int(img.height * r_dst)
        img = img.crop(((img.width - nw) // 2, 0, (img.width + nw) // 2, img.height))
    else:
        nh = int(img.width / r_dst)
        img = img.crop((0, (img.height - nh) // 2, img.width, (img.height + nh) // 2))
    return img.resize((w, h), Image.LANCZOS)


def velo(img, desde=0.55, alto=0.6, color=VERDE):
    """Degradado desde abajo para que el texto se lea sobre la foto."""
    capa = Image.new("RGBA", img.size, color + (0,))
    d = ImageDraw.Draw(capa)
    y0 = int(img.height * (1 - alto))
    for y in range(y0, img.height):
        a = int(255 * desde * ((y - y0) / (img.height - y0)) ** 1.4)
        d.line([(0, y), (img.width, y)], fill=color + (a,))
    return Image.alpha_composite(img.convert("RGBA"), capa)


def planta_con_selector(ancho, alto, piso=9, destacada=None, zoom=1.0, desplazar=(0, 0)):
    """La planta real con los polígonos reales pintados por estado.

    Por defecto el piso 9, que tiene disponibles y vendidas: así la pieza
    muestra el contraste de colores que después ve el que entra.
    """
    plano = next(p for p in ZONAS["planos"] if piso in p["pisos"])
    base = Image.open(RAIZ / "public" / plano["imagen"].lstrip("/")).convert("RGBA")
    capa = Image.new("RGBA", base.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(capa)
    delpiso = [u for u in UNIDADES["unidades"] if u["piso"] == piso]
    estados = {u["zona"]: u["estado"] for u in delpiso}
    numero = {u["zona"]: u["unidad"] for u in delpiso}
    if destacada is None:
        destacada = next(u["zona"] for u in delpiso if u["estado"] == "disponible")

    for zona, pts in plano["zonas"].items():
        puntos = [(x * base.width, y * base.height) for x, y in pts]
        vendida = estados.get(zona) == "vendido"
        color = ROJO_UI if vendida else VERDE_UI
        alpha = 150 if zona == destacada else (70 if not vendida else 60)
        d.polygon(puntos, fill=color + (alpha,), outline=color + (255,), width=5 if zona == destacada else 3)

    img = Image.alpha_composite(base, capa)

    # Chips con el número de unidad, como en la web
    d2 = ImageDraw.Draw(img)
    f = sans_b(22)
    for zona, pts in plano["zonas"].items():
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        cx = sum(xs) / len(xs) * base.width
        cy = sum(ys) / len(ys) * base.height
        destac = zona == destacada
        color = VERDE if destac else (ROJO_UI if estados.get(zona) == "vendido" else VERDE_UI)
        etiqueta = numero.get(zona, zona)
        tw = d2.textlength(etiqueta, font=f)
        caja = [cx - tw / 2 - 10, cy - 19, cx + tw / 2 + 10, cy + 19]
        d2.rounded_rectangle(caja, 6, fill=color + (255,))
        if destac:
            d2.rounded_rectangle(caja, 6, outline=ORO + (255,), width=4)
        d2.text((cx, cy), etiqueta, font=f, fill=BLANCO, anchor="mm")

    if zoom != 1.0:
        nw, nh = int(img.width / zoom), int(img.height / zoom)
        cx = img.width // 2 + desplazar[0]
        cy = img.height // 2 + desplazar[1]
        img = img.crop((cx - nw // 2, cy - nh // 2, cx + nw // 2, cy + nh // 2))
    return recortar(img, ancho, alto)


def ficha(ancho=430, unidad="909"):
    """Tarjeta de unidad con los datos reales de la lista vigente."""
    u = next(x for x in UNIDADES["unidades"] if x["unidad"] == unidad)
    alto = 300
    card = Image.new("RGBA", (ancho, alto), BLANCO + (255,))
    d = ImageDraw.Draw(card)
    d.rectangle([0, 0, ancho - 1, alto - 1], outline=(228, 225, 216, 255), width=2)

    d.text((26, 26), u["etiqueta"], font=serif(38), fill=VERDE)
    d.text((26, 76), f"{u['nivel']} · {u['tipologia']}", font=sans(19), fill=(90, 98, 92))

    etiqueta = "Disponible"
    tw = d.textlength(etiqueta, font=sans_b(17))
    d.rounded_rectangle([ancho - 42 - tw, 30, ancho - 22, 62], 16, fill=(232, 241, 237, 255))
    d.text((ancho - 32 - tw / 2, 46), etiqueta, font=sans_b(17), fill=VERDE_UI, anchor="mm")

    d.text((26, 118), f"USD {u['precio']:,.0f}".replace(",", "."), font=serif(46), fill=VERDE_UI)

    cols = [
        ("ÁREA HABITABLE", f"{u['habitable']:.2f} m²".replace(".", ",")),
        ("TERRAZA", f"{u['terrazas']:.2f} m²".replace(".", ",")),
        ("TOTAL", f"{u['total']:.2f} m²".replace(".", ",")),
    ]
    for i, (k, v) in enumerate(cols):
        x = 26 + i * ((ancho - 52) // 3)
        d.text((x, 196), k, font=sans(13), fill=(150, 156, 149))
        d.text((x, 216), v, font=sans_b(20), fill=(40, 48, 42))

    d.rounded_rectangle([26, 252, ancho - 26, alto - 22], 4, fill=ORO + (255,))
    d.text((ancho / 2, 275), f"CONSULTAR POR LA {u['etiqueta']}", font=sans_b(17), fill=VERDE, anchor="mm")
    return card


def marca(d, x, y, color=BLANCO, chico=False):
    d.text((x, y), "MVD Prime", font=serif(30 if not chico else 24), fill=color)
    d.text((x, y + (36 if not chico else 29)), "R E A L   E S T A T E",
           font=sans_b(13 if not chico else 11), fill=ORO)


def bloque_texto(d, x, y, lineas, fuente, fill, interlinea):
    for i, l in enumerate(lineas):
        d.text((x, y + i * interlinea), l, font=fuente, fill=fill)


# ─────────────────────────────────────────────────────────── 1. feed fachada

def feed_fachada():
    img = recortar(Image.open(FACHADA).convert("RGBA"), 1080, 1080)
    img = velo(img, 0.82, 0.72)
    d = ImageDraw.Draw(img)
    d.text((70, 596), "CITY HOMES · CORDÓN", font=sans_b(21), fill=ORO)
    bloque_texto(d, 70, 640, ["158 apartamentos.", "Elegí el tuyo", "en el plano."], serif(72), BLANCO, 86)
    d.text((70, 918), "Precio, metraje y disponibilidad de cada unidad, en vivo.",
           font=sans(25), fill=(222, 228, 223))
    d.rounded_rectangle([70, 966, 408, 1026], 4, fill=ORO + (255,))
    d.text((239, 996), "VER EL EDIFICIO", font=sans_b(21), fill=VERDE, anchor="mm")
    marca(d, 790, 966)
    img.convert("RGB").save(SALIDA / "01-feed-fachada.png")


# ──────────────────────────────────────────────────────────── 2. feed planta

def feed_planta():
    fondo = Image.new("RGBA", (1080, 1080), HUESO + (255,))
    planta = planta_con_selector(1080, 760, zoom=1.22, desplazar=(-60, 0))
    fondo.paste(planta, (0, 0))
    d = ImageDraw.Draw(fondo)

    d.rectangle([0, 700, 1080, 760], fill=HUESO + (0,))
    d.text((60, 806), "ASÍ ELEGÍS TU APARTAMENTO", font=sans_b(22), fill=(150, 156, 149))
    bloque_texto(d, 60, 846, ["Tocás una unidad", "y ves todo."], serif(60), VERDE, 72)

    # leyenda real
    y = 1008
    for color, txt in [(VERDE_UI, "Disponible"), (ROJO_UI, "Vendido")]:
        d.ellipse([60 if color == VERDE_UI else 290, y, (60 if color == VERDE_UI else 290) + 20, y + 20], fill=color)
        d.text(((60 if color == VERDE_UI else 290) + 32, y - 2), txt, font=sans(24), fill=(70, 78, 72))
    marca(d, 790, 980, VERDE)
    fondo.convert("RGB").save(SALIDA / "02-feed-planta.png")


# ───────────────────────────────────────────────────────── 3. story vertical

def story():
    img = Image.new("RGBA", (1080, 1920), VERDE + (255,))
    foto = recortar(Image.open(FACHADA).convert("RGBA"), 1080, 980)
    foto = velo(foto, 0.9, 0.5)
    # oscurecido arriba para que la marca se lea sobre el cielo
    techo = Image.new("RGBA", foto.size, (0, 0, 0, 0))
    dt = ImageDraw.Draw(techo)
    for y in range(300):
        dt.line([(0, y), (foto.width, y)], fill=VERDE + (int(150 * (1 - y / 300) ** 1.6),))
    img.paste(Image.alpha_composite(foto, techo), (0, 0))

    planta = planta_con_selector(1000, 700, zoom=1.5, desplazar=(-120, 0))
    sombra = Image.new("RGBA", (1000, 700), (0, 0, 0, 90)).filter(ImageFilter.GaussianBlur(18))
    img.paste(sombra, (44, 1046), sombra)
    img.paste(planta, (40, 1040))

    d = ImageDraw.Draw(img)
    marca(d, 70, 120)
    d.text((70, 640), "CITY HOMES · CORDÓN", font=sans_b(24), fill=ORO)
    bloque_texto(d, 70, 690, ["Elegí tu", "apartamento", "en el plano."], serif(78), BLANCO, 92)

    d.rounded_rectangle([70, 1800, 1010, 1870], 4, fill=ORO + (255,))
    d.text((540, 1835), "DESLIZÁ PARA VERLO →", font=sans_b(26), fill=VERDE, anchor="mm")
    img.convert("RGB").save(SALIDA / "03-story.png")


# ─────────────────────────────────────────────────────────────── 4. carrusel

def carrusel():
    # 1 — gancho
    c1 = recortar(Image.open(FACHADA).convert("RGBA"), 1080, 1080)
    c1 = velo(c1, 0.86, 0.8)
    d = ImageDraw.Draw(c1)
    d.text((70, 520), "CITY HOMES · FERNÁNDEZ CRESPO Y URUGUAY", font=sans_b(20), fill=ORO)
    bloque_texto(d, 70, 570, ["¿Cuál de los", "158 es el tuyo?"], serif(76), BLANCO, 92)
    d.text((70, 800), "Monoambientes, 1 y 2 dormitorios.\nTodos con terraza.", font=sans(28), fill=(222, 228, 223))
    d.text((70, 980), "Deslizá →", font=sans_b(30), fill=ORO)
    marca(d, 790, 966)
    c1.convert("RGB").save(SALIDA / "04-carrusel-1.png")

    # 2 — la planta
    c2 = Image.new("RGBA", (1080, 1080), HUESO + (255,))
    c2.paste(planta_con_selector(1080, 820, zoom=1.15, desplazar=(-40, 0)), (0, 90))
    d = ImageDraw.Draw(c2)
    d.text((60, 44), "PISO 1 — 16 UNIDADES", font=sans_b(24), fill=(150, 156, 149))
    d.text((60, 946), "Verde disponible, rojo vendido.", font=serif_r(40), fill=VERDE)
    d.text((60, 1006), "Sin llamar para preguntar qué queda.", font=sans(26), fill=(100, 108, 102))
    c2.convert("RGB").save(SALIDA / "04-carrusel-2.png")

    # 3 — la ficha
    c3 = Image.new("RGBA", (1080, 1080), VERDE + (255,))
    c3.paste(planta_con_selector(1080, 560, destacada="09", zoom=2.1, desplazar=(230, -250)), (0, 0))
    f = ficha(560)
    sombra = Image.new("RGBA", f.size, (0, 0, 0, 120)).filter(ImageFilter.GaussianBlur(20))
    c3.paste(sombra, (264, 476), sombra)
    c3.paste(f, (260, 470))
    d = ImageDraw.Draw(c3)
    d.text((540, 836), "Precio, metraje y plano de cada unidad.", font=serif_r(36), fill=HUESO, anchor="mm")
    d.rounded_rectangle([260, 900, 820, 968], 4, fill=ORO + (255,))
    d.text((540, 934), "ENTRÁ Y ELEGÍ EL TUYO", font=sans_b(24), fill=VERDE, anchor="mm")
    marca(d, 450, 1000, HUESO, chico=True)
    c3.convert("RGB").save(SALIDA / "04-carrusel-3.png")


if __name__ == "__main__":
    feed_fachada()
    feed_planta()
    story()
    carrusel()
    for f in sorted(SALIDA.glob("*.png")):
        im = Image.open(f)
        print(f"{f.name:28} {im.width}x{im.height}  {f.stat().st_size // 1024} KB")
