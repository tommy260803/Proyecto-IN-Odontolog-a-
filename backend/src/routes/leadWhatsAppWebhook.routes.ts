import { createHmac, timingSafeEqual } from 'node:crypto';
import express, { Router } from 'express';
import { prisma } from '../db';
import { processNextLeadWhatsApp } from '../services/leadChatbot';
import { explicitWhatsAppOptOut } from '../services/leadChatbotGroq';
import { leadWhatsAppSettings } from '../services/leadWhatsApp';
import { recordWhatsAppReceipt, whatsappTrackingInstalled } from '../services/leadWhatsAppTracking';
import {
  chatbotSchemaInstalled, chatbotWebhookSecret, enqueueWhatsAppMessage, resolveWhatsAppContact,
} from '../services/leadWhatsAppInbox';

export const leadWhatsAppWebhookRouter = Router();

export function verifyLeadWhatsAppSignature(raw: Buffer, signature: string | undefined, secret: string) {
  if (!signature || !/^sha256=[0-9a-f]{64}$/i.test(signature) || secret.length < 16) return false;
  const digest = createHmac('sha256', secret).update(raw).digest();
  return timingSafeEqual(digest, Buffer.from(signature.slice(7), 'hex'));
}

leadWhatsAppWebhookRouter.post('/', express.raw({ type: 'application/json', limit: '256kb', inflate: false }), async (req, res) => {
  const secret = chatbotWebhookSecret();
  if (!secret) return res.sendStatus(404);
  if (!Buffer.isBuffer(req.body)) return res.sendStatus(415);
  if (!verifyLeadWhatsAppSignature(req.body, req.get('X-OpenWA-Signature'), secret)) return res.sendStatus(401);

  let event: { event?: string; sessionId?: string; data?: Record<string, unknown> };
  try {
    event = JSON.parse(req.body.toString('utf8'));
    if (!event || typeof event !== 'object') return res.sendStatus(400);
  } catch {
    return res.sendStatus(400);
  }
  const configuredSession = process.env.OPENWA_SESSION_ID?.trim();
  if (event.event === 'test' && (!event.sessionId || event.sessionId === configuredSession)) return res.sendStatus(204);
  if (event.sessionId !== configuredSession) return res.sendStatus(403);
  const message = event.data;
  if (event.event === 'message.ack') {
    const id = externalId(message?.messageId) ?? externalId(message?.id);
    const status = message?.status;
    if (!configuredSession || !id || (status !== 'delivered' && status !== 'read')) return res.sendStatus(204);
    if (typeof message?.chatId === 'string' && !/@(?:c\.us|s\.whatsapp\.net|lid)$/.test(message.chatId)) return res.sendStatus(204);
    try {
      if (!await whatsappTrackingInstalled(prisma)) return res.sendStatus(503);
      await recordWhatsAppReceipt(prisma, configuredSession, id, status);
      return res.sendStatus(204);
    } catch {
      return res.sendStatus(503);
    }
  }
  if (event.event !== 'message.received' || !message || message.fromMe !== false || message.isGroup === true ||
      (message.kind && message.kind !== 'individual') || !['text', 'chat'].includes(String(message.type))) return res.sendStatus(204);
  const id = externalId(message.id);
  const from = typeof message.chatId === 'string' ? message.chatId : message.from;
  const text = typeof message.body === 'string' ? message.body.trim().slice(0, 4000) : '';
  if (!id || typeof from !== 'string' || !text) return res.sendStatus(204);

  try {
    if (!await chatbotSchemaInstalled(prisma)) return res.sendStatus(503);
    const settings = leadWhatsAppSettings();
    const senderPhone = typeof message.senderPhone === 'string' ? message.senderPhone.replace(/^\+/, '') : '';
    const resolved = /^\d{1,24}@lid$/.test(from) && /^[1-9]\d{7,14}$/.test(senderPhone)
      ? senderPhone + '@c.us' : await resolveWhatsAppContact(settings, from);
    if (!resolved) return res.sendStatus(204);
    const quoted = message.quotedMessage as { id?: unknown } | undefined;
    const quotedId = externalId(message.quotedMessageId) ?? externalId(quoted?.id);
    await enqueueWhatsAppMessage({ sessionId: settings.sessionId, chat: resolved }, {
      id, quotedId, text, optOut: explicitWhatsAppOptOut(text),
    });
    res.sendStatus(202);
    void processNextLeadWhatsApp();
  } catch {
    if (!res.headersSent) res.sendStatus(503);
  }
});

function externalId(value: unknown) {
  return typeof value === 'string' && value.length > 0 && value.length <= 220 && !/\s/.test(value) ? value : null;
}
