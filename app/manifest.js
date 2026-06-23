export default function manifest() {
  return {
    name: "MVD Prime Real Estate CRM",
    short_name: "MVDPrime",
    description: "CRM inmobiliario de MVD Prime Real Estate",
    start_url: "/dashboard",
    display: "standalone",
    orientation: "portrait",
    background_color: "#1A2B4A",
    theme_color: "#1A2B4A",
    categories: ["business", "productivity"],
    icons: [
      {
        src: "/apple-icon",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/icon-192",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icon-512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
    screenshots: [],
  };
}
