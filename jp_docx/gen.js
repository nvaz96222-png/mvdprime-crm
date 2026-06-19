const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, LevelFormat, HeadingLevel, BorderStyle, WidthType,
  ShadingType, PageBreak, PageNumber, Header, Footer
} = require("docx");

const GREEN = "6E7F4F";
const GREEND = "4A5733";
const GREY = "555555";
const LIGHT = "EEF1E6";

// ---------- helpers ----------
const H1 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun(t)] });
const H2 = (t) => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [new TextRun(t)] });
const P = (t, opts = {}) => new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text: t, ...opts })] });

const kicker = (t) =>
  new Paragraph({
    spacing: { before: 60, after: 40 },
    children: [new TextRun({ text: t.toUpperCase(), bold: true, color: GREEN, size: 18, characterSpacing: 30 })],
  });

const pageTitle = (t) =>
  new Paragraph({
    spacing: { after: 100 },
    children: [new TextRun({ text: t, bold: true, size: 30, color: GREEND })],
  });

const label = (t) =>
  new Paragraph({
    spacing: { before: 80, after: 40 },
    children: [new TextRun({ text: t, bold: true, size: 20, color: GREY })],
  });

const bullet = (t) =>
  new Paragraph({ numbering: { reference: "b", level: 0 }, spacing: { after: 40 }, children: [new TextRun(t)] });

const imgNote = (t) =>
  new Paragraph({
    spacing: { before: 60, after: 160 },
    shading: { fill: LIGHT, type: ShadingType.CLEAR },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: GREEN, space: 8 } },
    children: [
      new TextRun({ text: "🖼  Imagen sugerida:  ", bold: true, color: GREEND, size: 19 }),
      new TextRun({ text: t, italics: true, size: 19, color: GREY }),
    ],
  });

const divider = () =>
  new Paragraph({
    spacing: { before: 40, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "CCCCCC", space: 1 } },
    children: [new TextRun("")],
  });

const pb = () => new Paragraph({ children: [new PageBreak()] });

// ---------- shared data ----------
const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border, insideHorizontal: border, insideVertical: border };

function cell(text, { w, bold = false, fill = null, color = "000000", align = AlignmentType.LEFT } = {}) {
  return new TableCell({
    borders,
    width: { size: w, type: WidthType.DXA },
    shading: fill ? { fill, type: ShadingType.CLEAR } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    children: [new Paragraph({ alignment: align, children: [new TextRun({ text, bold, color })] })],
  });
}

function priceTable() {
  const cw = [2340, 2340, 2340, 2340];
  const head = (t) => cell(t, { w: cw[0], bold: true, fill: GREEN, color: "FFFFFF" });
  const rows = [
    new TableRow({
      tableHeader: true,
      children: ["Tipología", "Superficie", "Precio (USD)", "USD / m²"].map((t, i) =>
        cell(t, { w: cw[i], bold: true, fill: GREEN, color: "FFFFFF" })
      ),
    }),
    ...[
      ["Tipo A · 4 dorm.", "208 m²", "789.520", "3.795"],
      ["Tipo B · 3 dorm.", "168 m²", "686.450", "4.086"],
      ["Tipo C · 3 dorm.", "166 m²", "607.320", "3.659"],
    ].map(
      (r, ri) =>
        new TableRow({
          children: r.map((t, i) =>
            cell(t, { w: cw[i], bold: i === 0, fill: ri % 2 ? "F4F6EF" : null })
          ),
        })
    ),
  ];
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: cw, rows });
}

function payTable() {
  const cw = [6240, 3120];
  const rows = [
    ["Compromiso (firma)", "25 %"],
    ["6 cuotas trimestrales (durante la obra)", "60 %"],
    ["Entrega (2027)", "15 %"],
  ].map(
    (r, ri) =>
      new TableRow({
        children: [
          cell(r[0], { w: cw[0], fill: ri % 2 ? "F4F6EF" : null }),
          cell(r[1], { w: cw[1], bold: true, align: AlignmentType.CENTER, fill: ri % 2 ? "F4F6EF" : null }),
        ],
      })
  );
  return new Table({ width: { size: 9360, type: WidthType.DXA }, columnWidths: cw, rows });
}

// ---------- page builder ----------
function page({ n, kick, title, blocks, image }) {
  const out = [
    new Paragraph({
      spacing: { after: 20 },
      children: [new TextRun({ text: `PÁGINA ${n}`, bold: true, size: 16, color: "999999", characterSpacing: 40 })],
    }),
    kicker(kick),
    pageTitle(title),
  ];
  blocks.forEach((b) => out.push(b));
  out.push(imgNote(image));
  return out;
}

// content blocks per niche
function copyBlock(labelTxt, items) {
  const arr = [label(labelTxt)];
  items.forEach((i) => arr.push(bullet(i)));
  return arr;
}

// ===================================================================
//  VERSIONS
// ===================================================================
function version({ name, audience, color, pages }) {
  const out = [
    new Paragraph({ pageBreakBefore: true, heading: HeadingLevel.HEADING_1, children: [new TextRun(name)] }),
    new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: audience, italics: true, color: GREY, size: 22 })] }),
  ];
  pages.forEach((pg, idx) => {
    page(pg).forEach((b) => out.push(b));
    if (idx < pages.length - 1) out.push(divider());
  });
  return out;
}

// ---- FAMILIA ----
const familia = version({
  name: "VERSIÓN 1 — Familia compradora final",
  audience: "Público: familia que va a vivir la casa. Eje emocional: calidad de vida, colegios, seguridad y espacio propio.",
  pages: [
    {
      n: 1, kick: "Portada · Gran idea", title: "Tu casa con jardín, en el corazón de Carrasco.",
      blocks: [
        ...copyBlock("Bajada", ["Solo 18 residencias dúplex frente al Carrasco Polo Club. Casa, jardín propio y la seguridad de un barrio cerrado."]),
        ...copyBlock("Frase de posicionamiento", ["Tu lugar en el mundo."]),
      ],
      image: "Render nocturno de la calle interior del barrio (cálido, aspiracional). Logo arriba-izquierda en blanco.",
    },
    {
      n: 2, kick: "Ubicación y oportunidad", title: "Los mejores colegios, a la vuelta de casa.",
      blocks: [...copyBlock("Beneficios", [
        "Frente al Carrasco Polo Club, rodeado de verde.",
        "The British Schools, St. Patrick's, Stella Maris y Scuola Italiana a minutos.",
        "Arocena y Portones Shopping muy cerca.",
        "Salida rápida al Este y al Aeropuerto de Carrasco.",
        "British Hospital y todos los servicios en la zona.",
      ])],
      image: "Render diurno de la calle/peatonal del barrio con familias y bicicletas. Texto sobre panel verde semitransparente a la izquierda.",
    },
    {
      n: 3, kick: "El producto", title: "Casas para vivir, no solo para mostrar.",
      blocks: [...copyBlock("Lo que vas a disfrutar", [
        "Dúplex de 3 y 4 dormitorios con jardín propio.",
        "Posibilidad de piscina propia incluida en el precio.",
        "Pisos y carpintería de roble natural; aberturas de alta prestación con doble vidrio.",
        "Cocina equipada y griferías importadas de alta gama.",
        "Galería, garaje doble y seguridad 24 h.",
      ])],
      image: "Render del living-comedor abierto al jardín (luz natural, estar amplio).",
    },
    {
      n: 4, kick: "Inversión y valor", title: "Empezá tu casa hoy, pagándola en cuotas.",
      blocks: [
        label("Precios desde"), priceTableMarker(),
        label("Plan de pago"), payTableMarker(),
        P("La obra ya está en estructura, con entrega estimada en 2027. Pagás durante la construcción. Contado, financiación propia o bancaria.", { size: 20, color: GREY, italics: true }),
      ],
      image: "Render diurno del exterior de las casas (fachada con palmeras). Tabla de precios sobre panel claro.",
    },
    {
      n: 5, kick: "Cierre comercial", title: "No comprás una casa. Elegís cómo va a crecer tu familia.",
      blocks: [
        ...copyBlock("Por qué ahora", [
          "Jardín propio + colegios al lado.",
          "Seguridad 24 h en un barrio cerrado de solo 18 familias.",
          "Terminaciones premium importadas.",
        ]),
        ...copyBlock("Mensaje aspiracional", ["Imaginá a tus hijos yendo en bici a la plaza y el living abierto al jardín. Eso no se construye dos veces."]),
        ...copyBlock("Llamado a la acción", ["WhatsApp 095 644 342  ·  jardinesdelpolo.uy", "Agendá tu visita y elegí tu casa."]),
      ],
      image: "Vista aérea del masterplan (muestra exclusividad: pocas unidades, mucho verde).",
    },
  ],
});

// ---- INVERSOR ----
const inversor = version({
  name: "VERSIÓN 2 — Inversor",
  audience: "Público: inversor uruguayo o argentino. Eje racional: escasez, valorización de Carrasco, entrada en pozo y plan de pago.",
  pages: [
    {
      n: 1, kick: "Portada · Gran idea", title: "La zona que mejor retiene valor de Montevideo.",
      blocks: [
        ...copyBlock("Bajada", ["Entrá en pozo a precio de obra y capitalizá la valorización de Carrasco. Solo 18 residencias."]),
        ...copyBlock("Frase de posicionamiento", ["Entrega 2027 · obra en ejecución."]),
      ],
      image: "Render nocturno premium de la calle interior (transmite categoría y exclusividad).",
    },
    {
      n: 2, kick: "Ubicación = plusvalía", title: "Carrasco no es una dirección. Es un activo.",
      blocks: [...copyBlock("Fundamentos", [
        "Distrito de barrios privados en desarrollo sostenido.",
        "Demanda alta y oferta escasa de casas con jardín.",
        "Frente al Polo Club y rodeado de colegios premium.",
        "A minutos del Aeropuerto de Carrasco.",
        "Respaldo de desarrollador: Pires Benlian + Alive.",
      ])],
      image: "Render diurno del exterior / calle del barrio.",
    },
    {
      n: 3, kick: "El producto", title: "Tres tipologías, un fundamento: escasez.",
      blocks: [...copyBlock("Producto", [
        "Solo 18 casas de 166 a 208 m².",
        "Roble natural y terminaciones importadas europeas.",
        "Producto de reposición costosa que sostiene su valor.",
        "Posibilidad de piscina propia incluida.",
        "Barrio cerrado con seguridad 24 h.",
      ])],
      image: "Render del interior premium (living/cocina) que muestra nivel de terminación.",
    },
    {
      n: 4, kick: "Los números", title: "Comprás a precio de obra, entregás en 2027.",
      blocks: [
        label("Precios y valor por m²"), priceTableMarker(),
        label("Plan de pago"), payTableMarker(),
        P("Plan diluido en 2 años de obra: apalancás la valorización del pozo a la entrega.", { size: 20, color: GREY, italics: true }),
      ],
      image: "Render diurno del exterior. Tabla de precios destacada.",
    },
    {
      n: 5, kick: "Cierre comercial", title: "En Carrasco no se construye dos veces lo mismo.",
      blocks: [
        ...copyBlock("Argumentos de cierre", [
          "Solo 18 unidades · entrada en pozo.",
          "Zona AAA, de mayor retención de valor de Montevideo.",
          "Desarrollador con track record (Alive Residences).",
        ]),
        ...copyBlock("Razón para actuar", ["Comprá hoy a precio de obra; el valor a la entrega es otro. La ventana es ahora."]),
        ...copyBlock("Llamado a la acción", ["WhatsApp 095 644 342  ·  jardinesdelpolo.uy", "Pedí la lista de unidades disponibles."]),
      ],
      image: "Vista aérea del masterplan (refuerza el argumento de escasez).",
    },
  ],
});

// ---- EXTRANJERO ----
const extranjero = version({
  name: "VERSIÓN 3 — Argentino / extranjero que se relocaliza",
  audience: "Público: extranjero que se muda a Uruguay. Eje: nueva vida, llave en mano, seguridad y cercanía al aeropuerto.",
  pages: [
    {
      n: 1, kick: "Portada · Gran idea", title: "Mudate a Carrasco. Tu nueva vida empieza en casa.",
      blocks: [
        ...copyBlock("Bajada", ["Casas premium con jardín y seguridad 24 h, en el mejor Montevideo. Listo para habitar en 2027."]),
        ...copyBlock("Frase de posicionamiento", ["A minutos del Aeropuerto de Carrasco."]),
      ],
      image: "Render diurno cálido del exterior con familia (transmite 'nuevo comienzo').",
    },
    {
      n: 2, kick: "Por qué Carrasco", title: "Colegios internacionales y aeropuerto a minutos.",
      blocks: [...copyBlock("Beneficios", [
        "Estabilidad y calidad de vida uruguaya.",
        "Colegios bilingües e internacionales al lado.",
        "Aeropuerto de Carrasco a minutos (conexión directa con Buenos Aires).",
        "British Hospital y todos los servicios cerca.",
        "Barrio cerrado con seguridad 24 h.",
      ])],
      image: "Render de la calle interior / peatonal del barrio.",
    },
    {
      n: 3, kick: "Llave en mano", title: "Una casa lista para empezar de nuevo.",
      blocks: [...copyBlock("Producto", [
        "Dúplex de 3 y 4 dormitorios con jardín.",
        "Piscina propia opcional incluida en el precio.",
        "Terminaciones importadas europeas y roble natural.",
        "Lista para habitar al entregar (2027).",
        "Seguridad 24 h y vida de barrio privado.",
      ])],
      image: "Render del interior (living/cocina) acogedor.",
    },
    {
      n: 4, kick: "Inversión y respaldo", title: "Comprá desde el exterior, pagá durante la obra.",
      blocks: [
        label("Precios desde"), priceTableMarker(),
        label("Plan de pago"), payTableMarker(),
        P("Uruguay permite la compra a extranjeros sin restricciones. Consultá con tu escribano los beneficios de residencia y los incentivos fiscales para nuevos residentes.", { size: 20, color: GREY, italics: true }),
      ],
      image: "Vista aérea del masterplan o render exterior. Tabla de precios sobre panel claro.",
    },
    {
      n: 5, kick: "Cierre comercial", title: "Tu lugar en el mundo te espera en Carrasco.",
      blocks: [
        ...copyBlock("Por qué elegirnos", [
          "Casa premium + seguridad 24 h.",
          "Colegios internacionales a minutos.",
          "A minutos del aeropuerto y de Buenos Aires.",
        ]),
        ...copyBlock("Mensaje aspiracional", ["Empezá de nuevo en el mejor Montevideo, en una casa pensada para tu familia."]),
        ...copyBlock("Llamado a la acción", ["WhatsApp 095 644 342  ·  jardinesdelpolo.uy", "Coordinamos una visita virtual y te acompañamos en todo el proceso."]),
      ],
      image: "Render de la calle del barrio o vista aérea, en tono cálido.",
    },
  ],
});

// placeholder markers replaced after flattening (tables can't be returned by copyBlock easily inline)
function priceTableMarker() { return { __table: "price" }; }
function payTableMarker() { return { __table: "pay" }; }

// flatten: replace table markers with real tables
function flatten(arr) {
  const out = [];
  arr.forEach((el) => {
    if (el && el.__table === "price") out.push(priceTable());
    else if (el && el.__table === "pay") out.push(payTable());
    else out.push(el);
  });
  return out;
}

// ---------- intro / master data ----------
const intro = [
  new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Jardines del Polo — Brief de diseño del brochure")] }),
  new Paragraph({ spacing: { after: 160 }, children: [new TextRun({ text: "Housing Carrasco · presentación comercial de 5 páginas · 3 versiones por público", italics: true, color: GREY, size: 22 })] }),
  P("Este documento contiene el contenido final, listo para diseñar. Cada versión tiene 5 páginas: copiá el texto a tu herramienta de diseño (Canva / Claude Design) y usá la imagen sugerida indicada en cada página. Datos comerciales confirmados por la asesora.", { size: 22 }),
  divider(),
  H2("Datos maestros (válidos para las 3 versiones)"),
  label("Precios y superficies"),
  priceTable(),
  new Paragraph({ spacing: { after: 120 }, children: [new TextRun("")] }),
  label("Forma de pago"),
  payTable(),
  new Paragraph({ spacing: { after: 120 }, children: [new TextRun("")] }),
  label("Estado de obra y condiciones"),
  bullet("Obra ya iniciada, actualmente en estructura. Entrega estimada: fines de 2027."),
  bullet("Formas de pago: contado, financiación propia o financiación bancaria."),
  bullet("Seguridad 24 h. Gastos comunes accesibles. Posibilidad de piscina propia incluida en el precio."),
  label("Terminaciones (premium)"),
  bullet("Pisos de roble natural multicapa."),
  bullet("Aberturas de alta prestación con doble vidrio."),
  bullet("Carpintería de roble natural para puertas y zócalos."),
  bullet("Equipamiento de cocina importado de alta gama."),
  bullet("Revestimientos de pisos y paredes importados."),
  bullet("Losas y griferías importadas de alta gama."),
];

// ---------- appendix ----------
const appendix = [
  new Paragraph({ pageBreakBefore: true, heading: HeadingLevel.HEADING_1, children: [new TextRun("Anexo — Para potenciar el material")] }),
  P("Datos que conviene confirmar con la asesora para reforzar los argumentos (especialmente inversor y extranjero):", { size: 22 }),
  bullet("¿El proyecto califica para la Ley de Vivienda Promovida? (exoneraciones fiscales — argumento fuerte de inversión)."),
  bullet("Amenities comunes del barrio: ¿SUM, parrilleros, área de niños, espacios verdes comunes?"),
  bullet("¿Ofrecen administración de alquiler y/o acompañamiento en la relocalización?"),
  bullet("Métricas de valorización de la zona y renta estimada (para cuantificar el retorno del inversor)."),
];

// ---------- build ----------
const children = [
  ...flatten(intro),
  ...flatten(familia),
  ...flatten(inversor),
  ...flatten(extranjero),
  ...flatten(appendix),
];

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 34, bold: true, color: GREEND, font: "Arial" },
        paragraph: { spacing: { before: 240, after: 160 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, color: GREEN, font: "Arial" },
        paragraph: { spacing: { before: 180, after: 120 }, outlineLevel: 1 } },
    ],
  },
  numbering: {
    config: [
      { reference: "b", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 460, hanging: 260 } } } }] },
    ],
  },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1300, right: 1300, bottom: 1300, left: 1300 } } },
    footers: {
      default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: "Jardines del Polo · Housing Carrasco · WhatsApp 095 644 342      —      ", color: "999999", size: 16 }),
          new TextRun({ text: "Pág. ", color: "999999", size: 16 }),
          new TextRun({ children: [PageNumber.CURRENT], color: "999999", size: 16 })] })] }),
    },
    children,
  }],
});

Packer.toBuffer(doc).then((buf) => {
  fs.writeFileSync("Jardines del Polo - Brief de diseno.docx", buf);
  console.log("OK docx written");
});
