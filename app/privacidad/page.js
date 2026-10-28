// Política de privacidad pública (requerida por Meta para publicar la app
// de integración de WhatsApp / Instagram / Lead Ads).
// Ruta pública: /privacidad (agregada a RUTAS_PUBLICAS en el middleware).

export const metadata = {
  title: "Política de privacidad — MVD Prime Real Estate",
  description:
    "Cómo MVD Prime Real Estate recopila, usa y protege los datos de las personas que nos contactan por nuestra web, WhatsApp, Instagram y anuncios de Meta.",
  robots: { index: true, follow: true },
};

const ACTUALIZADO = "28 de octubre de 2026";

export default function PrivacidadPage() {
  return (
    <main
      style={{
        maxWidth: 760,
        margin: "0 auto",
        padding: "48px 20px 80px",
        fontFamily: "var(--font-geist-sans), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        color: "#1e293b",
        lineHeight: 1.65,
      }}
    >
      <h1 style={{ fontSize: "1.9rem", fontWeight: 700, color: "#0b2e1e", marginBottom: 6 }}>
        Política de privacidad
      </h1>
      <p style={{ color: "#64748b", fontSize: ".9rem", marginTop: 0 }}>
        MVD Prime Real Estate · Última actualización: {ACTUALIZADO}
      </p>

      <Section titulo="1. Quiénes somos">
        <p>
          MVD Prime Real Estate es una inmobiliaria con sede en Montevideo, Uruguay. Esta política
          describe cómo tratamos los datos personales de quienes nos contactan a través de nuestro
          sitio web, de WhatsApp, de Instagram, de Facebook y de los formularios de anuncios de Meta
          (Lead Ads). Responsable del tratamiento: MVD Prime Real Estate — contacto{" "}
          <a href="mailto:contacto@mvdprime.uy" style={{ color: "#0d7377" }}>contacto@mvdprime.uy</a>.
        </p>
      </Section>

      <Section titulo="2. Qué datos recopilamos">
        <ul>
          <li>Datos de contacto que nos facilitás: nombre, teléfono, correo electrónico.</li>
          <li>El contenido de los mensajes que nos enviás por WhatsApp, Instagram o Facebook Messenger, y los metadatos asociados (fecha, identificador del mensaje, canal).</li>
          <li>Tu identificador de usuario de WhatsApp (número) o de Instagram cuando nos escribís por esos canales.</li>
          <li>Información de los formularios instantáneos (Lead Ads) de Meta que completás, y datos de atribución del anuncio o campaña de origen.</li>
          <li>La propiedad o emprendimiento por el que consultás.</li>
        </ul>
      </Section>

      <Section titulo="3. Para qué usamos tus datos">
        <ul>
          <li>Responder tus consultas y brindarte información sobre propiedades y emprendimientos.</li>
          <li>Gestionar tu solicitud como contacto comercial en nuestro CRM y darle seguimiento.</li>
          <li>Coordinar visitas, tasaciones y comunicaciones relacionadas con tu interés.</li>
          <li>Mejorar nuestra atención. No vendemos tus datos a terceros.</li>
        </ul>
      </Section>

      <Section titulo="4. Con quién los compartimos">
        <p>
          Utilizamos proveedores que tratan datos por nuestra cuenta para prestar el servicio:
        </p>
        <ul>
          <li><strong>Meta Platforms</strong> (WhatsApp Business Platform, Instagram, Facebook) para recibir y responder tus mensajes y anuncios.</li>
          <li><strong>Supabase</strong> como base de datos donde se almacena de forma segura tu información de contacto y conversaciones.</li>
          <li>Proveedores de notificación por correo electrónico a nuestro equipo.</li>
        </ul>
        <p>No compartimos tus datos con terceros con fines publicitarios ajenos a MVD Prime Real Estate.</p>
      </Section>

      <Section titulo="5. Conservación">
        <p>
          Conservamos tus datos mientras exista una relación comercial o interés vigente, y durante
          el plazo necesario para cumplir obligaciones legales. Luego se eliminan o anonimizan.
        </p>
      </Section>

      <Section titulo="6. Tus derechos">
        <p>
          Podés solicitar el acceso, la rectificación o la eliminación de tus datos personales, u
          oponerte a su tratamiento, escribiéndonos a{" "}
          <a href="mailto:contacto@mvdprime.uy" style={{ color: "#0d7377" }}>contacto@mvdprime.uy</a>.
          También podés pedirnos que dejemos de contactarte en cualquier momento.
        </p>
      </Section>

      <Section titulo="7. Eliminación de datos">
        <p>
          Para solicitar la eliminación de tus datos personales (incluidas tus conversaciones de
          WhatsApp o Instagram con nosotros), enviá un correo a{" "}
          <a href="mailto:contacto@mvdprime.uy" style={{ color: "#0d7377" }}>contacto@mvdprime.uy</a>{" "}
          con el asunto “Eliminación de datos” indicando el teléfono o usuario desde el que nos
          contactaste. Procesaremos la solicitud en un plazo razonable.
        </p>
      </Section>

      <Section titulo="8. Cambios">
        <p>
          Podemos actualizar esta política. Publicaremos la versión vigente en esta misma página con
          su fecha de actualización.
        </p>
      </Section>

      <p style={{ marginTop: 40, color: "#64748b", fontSize: ".85rem" }}>
        MVD Prime Real Estate · Montevideo, Uruguay ·{" "}
        <a href="mailto:contacto@mvdprime.uy" style={{ color: "#0d7377" }}>contacto@mvdprime.uy</a>
      </p>
    </main>
  );
}

function Section({ titulo, children }) {
  return (
    <section style={{ marginTop: 28 }}>
      <h2 style={{ fontSize: "1.15rem", fontWeight: 600, color: "#0b2e1e", marginBottom: 6 }}>
        {titulo}
      </h2>
      {children}
    </section>
  );
}
