import localFont from "next/font/local";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const metadata = {
  title: "MVDPrime Real Estate",
  description: "CRM inmobiliario de MVDPrime Real Estate",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} font-sans`}>{children}</body>
    </html>
  );
}
