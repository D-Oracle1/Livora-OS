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

  // ── Livora OS company (points to the main tenant DATABASE_URL) ────────
  // This registers the primary Livora OS installation as the first tenant so it
  // appears in the super-admin companies list.
  const tenantDbUrl = process.env.DATABASE_URL;
  if (tenantDbUrl) {
    const existing = await prisma.company.findFirst({
      where: { slug: 'livora-os' },
    });

    if (!existing) {
      const company = await prisma.company.create({
        data: {
          name: 'Livora OS',
          slug: 'livora-os',
          domain: process.env.NEXT_PUBLIC_APP_URL?.replace(/^https?:\/\//, '') || 'rms.vercel.app',
          databaseUrl: tenantDbUrl,
          primaryColor: '#3b82f6',
          inviteCode: `INV-${uuidv4().substring(0, 8).toUpperCase()}`,
          isActive: true,
          plan: 'enterprise',
          maxUsers: 500,
        },
      });
      console.log(`Livora OS company created: ${company.id}`);
    } else {
      // Keep databaseUrl in sync if it changed
      await prisma.company.update({
        where: { id: existing.id },
        data: { databaseUrl: tenantDbUrl },
      });
      console.log(`Livora OS company already exists, URL refreshed.`);
    }
  } else {
    console.log('DATABASE_URL not set — skipping Livora OS company seed.');
  }

  // ── Demo Parent + Subsidiary Companies ──────────────────────────────────
  // Only seed demo hierarchy if DATABASE_URL is set and not in production
  if (tenantDbUrl && process.env.SEED_DEMO_HIERARCHY === 'true') {
    const parentExists = await prisma.company.findFirst({ where: { slug: 'livora-group' } });
    if (!parentExists) {
      const parent = await prisma.company.create({
        data: {
          name:          'Livora Group Holdings',
          slug:          'livora-group',
          domain:        'group.livora.com',
          databaseUrl:   tenantDbUrl,
          type:          'PARENT',
          primaryColor:  '#2b1464',
          inviteCode:    `INV-${uuidv4().substring(0, 8).toUpperCase()}`,
          isActive:      true,
          plan:          'enterprise',
          maxUsers:      1000,
          description:   'Parent holding company for all Livora subsidiaries',
          city:          'Lagos',
          country:       'Nigeria',
          email:         'group@livora.com',
          phone:         '+2341234500000',
        },
      });

      // Subsidiary 1: Lagos
      await prisma.company.create({
        data: {
          name:          'Livora Properties Lagos',
          slug:          'livora-lagos',
          domain:        'lagos.livora.com',
          databaseUrl:   tenantDbUrl,
          type:          'SUBSIDIARY',
          parentId:      parent.id,
          primaryColor:  '#6366f1',
          inviteCode:    `INV-${uuidv4().substring(0, 8).toUpperCase()}`,
          isActive:      true,
          plan:          'professional',
          maxUsers:      200,
          description:   'Lagos region operations',
          city:          'Lagos',
          country:       'Nigeria',
        },
      });

      // Subsidiary 2: Abuja
      await prisma.company.create({
        data: {
          name:          'Livora Properties Abuja',
          slug:          'livora-abuja',
          domain:        'abuja.livora.com',
          databaseUrl:   tenantDbUrl,
          type:          'SUBSIDIARY',
          parentId:      parent.id,
          primaryColor:  '#22c55e',
          inviteCode:    `INV-${uuidv4().substring(0, 8).toUpperCase()}`,
          isActive:      true,
          plan:          'professional',
          maxUsers:      150,
          description:   'FCT and North-Central operations',
          city:          'Abuja',
          country:       'Nigeria',
        },
      });

      console.log('Demo parent/subsidiary hierarchy seeded (set SEED_DEMO_HIERARCHY=true to re-run)');
    }
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
