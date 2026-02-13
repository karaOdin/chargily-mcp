#!/usr/bin/env tsx
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const key = await prisma.apiKey.findFirst({
    where: { key: { startsWith: 'test_sk_22042d1a' } },
  });

  if (key) {
    console.log('Key found in DB:');
    console.log('ID:', key.id);
    console.log('Prefix:', key.key);
    console.log('Hashed Key (stored):', key.hashedKey);
    console.log('');
    console.log('Expected hash from hashForLookup:');
    console.log('9bb000d4cc704e9f269534394df5c44397ac448bf9b5693db9fcde9d6b2ef93d');
    console.log('');
    console.log('Match:', key.hashedKey === '9bb000d4cc704e9f269534394df5c44397ac448bf9b5693db9fcde9d6b2ef93d');
  } else {
    console.log('Key not found');
  }

  await prisma.$disconnect();
}

main().catch(console.error);
