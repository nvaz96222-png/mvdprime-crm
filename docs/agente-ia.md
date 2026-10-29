# Agente IA calificador — MVD Prime CRM

> Fase 3 · 2026-10-29

Responde a los clientes que escriben por WhatsApp, Instagram o Messenger con
los **datos reales de la ficha** de la propiedad, hace las **preguntas de
filtrado** y **pasa el chat a una persona** cuando hace falta. Arranca
**apagado**: se prende desde **Admin → Agente IA**.

## Cómo funciona

```
Mensaje del cliente → webhook de Meta (responde 200 al instante)
                    → waitUntil: procesarConversacionIA()  (lib/ia/agente.js)
                         1. candado (ia_tomar_conversacion) — nunca 2 respuestas a la vez
                         2. espera 4 s — junta los mensajes que llegan seguidos
                         3. chequeos (ver abajo) — si no corresponde, no responde
                         4. Claude + herramientas, con ficha pública + calificación + historial
                         5. envía, guarda el mensaje (autor "ia") y audita en ia_eventos
                         6. si el cliente escribió de nuevo mientras tanto, otra ronda (máx. 2)
```

## Cuándo NO responde

| Motivo | Detalle |
|---|---|
| Apagado general | `agente_ia_config.activo = false` (por defecto) |
| Apagado en el chat | botón “IA” de la bandeja; con “Atender sola las conversaciones nuevas” se prende sola en chats nuevos |
| Derivado | la IA pasó el chat a una persona (`ia_derivada`). Se resuelve al responder un humano o con “Devolvérsela a la IA” |
| Pausa por humano | cuando una persona escribe (CRM o celular) la IA se pausa 12 h. “Reactivar ahora” la vuelve a prender |
| Ventana de 24 h | cerrada: Meta no permite texto libre |
| Horario / días | configurables (hora de Montevideo) |
| Límites | por chat (al llegar, deriva) y por día (tope de costo) |
| Respondió un humano mientras pensaba | descarta su respuesta para no pisarlo |

## Herramientas (lib/ia/herramientas.js)

Todas actúan **solo sobre el lead de esa conversación**.

| Herramienta | Qué hace |
|---|---|
| `actualizar_calificacion` | guarda en `leads.calificacion` lo que dijo el cliente; con datos completos pasa el lead a **Calificado** y ajusta la prioridad |
| `buscar_propiedades` | busca propiedades **disponibles** (máx. 5) para ofrecer alternativas con su link |
| `asignar_propiedad` | suma una propiedad de interés (solo de la ficha o de la búsqueda; nunca un id inventado) |
| `proponer_visita` | deja una visita **pendiente** en el calendario (“CONFIRMAR con el cliente”) y pasa el lead a **Visita**; nunca en el pasado ni a más de 60 días |
| `derivar_a_humano` | marca el chat “Para atender”, pausa la IA 48 h y avisa por email al asignado (o a los admins) |

En la última ronda (5.ª) el modelo queda obligado a contestar con texto, para
que el cliente nunca quede sin respuesta.

## Qué datos ve el agente

Solo los campos **públicos** de la ficha (`lib/ia/ficha.js`, los mismos que
muestra `/p/[id]`): título, tipo, operación, precio, ubicación, dormitorios,
baños, superficies, garage, parrillero, piscina, amueblado, mascotas, año,
obra nueva, estado y descripción. **Nunca** propietario, comisiones, notas
internas ni otros clientes. Lo que no está en la ficha (gastos comunes,
contribución, etc.) no lo inventa: lo consulta con un asesor.

## Configuración (Admin → Agente IA)

Encendido general, atender sola las conversaciones nuevas, nombre, tono,
mensaje de bienvenida, **preguntas de filtrado** (editables y ordenables),
horario y días, límites, instrucciones extra, **uso y costo aproximado** de
los últimos 30 días y **simulador** (probás como cliente con la configuración
en pantalla, sin mandar nada ni escribir en la base).

## Aplicar

1. Correr `supabase/migrations/20261029_agente_ia.sql` en el SQL Editor.
2. Verificar `ANTHROPIC_API_KEY` en Vercel (ya se usa en el análisis de mercado).
3. Opcional: `AGENTE_IA_MODELO` (por defecto `claude-haiku-4-5-20251001`).
4. Probar en el simulador → prender el agente → prender la IA en un chat de prueba.

Sin la migración, todo sigue funcionando como antes: el agente simplemente no
responde y la bandeja oculta los controles de IA.

## Costos

Cada respuesta usa en general 1 a 3 llamadas al modelo. La pantalla muestra
los tokens y un costo aproximado; el valor exacto está en la consola de
Anthropic. El tope diario (`max_mensajes_dia`) limita el gasto.
