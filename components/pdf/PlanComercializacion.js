import React from "react";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";

// ── Paleta exacta del CRM MVDPrime ─────────────────────────────
const N  = "#1A2B4A"; // navy (tailwind: navy.DEFAULT)
const T  = "#0D7377"; // teal (tailwind: accent.DEFAULT)
const TL = "#0fa3a8"; // teal light
const W  = "#ffffff";
const S  = "#1e293b"; // slate oscuro (texto principal)
const G  = "#64748b"; // gris (texto secundario)
const L  = "#f8fafc"; // fondo light
const B  = "#e2e8f0"; // borde

// ── Helpers ─────────────────────────────────────────────────────
function fmtPrecio(precio, moneda) {
  if (!precio) return "A consultar";
  const n = Number(precio).toLocaleString("es-UY");
  return `${moneda === "UYU" ? "$U" : "USD"} ${n}`;
}

function fmtFecha() {
  return new Date().toLocaleDateString("es-UY", {
    day: "numeric", month: "long", year: "numeric",
  });
}

// ── Datos estáticos ─────────────────────────────────────────────
const PORTALES = [
  {
    name: "MVDPrime.uy",
    desc: "Portal propio con ficha completa, galería fotográfica y mapa interactivo. SEO orgánico permanente.",
    reach: "Base de clientes propia + SEO",
    primary: true,
  },
  {
    name: "MercadoLibre Inmuebles",
    desc: "El mayor portal del Uruguay. Anuncio destacado con exposición máxima.",
    reach: "+15 millones de visitas / mes",
    primary: false,
  },
  {
    name: "InfoCasas",
    desc: "Plataforma especializada 100% en inmuebles uruguayos. Alta intención de compra.",
    reach: "Audiencia inmobiliaria calificada",
    primary: false,
  },
  {
    name: "GallitoPropiedades",
    desc: "Referente histórico del mercado local con alta fidelidad de público.",
    reach: "Mercado local consolidado",
    primary: false,
  },
  {
    name: "Properati / Zonaprop",
    desc: "Portales regionales con fuerte presencia en Uruguay y el Río de la Plata.",
    reach: "Alcance regional Latinoamérica",
    primary: false,
  },
  {
    name: "Facebook & Instagram",
    desc: "Campaña paga segmentada por zona, perfil e intereses. Creatividades con fotos profesionales.",
    reach: "Audiencia personalizada + retargeting",
    primary: false,
  },
  {
    name: "WhatsApp Business",
    desc: "Difusión directa a base de compradores activos y calificados registrados en nuestro CRM.",
    reach: "Base propia de contactos",
    primary: false,
  },
  {
    name: "Google Ads",
    desc: "Posicionamiento en búsquedas específicas: barrio, tipo, precio y características.",
    reach: "Alta intención de búsqueda activa",
    primary: false,
  },
];

const SERVICIOS = [
  "Tasación comparativa de mercado (análisis CMA)",
  "Asesoramiento en fijación estratégica del precio",
  "Fotografía profesional de alta resolución",
  "Redacción comercial de la descripción",
  "Publicación simultánea en todos los portales",
  "Campaña paga en redes sociales segmentada",
  "Gestión y filtrado de consultas entrantes 24/7",
  "Calificación financiera de interesados",
  "Coordinación y acompañamiento en visitas",
  "Asesoramiento experto en negociación y cierre",
  "Informes quincenales de actividad al propietario",
  "Gestión documental y contractual completa",
];

const PASOS = [
  { n: "01", t: "Mandato",     d: "Firma del acuerdo de comercialización" },
  { n: "02", t: "Producción",  d: "Sesión fotográfica y preparación (24–48 hs)" },
  { n: "03", t: "Publicación", d: "Lanzamiento multiportal simultáneo (48–72 hs)" },
  { n: "04", t: "Informe",     d: "Primer reporte de consultas a los 7 días" },
  { n: "05", t: "Revisión",    d: "Ajuste de estrategia y precio a los 30 días" },
];

// ── Componentes internos ─────────────────────────────────────────
function PageHeader({ title }) {
  return (
    <View>
      <View style={{ backgroundColor: N, paddingHorizontal: 36, paddingVertical: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: W, letterSpacing: 2 }}>
          {title}
        </Text>
        <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: W }}>
          MVD Prime <Text style={{ color: TL }}>Real Estate</Text>
        </Text>
      </View>
      <View style={{ height: 2, backgroundColor: T }} />
    </View>
  );
}

function PageFooter({ page }) {
  return (
    <View style={{ borderTopWidth: 1, borderTopColor: B, paddingHorizontal: 36, paddingVertical: 9, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: L }}>
      <Text style={{ fontSize: 7, color: G }}>mvdprime.uy</Text>
      <Text style={{ fontSize: 7, color: G }}>Documento confidencial · {fmtFecha()}</Text>
      <Text style={{ fontSize: 7, color: G }}>{page} / 4</Text>
    </View>
  );
}

// ── Componente principal ─────────────────────────────────────────
export default function PlanComercializacion({ propiedad, fotoBase64, agente }) {
  const foto = fotoBase64 || null;

  const specs = [
    { label: "TIPO",         value: propiedad.tipo         ? propiedad.tipo.charAt(0).toUpperCase() + propiedad.tipo.slice(1) : null },
    { label: "OPERACIÓN",    value: propiedad.operacion    ? propiedad.operacion.charAt(0).toUpperCase() + propiedad.operacion.slice(1) : null },
    { label: "DORMITORIOS",  value: propiedad.dormitorios  != null ? String(propiedad.dormitorios) : null },
    { label: "BAÑOS",        value: propiedad.banos        != null ? String(propiedad.banos) : null },
    { label: "SUP. TOTAL",   value: propiedad.superficie_total    ? `${propiedad.superficie_total} m²` : null },
    { label: "SUP. CUBIERTA",value: propiedad.superficie_cubierta ? `${propiedad.superficie_cubierta} m²` : null },
    { label: "AÑO CONST.",   value: propiedad.anio_construccion   ? String(propiedad.anio_construccion) : null },
    { label: "ESTADO",       value: propiedad.estado       ? propiedad.estado.charAt(0).toUpperCase() + propiedad.estado.slice(1) : null },
  ].filter((s) => s.value);

  return (
    <Document
      title={`Plan de Comercialización · ${propiedad.titulo || "Propiedad"}`}
      author="MVD Prime Real Estate"
    >
      {/* ══════════════════════════════════════════════════════ */}
      {/* PÁGINA 1 — PORTADA                                    */}
      {/* ══════════════════════════════════════════════════════ */}
      <Page size="A4" style={{ fontFamily: "Helvetica", backgroundColor: W }}>

        {/* Header navy con franja teal */}
        <View style={{ backgroundColor: N, paddingHorizontal: 45, paddingTop: 38, paddingBottom: 48 }}>
          {/* Logo */}
          <View style={{ flexDirection: "row", alignItems: "flex-end", marginBottom: 6 }}>
            <Text style={{ fontSize: 24, fontFamily: "Helvetica-Bold", color: W }}>
              MVD Prime{" "}
            </Text>
            <Text style={{ fontSize: 24, fontFamily: "Helvetica-Bold", color: TL }}>
              Real Estate
            </Text>
          </View>
          <Text style={{ fontSize: 7, color: "#94a3b8", letterSpacing: 2 }}>
            MONTEVIDEO, URUGUAY · mvdprime.uy
          </Text>
        </View>
        <View style={{ height: 3, backgroundColor: T }} />

        {/* Cuerpo portada */}
        <View style={{ flex: 1, paddingHorizontal: 45, paddingTop: 44, paddingBottom: 28 }}>

          {/* Etiqueta */}
          <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: T, letterSpacing: 3, marginBottom: 18 }}>
            PLAN DE COMERCIALIZACIÓN
          </Text>

          {/* Título propiedad */}
          <Text style={{ fontSize: 30, fontFamily: "Helvetica-Bold", color: N, lineHeight: 1.2, marginBottom: 7 }}>
            {propiedad.titulo || "Propiedad"}
          </Text>

          {/* Ubicación */}
          {(propiedad.barrio || propiedad.departamento) && (
            <Text style={{ fontSize: 13, color: G, marginBottom: 28 }}>
              {[propiedad.barrio, propiedad.departamento].filter(Boolean).join(", ")}
            </Text>
          )}

          {/* Línea teal decorativa */}
          <View style={{ width: 48, height: 3, backgroundColor: T, marginBottom: 34 }} />

          {/* Tipo · Operación · Precio */}
          <View style={{ flexDirection: "row", marginBottom: 34 }}>
            {[
              { label: "TIPO",            val: propiedad.tipo       ? propiedad.tipo.toUpperCase()       : "—" },
              { label: "OPERACIÓN",       val: propiedad.operacion  ? propiedad.operacion.toUpperCase()  : "—" },
              { label: "PRECIO SUGERIDO", val: fmtPrecio(propiedad.precio, propiedad.moneda) },
            ].map((item, i) => (
              <View key={i} style={{ marginRight: 28 }}>
                <Text style={{ fontSize: 6, fontFamily: "Helvetica-Bold", color: G, letterSpacing: 1.5, marginBottom: 4 }}>
                  {item.label}
                </Text>
                <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: N }}>
                  {item.val}
                </Text>
              </View>
            ))}
          </View>

          {/* Texto intro */}
          <View style={{ backgroundColor: "#f0fdfd", borderLeftWidth: 3, borderLeftColor: T, paddingHorizontal: 14, paddingVertical: 13, borderRadius: 2, marginBottom: 26 }}>
            <Text style={{ fontSize: 9, color: S, lineHeight: 1.72 }}>
              Este documento ha sido preparado por el equipo de MVD Prime Real Estate como
              propuesta de comercialización para su propiedad. Describe la estrategia
              multicanal, los portales de publicación y los servicios incluidos en la
              gestión inmobiliaria profesional.
            </Text>
          </View>

          {/* Métricas */}
          <View style={{ flexDirection: "row", borderTopWidth: 1, borderTopColor: B, paddingTop: 18 }}>
            {[
              { num: "+8",    label: "portales activos" },
              { num: "24/7",  label: "gestión de consultas" },
              { num: "100%",  label: "cobertura digital" },
              { num: "1er día", label: "publicación multicanal" },
            ].map((m, i) => (
              <View key={i} style={{ flex: 1, alignItems: "center", borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: B }}>
                <Text style={{ fontSize: 15, fontFamily: "Helvetica-Bold", color: T, marginBottom: 3 }}>
                  {m.num}
                </Text>
                <Text style={{ fontSize: 7, color: G, textAlign: "center" }}>
                  {m.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Footer portada */}
        <View style={{ backgroundColor: N, paddingHorizontal: 45, paddingVertical: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <View>
            <Text style={{ fontSize: 6, color: "#94a3b8", marginBottom: 2 }}>ASESOR ASIGNADO</Text>
            <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: W }}>
              {agente?.nombre || "MVD Prime Real Estate"}
            </Text>
          </View>
          <Text style={{ fontSize: 7, color: "#94a3b8" }}>Preparado el {fmtFecha()}</Text>
          <Text style={{ fontSize: 7, color: "#94a3b8" }}>+598 99 972 906 · info@mvdprime.uy</Text>
        </View>
      </Page>

      {/* ══════════════════════════════════════════════════════ */}
      {/* PÁGINA 2 — FICHA DE LA PROPIEDAD                      */}
      {/* ══════════════════════════════════════════════════════ */}
      <Page size="A4" style={{ fontFamily: "Helvetica", backgroundColor: W }}>
        <PageHeader title="FICHA DE LA PROPIEDAD" />

        <View style={{ flex: 1, paddingHorizontal: 36, paddingTop: 24, paddingBottom: 16 }}>

          {/* Foto principal */}
          {foto && (
            <View style={{ marginBottom: 18, height: 200 }}>
              <Image src={foto} style={{ width: "100%", height: 200, objectFit: "cover" }} />
            </View>
          )}

          {/* Precio destacado */}
          <View style={{ backgroundColor: N, borderRadius: 3, paddingHorizontal: 16, paddingVertical: 11, marginBottom: 20, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: "#94a3b8", letterSpacing: 1 }}>
              PRECIO DE PUBLICACIÓN SUGERIDO
            </Text>
            <Text style={{ fontSize: 20, fontFamily: "Helvetica-Bold", color: W }}>
              {fmtPrecio(propiedad.precio, propiedad.moneda)}
            </Text>
          </View>

          {/* Grid de specs */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 14 }}>
            {specs.map((s, i) => (
              <View key={i} style={{ width: "25%", marginBottom: 14, paddingRight: 6 }}>
                <Text style={{ fontSize: 6, fontFamily: "Helvetica-Bold", color: G, letterSpacing: 1.2, marginBottom: 3 }}>
                  {s.label}
                </Text>
                <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: S }}>
                  {s.value}
                </Text>
              </View>
            ))}
          </View>

          {/* Dirección */}
          {propiedad.direccion && (
            <View style={{ borderTopWidth: 1, borderTopColor: B, paddingTop: 12, marginBottom: 12 }}>
              <Text style={{ fontSize: 6, fontFamily: "Helvetica-Bold", color: G, letterSpacing: 1.2, marginBottom: 3 }}>
                DIRECCIÓN
              </Text>
              <Text style={{ fontSize: 10, color: S }}>
                {[propiedad.direccion, propiedad.barrio, propiedad.departamento].filter(Boolean).join(" · ")}
              </Text>
            </View>
          )}

          {/* Descripción */}
          {propiedad.descripcion && (
            <View style={{ borderTopWidth: 1, borderTopColor: B, paddingTop: 12 }}>
              <Text style={{ fontSize: 6, fontFamily: "Helvetica-Bold", color: G, letterSpacing: 1.2, marginBottom: 5 }}>
                DESCRIPCIÓN
              </Text>
              <Text style={{ fontSize: 9, color: S, lineHeight: 1.7 }}>
                {propiedad.descripcion.length > 500
                  ? propiedad.descripcion.slice(0, 500) + "…"
                  : propiedad.descripcion}
              </Text>
            </View>
          )}

          {/* Asesor asignado */}
          {agente?.nombre && (
            <View style={{ marginTop: 16, backgroundColor: "#f0fdfd", borderRadius: 3, paddingHorizontal: 14, paddingVertical: 10, flexDirection: "row", alignItems: "center" }}>
              <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: T, alignItems: "center", justifyContent: "center", marginRight: 10 }}>
                <Text style={{ fontSize: 12, fontFamily: "Helvetica-Bold", color: W }}>
                  {agente.nombre.charAt(0).toUpperCase()}
                </Text>
              </View>
              <View>
                <Text style={{ fontSize: 6, color: G, letterSpacing: 1, marginBottom: 2 }}>ASESOR INMOBILIARIO ASIGNADO</Text>
                <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: N }}>{agente.nombre}</Text>
                <Text style={{ fontSize: 8, color: G }}>MVD Prime Real Estate · +598 99 972 906</Text>
              </View>
            </View>
          )}
        </View>

        <PageFooter page="2" />
      </Page>

      {/* ══════════════════════════════════════════════════════ */}
      {/* PÁGINA 3 — ESTRATEGIA DE COMERCIALIZACIÓN             */}
      {/* ══════════════════════════════════════════════════════ */}
      <Page size="A4" style={{ fontFamily: "Helvetica", backgroundColor: W }}>
        <PageHeader title="ESTRATEGIA DE COMERCIALIZACIÓN" />

        <View style={{ flex: 1, paddingHorizontal: 36, paddingTop: 22, paddingBottom: 16 }}>

          {/* Título sección */}
          <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: T, letterSpacing: 2, marginBottom: 4 }}>
            CANALES DE PUBLICACIÓN
          </Text>
          <Text style={{ fontSize: 17, fontFamily: "Helvetica-Bold", color: N, marginBottom: 4 }}>
            Presencia multiportal desde el primer día
          </Text>
          <Text style={{ fontSize: 8.5, color: G, lineHeight: 1.6, marginBottom: 16 }}>
            Su propiedad se publicará de forma simultánea en todos los portales inmobiliarios
            relevantes de Uruguay y la región, garantizando la máxima exposición.
          </Text>

          {/* Portales en 2 columnas — sin height fijo en las cards */}
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {PORTALES.map((p, i) => (
              <View
                key={i}
                style={{
                  width: "50%",
                  paddingRight: i % 2 === 0 ? 6 : 0,
                  paddingLeft:  i % 2 === 1 ? 6 : 0,
                  marginBottom: 8,
                }}
              >
                <View
                  style={{
                    backgroundColor: p.primary ? "#f0fdfd" : L,
                    borderRadius: 3,
                    paddingHorizontal: 11,
                    paddingVertical: 9,
                    borderLeftWidth: 3,
                    borderLeftColor: p.primary ? T : N,
                  }}
                >
                  <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", color: N, marginBottom: 2 }}>
                    {p.name}
                  </Text>
                  <Text style={{ fontSize: 7.5, color: S, lineHeight: 1.5, marginBottom: 5 }}>
                    {p.desc}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={{ width: 4, height: 4, backgroundColor: T, borderRadius: 2, marginRight: 5 }} />
                    <Text style={{ fontSize: 6.5, color: G }}>
                      {p.reach}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        <PageFooter page="3" />
      </Page>

      {/* ══════════════════════════════════════════════════════ */}
      {/* PÁGINA 4 — SERVICIOS Y PRÓXIMOS PASOS                 */}
      {/* ══════════════════════════════════════════════════════ */}
      <Page size="A4" style={{ fontFamily: "Helvetica", backgroundColor: W }}>
        <PageHeader title="SERVICIOS Y PRÓXIMOS PASOS" />

        <View style={{ flex: 1, paddingHorizontal: 36, paddingTop: 22, paddingBottom: 16, flexDirection: "row" }}>

          {/* ── Servicios (columna izquierda) ── */}
          <View style={{ flex: 55, paddingRight: 18 }}>
            <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: T, letterSpacing: 2, marginBottom: 4 }}>
              SERVICIOS INCLUIDOS
            </Text>
            <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: N, marginBottom: 14 }}>
              Gestión integral de la comercialización
            </Text>
            {SERVICIOS.map((s, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 7 }}>
                <View style={{ width: 16, height: 16, backgroundColor: N, borderRadius: 8, marginRight: 8, marginTop: 0.5, alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <Text style={{ fontSize: 6, fontFamily: "Helvetica-Bold", color: W }}>
                    {String(i + 1).padStart(2, "0")}
                  </Text>
                </View>
                <Text style={{ fontSize: 8.5, color: S, lineHeight: 1.5, flex: 1, paddingTop: 1 }}>
                  {s}
                </Text>
              </View>
            ))}
          </View>

          {/* Separador */}
          <View style={{ width: 1, backgroundColor: B, marginTop: 20 }} />

          {/* ── Próximos pasos (columna derecha) ── */}
          <View style={{ flex: 40, paddingLeft: 18 }}>
            <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: T, letterSpacing: 2, marginBottom: 4 }}>
              CRONOGRAMA
            </Text>
            <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: N, marginBottom: 14 }}>
              Próximos pasos
            </Text>

            {PASOS.map((p, i) => (
              <View key={i} style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 2 }}>
                  <Text style={{ fontSize: 18, fontFamily: "Helvetica-Bold", color: B, marginRight: 7, lineHeight: 1 }}>
                    {p.n}
                  </Text>
                  <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", color: N }}>
                    {p.t}
                  </Text>
                </View>
                <Text style={{ fontSize: 8, color: G, lineHeight: 1.5, paddingLeft: 30 }}>
                  {p.d}
                </Text>
                {i < PASOS.length - 1 && (
                  <View style={{ marginTop: 10, marginLeft: 9, height: 1, backgroundColor: B }} />
                )}
              </View>
            ))}

            {/* CTA */}
            <View style={{ backgroundColor: T, borderRadius: 4, paddingHorizontal: 14, paddingVertical: 13, marginTop: 14 }}>
              <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: W, marginBottom: 4 }}>
                ¿Listo para comenzar?
              </Text>
              <Text style={{ fontSize: 8, color: W, lineHeight: 1.55, marginBottom: 8, opacity: 0.9 }}>
                Coordinamos la firma del mandato y la sesión fotográfica en 24 horas.
              </Text>
              {agente?.nombre && (
                <Text style={{ fontSize: 8, color: W, marginBottom: 4, opacity: 0.9 }}>
                  Asesor: {agente.nombre}
                </Text>
              )}
              <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: W }}>
                +598 99 972 906
              </Text>
              <Text style={{ fontSize: 8, color: W, marginTop: 2, opacity: 0.85 }}>
                info@mvdprime.uy · mvdprime.uy
              </Text>
            </View>
          </View>
        </View>

        {/* Barra inferior de marca */}
        <View style={{ backgroundColor: N, paddingHorizontal: 36, paddingVertical: 13, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: W }}>
            MVD Prime <Text style={{ color: TL }}>Real Estate</Text>
          </Text>
          <Text style={{ fontSize: 7, color: "#94a3b8" }}>
            mvdprime.uy · info@mvdprime.uy · +598 99 972 906
          </Text>
          <Text style={{ fontSize: 7, color: "#94a3b8" }}>4 / 4</Text>
        </View>
      </Page>
    </Document>
  );
}
