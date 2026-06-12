"use client";

import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { crearUsuario } from "../actions";

const initialState = { error: null };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="flex-1 rounded-lg bg-accent py-2.5 text-sm font-semibold text-white transition hover:bg-accent/90 disabled:opacity-60"
    >
      {pending ? "Creando…" : "Crear usuario"}
    </button>
  );
}

export default function NuevoUsuarioPage() {
  const [state, action] = useFormState(crearUsuario, initialState);

  return (
    <div className="mx-auto max-w-lg">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-navy">Agregar usuario</h1>
        <p className="mt-1 text-sm text-slate-500">
          El usuario podrá iniciar sesión inmediatamente con las credenciales que definas.
        </p>
      </div>

      <div className="rounded-xl bg-white p-6 shadow-sm">
        {state?.error && (
          <div className="mb-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
            {state.error}
          </div>
        )}

        <form action={action} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Nombre completo
            </label>
            <input
              name="nombre"
              type="text"
              required
              autoComplete="off"
              placeholder="Ej: María González"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              autoComplete="off"
              placeholder="maria@ejemplo.com"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Contraseña temporal
            </label>
            <input
              name="password"
              type="text"
              required
              autoComplete="off"
              minLength={8}
              placeholder="Mínimo 8 caracteres"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            />
            <p className="mt-1 text-xs text-slate-400">
              Compartí esta contraseña con el usuario por WhatsApp o email.
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Rol
            </label>
            <select
              name="rol"
              required
              defaultValue="agente"
              className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="agente">Agente — solo ve sus leads</option>
              <option value="admin">Admin — acceso completo</option>
            </select>
          </div>

          <div className="flex gap-3 pt-1">
            <SubmitButton />
            <Link
              href="/equipo"
              className="flex-1 rounded-lg border border-slate-200 py-2.5 text-center text-sm font-medium text-slate-600 transition hover:bg-slate-50"
            >
              Cancelar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
