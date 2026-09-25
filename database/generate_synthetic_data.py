"""Amplia las fuentes externas con datos sinteticos reproducibles de Trujillo."""

from __future__ import annotations

import csv
import json
from datetime import datetime, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parent
EXTERNAL = ROOT / "external"

FIRST_NAMES = [
    "Andrea", "Bruno", "Carla", "Daniel", "Elena", "Fabian", "Gabriela", "Hector",
    "Irene", "Javier", "Karina", "Luis", "Milagros", "Nicolas", "Olga", "Paolo",
    "Rosa", "Sergio", "Tatiana", "Victor",
]
LAST_NAMES = [
    "Acuna", "Aguirre", "Benites", "Caballero", "Campos", "Castañeda", "Cisneros",
    "Cueva", "Diaz", "Espinoza", "Fernandez", "Flores", "Gamarra", "Gonzales",
    "Herrera", "Huaman", "Luna", "Mendoza", "Morales", "Navarro",
]
ZONES = [
    "Centro Historico", "Victor Larco Herrera", "La Esperanza", "El Porvenir",
    "Huanchaco", "Florencia de Mora", "Moche", "Trujillo", "Buenos Aires",
]
MESSAGES = [
    "Quisiera conocer los horarios disponibles.",
    "Deseo una evaluacion para esta semana.",
    "Me pueden indicar el precio del tratamiento?",
    "Necesito una cita para limpieza dental.",
    "Estoy consultando por ortodoncia.",
    "Tienen atencion en la sede de Trujillo?",
    "Quisiera reservar una evaluacion para mi hijo.",
    "Me interesa el blanqueamiento dental.",
]
RESULTS = [
    "Solicita disponibilidad", "Consulta de tarifa", "Interes calificado",
    "Solicita sede", "Pendiente de respuesta",
]
CAMPAIGNS = ["Sonrie Trujillo Septiembre", "Evaluacion Dental Trujillo"]
AMOUNTS = [60.00, 100.00, 150.00, 350.00]
PAYMENT_CHANNELS = ["MercadoPago", "Yape", "Plin", "Transferencia bancaria"]


def load_json(name: str) -> dict:
    with (EXTERNAL / name).open(encoding="utf-8") as file:
        return json.load(file)


def append_interactions(count: int = 1000) -> list[dict]:
    payload = load_json("whatsapp_interactions.json")
    events = payload.setdefault("events", [])
    existing_ids = {event["event_id"] for event in events}
    generated = []
    start = datetime(2026, 9, 1, 8, 0)

    for index in range(1, count + 1):
        event_id = f"wa-tru-{1000 + index:04d}"
        if event_id in existing_ids:
            continue
        first_name = FIRST_NAMES[(index - 1) % len(FIRST_NAMES)]
        last_name = LAST_NAMES[((index * 3) - 1) % len(LAST_NAMES)]
        received_at = start + timedelta(hours=(index * 7) % (30 * 24 - 1))
        event = {
            "event_id": event_id,
            "received_at": received_at.isoformat(timespec="seconds"),
            "phone": f"+519{80000000 + index:08d}",
            "first_name": first_name,
            "last_name": last_name,
            "email": f"{first_name.lower()}.{last_name.lower()}.{index}@example.com",
            "zone": ZONES[(index - 1) % len(ZONES)],
            "campaign": CAMPAIGNS[(index - 1) % len(CAMPAIGNS)],
            "message": MESSAGES[(index - 1) % len(MESSAGES)],
            "useful": index % 7 != 0,
            "result": RESULTS[(index - 1) % len(RESULTS)],
        }
        events.append(event)
        generated.append(event)

    with (EXTERNAL / "whatsapp_interactions.json").open("w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write("\n")
    return generated


def append_payments(interactions: list[dict]) -> int:
    payload = load_json("payment_webhooks.json")
    events = payload.setdefault("events", [])
    existing_ids = {event["event_id"] for event in events}
    created = 0

    for index, interaction in enumerate(interactions[:600], start=1):
        event_id = f"pay-tru-{1000 + index:04d}"
        if event_id in existing_ids:
            continue
        received_at = datetime.fromisoformat(interaction["received_at"]) + timedelta(hours=2)
        events.append({
            "event_id": event_id,
            "received_at": received_at.isoformat(timespec="seconds"),
            "reference": f"PAGO-TRU-202609-{1000 + index:04d}",
            "email": interaction["email"],
            "amount": AMOUNTS[(index - 1) % len(AMOUNTS)],
            "payment_channel": PAYMENT_CHANNELS[(index - 1) % len(PAYMENT_CHANNELS)],
            "status": "approved" if index % 5 != 0 else "rejected",
        })
        created += 1

    with (EXTERNAL / "payment_webhooks.json").open("w", encoding="utf-8") as file:
        json.dump(payload, file, ensure_ascii=False, indent=2)
        file.write("\n")
    return created


def append_spend(count: int = 300) -> int:
    path = EXTERNAL / "campaign_spend.csv"
    with path.open(newline="", encoding="utf-8") as file:
        rows = list(csv.DictReader(file))
    existing_keys = {(row["date"], row["campaign_name"], row["amount"]) for row in rows}
    start = datetime(2026, 9, 1)

    for index in range(1, count + 1):
        spend_date = (start + timedelta(days=(index - 1) % 30)).date().isoformat()
        campaign = CAMPAIGNS[(index - 1) % len(CAMPAIGNS)]
        amount = f"{75 + ((index * 37) % 220) + ((index % 4) * 0.25):.2f}"
        key = (spend_date, campaign, amount)
        if key in existing_keys:
            continue
        rows.append({
            "date": spend_date,
            "campaign_name": campaign,
            "amount": amount,
            "description": f"Pauta digital local Trujillo - lote {index:04d}",
        })
        existing_keys.add(key)

    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.DictWriter(file, fieldnames=["date", "campaign_name", "amount", "description"])
        writer.writeheader()
        writer.writerows(rows)
    return len(rows)


def main() -> None:
    interactions = append_interactions()
    payments = append_payments(interactions)
    spend_total = append_spend()
    print(f"Fuentes ampliadas: +{len(interactions)} interacciones, +{payments} pagos, {spend_total} gastos totales.")


if __name__ == "__main__":
    main()
