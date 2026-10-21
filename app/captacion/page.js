import FormCaptacion from "@/components/public/FormCaptacion";

export const metadata = {
  title: "Ficha de propiedad | MVDPrime Real Estate",
  description:
    "Completá los datos de tu propiedad para que MVDPrime Real Estate la publique en venta o alquiler.",
  robots: { index: false, follow: false },
};

export default function CaptacionPage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-navy">
        <div className="mx-auto max-w-2xl px-4 py-6">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent-light">
            MVDPrime Real Estate
          </p>
          <h1 className="mt-1 text-2xl font-bold text-white">Ficha de tu propiedad</h1>
          <p className="mt-2 text-sm text-slate-300">
            Con estos datos preparamos la publicación en nuestra web, Mercado Libre y redes.
            Te lleva unos 5 minutos. Si no sabés algún dato, dejalo en blanco y lo vemos juntos.
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8">
        <FormCaptacion />
        <p className="mt-6 text-center text-xs text-slate-400">
          Tus datos se usan solo para gestionar tu propiedad con MVDPrime Real Estate.
        </p>
      </main>
    </div>
  );
}
