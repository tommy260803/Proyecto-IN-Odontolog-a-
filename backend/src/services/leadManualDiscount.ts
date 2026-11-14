import { Prisma } from '@prisma/client';
import { getServiceDiscountLimit } from '../routes/config.routes';

export function readLeadDiscount(value: unknown): number | null {
  return typeof value === 'number' && /^\d{1,3}(?:\.\d{1,2})?$/.test(String(value)) && value < 100
    ? value
    : null;
}

export function quoteLeadDiscount(serviceId: number, base: Prisma.Decimal, discount: number) {
  const maximum = getServiceDiscountLimit(serviceId);
  if (discount > maximum) return { error: `El descuento máximo de este servicio es ${maximum} %.` } as const;
  const amount = base.mul(new Prisma.Decimal(100).minus(discount)).div(100)
    .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  if (amount.lte(0)) return { error: 'La tarifa ofertada debe ser mayor a 0.' } as const;
  return { amount, promotion: discount === 0 ? null : `Promoción (-${discount}%)` };
}
