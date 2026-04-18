import { PrismaClient, UserRole, UserStatus, StaffPosition, EmploymentType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  const hashedPassword = await bcrypt.hash('Admin123!', 12);

  // Create Super Admin
  const superAdmin = await prisma.user.upsert({
    where: { email: 'superadmin@rms.com' },
    update: {},
    create: {
      email: 'superadmin@rms.com',
      password: hashedPassword,
      firstName: 'Super',
      lastName: 'Admin',
      phone: '+1234567890',
      role: UserRole.SUPER_ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      referralCode: 'REF-SADMIN01',
      adminProfile: {
        create: {
          permissions: ['all'],
          department: 'Executive',
        },
      },
    },
  });

  console.log('Super Admin created:', superAdmin.email);

  // Create Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@rms.com' },
    update: {},
    create: {
      email: 'admin@rms.com',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      phone: '+1234567891',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      referralCode: 'REF-ADMIN001',
      adminProfile: {
        create: {
          permissions: ['manage_realtors', 'manage_clients', 'manage_properties', 'view_analytics'],
          department: 'Operations',
        },
      },
    },
  });

  console.log('Admin created:', admin.email);

  // Create Department for staff
  const department = await prisma.department.upsert({
    where: { code: 'OPS' },
    update: {},
    create: {
      name: 'Operations',
      code: 'OPS',
      description: 'General operations department',
    },
  });

  console.log('Department created:', department.name);

  // Create Staff Member
  const staffUser = await prisma.user.upsert({
    where: { email: 'staff@rms.com' },
    update: { password: hashedPassword, status: UserStatus.ACTIVE },
    create: {
      email: 'staff@rms.com',
      password: hashedPassword,
      firstName: 'John',
      lastName: 'Staff',
      phone: '+1234567892',
      role: UserRole.STAFF,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      referralCode: 'REF-STAFF001',
      staffProfile: {
        create: {
          employeeId: 'EMP-001',
          position: StaffPosition.SENIOR,
          title: 'Senior Operations Officer',
          employmentType: EmploymentType.FULL_TIME,
          hireDate: new Date('2024-01-15'),
          departmentId: department.id,
          baseSalary: 500000,
          currency: 'NGN',
          annualLeaveBalance: 20,
          sickLeaveBalance: 10,
        },
      },
    },
  });
  console.log('Staff:', staffUser.email);

  // Create General Overseer
  const goUser = await prisma.user.upsert({
    where: { email: 'overseer@rms.com' },
    update: { password: hashedPassword, status: UserStatus.ACTIVE },
    create: {
      email: 'overseer@rms.com',
      password: hashedPassword,
      firstName: 'General',
      lastName: 'Overseer',
      phone: '+1234567893',
      role: UserRole.GENERAL_OVERSEER,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      referralCode: 'REF-OVSEER01',
    },
  });
  console.log('General Overseer:', goUser.email);

  // Create Realtor
  const realtorUser = await prisma.user.upsert({
    where: { email: 'realtor@rms.com' },
    update: { password: hashedPassword, status: UserStatus.ACTIVE },
    create: {
      email: 'realtor@rms.com',
      password: hashedPassword,
      firstName: 'Jane',
      lastName: 'Realtor',
      phone: '+1234567894',
      role: UserRole.REALTOR,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      referralCode: 'REF-REALTR01',
      realtorProfile: {
        create: {
          licenseNumber: 'LVR-LIC-001',
          agency: 'Livora Properties',
          bio: 'Experienced real estate professional',
          specializations: ['Residential', 'Land'],
        },
      },
    },
  });
  console.log('Realtor:', realtorUser.email);

  // Create system settings (commission rates and tax)
  const settings = [
    { key: 'commission_bronze', value: { rate: 0.03 } },
    { key: 'commission_silver', value: { rate: 0.035 } },
    { key: 'commission_gold', value: { rate: 0.04 } },
    { key: 'commission_platinum', value: { rate: 0.05 } },
    { key: 'tax_rate', value: { rate: 0.15 } },
    { key: 'loyalty_points_per_sale', value: { points: 100 } },
  ];

  for (const setting of settings) {
    await prisma.systemSetting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }

  console.log('System settings created');

  console.log('');
  console.log('Database seeded successfully!');
  console.log('');
  console.log('Accounts:');
  console.log('  Super Admin:       superadmin@rms.com / Admin123!');
  console.log('  Admin:             admin@rms.com / Admin123!');
  console.log('  General Overseer:  overseer@rms.com / Admin123!');
  console.log('  Realtor:           realtor@rms.com / Admin123!');
  console.log('  Staff:             staff@rms.com / Admin123!');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
