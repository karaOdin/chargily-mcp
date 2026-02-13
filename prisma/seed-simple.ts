/**
 * Simple MVP Seed - Works with Prisma 7
 */

import { PrismaClient } from '@prisma/client';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// Prisma 7 format
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./data/mvp.db'
    }
  }
});

async function main() {
  console.log('🌱 Seeding...');

  // Create test user
  const testUser = await prisma.user.create({
    data: {
      email: 'test@chargily-mcp.local',
      password: await bcrypt.hash('password123', 10),
      name: 'Test User',
    },
  });

  console.log('✓ Test user created');

  // Create API key
  const apiKeyValue = `mcp_sk_${crypto.randomBytes(16).toString('hex')}`;
  await prisma.apiKey.create({
    data: {
      key: apiKeyValue.substring(0, 20) + '...',
      hashedKey: await bcrypt.hash(apiKeyValue, 10),
      name: 'Test Key',
      userId: testUser.id,
    },
  });

  console.log('✓ API key created:', apiKeyValue);
  console.log('\n✅ Done! Login: test@chargily-mcp.local / password123\n');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
