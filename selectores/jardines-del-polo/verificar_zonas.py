"""
verificar_zonas.py — dibuja los polígonos sobre el masterplan para mirarlos.

El trazado de las zonas se comprueba de dos maneras: la automática vive en
construir_datos.py (el área de los techos tiene que agruparse por tipo de casa,
y los grupos no se pueden superponer); la visual es esta, que es la que
realmente convence: cada casa pintada de su color de estado con su número
encima, sobre el plano original.

Uso:  python -I verificar_zonas.py   →  salida/verificacion-zonas.png
"""

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

sys.stdout.reconfigure(encoding="utf-8")

RAIZ = Path(__file__).resolve().parent
SALIDA = RAIZ / "salida"

COLORES = {
    "disponible": (26, 77, 55),
    "reservado": (169, 132, 47),
    "vendido": (154, 59, 48),
    "consultar": (90, 90, 90),
}


def fuente(tam):
    for nombre in ("segoeuib.ttf", "arialbd.ttf", "DejaVuSans-Bold.ttf"):
        try:
            return ImageFont.truetype(nombre, tam)
        except OSError:
            continue
    return ImageFont.load_default()


def main():
    plantas = json.loads((SALIDA / "plantas.json").read_text(encoding="utf-8"))
    datos = json.loads((SALIDA / "unidades.json").read_text(encoding="utf-8"))
    plano = plantas["planos"][0]
    estados = {u["zona"]: u["estado"] for u in datos["unidades"]}

    base = Image.open(SALIDA / "masterplan.webp").convert("RGBA")
    ancho, alto = base.size
    capa = Image.new("RGBA", base.size, (0, 0, 0, 0))
    dib = ImageDraw.Draw(capa)

    for zona, puntos in plano["zonas"].items():
        px = [(x * ancho, y * alto) for x, y in puntos]
        color = COLORES[estados.get(zona, "consultar")]
        dib.polygon(px, fill=color + (110,), outline=color + (255,), width=3)

    compuesta = Image.alpha_composite(base, capa)
    dib = ImageDraw.Draw(compuesta)
    f = fuente(22)
    for zona, puntos in plano["zonas"].items():
        cx = sum(x for x, _ in puntos) / len(puntos) * ancho
        cy = sum(y for _, y in puntos) / len(puntos) * alto
        caja = dib.textbbox((0, 0), zona, font=f)
        w, h = caja[2] - caja[0], caja[3] - caja[1]
        dib.rectangle(
            [cx - w / 2 - 7, cy - h / 2 - 5, cx + w / 2 + 7, cy + h / 2 + 7],
            fill=(255, 255, 255, 235),
        )
        dib.text((cx - w / 2, cy - h / 2 - 2), zona, font=f, fill=(20, 20, 20))

    destino = SALIDA / "verificacion-zonas.png"
    compuesta.convert("RGB").save(destino)
    print(f"-> {destino}  ({ancho}x{alto})")
    print("Verde = disponible · Rojo = vendida")


if __name__ == "__main__":
    main()
