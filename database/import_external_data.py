"""Importa eventos externos sinteticos a NexoSaludDB (SQL Server)."""

from __future__ import annotations

import csv
import json
import os
from datetime import datetime
from decimal import Decimal
from pathlib import Path

import pyodbc

ROOT = Path(__file__).resolve().parent
EXTERNAL = ROOT / "external"


def read_json(name: str) -> dict:
    with (EXTERNAL / name).open(encoding="utf-8") as file:
        return json.load(file)


def one(cursor: pyodbc.Cursor, query: str, *params):
    cursor.execute(query, params)
    return cursor.fetchone()


def required_id(cursor: pyodbc.Cursor, query: str, *params) -> int:
    row = one(cursor, query, *params)
    if row is None:
        raise RuntimeError(f"No se encontro la referencia requerida: {params}")
    return int(row[0])


def get_or_create_person(cursor: pyodbc.Cursor, event: dict, stage_id: int, channel_id: int, campaign_id: int | None) -> int:
    row = one(
        cursor,
        "SELECT id_persona FROM Personas WHERE email = ? OR numero = ?",
        event["email"],
        event["phone"],
    )
    if row:
        return int(row[0])

    cursor.execute(
        """
        INSERT INTO Personas (
            nombres, apellidos, email, numero, zona, autoriza_contacto,
            fecha_autorizacion, id_campana_origen, id_canal_origen, id_etapa_actual
        )
        OUTPUT INSERTED.id_persona
        VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
        """,
        event["first_name"],
        event["last_name"],
        event["email"],
        event["phone"],
        event["zone"],
        datetime.fromisoformat(event["received_at"]),
        campaign_id,
        channel_id,
        stage_id,
    )
    return int(cursor.fetchone()[0])


def import_interactions(cursor: pyodbc.Cursor) -> int:
    channel_id = required_id(cursor, "SELECT id_canal FROM Canales WHERE nombre = ?", "WhatsApp")
    source_id = required_id(cursor, "SELECT id_fuente FROM Fuentes WHERE nombre = ?", "Redes Sociales")
    stage_id = required_id(cursor, "SELECT id_etapa FROM Etapas WHERE nombre = ?", "LEAD")
    inserted = 0

    for event in read_json("whatsapp_interactions.json")["events"]:
        campaign = one(cursor, "SELECT id_campana FROM Campanas WHERE nombre = ?", event["campaign"])
        campaign_id = int(campaign[0]) if campaign else None
        person_id = get_or_create_person(cursor, event, stage_id, channel_id, campaign_id)
        duplicate = one(
            cursor,
            "SELECT id_interaccion FROM Interacciones WHERE id_persona = ? AND mensaje = ?",
            person_id,
            event["message"],
        )
        if duplicate:
            continue
        cursor.execute(
            """
            INSERT INTO Interacciones (
                id_persona, id_canal, id_fuente, fecha_hora, tipo, mensaje,
                es_respuesta_util, resultado
            )
            VALUES (?, ?, ?, ?, 'Mensaje entrante', ?, ?, ?)
            """,
            person_id,
            channel_id,
            source_id,
            datetime.fromisoformat(event["received_at"]),
            event["message"],
            event["useful"],
            f"{event['result']} [evento:{event['event_id']}]",
        )
        inserted += 1
    return inserted


def import_campaign_spend(cursor: pyodbc.Cursor) -> int:
    inserted = 0
    with (EXTERNAL / "campaign_spend.csv").open(newline="", encoding="utf-8") as file:
        for row in csv.DictReader(file):
            campaign_id = required_id(cursor, "SELECT id_campana FROM Campanas WHERE nombre = ?", row["campaign_name"])
            spend_date = datetime.strptime(row["date"], "%Y-%m-%d").date()
            amount = Decimal(row["amount"])
            duplicate = one(
                cursor,
                """
                SELECT id_gasto FROM GastosCampana
                WHERE id_campana = ? AND fecha = ? AND importe = ?
                """,
                campaign_id,
                spend_date,
                amount,
            )
            if duplicate:
                continue
            cursor.execute(
                """
                INSERT INTO GastosCampana (id_campana, fecha, importe, descripcion)
                VALUES (?, ?, ?, ?)
                """,
                campaign_id,
                spend_date,
                amount,
                row["description"],
            )
            inserted += 1
    return inserted


def get_or_create_reservation(cursor: pyodbc.Cursor, person_id: int, amount: Decimal) -> int:
    row = one(cursor, "SELECT TOP 1 id_reserva FROM Reservas WHERE id_persona = ? ORDER BY id_reserva", person_id)
    if row:
        return int(row[0])

    service = one(
        cursor,
        """
        SELECT TOP 1 s.id_servicio
        FROM Servicios s
        JOIN Tarifas t ON t.id_servicio = s.id_servicio
        WHERE t.precio = ? AND t.activo = 1
        ORDER BY s.id_servicio
        """,
        amount,
    )
    if not service:
        service = one(cursor, "SELECT TOP 1 id_servicio FROM Servicios WHERE nombre = ?", "Evaluacion odontologica")
    service_id = int(service[0])

    availability = one(
        cursor,
        """
        SELECT TOP 1 d.id_disponibilidad
        FROM Disponibilidad d
        WHERE d.estado = 'Disponible'
          AND NOT EXISTS (
              SELECT 1 FROM Opciones o WHERE o.id_disponibilidad = d.id_disponibilidad
          )
        ORDER BY d.fecha, d.hora_inicio
        """,
    )
    if not availability:
        raise RuntimeError("No hay disponibilidades libres para crear la reserva del pago")
    availability_id = int(availability[0])

    cursor.execute(
        "INSERT INTO Solicitudes (id_persona, id_servicio, motivo) OUTPUT INSERTED.id_solicitud VALUES (?, ?, ?)",
        person_id,
        service_id,
        "Solicitud generada desde webhook de pago simulado",
    )
    request_id = int(cursor.fetchone()[0])
    cursor.execute(
        """
        INSERT INTO Opciones (id_solicitud, id_disponibilidad, precio_ofrecido, seleccionada)
        OUTPUT INSERTED.id_opcion
        VALUES (?, ?, ?, 1)
        """,
        request_id,
        availability_id,
        amount,
    )
    option_id = int(cursor.fetchone()[0])
    cursor.execute(
        """
        INSERT INTO Reservas (id_persona, id_solicitud, id_opcion, estado, confirmacion_explicita)
        OUTPUT INSERTED.id_reserva
        VALUES (?, ?, ?, 'Confirmada', 1)
        """,
        person_id,
        request_id,
        option_id,
    )
    return int(cursor.fetchone()[0])


def import_payments(cursor: pyodbc.Cursor) -> int:
    inserted = 0
    for event in read_json("payment_webhooks.json")["events"]:
        if one(cursor, "SELECT id_pago FROM Pagos WHERE referencia_pago = ?", event["reference"]):
            continue
        person = one(cursor, "SELECT id_persona FROM Personas WHERE email = ?", event["email"])
        if not person:
            raise RuntimeError(f"No existe persona para el pago {event['reference']}")
        person_id = int(person[0])
        amount = Decimal(str(event["amount"]))
        reservation_id = get_or_create_reservation(cursor, person_id, amount)
        approved = event["status"] == "approved"
        cursor.execute(
            """
            INSERT INTO Pagos (
                id_persona, id_reserva, referencia_pago, importe, canal_pago,
                fecha_registro, fecha_validacion, estado, observaciones
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            person_id,
            reservation_id,
            event["reference"],
            amount,
            event["payment_channel"],
            datetime.fromisoformat(event["received_at"]),
            datetime.fromisoformat(event["received_at"]) if approved else None,
            "Validado" if approved else "Rechazado",
            f"Webhook {event['event_id']} procesado",
        )
        inserted += 1
    return inserted


def main() -> None:
    connection_string = os.environ.get("SQLSERVER_CONNECTION_STRING")
    if not connection_string:
        raise RuntimeError("Define SQLSERVER_CONNECTION_STRING antes de ejecutar el importador")

    connection = pyodbc.connect(connection_string)
    try:
        cursor = connection.cursor()
        interactions = import_interactions(cursor)
        spend = import_campaign_spend(cursor)
        payments = import_payments(cursor)
        connection.commit()
        print(f"Importacion completada en Trujillo: {interactions} interacciones, {spend} gastos y {payments} pagos.")
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


if __name__ == "__main__":
    main()
