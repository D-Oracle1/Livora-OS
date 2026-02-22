import { PrismaClient } from '../src/generated/master-client';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient({
  datasourceUrl: process.env.MASTER_DATABASE_URL,
});

async function main() {
  console.log('Seeding master database...');

  // ── Super Admin ──────────────────────────────────────────────────────────
  const password = await bcrypt.hash('SuperAdmin123!', 12);

  const admin = await prisma.superAdmin.upsert({
    where: { email: 'superadmin@rms.com' },
    update: {},
    create: {
      email: 'superadmin@rms.com',
      password,
      firstName: 'Platform',
      lastName: 'Admin',
      phone: '+2348000000000',
    },
  });

  console.log('Super Admin created:');
  console.log(`  Email:    superadmin@rms.com`);
  console.log(`  Password: SuperAdmin123!`);
  console.log(`  ID:       ${admin.id}`);
  console.log('');

  // ── RMS Platform company (points to the main tenant DATABASE_URL) ────────
  // This registers the primary RMS installation as the first tenant so it
  // appears in the super-admin companies list.
  const tenantDbUrl = process.env.DATABASE_URL;
  if (tenantDbUrl) {
    const existing = await prisma.company.findFirst({
      where: { slug: 'rms-platform' },
    });

    if (!existing) {
      const company = await prisma.company.create({
        data: {
          name: 'RMS Platform',
          slug: 'rms-platform',
          domain: process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '') || 'rms.vercel.app',
          databaseUrl: tenantDbUrl,
          primaryColor: '#3b82f6',
          inviteCode: `INV-${uuidv4().substring(0, 8).toUpperCase()}`,
          isActive: true,
          plan: 'enterprise',
          maxUsers: 500,
        },
      });
      console.log(`RMS Platform company created: ${company.id}`);
    } else {
      // Keep databaseUrl in sync if it changed
      await prisma.company.update({
        where: { id: existing.id },
        data: { databaseUrl: tenantDbUrl },
      });
      console.log(`RMS Platform company already exists, URL refreshed.`);
    }
  } else {
    console.log('DATABASE_URL not set — skipping RMS Platform company seed.');
  }

  console.log('Master database seeded successfully.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
