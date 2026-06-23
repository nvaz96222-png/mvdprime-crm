import React from "react";
import { Document, Page, View, Text, Image, StyleSheet } from "@react-pdf/renderer";

// Paleta de colores
const N = "#1e3a5f"; // navy
const A = "#e8723a"; // accent
const W = "#ffffff"; // white
const S = "#1e293b"; // slate
const G = "#64748b"; // gray
const L = "#f8fafc"; // light bg
const B = "#e2e8f0"; // border

function fmtPrecio(precio, moneda) {
  if (!precio) return "A consultar";
  const n = Number(precio).toLocaleString("es-UY");
  return `${moneda === "UYU" ? "$U" : "USD"} ${n}`;
}

function fmtFecha() {
  return new Date().toLocaleDateString("es-UY", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

const PORTALES = [
  {
    name: "MVDPrime.uy",
    desc: "Portal propio con ficha completa, galería fotográfica y mapa interactivo. Posicionamiento SEO orgánico permanente.",
    reach: "Base de clientes propia + SEO orgánico",
    highlight: true,
  },
  {
    name: "MercadoLibre Inmuebles",
    desc: "El mayor portal del Uruguay. Publicación destacada con exposición máxima al mayor volumen de compradores.",
    reach: "+15 millones de visitas / mes",
    highlight: false,
  },
  {
    name: "InfoCasas",
    desc: "Plataforma especializada 100% en inmuebles uruguayos. Los usuarios llegan con alta intención de compra o alquiler.",
    reach: "Audiencia inmobiliaria calificada",
    highlight: false,
  },
  {
    name: "GallitoPropiedades",
    desc: "Referente histórico del mercado inmobiliario local. Alta fidelidad de público y trayectoria reconocida.",
    reach: "Mercado local consolidado",
    highlight: false,
  },
  {
    name: "Properati / Zonaprop",
    desc: "Portales regionales con fuerte presencia en Uruguay y la región del Río de la Plata.",
    reach: "Alcance regional Latinoamérica",
    highlight: false,
  },
  {
    name: "Facebook & Instagram",
    desc: "Campaña paga con segmentación demográfica, geográfica y por intereses. Creatividades premium con fotos profesionales.",
    reach: "Audiencia personalizada + retargeting",
    highlight: false,
  },
  {
    name: "WhatsApp Business",
    desc: "Difusión directa a base de compradores activos y calificados registrados en nuestro CRM.",
    reach: "Base propia de contactos calificados",
    highlight: false,
  },
  {
    name: "Google Ads",
    desc: "Posicionamiento pagado en búsquedas específicas: barrio, tipo de propiedad, precio y características.",
    reach: "Alta intención de búsqueda activa",
    highlight: false,
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
  { n: "01", t: "Mandato", d: "Firma del acuerdo de comercialización" },
  { n: "02", t: "Producción", d: "Sesión fotográfica y preparación de la ficha (24–48 hs)" },
  { n: "03", t: "Publicación", d: "Lanzamiento multiportal simultáneo (48–72 hs)" },
  { n: "04", t: "Seguimiento", d: "Primer informe de consultas a los 7 días" },
  { n: "05", t: "Revisión", d: "Ajuste de estrategia y precio a los 30 días" },
];

function PageHeader({ title }) {
  return (
    <View>
      <View style={{ backgroundColor: N, paddingHorizontal: 40, paddingVertical: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: W, letterSpacing: 2 }}>
          {title}
        </Text>
        <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: W }}>
          MVDPrime <Text style={{ color: A }}>RE</Text>
        </Text>
      </View>
      <View style={{ height: 3, backgroundColor: A }} />
    </View>
  );
}

function PageFooter({ page, total = "4" }) {
  return (
    <View style={{ backgroundColor: L, borderTopWidth: 1, borderTopColor: B, padding: 10, paddingHorizontal: 40, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
      <Text style={{ fontSize: 7, color: G }}>mvdprime.uy</Text>
      <Text style={{ fontSize: 7, color: G }}>Documento confidencial · {fmtFecha()}</Text>
      <Text style={{ fontSize: 7, color: G }}>{page} / {total}</Text>
    </View>
  );
}

export default function PlanComercializacion({ propiedad, fotoBase64 }) {
  const foto = fotoBase64 || null;

  const specs = [
    { label: "TIPO", value: propiedad.tipo ? propiedad.tipo.charAt(0).toUpperCase() + propiedad.tipo.slice(1) : null },
    { label: "OPERACIÓN", value: propiedad.operacion ? propiedad.operacion.charAt(0).toUpperCase() + propiedad.operacion.slice(1) : null },
    { label: "DORMITORIOS", value: propiedad.dormitorios != null ? String(propiedad.dormitorios) : null },
    { label: "BAÑOS", value: propiedad.banos != null ? String(propiedad.banos) : null },
    { label: "SUP. TOTAL", value: propiedad.superficie_total ? `${propiedad.superficie_total} m²` : null },
    { label: "SUP. CUBIERTA", value: propiedad.superficie_cubierta ? `${propiedad.superficie_cubierta} m²` : null },
    { label: "AÑO CONST.", value: propiedad.anio_construccion ? String(propiedad.anio_construccion) : null },
    { label: "ESTADO", value: propiedad.estado ? propiedad.estado.charAt(0).toUpperCase() + propiedad.estado.slice(1) : null },
  ].filter((s) => s.value);

  return (
    <Document
      title={`Plan de Comercialización · ${propiedad.titulo || "Propiedad"}`}
      author="MVDPrime RE"
    >
      {/* ══════════════════════════════════════════════ */}
      {/* PÁGINA 1 — PORTADA                            */}
      {/* ══════════════════════════════════════════════ */}
      <Page size="A4" style={{ fontFamily: "Helvetica", backgroundColor: W, flexDirection: "column" }}>
        {/* Header navy */}
        <View style={{ backgroundColor: N, paddingHorizontal: 45, paddingTop: 40, paddingBottom: 55 }}>
          <Text style={{ fontSize: 22, fontFamily: "Helvetica-Bold", color: W }}>
            MVDPrime <Text style={{ color: A }}>RE</Text>
          </Text>
          <Text style={{ fontSize: 7, color: "#94a3b8", marginTop: 5, letterSpacing: 2 }}>
            REAL ESTATE · MONTEVIDEO, URUGUAY
          </Text>
        </View>

        {/* Franja naranja */}
        <View style={{ height: 4, backgroundColor: A }} />

        {/* Cuerpo */}
        <View style={{ flex: 1, paddingHorizontal: 45, paddingTop: 50, paddingBottom: 30 }}>
          {/* Label */}
          <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: A, letterSpacing: 3, marginBottom: 20 }}>
            PLAN DE COMERCIALIZACIÓN
          </Text>

          {/* Título de la propiedad */}
          <Text style={{ fontSize: 28, fontFamily: "Helvetica-Bold", color: N, lineHeight: 1.25, marginBottom: 8 }}>
            {propiedad.titulo || "Propiedad"}
          </Text>

          {/* Barrio */}
          {(propiedad.barrio || propiedad.departamento) && (
            <Text style={{ fontSize: 13, color: G, marginBottom: 30 }}>
              {[propiedad.barrio, propiedad.departamento].filter(Boolean).join(", ")}
            </Text>
          )}

          {/* Línea decorativa */}
          <View style={{ width: 50, height: 3, backgroundColor: A, marginBottom: 38 }} />

          {/* Tipo / Operación / Precio */}
          <View style={{ flexDirection: "row", marginBottom: 38 }}>
            {[
              { label: "TIPO", value: propiedad.tipo ? propiedad.tipo.toUpperCase() : "—" },
              { label: "OPERACIÓN", value: propiedad.operacion ? propiedad.operacion.toUpperCase() : "—" },
              { label: "PRECIO SUGERIDO", value: fmtPrecio(propiedad.precio, propiedad.moneda) },
            ].map((item, i) => (
              <View key={i} style={{ marginRight: 30 }}>
                <Text style={{ fontSize: 6, fontFamily: "Helvetica-Bold", color: G, letterSpacing: 1.5, marginBottom: 4 }}>
                  {item.label}
                </Text>
                <Text style={{ fontSize: 13, fontFamily: "Helvetica-Bold", color: N }}>
                  {item.value}
                </Text>
              </View>
            ))}
          </View>

          {/* Texto intro */}
          <View style={{ backgroundColor: L, borderLeftWidth: 3, borderLeftColor: A, paddingHorizontal: 16, paddingVertical: 14, borderRadius: 2 }}>
            <Text style={{ fontSize: 9, color: S, lineHeight: 1.75 }}>
              Este documento ha sido preparado por el equipo de MVDPrime RE como propuesta
              de comercialización para su propiedad. Describe la estrategia multicanal, los
              portales de publicación y los servicios incluidos en la gestión inmobiliaria profesional.
            </Text>
          </View>

          {/* Métricas de la agencia */}
          <View style={{ flexDirection: "row", marginTop: 32 }}>
            {[
              { num: "+8", label: "portales activos" },
              { num: "24/7", label: "gestión de consultas" },
              { num: "100%", label: "cobertura digital" },
              { num: "1er día", label: "publicación multicanal" },
            ].map((m, i) => (
              <View key={i} style={{ flex: 1, alignItems: "center", borderLeftWidth: i > 0 ? 1 : 0, borderLeftColor: B }}>
                <Text style={{ fontSize: 16, fontFamily: "Helvetica-Bold", color: A, marginBottom: 2 }}>
                  {m.num}
                </Text>
                <Text style={{ fontSize: 7, color: G, textAlign: "center" }}>
                  {m.label}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* Footer */}
        <View style={{ backgroundColor: N, paddingHorizontal: 45, paddingVertical: 16, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 7, color: "#94a3b8" }}>Preparado el {fmtFecha()}</Text>
          <Text style={{ fontSize: 7, color: "#94a3b8" }}>info@mvdprime.uy · +598 99 972 906</Text>
          <Text style={{ fontSize: 7, color: "#94a3b8" }}>Documento confidencial</Text>
        </View>
      </Page>

      {/* ══════════════════════════════════════════════ */}
      {/* PÁGINA 2 — FICHA DE LA PROPIEDAD              */}
      {/* ══════════════════════════════════════════════ */}
      <Page size="A4" style={{ fontFamily: "Helvetica", backgroundColor: W }}>
        <PageHeader title="FICHA DE LA PROPIEDAD" />

        <View style={{ flex: 1, paddingHorizontal: 40, paddingTop: 28, paddingBottom: 20 }}>
          {/* Foto principal */}
          {foto && (
            <View style={{ marginBottom: 22, height: 195 }}>
              <Image
                src={foto}
                style={{ width: "100%", height: 195, objectFit: "cover" }}
              />
            </View>
          )}

          {/* Precio destacado */}
          <View style={{ backgroundColor: N, borderRadius: 4, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 22, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
            <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: "#94a3b8", letterSpacing: 1 }}>
              PRECIO DE PUBLICACIÓN SUGERIDO
            </Text>
            <Text style={{ fontSize: 19, fontFamily: "Helvetica-Bold", color: W }}>
              {fmtPrecio(propiedad.precio, propiedad.moneda)}
            </Text>
          </View>

          {/* Grid de specs */}
          <View style={{ flexDirection: "row", flexWrap: "wrap", marginBottom: 18 }}>
            {specs.map((s, i) => (
              <View key={i} style={{ width: "25%", marginBottom: 16, paddingRight: 8 }}>
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
            <View style={{ borderTopWidth: 1, borderTopColor: B, paddingTop: 14, marginBottom: 14 }}>
              <Text style={{ fontSize: 6, fontFamily: "Helvetica-Bold", color: G, letterSpacing: 1.2, marginBottom: 3 }}>
                DIRECCIÓN
              </Text>
              <Text style={{ fontSize: 10, color: S }}>
                {propiedad.direccion}
                {propiedad.barrio ? ` · ${propiedad.barrio}` : ""}
                {propiedad.departamento ? `, ${propiedad.departamento}` : ""}
              </Text>
            </View>
          )}

          {/* Descripción */}
          {propiedad.descripcion && (
            <View style={{ borderTopWidth: 1, borderTopColor: B, paddingTop: 14 }}>
              <Text style={{ fontSize: 6, fontFamily: "Helvetica-Bold", color: G, letterSpacing: 1.2, marginBottom: 6 }}>
                DESCRIPCIÓN
              </Text>
              <Text style={{ fontSize: 9, color: S, lineHeight: 1.7 }}>
                {propiedad.descripcion.length > 500
                  ? propiedad.descripcion.slice(0, 500) + "…"
                  : propiedad.descripcion}
              </Text>
            </View>
          )}
        </View>

        <PageFooter page="2" />
      </Page>

      {/* ══════════════════════════════════════════════ */}
      {/* PÁGINA 3 — ESTRATEGIA DE COMERCIALIZACIÓN     */}
      {/* ══════════════════════════════════════════════ */}
      <Page size="A4" style={{ fontFamily: "Helvetica", backgroundColor: W }}>
        <PageHeader title="ESTRATEGIA DE COMERCIALIZACIÓN" />

        <View style={{ flex: 1, paddingHorizontal: 40, paddingTop: 28, paddingBottom: 20 }}>
          {/* Título sección */}
          <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: A, letterSpacing: 2, marginBottom: 5 }}>
            CANALES DE PUBLICACIÓN
          </Text>
          <Text style={{ fontSize: 17, fontFamily: "Helvetica-Bold", color: N, marginBottom: 5 }}>
            Presencia multiportal desde el primer día
          </Text>
          <Text style={{ fontSize: 8.5, color: G, lineHeight: 1.65, marginBottom: 22 }}>
            Su propiedad se publicará de forma simultánea en todos los portales inmobiliarios
            relevantes de Uruguay y la región, garantizando la máxima exposición al universo
            de compradores activos.
          </Text>

          {/* Grid de portales 2 columnas */}
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {PORTALES.map((p, i) => (
              <View
                key={i}
                style={{
                  width: "50%",
                  paddingRight: i % 2 === 0 ? 8 : 0,
                  paddingLeft: i % 2 === 1 ? 8 : 0,
                  marginBottom: 10,
                }}
              >
                <View
                  style={{
                    backgroundColor: p.highlight ? "#fff8f5" : L,
                    borderRadius: 3,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderLeftWidth: 3,
                    borderLeftColor: p.highlight ? A : N,
                    height: "100%",
                  }}
                >
                  <Text style={{ fontSize: 8.5, fontFamily: "Helvetica-Bold", color: N, marginBottom: 3 }}>
                    {p.name}
                  </Text>
                  <Text style={{ fontSize: 7.5, color: S, lineHeight: 1.55, marginBottom: 6 }}>
                    {p.desc}
                  </Text>
                  <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={{ width: 4, height: 4, backgroundColor: A, borderRadius: 2, marginRight: 4 }} />
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

      {/* ══════════════════════════════════════════════ */}
      {/* PÁGINA 4 — SERVICIOS Y PRÓXIMOS PASOS         */}
      {/* ══════════════════════════════════════════════ */}
      <Page size="A4" style={{ fontFamily: "Helvetica", backgroundColor: W }}>
        <PageHeader title="SERVICIOS Y PRÓXIMOS PASOS" />

        <View style={{ flex: 1, paddingHorizontal: 40, paddingTop: 28, paddingBottom: 20, flexDirection: "row" }}>
          {/* ── Columna izquierda: Servicios ── */}
          <View style={{ flex: 55, paddingRight: 20 }}>
            <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: A, letterSpacing: 2, marginBottom: 5 }}>
              SERVICIOS INCLUIDOS
            </Text>
            <Text style={{ fontSize: 15, fontFamily: "Helvetica-Bold", color: N, marginBottom: 16 }}>
              Gestión integral de la comercialización
            </Text>
            {SERVICIOS.map((s, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 8 }}>
                <View
                  style={{
                    width: 17,
                    height: 17,
                    backgroundColor: N,
                    borderRadius: 8.5,
                    marginRight: 9,
                    marginTop: 0.5,
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Text style={{ fontSize: 6.5, fontFamily: "Helvetica-Bold", color: W }}>
                    {String(i + 1).padStart(2, "0")}
                  </Text>
                </View>
                <Text style={{ fontSize: 8.5, color: S, lineHeight: 1.55, flex: 1, paddingTop: 1 }}>
                  {s}
                </Text>
              </View>
            ))}
          </View>

          {/* Separador vertical */}
          <View style={{ width: 1, backgroundColor: B, marginTop: 24 }} />

          {/* ── Columna derecha: Próximos pasos ── */}
          <View style={{ flex: 40, paddingLeft: 20 }}>
            <Text style={{ fontSize: 7, fontFamily: "Helvetica-Bold", color: A, letterSpacing: 2, marginBottom: 5 }}>
              CRONOGRAMA
            </Text>
            <Text style={{ fontSize: 15, fontFamily: "Helvetica-Bold", color: N, marginBottom: 16 }}>
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
                <Text style={{ fontSize: 8, color: G, lineHeight: 1.5, paddingLeft: 32 }}>
                  {p.d}
                </Text>
                {i < PASOS.length - 1 && (
                  <View style={{ marginTop: 10, marginLeft: 10, height: 1, backgroundColor: B }} />
                )}
              </View>
            ))}

            {/* CTA card */}
            <View style={{ backgroundColor: A, borderRadius: 4, paddingHorizontal: 14, paddingVertical: 14, marginTop: 18 }}>
              <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: W, marginBottom: 4 }}>
                ¿Listo para comenzar?
              </Text>
              <Text style={{ fontSize: 8, color: W, lineHeight: 1.55, marginBottom: 8 }}>
                Coordinamos la firma del mandato y la sesión fotográfica en 24 horas.
              </Text>
              <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: W }}>
                +598 99 972 906
              </Text>
              <Text style={{ fontSize: 8, color: W, marginTop: 2 }}>
                info@mvdprime.uy · mvdprime.uy
              </Text>
            </View>
          </View>
        </View>

        {/* Bottom brand bar */}
        <View style={{ backgroundColor: N, paddingHorizontal: 40, paddingVertical: 14, flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
          <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: W }}>
            MVDPrime <Text style={{ color: A }}>RE</Text>
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
