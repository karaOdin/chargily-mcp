#!/usr/bin/env tsx
/**
 * Generate an API key using the auth service (for testing)
 */

import { PrismaClient } from '@prisma/client';
import { ApiKeyManager } from '@chargily/mcp-auth';

// Set DATABASE_URL if not already set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./data/mvp.db';
}

const prisma = new PrismaClient();
const apiKeyManager = new ApiKeyManager();

async function main() {
  // Get the test user (created by seed or previous script)
  const user = await prisma.user.findUnique({
    where: { email: 'test@example.com' },
  });

  if (!user) {
    console.log('❌ Test user not found. Creating one...');
    // Create a simple test user
    const newUser = await prisma.user.create({
      data: {
        email: 'test@example.com',
        password: 'hashed_password_not_used_for_api_key_auth',
        name: 'Test User',
        chargilyMode: 'sandbox',
      },
    });
    console.log('✅ Created test user:', newUser.email);
  }

  const userId = user?.id || (await prisma.user.findUnique({ where: { email: 'test@example.com' } }))!.id;

  // Generate API key using the auth manager
  const { apiKey, plainKey } = await apiKeyManager.generateApiKey(
    userId,
    ['balance:read', 'customers:*', 'checkouts:*', 'products:*'],
    {
      name: 'Test API Key',
      isTest: true,
    }
  );

  // We need BOTH hashes: SHA-256 for lookup, bcrypt for verification
  const lookupHash = apiKeyManager.hashForLookup(plainKey);

  // Store in database
  const dbApiKey = await prisma.apiKey.create({
    data: {
      key: apiKey.key,
      lookupHash: lookupHash,  // SHA-256 for fast database lookup
      hashedKey: apiKey.hashedKey,  // bcrypt for secure verification
      name: apiKey.name || 'Test API Key',
      userId: userId,
      scopes: JSON.stringify(apiKey.scopes),
      isTest: true,
      expiresAt: apiKey.expiresAt,
      isActive: true,
    },
  });

  console.log('✅ API Key generated:');
  console.log('  ID:', dbApiKey.id);
  console.log('  Prefix:', dbApiKey.key);
  console.log('  Full key:', plainKey);
  console.log('');
  console.log('🔑 Use in Authorization header:');
  console.log(`   Authorization: Bearer ${plainKey}`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
