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

  // ─────────────────────────────────────────────────────────────────────────
  // MULTI-BRANCH SEED DATA
  // ─────────────────────────────────────────────────────────────────────────

  // ── Branch 1: Lagos Island ─────────────────────────────────────────────

  const branchLagos = await prisma.branch.upsert({
    where: { code: 'LGS-01' },
    update: {},
    create: {
      name:        'Lagos Island Branch',
      code:        'LGS-01',
      description: 'Primary Lagos Island operations hub',
      address:     '45 Marina Road, Lagos Island',
      city:        'Lagos',
      state:       'Lagos State',
      country:     'Nigeria',
      latitude:    6.4541,
      longitude:   3.3947,
      phone:       '+2341234567801',
      email:       'lagos-island@livora.com',
      isActive:    true,
    },
  });
  console.log('Branch created:', branchLagos.name);

  // ── Branch 2: Abuja Central ────────────────────────────────────────────

  const branchAbuja = await prisma.branch.upsert({
    where: { code: 'ABJ-01' },
    update: {},
    create: {
      name:        'Abuja Central Branch',
      code:        'ABJ-01',
      description: 'Federal Capital Territory operations',
      address:     '12 Wuse Zone 4, Abuja',
      city:        'Abuja',
      state:       'FCT',
      country:     'Nigeria',
      latitude:    9.0579,
      longitude:   7.4951,
      phone:       '+2341234567802',
      email:       'abuja@livora.com',
      isActive:    true,
    },
  });
  console.log('Branch created:', branchAbuja.name);

  // ── Branch 3: Port Harcourt ────────────────────────────────────────────

  const branchPH = await prisma.branch.upsert({
    where: { code: 'PHC-01' },
    update: {},
    create: {
      name:        'Port Harcourt Branch',
      code:        'PHC-01',
      description: 'South-South regional hub',
      address:     '8 Aba Road, Port Harcourt',
      city:        'Port Harcourt',
      state:       'Rivers State',
      country:     'Nigeria',
      latitude:    4.8156,
      longitude:   7.0498,
      phone:       '+2341234567803',
      email:       'ph@livora.com',
      isActive:    true,
    },
  });
  console.log('Branch created:', branchPH.name);

  // ── Branch Managers ────────────────────────────────────────────────────

  const bmLagos = await prisma.user.upsert({
    where: { email: 'bm.lagos@livora.com' },
    update: { password: hashedPassword, status: UserStatus.ACTIVE },
    create: {
      email:         'bm.lagos@livora.com',
      password:      hashedPassword,
      firstName:     'Chidi',
      lastName:      'Okonkwo',
      phone:         '+2348011223344',
      role:          UserRole.BRANCH_MANAGER,
      status:        UserStatus.ACTIVE,
      emailVerified: true,
      referralCode:  'REF-BMLGS01',
      branchId:      branchLagos.id,
    },
  });

  const bmAbuja = await prisma.user.upsert({
    where: { email: 'bm.abuja@livora.com' },
    update: { password: hashedPassword, status: UserStatus.ACTIVE },
    create: {
      email:         'bm.abuja@livora.com',
      password:      hashedPassword,
      firstName:     'Ngozi',
      lastName:      'Adeyemi',
      phone:         '+2348022334455',
      role:          UserRole.BRANCH_MANAGER,
      status:        UserStatus.ACTIVE,
      emailVerified: true,
      referralCode:  'REF-BMABJ01',
      branchId:      branchAbuja.id,
    },
  });

  const bmPH = await prisma.user.upsert({
    where: { email: 'bm.ph@livora.com' },
    update: { password: hashedPassword, status: UserStatus.ACTIVE },
    create: {
      email:         'bm.ph@livora.com',
      password:      hashedPassword,
      firstName:     'Emeka',
      lastName:      'Eze',
      phone:         '+2348033445566',
      role:          UserRole.BRANCH_MANAGER,
      status:        UserStatus.ACTIVE,
      emailVerified: true,
      referralCode:  'REF-BMPHC01',
      branchId:      branchPH.id,
    },
  });

  // Assign managers to branches
  await prisma.branch.update({ where: { id: branchLagos.id }, data: { managerId: bmLagos.id } });
  await prisma.branch.update({ where: { id: branchAbuja.id }, data: { managerId: bmAbuja.id } });
  await prisma.branch.update({ where: { id: branchPH.id },    data: { managerId: bmPH.id } });
  console.log('Branch managers assigned');

  // ── Branch Realtors ────────────────────────────────────────────────────

  const realtorLagos = await prisma.user.upsert({
    where: { email: 'realtor.lagos@livora.com' },
    update: { password: hashedPassword, status: UserStatus.ACTIVE },
    create: {
      email:         'realtor.lagos@livora.com',
      password:      hashedPassword,
      firstName:     'Amaka',
      lastName:      'Nwosu',
      phone:         '+2348044556677',
      role:          UserRole.REALTOR,
      status:        UserStatus.ACTIVE,
      emailVerified: true,
      referralCode:  'REF-RLLGS01',
      branchId:      branchLagos.id,
      realtorProfile: {
        create: {
          licenseNumber: 'LVR-LIC-LGS-001',
          agency:        'Livora Properties Lagos',
          bio:           'Lagos Island specialist with 5 years experience',
          specializations: ['Residential', 'Commercial'],
        },
      },
    },
  });

  const realtorAbuja = await prisma.user.upsert({
    where: { email: 'realtor.abuja@livora.com' },
    update: { password: hashedPassword, status: UserStatus.ACTIVE },
    create: {
      email:         'realtor.abuja@livora.com',
      password:      hashedPassword,
      firstName:     'Tunde',
      lastName:      'Balogun',
      phone:         '+2348055667788',
      role:          UserRole.REALTOR,
      status:        UserStatus.ACTIVE,
      emailVerified: true,
      referralCode:  'REF-RLABJ01',
      branchId:      branchAbuja.id,
      realtorProfile: {
        create: {
          licenseNumber: 'LVR-LIC-ABJ-001',
          agency:        'Livora Properties Abuja',
          bio:           'FCT specialist focused on luxury properties',
          specializations: ['Luxury', 'Land'],
        },
      },
    },
  });

  console.log('Branch realtors created');

  // ── Sample Properties per Branch ──────────────────────────────────────

  const lagosRealtor  = await prisma.realtorProfile.findUnique({ where: { licenseNumber: 'LVR-LIC-LGS-001' } });
  const abujaRealtor  = await prisma.realtorProfile.findUnique({ where: { licenseNumber: 'LVR-LIC-ABJ-001' } });

  if (lagosRealtor) {
    const prop1 = await prisma.property.upsert({
      where: { id: 'seed-prop-lgs-001' },
      update: {},
      create: {
        id:            'seed-prop-lgs-001',
        title:         '3-Bedroom Luxury Apartment, Victoria Island',
        description:   'Modern duplex with ocean view and smart home features',
        type:          'APARTMENT',
        status:        'AVAILABLE',
        address:       '14 Ozumba Mbadiwe Avenue',
        city:          'Lagos',
        state:         'Lagos State',
        country:       'Nigeria',
        latitude:      6.4295,
        longitude:     3.4279,
        price:         75_000_000,
        originalPrice: 75_000_000,
        listingPrice:  78_000_000,
        bedrooms:      3,
        bathrooms:     3,
        area:          2200,
        isListed:      true,
        listedAt:      new Date(),
        realtorId:     lagosRealtor.id,
        branchId:      branchLagos.id,
        features:      ['Swimming Pool', 'Gym', 'Smart Home', 'Generator', 'BQ'],
        images:        [],
      },
    });

    await prisma.property.upsert({
      where: { id: 'seed-prop-lgs-002' },
      update: {},
      create: {
        id:            'seed-prop-lgs-002',
        title:         'Commercial Plaza, Lekki Phase 1',
        description:   'Prime commercial space in Lekki business district',
        type:          'COMMERCIAL',
        status:        'LISTED',
        address:       '22 Admiralty Way, Lekki',
        city:          'Lagos',
        state:         'Lagos State',
        country:       'Nigeria',
        latitude:      6.4461,
        longitude:     3.5394,
        price:         220_000_000,
        originalPrice: 220_000_000,
        bedrooms:      0,
        bathrooms:     4,
        area:          8500,
        isListed:      true,
        listedAt:      new Date(),
        realtorId:     lagosRealtor.id,
        branchId:      branchLagos.id,
        features:      ['Parking Spaces', 'Central AC', 'Security', 'Generator'],
        images:        [],
      },
    });
    console.log('Lagos properties seeded');
  }

  if (abujaRealtor) {
    await prisma.property.upsert({
      where: { id: 'seed-prop-abj-001' },
      update: {},
      create: {
        id:            'seed-prop-abj-001',
        title:         '4-Bedroom Terrace Duplex, Maitama',
        description:   'Elegant duplex in Abuja\'s most prestigious district',
        type:          'RESIDENTIAL',
        status:        'AVAILABLE',
        address:       '5 Aminu Kano Crescent, Maitama',
        city:          'Abuja',
        state:         'FCT',
        country:       'Nigeria',
        latitude:      9.0820,
        longitude:     7.4866,
        price:         120_000_000,
        originalPrice: 120_000_000,
        bedrooms:      4,
        bathrooms:     4,
        area:          3400,
        isListed:      true,
        listedAt:      new Date(),
        realtorId:     abujaRealtor.id,
        branchId:      branchAbuja.id,
        features:      ['Boys Quarters', 'Generator', 'Parking', 'CCTV'],
        images:        [],
      },
    });

    await prisma.property.upsert({
      where: { id: 'seed-prop-abj-002' },
      update: {},
      create: {
        id:            'seed-prop-abj-002',
        title:         '500 SQM Land, Gwarinpa Estate',
        description:   'Registered land with C-of-O in fast-developing Gwarinpa',
        type:          'LAND',
        status:        'AVAILABLE',
        address:       'Plot 12, 4th Avenue, Gwarinpa',
        city:          'Abuja',
        state:         'FCT',
        country:       'Nigeria',
        latitude:      9.1091,
        longitude:     7.3831,
        price:         35_000_000,
        originalPrice: 35_000_000,
        pricePerSqm:   70_000,
        numberOfPlots: 1,
        bedrooms:      0,
        bathrooms:     0,
        area:          500,
        isListed:      true,
        listedAt:      new Date(),
        realtorId:     abujaRealtor.id,
        branchId:      branchAbuja.id,
        features:      ['C-of-O', 'Corner Piece', 'Fenced', 'Serviced'],
        images:        [],
      },
    });
    console.log('Abuja properties seeded');
  }

  // ── Sample Expense Categories ──────────────────────────────────────────

  const expCatNames = [
    { name: 'Office Supplies',   type: 'OPERATIONAL' as const },
    { name: 'Marketing',         type: 'MARKETING'   as const },
    { name: 'Utility Bills',     type: 'UTILITY'     as const },
    { name: 'Staff Transport',   type: 'OPERATIONAL' as const },
    { name: 'Capital Equipment', type: 'CAPITAL'     as const },
  ];

  const expCats: Record<string, string> = {};
  for (const c of expCatNames) {
    let cat = await prisma.expenseCategory.findFirst({ where: { name: c.name } });
    if (!cat) {
      cat = await prisma.expenseCategory.create({
        data: { name: c.name, description: `${c.name} expenses`, type: c.type },
      });
    }
    expCats[c.name] = cat.id;
  }
  console.log('Expense categories seeded');

  // ── Sample Expenses per Branch ─────────────────────────────────────────

  const expenseSeed = [
    { title: 'Office stationery Q1', amount: 45_000,    catName: 'Office Supplies',   branchId: branchLagos.id, daysAgo: 20 },
    { title: 'Facebook Ads – Lagos', amount: 250_000,   catName: 'Marketing',         branchId: branchLagos.id, daysAgo: 15 },
    { title: 'Electricity bill',     amount: 85_000,    catName: 'Utility Bills',     branchId: branchLagos.id, daysAgo: 5  },
    { title: 'Staff bus (Abuja)',    amount: 120_000,   catName: 'Staff Transport',   branchId: branchAbuja.id, daysAgo: 10 },
    { title: 'Printer purchase',     amount: 320_000,   catName: 'Capital Equipment', branchId: branchAbuja.id, daysAgo: 30 },
    { title: 'Internet service Q1',  amount: 60_000,    catName: 'Utility Bills',     branchId: branchPH.id,    daysAgo: 8  },
    { title: 'PH office marketing',  amount: 180_000,   catName: 'Marketing',         branchId: branchPH.id,    daysAgo: 12 },
  ];

  for (const e of expenseSeed) {
    const expDate = new Date();
    expDate.setDate(expDate.getDate() - e.daysAgo);
    await prisma.expense.create({
      data: {
        title:          e.title,
        amount:         e.amount,
        categoryId:     expCats[e.catName],
        paymentMethod:  'BANK_TRANSFER',
        expenseDate:    expDate,
        createdById:    admin.id,
        approvalStatus: 'APPROVED',
        approvedById:   admin.id,
        approvedAt:     expDate,
        branchId:       e.branchId,
      },
    });
  }
  console.log('Sample expenses seeded');

  console.log('');
  console.log('Database seeded successfully!');
  console.log('');
  console.log('Accounts:');
  console.log('  Super Admin:          superadmin@rms.com       / Admin123!');
  console.log('  Admin:                admin@rms.com            / Admin123!');
  console.log('  General Overseer:     overseer@rms.com         / Admin123!');
  console.log('  Realtor:              realtor@rms.com          / Admin123!');
  console.log('  Staff:                staff@rms.com            / Admin123!');
  console.log('');
  console.log('Branch Managers:');
  console.log('  Lagos Branch Manager: bm.lagos@livora.com      / Admin123!');
  console.log('  Abuja Branch Manager: bm.abuja@livora.com      / Admin123!');
  console.log('  PH Branch Manager:    bm.ph@livora.com         / Admin123!');
  console.log('');
  console.log('Branch Realtors:');
  console.log('  Lagos Realtor:        realtor.lagos@livora.com / Admin123!');
  console.log('  Abuja Realtor:        realtor.abuja@livora.com / Admin123!');
  console.log('');
  console.log('Branches: Lagos Island (LGS-01) | Abuja Central (ABJ-01) | Port Harcourt (PHC-01)');
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
