# Entrega de solicitudes de BUYER a LEAD

BUYER conserva el mensaje y evalúa su intención. LEAD recibe la solicitud después de que SQL Server confirma la conversión. Una fila en `dbo.EntradasAgenteLead` indica que la solicitud está lista para el futuro agente de negociación.

## Interfaz entre equipos

1. BUYER registra el contacto, la captación y el mensaje antes de llamar a Gemini. Un reenvío conserva el identificador del mensaje. Las consultas informativas quedan en BUYER, las ambiguas reciben una aclaración y un fallo de Gemini deja la evaluación pendiente de reintento.
2. Con intención confirmada, servicio activo y autorización válida, BUYER guarda el trabajo pendiente y ejecuta la conversión existente mediante `POST /buyer/:id/convert` y `dbo.usp_ConvertirBuyerALead`. Si se interrumpe después de convertir, repite la misma operación para recuperar el mismo `id_solicitud`.
3. Después de confirmar la transacción, BUYER llama a [registerLeadIntake](../../backend/src/services/leadIntake.ts) desde el mismo backend. Es una función interna que recibe el `id_solicitud` devuelto por la conversión y devuelve `id_solicitud`, `id_evento_etapa`, `id_captacion` e `id_persona`. BUYER marca su trabajo como entregado tras recibir la respuesta. Si se pierde la respuesta, reenvía el mismo ID.

LEAD verifica el evento BUYER → LEAD y sus vínculos con persona, captación y solicitud. Un aviso duplicado devuelve la entrada existente, incluso si llega al mismo tiempo que otro. El procedimiento rechaza una transacción externa abierta (54702) y solicitudes sin conversión vinculada (54703). BUYER debe tratar 54703 como inconsistencia para revisión y reintentar los fallos transitorios. Una conversión histórica sin vínculo no debe generar una entrada automáticamente.

Si el contacto ya avanzó, BUYER conserva su etapa y registra la interacción. Puede vincularla a una oportunidad que el contexto identifique con claridad. Una solicitud distinta queda pendiente de apertura hasta acordar ese flujo.

## QA y estado de integración

Con el paquete OLTP BUYER y LEAD instalado, ejecutar desde la raíz del repositorio, con la instancia de QA:

```powershell
sqlcmd -S "<instancia QA>" -E -C -I -b -d NexoSalud_LeadPruebas -f 65001 -i database/lead_revision/ENTRADA_AGENTE_LEAD_QA.sql
```

Desde `backend`, con `SQLSERVER_URL` apuntando a la misma copia, ejecutar `npm run test:lead:intake`. La prueba crea y limpia un caso temporal. Comprueba rechazo sin evento, recuperación tras confirmar la conversión, avisos concurrentes y repetición tras perder la respuesta.

La recepción LEAD compiló y pasó la prueba en `NexoSalud_LeadPruebas`. Ocho avisos lanzados en paralelo devolvieron la misma entrada. Se comprobó que quedaran una solicitud convertida, un evento y una entrada antes de limpiar el caso temporal.

BUYER debe conectar la llamada desde `feature/buyer-agent-gemini` y enlazar este contrato en su entrega. La prueba conjunta debe cubrir también consulta informativa, aclaración contextual, servicio desconocido, falta de autorización, fallo de Gemini, reenvío de mensaje y conservación de etapas posteriores.
