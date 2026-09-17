# Diagramas del Proyecto

## Diagrama E-R Específico de la Fase LEAD

Este diagrama refleja conceptualmente las entidades clave involucradas durante la fase de negociación (LEAD) y cómo se conectan con la base de datos general para lograr la transición a PAYER.

```mermaid
erDiagram
    %% Entidades Principales (Contexto del Lead)
    PERSONAS ||--o{ SOLICITUDES : "realiza"
    PERSONAS ||--o{ PREFERENCIAS : "declara"
    PERSONAS ||--o{ INTERACCIONES : "participa en"
    
    %% Catálogos y Restricciones
    SOLICITUDES }|--|| SERVICIOS : "requiere"
    PREFERENCIAS }o--o| SEDES : "restringe"
    
    %% Negociación y Alternativas
    SOLICITUDES ||--o{ OPCIONES : "genera"
    OPCIONES }|--|| DISPONIBILIDAD : "ocupa cupo de"
    DISPONIBILIDAD }|--|| PROFESIONALES : "atendido por"
    DISPONIBILIDAD }|--|| SEDES : "ocurre en"
    
    %% Cierre y Transacción
    OPCIONES ||--o| RESERVAS : "se concreta en (si es seleccionada)"
    PERSONAS ||--o{ RESERVAS : "es titular de"
    RESERVAS ||--o{ PAGOS : "depende de"

    PERSONAS {
        int id_persona PK
        varchar nombres "Nombre completo"
        varchar email "Contacto"
        varchar numero "Contacto"
        bit autoriza_contacto "Permiso de contacto"
        int id_etapa_actual "Estado actual (LEAD/PAYER)"
    }

    PREFERENCIAS {
        int id_preferencia PK
        int id_persona FK
        varchar sede_preferida
        varchar modalidad
        varchar horario_preferido
    }

    INTERACCIONES {
        int id_interaccion PK
        int id_persona FK
        varchar canal "Canal preferido / origen"
        datetime fecha
        varchar accion "Cronología"
    }

    SOLICITUDES {
        int id_solicitud PK
        int id_persona FK
        int id_servicio FK
        varchar motivo "Información declarada relevante"
        datetime fecha_solicitud
    }

    OPCIONES {
        int id_opcion PK
        int id_solicitud FK
        int id_disponibilidad FK
        decimal precio_ofrecido "Tarifa informada"
        bit seleccionada "Indica la alternativa elegida"
    }

    RESERVAS {
        int id_reserva PK
        int id_persona FK
        int id_opcion FK
        varchar estado "Bloqueo temporal / Pendiente / Confirmada"
        datetime fecha_reserva
    }

    PAGOS {
        int id_pago PK
        int id_reserva FK
        decimal importe
        varchar estado "Pendiente / Confirmado / Fallido / Revertido"
        varchar referencia_conciliacion
    }
```

### Explicación Funcional según el Contexto
1. **Preparación de la Respuesta (Actividades 1-4)**: El sistema consulta a la entidad `PERSONAS` y su cronología en `INTERACCIONES`. Se evalúan las `PREFERENCIAS` para filtrar la `DISPONIBILIDAD` y armar las `OPCIONES` pertinentes basadas en la `SOLICITUD` actual del `SERVICIO`.
2. **Formalización del Acuerdo (Actividades 5-8)**: Se listan las `OPCIONES` (alternativas ofrecidas con precio y condiciones). Cuando el paciente confirma una explícitamente, la opción se marca como `seleccionada = true` y se genera el registro en `RESERVAS` (bloqueo temporal).
3. **Cierre y Control (Actividades 9-11)**: El área administrativa genera un registro en `PAGOS`. Solo cuando el `estado` del pago pase a "Confirmado" tras conciliación cruzada con la fuente oficial, el sistema registrará el evento de cambio de etapa y moverá la `PERSONA` de LEAD a PAYER.