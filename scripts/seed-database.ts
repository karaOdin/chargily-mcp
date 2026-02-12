/**
 * Database seeding script
 * Creates initial data for development/testing
 */

import { PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create admin user
  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@chargily-mcp.com' },
    update: {},
    create: {
      email: 'admin@chargily-mcp.com',
      name: 'Admin User',
      role: 'admin',
    },
  });

  console.log('✅ Created admin user:', adminUser.email);

  // Create test user
  const testUser = await prisma.user.upsert({
    where: { email: 'test@chargily-mcp.com' },
    update: {},
    create: {
      email: 'test@chargily-mcp.com',
      name: 'Test User',
      role: 'user',
    },
  });

  console.log('✅ Created test user:', testUser.email);

  // Create test API key
  const hashedKey = await hash('test_sk_example_key_12345', 10);

  await prisma.apiKey.upsert({
    where: { key: 'test_sk_exa...' },
    update: {},
    create: {
      key: 'test_sk_exa...',
      hashedKey: hashedKey,
      name: 'Development Test Key',
      userId: testUser.id,
      scopes: ['balance:read', 'customers:*', 'checkouts:*'],
      isTest: true,
      isActive: true,
    },
  });

  console.log('✅ Created test API key');

  // Create system config
  await prisma.systemConfig.upsert({
    where: { key: 'approval_enabled' },
    update: {},
    create: {
      key: 'approval_enabled',
      value: true,
      description: 'Enable approval workflow for sensitive operations',
    },
  });

  console.log('✅ Created system config');

  console.log('');
  console.log('🎉 Database seeded successfully!');
  console.log('');
  console.log('📋 Test credentials:');
  console.log('  Email: test@chargily-mcp.com');
  console.log('  API Key: test_sk_example_key_12345');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
