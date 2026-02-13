#!/usr/bin/env tsx
/**
 * Create a test user for MVP testing
 */

import { PrismaClient } from '@prisma/client';
import * as crypto from 'crypto';

// Set DATABASE_URL if not already set
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./data/mvp.db';
}

const prisma = new PrismaClient();

async function main() {
  // Hash password (simple for testing - in production use bcrypt)
  const password = 'test123456';
  const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

  // Create test user
  const user = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {},
    create: {
      email: 'test@example.com',
      password: hashedPassword,
      name: 'Test User',
      chargilyMode: 'sandbox',
    },
  });

  console.log('✅ Test user created:', {
    id: user.id,
    email: user.email,
    name: user.name,
  });

  // Generate API key
  const apiKeyValue = `mcp_sk_test_${crypto.randomBytes(32).toString('hex')}`;
  const hashedKey = crypto.createHash('sha256').update(apiKeyValue).digest('hex');

  const apiKey = await prisma.apiKey.create({
    data: {
      key: apiKeyValue.substring(0, 20) + '...', // Store prefix only
      hashedKey: hashedKey,
      name: 'Test API Key',
      userId: user.id,
      isActive: true,
    },
  });

  console.log('✅ API Key generated:', {
    id: apiKey.id,
    key: apiKeyValue, // Show full key only once
    name: apiKey.name,
  });

  console.log('\n🔑 Use this API key in Authorization header:');
  console.log(`Authorization: Bearer ${apiKeyValue}`);

  await prisma.$disconnect();
}

main().catch((error) => {
  console.error('❌ Error:', error);
  process.exit(1);
});
