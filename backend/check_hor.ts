import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  console.log(await prisma.horarios.findMany());
}
main().catch(console.error).finally(() => prisma.$disconnect());
