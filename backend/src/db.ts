import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Asegurar que las variables de entorno se cargan antes de instanciar Prisma
dotenv.config({ path: path.join(__dirname, '../.env') });

export const prisma = new PrismaClient();
