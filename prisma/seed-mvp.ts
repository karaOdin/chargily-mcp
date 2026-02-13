/**
 * MVP Database Seed
 * Creates test user and initial data
 */

import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding MVP database...');

  // Clean existing data
  await prisma.auditLog.deleteMany();
  await prisma.apiKey.deleteMany();
  await prisma.user.deleteMany();
  await prisma.systemConfig.deleteMany();

  // Create test user
  const testUser = await prisma.user.create({
    data: {
      email: 'test@chargily-mcp.local',
      password: await bcrypt.hash('password123', 10),
      name: 'Test User',
      chargilyApiKey: null, // User will add their own
      chargilyMode: 'sandbox',
    },
  });

  console.log('✓ Created test user:', testUser.email);

  // Create demo user with Chargily key (for testing)
  const demoUser = await prisma.user.create({
    data: {
      email: 'demo@chargily-mcp.local',
      password: await bcrypt.hash('demo123', 10),
      name: 'Demo User',
      chargilyApiKey: 'test_sk_demo_key_12345', // Fake key for demo
      chargilyMode: 'sandbox',
    },
  });

  console.log('✓ Created demo user:', demoUser.email);

  // Generate MCP API key for test user
  const apiKeyValue = `mcp_sk_${crypto.randomBytes(32).toString('hex')}`;
  const apiKey = await prisma.apiKey.create({
    data: {
      key: `${apiKeyValue.substring(0, 20)}...`, // Visible prefix
      hashedKey: await bcrypt.hash(apiKeyValue, 10),
      name: 'Test MCP Key',
      userId: testUser.id,
      isActive: true,
    },
  });

  console.log('✓ Created MCP API key:', apiKey.key);
  console.log('  Full key (save this):', apiKeyValue);

  // Create system config
  await prisma.systemConfig.createMany({
    data: [
      {
        key: 'platform_name',
        value: { name: 'Chargily MCP Platform' },
        description: 'Platform display name',
      },
      {
        key: 'allow_signups',
        value: { enabled: true },
        description: 'Allow new user registrations',
      },
      {
        key: 'api_rate_limit',
        value: { requests_per_minute: 60 },
        description: 'Global API rate limit',
      },
    ],
  });

  console.log('✓ Created system config');

  // Create sample audit logs
  await prisma.auditLog.createMany({
    data: [
      {
        userId: demoUser.id,
        action: 'get_balance',
        resource: 'balance',
        success: true,
        duration: 145,
        ipAddress: '127.0.0.1',
        userAgent: 'Claude Desktop/1.0',
      },
      {
        userId: demoUser.id,
        action: 'list_customers',
        resource: 'customer',
        success: true,
        duration: 230,
        ipAddress: '127.0.0.1',
        userAgent: 'Claude Desktop/1.0',
      },
      {
        userId: demoUser.id,
        action: 'create_checkout',
        resource: 'checkout',
        resourceId: 'checkout_123abc',
        success: true,
        duration: 456,
        ipAddress: '127.0.0.1',
        userAgent: 'Claude Desktop/1.0',
      },
    ],
  });

  console.log('✓ Created sample audit logs');

  console.log('\n🎉 MVP database seeded successfully!\n');
  console.log('📝 Test Credentials:');
  console.log('   Email: test@chargily-mcp.local');
  console.log('   Password: password123\n');
  console.log('📝 Demo Credentials (has Chargily key):');
  console.log('   Email: demo@chargily-mcp.local');
  console.log('   Password: demo123\n');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
