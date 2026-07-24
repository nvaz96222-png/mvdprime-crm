const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://mvdprime.uy";

export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/desarrollos", "/p/"],
        disallow: [
          "/dashboard",
          "/proyectos",
          "/propiedades",
          "/contactos",
          "/leads",
          "/usuarios",
          "/api/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
