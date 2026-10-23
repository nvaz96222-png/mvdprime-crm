import { useState } from "react";
import type { Unidad } from "./tipos";
import { proyecto } from "./datos/proyecto";
import {
  discrepancias,
  fuentes,
  garajes,
  metodoZonas,
  plantasInformativas,
  precioMinimo,
  reglaDePrecedencia,
  unidades,
} from "./datos";
import { montoTexto } from "./utiles";
import Selector from "./componentes/Selector";
import Contacto from "./componentes/Contacto";

export default function App() {
  const [consulta, setConsulta] = useState<{ abierta: boolean; unidad: Unidad | null }>({
    abierta: false,
    unidad: null,
  });

  const disponibles = unidades.filter((u) => u.estado === "disponible").length;
  const conflictos = discrepancias.filter((d) => d.tipo === "estado");
  const ajustes = discrepancias.filter((d) => d.tipo === "precio");

  return (
    <>
      <header className="encabezado">
        <div className="contenedor encabezado__fila">
          <a className="encabezado__marca" href="#top">
            <img
              className="encabezado__logo"
              src="medios/marca/city-homes.png"
              alt="City Homes"
              width={945}
              height={567}
            />
            <span className="encabezado__sitio">{proyecto.barrio}, Montevideo</span>
          </a>
          <nav className="encabezado__nav">
            <a href="#unidades">Unidades</a>
            <a href="#proyecto">Proyecto</a>
            <a href="#datos">Datos</a>
            <button
              className="boton boton--chico"
              onClick={() => setConsulta({ abierta: true, unidad: null })}
            >
              Contacto
            </button>
          </nav>
        </div>
      </header>

      <main id="top">
        <section className="portada">
          <>
            <div className="portada__texto">
              <div>
                <p className="ojo">{proyecto.desarrollador}</p>
                <h1 className="portada__titulo">
                  {proyecto.nombre}
                  <br />
                  {proyecto.bajada}
                </h1>
              </div>
              <p className="portada__descripcion">
                {proyecto.totalApartamentos} apartamentos en {proyecto.direccion},{" "}
                {proyecto.entreCalles} — {proyecto.barrio}, {proyecto.ciudad}. Monoambientes, 1 y 2
                dormitorios, todos con terraza.
              </p>
              <div className="portada__datos">
                <div className="portada__dato">
                  <strong>{proyecto.totalApartamentos}</strong>
                  <span>Apartamentos</span>
                </div>
                <div className="portada__dato">
                  <strong>{disponibles}</strong>
                  <span>Disponibles hoy</span>
                </div>
                <div className="portada__dato">
                  <strong>{montoTexto(precioMinimo)}</strong>
                  <span>Desde</span>
                </div>
                <div className="portada__dato">
                  <strong>11</strong>
                  <span>Niveles + amenities</span>
                </div>
              </div>
              <div className="portada__acciones">
                <a className="boton" href="#unidades">
                  Elegí tu apartamento
                </a>
                <a
                  className="boton boton--fantasma"
                  href={proyecto.documentos.brochure}
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver brochure
                </a>
              </div>
            </div>
            <div className="portada__imagen">
              <img
                src="medios/renders/fachada.webp"
                alt={`Render de la fachada de ${proyecto.nombre} sobre ${proyecto.direccion}`}
                width={877}
                height={1240}
              />
            </div>
          </>
        </section>

        <Selector alConsultar={(u) => setConsulta({ abierta: true, unidad: u })} />

        <section className="seccion seccion--borde" id="proyecto">
          <div className="contenedor">
            <header className="seccion__encabezado">
              <div>
                <p className="ojo">El proyecto</p>
                <h2 className="seccion__titulo">Sé parte de algo grande</h2>
                <p className="seccion__ayuda">
                  {proyecto.mezcla.map((m) => `${m.cantidad} ${m.etiqueta}`).join(", ")}. Todas las
                  tipologías con terraza, sobre un punto icónico de {proyecto.barrio}.
                </p>
              </div>
            </header>

            <div className="galeria">
              {proyecto.galeria.map((g) => (
                <figure key={g.imagen}>
                  <img src={g.imagen} alt={g.titulo} loading="lazy" />
                  <figcaption>{g.titulo}</figcaption>
                </figure>
              ))}
            </div>

            <div className="columnas" style={{ marginTop: 34 }}>
              <div className="tarjeta">
                <h3>Amenities</h3>
                <ul className="lista-limpia">
                  {proyecto.amenities.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
              <div className="tarjeta">
                <h3>{proyecto.beneficiosFiscales.titulo}</h3>
                <p style={{ marginBottom: 10 }}>
                  <strong>Inversores. </strong>
                  {proyecto.beneficiosFiscales.inversores}
                </p>
                <p style={{ marginBottom: 10 }}>
                  <strong>Consumidores finales. </strong>
                  {proyecto.beneficiosFiscales.consumidoresFinales}
                </p>
                <p className="detalle-fuentes">{proyecto.beneficiosFiscales.nota}</p>
              </div>
              <div className="tarjeta">
                <h3>Forma de pago</h3>
                <ul className="lista-limpia">
                  {proyecto.comercial.formaDePago.map((e) => (
                    <li key={e.etapa}>
                      {e.etapa} — {e.porcentaje}%
                    </li>
                  ))}
                  <li>{proyecto.comercial.gastosAdicionales}</li>
                </ul>
                <p className="detalle-fuentes" style={{ marginTop: 10 }}>
                  {proyecto.comercial.aviso}
                </p>
              </div>
            </div>

            <div className="columnas" style={{ marginTop: 20 }}>
              {proyecto.terminaciones.map((t) => (
                <div className="tarjeta" key={t.titulo}>
                  <h3>{t.titulo}</h3>
                  <p>{t.detalle}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="seccion seccion--borde">
          <div className="contenedor">
            <header className="seccion__encabezado">
              <div>
                <p className="ojo">Plantas</p>
                <h2 className="seccion__titulo">Planta baja y amenities</h2>
                <p className="seccion__ayuda">
                  Plantas sin unidades en venta, incluidas como referencia del edificio.
                </p>
              </div>
            </header>
            <div className="galeria">
              {plantasInformativas.map((p) => (
                <figure className="planta" key={p.id}>
                  <img src={p.imagen} alt={p.titulo} loading="lazy" />
                  <figcaption>
                    <strong style={{ color: "var(--tinta)" }}>{p.titulo}</strong> — {p.descripcion}
                  </figcaption>
                </figure>
              ))}
            </div>
            <p className="nota" style={{ marginTop: 16 }}>
              Garajes: {proyecto.garajes.nota} Los {proyecto.garajes.enListaDePrecios} cotizados
              valen {montoTexto(proyecto.garajes.precioUnitario)} cada uno —{" "}
              {garajes.filter((g) => g.estado === "disponible").length} disponibles,{" "}
              {garajes.filter((g) => g.estado === "reservado").length} reservados y{" "}
              {garajes.filter((g) => g.estado === "vendido").length} vendidos según la planilla
              vigente.
            </p>
          </div>
        </section>

        <section className="seccion seccion--borde" id="datos">
          <div className="contenedor">
            <header className="seccion__encabezado">
              <div>
                <p className="ojo">Trazabilidad</p>
                <h2 className="seccion__titulo">De dónde salen los datos</h2>
                <p className="seccion__ayuda">{reglaDePrecedencia}</p>
              </div>
            </header>
            <div className="columnas">
              <div className="tarjeta">
                <h3>Documentos de origen</h3>
                <ul className="lista-limpia">
                  <li>{fuentes.listaOficialPdf}</li>
                  <li>{fuentes.planillaVigente}</li>
                  <li>{fuentes.brochure}</li>
                </ul>
              </div>
              <div className="tarjeta">
                <h3>Diferencias de estado ({conflictos.length})</h3>
                {conflictos.length === 0 ? (
                  <p>Las dos listas coinciden en el estado de todas las unidades.</p>
                ) : (
                  <ul className="lista-limpia lista-desplazable">
                    {conflictos.map((d) => (
                      <li key={d.unidad}>
                        {d.unidad}: PDF «{String(d.listaOficialPdf)}» · planilla «
                        {String(d.planillaVigente)}»
                      </li>
                    ))}
                  </ul>
                )}
                <p className="detalle-fuentes" style={{ marginTop: 10 }}>
                  Se muestra la lectura más reciente y queda señalado en la ficha de cada unidad.
                </p>
              </div>
              <div className="tarjeta">
                <h3>Ajustes de precio ({ajustes.length})</h3>
                <p>
                  La planilla del 23/10/2026 actualizó el precio de {ajustes.length} unidades
                  respecto de la lista oficial en PDF del 24/06/2026. Se muestra el valor nuevo y el
                  anterior queda registrado en la ficha.
                </p>
              </div>
              <div className="tarjeta">
                <h3>Cómo se trazaron las zonas</h3>
                <p>{metodoZonas}</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="pie">
        <div className="contenedor">
          <div className="pie__grilla">
            <div>
              <h4>{proyecto.nombre}</h4>
              <p>
                {proyecto.direccion}
                <br />
                {proyecto.entreCalles}
                <br />
                {proyecto.barrio} — {proyecto.ciudad}
              </p>
            </div>
            <div>
              <h4>Desarrolla</h4>
              <p>{proyecto.desarrollador}</p>
              <h4 style={{ marginTop: 16 }}>Comercializa</h4>
              <p>{proyecto.contacto.equipo}</p>
            </div>
            <div>
              <h4>Documentos</h4>
              <p>
                <a href={proyecto.documentos.brochure} target="_blank" rel="noreferrer">
                  Brochure City Homes (PDF)
                </a>
              </p>
            </div>
            <div>
              <h4>Consultas</h4>
              <button
                className="boton boton--chico"
                onClick={() => setConsulta({ abierta: true, unidad: null })}
              >
                Solicitar información
              </button>
            </div>
          </div>
          <p className="pie__legal">{proyecto.legal}</p>
        </div>
      </footer>

      {consulta.abierta && (
        <Contacto
          unidad={consulta.unidad}
          alCerrar={() => setConsulta({ abierta: false, unidad: null })}
        />
      )}
    </>
  );
}
