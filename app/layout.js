import localFont from "next/font/local";
import "./globals.css";
import PwaRegister from "@/components/PwaRegister";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const metadata = {
  title: "MVD Prime Real Estate CRM",
  description: "CRM inmobiliario de MVD Prime Real Estate",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MVDPrime",
  },
};

export const viewport = {
  themeColor: "#1A2B4A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} font-sans`}>
        <PwaRegister />
        {children}
      </body>
    </html>
  );
}
