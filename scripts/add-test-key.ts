#!/usr/bin/env tsx
/**
 * Add the provided test API key to the database
 */

import { PrismaClient } from '@prisma/client';
import { ApiKeyManager } from '@chargily/mcp-auth';

const prisma = new PrismaClient();
const apiKeyManager = new ApiKeyManager();

async function main() {
  // Create test user if doesn't exist
  const user = await prisma.user.upsert({
    where: { email: 'test@chargily-mcp.com' },
    update: {},
    create: {
      email: 'test@chargily-mcp.com',
      password: 'hashed_not_used',
      name: 'Test User',
      chargilyMode: 'sandbox', // Start with sandbox mode
    },
  });

  console.log('✅ Test user ready:', user.email);

  // The provided API key
  const providedKey = 'test_sk_JxIkRDj68r6mfanZ4mWYG16rlaKLC2R9wk6brveY';

  // Hash it for storage
  const hashedKey = apiKeyManager.hashForLookup(providedKey);

  // Create API key in database
  const apiKey = await prisma.apiKey.upsert({
    where: { hashedKey },
    update: {},
    create: {
      key: providedKey.substring(0, 20) + '...',
      hashedKey: hashedKey,
      name: 'Test API Key (Experiment)',
      userId: user.id,
      scopes: JSON.stringify(['balance:read', 'customers:*', 'checkouts:*', 'products:*']),
      isTest: true,
      isActive: true,
    },
  });

  console.log('✅ API Key added to database:');
  console.log('  ID:', apiKey.id);
  console.log('  Key:', providedKey);
  console.log('  User:', user.email);
  console.log('  Mode:', user.chargilyMode);
  console.log('');
  console.log('🔑 Use in requests:');
  console.log(`   Authorization: Bearer ${providedKey}`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
