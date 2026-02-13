#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';
import { ApiKeyManager } from '@chargily/mcp-auth';

const prisma = new PrismaClient();
const apiKeyManager = new ApiKeyManager();

async function main() {
  const testKey = 'test_sk_22042d1aaba9cbf3e3a71357fecd6897424570824052bf70cb76d9b9e4ecbbbf';

  // Hash it
  const hashedKey = apiKeyManager.hashForLookup(testKey);
  console.log('Plain key:', testKey);
  console.log('Hashed for lookup:', hashedKey);
  console.log('');

  // Try to find it
  const found = await prisma.apiKey.findUnique({
    where: { hashedKey },
    include: { user: true },
  });

  console.log('Found in database:', found ? 'YES' : 'NO');
  if (found) {
    console.log('  ID:', found.id);
    console.log('  Key prefix:', found.key);
    console.log('  User:', found.user.email);
  }

  // Show all keys in database
  const all = await prisma.apiKey.findMany({
    select: { id: true, key: true, hashedKey: true, userId: true },
  });
  console.log('');
  console.log('All keys in database:', all.length);
  all.forEach((key, i) => {
    console.log(`  ${i+1}. ID: ${key.id}, Prefix: ${key.key}`);
  });

  await prisma.$disconnect();
}

main().catch(console.error);
