import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request) {
  try {
    const { propiedad, stats, moneda } = await request.json();

    if (!propiedad) {
      return NextResponse.json({ error: "Datos insuficientes" }, { status: 400 });
    }

    const prompt = buildPrompt(propiedad, stats, moneda);

    const message = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    });

    const texto = message.content[0]?.text ?? "";
    const analisis = parseAnalisis(texto);

    return NextResponse.json({ analisis });
  } catch (err) {
    console.error("[analisis-ia]", err);
    if (err?.status === 401) {
      return NextResponse.json(
        { error: "API key de Anthropic no configurada o inválida." },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Error al generar el análisis." }, { status: 500 });
  }
}

function buildPrompt(propiedad, stats, moneda) {
  const tipo = propiedad.tipo || "propiedad";
  const operacion = propiedad.operacion || "venta";
  const precio = propiedad.precio ? `${moneda} ${propiedad.precio.toLocaleString()}` : "no especificado";
  const superficie = propiedad.superficie_total ? `${propiedad.superficie_total} m²` : "no especificada";
  const zona = propiedad.barrio || propiedad.departamento || "no especificada";

  let statsTexto = "No hay comparables disponibles.";
  if (stats) {
    statsTexto = `
- Comparables analizados: ${stats.n}
- Precio mediano del mercado: ${moneda} ${stats.med?.toLocaleString()}
- Precio promedio: ${moneda} ${stats.avg?.toLocaleString()}
- Rango de precios: ${moneda} ${stats.min?.toLocaleString()} – ${moneda} ${stats.max?.toLocaleString()}
- Percentil 25: ${moneda} ${stats.p25?.toLocaleString()}
- Percentil 75: ${moneda} ${stats.p75?.toLocaleString()}
${stats.avgM2 ? `- Precio/m² promedio: ${moneda} ${stats.avgM2?.toLocaleString()}` : ""}
${stats.medM2 ? `- Precio/m² mediano: ${moneda} ${stats.medM2?.toLocaleString()}` : ""}
`.trim();
  }

  return `Eres un experto en análisis inmobiliario del mercado uruguayo. Analiza la siguiente propiedad y su posición frente al mercado actual.

PROPIEDAD A ANALIZAR:
- Tipo: ${tipo} en ${operacion}
- Precio publicado: ${precio}
- Superficie: ${superficie}
- Zona: ${zona}

DATOS DEL MERCADO (comparables activos en portales):
${statsTexto}

Proporciona un análisis conciso y práctico con EXACTAMENTE estas tres secciones, usando estos encabezados exactos:

## POSICIÓN EN EL MERCADO
[2-3 oraciones sobre cómo se posiciona el precio de la propiedad respecto al mercado. Indica si está por encima, por debajo o en línea con la mediana.]

## RECOMENDACIÓN DE PRECIO
[2-3 oraciones con una recomendación concreta de precio. Si el precio es competitivo, indícalo. Si conviene ajustar, sugiere un rango específico.]

## INSIGHTS CLAVE
[3 puntos breves (usar guión -) con observaciones relevantes sobre el mercado, la zona, o factores a considerar para la negociación.]

Responde en español rioplatense, de forma directa y profesional. No uses markdown innecesario.`;
}

function parseAnalisis(texto) {
  const secciones = {
    posicion: "",
    recomendacion: "",
    insights: [],
  };

  // Extraer sección POSICIÓN EN EL MERCADO
  const posMatch = texto.match(/##\s*POSICI[ÓO]N EN EL MERCADO\s*\n([\s\S]*?)(?=##|$)/i);
  if (posMatch) secciones.posicion = posMatch[1].trim();

  // Extraer sección RECOMENDACIÓN DE PRECIO
  const recMatch = texto.match(/##\s*RECOMENDACI[ÓO]N DE PRECIO\s*\n([\s\S]*?)(?=##|$)/i);
  if (recMatch) secciones.recomendacion = recMatch[1].trim();

  // Extraer sección INSIGHTS CLAVE
  const insMatch = texto.match(/##\s*INSIGHTS CLAVE\s*\n([\s\S]*?)(?=##|$)/i);
  if (insMatch) {
    secciones.insights = insMatch[1]
      .split("\n")
      .map((l) => l.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean);
  }

  // Fallback: si el parseo falló, devolver todo el texto como posición
  if (!secciones.posicion && !secciones.recomendacion) {
    secciones.posicion = texto.trim();
  }

  return secciones;
}
