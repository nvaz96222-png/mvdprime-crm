/**
 * Datos del proyecto tomados del BROCHURE-CITY-HOMES.pdf (Drive > City Homes).
 * No hay nada inventado acá: cada texto sale del brochure o de las plantas.
 */

export const proyecto = {
  nombre: "City Homes",
  bajada: "Viví la ciudad",
  desarrollador: "Pires Benlian",
  direccion: "Fernández Crespo 1664/1676",
  entreCalles: "entre Uruguay y Mercedes",
  barrio: "Cordón",
  ciudad: "Montevideo, Uruguay",
  totalApartamentos: 158,
  mezcla: [
    { etiqueta: "monoambientes", cantidad: 20 },
    { etiqueta: "de 1 dormitorio", cantidad: 100 },
    { etiqueta: "de 2 dormitorios", cantidad: 38 },
  ],
  amenities: [
    "Gimnasio equipado",
    "2 barbacoas con terraza",
    "Laundry con app",
    "Parking con garita",
    "Local comercial 350 m²",
    "Cámaras de seguridad",
  ],
  garajes: {
    totalEnPlantas: 86,
    enListaDePrecios: 22,
    precioUnitario: 20000,
    nota:
      "Las plantas del brochure numeran 86 garajes (planta baja 01-22, primer subsuelo 23-65, " +
      "segundo subsuelo 66-86). La lista de precios sólo cotiza los 22 de planta baja.",
  },
  terminaciones: [
    {
      titulo: "Living comedor y dormitorios",
      detalle:
        "Pisos de vinílico de alta calidad. Paredes enduidas con terminación de pintura. " +
        "Aberturas de alta prestación con DVH (doble vidrio hermético). Dormitorios con cortina " +
        "de enrollar metálica. Preinstalación para aire acondicionado en living y dormitorios.",
    },
    {
      titulo: "Cocinas",
      detalle:
        "Piso de porcelanato importado de alta prestación. Revestimientos cerámicos similar en " +
        "sector de mesada. Equipamiento completo (bajo y sobre mesada) de cocina, importado de " +
        "alta calidad. Pileta de acero inoxidable importada.",
    },
    {
      titulo: "Baños",
      detalle:
        "Pisos y revestimientos cerámicos de alta calidad. Artefactos y griferías importados de " +
        "calidad. Pileta con mueble incorporado.",
    },
    {
      titulo: "Terrazas",
      detalle:
        "Pavimentos cerámicos de alta prestación. Barandas metálicas o de vidrio (a definir). " +
        "Iluminación exterior indirecta.",
    },
  ],
  beneficiosFiscales: {
    titulo: "Apartamentos 100% IVA OFF",
    inversores:
      "Exoneración del Impuesto a la Renta de los Alquileres por 10 años (IRPF/IRAE o IRNR).",
    consumidoresFinales:
      "Exoneración del ITP (2% sobre el valor de Catastro). Exoneración del IVA del precio de " +
      "compra. Exoneración del Impuesto al Patrimonio por 10 años.",
    nota: "Proyecto aprobado por ANV — Ley de Vivienda Promovida 18.795.",
  },
  comercial: {
    formaDePago: [
      { etapa: "Compromiso", porcentaje: 25 },
      { etapa: "6 trimestres de 10%", porcentaje: 60 },
      { etapa: "Entrega", porcentaje: 15 },
    ],
    gastosAdicionales: "Conexiones: 4% del precio de venta.",
    aviso: "Precios sujetos a ajuste por avance de ventas.",
  },
  galeria: [
    { imagen: "medios/renders/fachada.webp", titulo: "Fachada sobre Fernández Crespo" },
    { imagen: "medios/renders/hall-acceso.webp", titulo: "Hall de acceso" },
    { imagen: "medios/renders/interior-dia.webp", titulo: "Living comedor" },
    { imagen: "medios/renders/interior-noche.webp", titulo: "Living comedor de noche" },
    { imagen: "medios/renders/gimnasio.webp", titulo: "Gimnasio equipado" },
    { imagen: "medios/renders/barbacoa.webp", titulo: "Barbacoas con terraza" },
  ],
  documentos: {
    brochure: "medios/documentos/brochure-city-homes.pdf",
  },
  legal:
    "La presente información es preliminar, orientativa y no vinculante, quedando sujeta a las " +
    "modificaciones que por causas técnicas, naturales o impuestas por las autoridades " +
    "pertinentes pudieran ocurrir. Las imágenes pueden presentar diferencias con la versión " +
    "final real. Las áreas están consideradas según los criterios de APPCU.",

  /**
   * Canal comercial. Completá estos dos campos con los datos reales antes de publicar:
   * con `email` se arma un mailto y con `whatsapp` (formato internacional, sin signos)
   * un enlace wa.me. Si quedan en null, el formulario muestra la consulta para copiarla.
   */
  contacto: {
    equipo: "MVD Prime",
    email: null as string | null,
    whatsapp: null as string | null,
  },
};

export type Proyecto = typeof proyecto;
