import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import * as ExcelJS from 'exceljs';
import * as bcrypt from 'bcryptjs';

export interface ImportResult {
  total: number;
  created: number;
  skipped: number;
  errors: Array<{ row: number; email: string; reason: string }>;
}

type AnyBuffer = Buffer | Buffer<ArrayBufferLike> | ArrayBuffer | Uint8Array;

@Injectable()
export class BulkImportService {
  constructor(private readonly prisma: PrismaService) {}

  async generateTemplate(type: 'staff' | 'client' | 'realtor'): Promise<AnyBuffer> {
    const workbook = new ExcelJS.Workbook();

    let sheetName: string;
    let columns: string[];
    let sampleRows: (string | number)[][];

    if (type === 'staff') {
      sheetName = 'Staff Import';
      columns = [
        'First Name',
        'Last Name',
        'Email',
        'Password',
        'Phone',
        'Employee ID',
        'Position',
        'Employment Type',
        'Job Title',
        'Department Name',
        'Hire Date (YYYY-MM-DD)',
        'Base Salary',
      ];
      sampleRows = [
        ['John', 'Doe', 'john.doe@company.com', 'SecurePass1!', '+2348012345678', 'EMP-001', 'JUNIOR', 'FULL_TIME', 'Sales Agent', 'Sales', '2024-01-15', '150000'],
        ['Jane', 'Smith', 'jane.smith@company.com', 'SecurePass1!', '+2348098765432', 'EMP-002', 'SENIOR', 'FULL_TIME', 'Senior Agent', 'Marketing', '2023-06-01', '250000'],
        ['Bob', 'Johnson', 'bob.j@company.com', 'SecurePass1!', '+2348055512345', 'EMP-003', 'MANAGER', 'FULL_TIME', 'Team Lead', 'Operations', '2022-03-20', '350000'],
      ];
    } else if (type === 'client') {
      sheetName = 'Client Import';
      columns = [
        'First Name',
        'Last Name',
        'Email',
        'Phone',
        'Assigned Realtor Email',
      ];
      sampleRows = [
        ['Alice', 'Brown', 'alice.brown@gmail.com', '+2348011112222', 'realtor@company.com'],
        ['Charlie', 'Davis', 'charlie.davis@gmail.com', '+2348033334444', 'realtor@company.com'],
        ['Eva', 'Wilson', 'eva.wilson@gmail.com', '+2348055556666', ''],
      ];
    } else {
      sheetName = 'Realtor Import';
      columns = [
        'First Name',
        'Last Name',
        'Email',
        'Password',
        'Phone',
        'License Number',
        'Agency',
        'Specializations (comma-separated)',
        'Bio',
      ];
      sampleRows = [
        ['Mike', 'Chen', 'mike.chen@agency.com', 'SecurePass1!', '+2348022223333', 'REA-001', 'Prime Realty', 'Residential,Luxury', 'Experienced realtor specializing in luxury properties'],
        ['Sarah', 'Lee', 'sarah.lee@agency.com', 'SecurePass1!', '+2348044445555', 'REA-002', 'Best Homes', 'Commercial,Land', 'Commercial property expert'],
        ['Tom', 'Park', 'tom.park@agency.com', 'SecurePass1!', '+2348066667777', 'REA-003', 'City Realty', 'Residential', 'Residential specialist'],
      ];
    }

    const sheet = workbook.addWorksheet(sheetName);

    // Set column widths
    sheet.columns = columns.map((header) => ({
      header,
      key: header,
      width: header.toLowerCase().includes('email') ? 30 : 20,
    }));

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'ffd6e4f7' },
      };
    });

    // AutoFilter on header row
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: columns.length },
    };

    // Freeze first row
    sheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];

    // Add sample rows
    for (const row of sampleRows) {
      sheet.addRow(row);
    }

    return workbook.xlsx.writeBuffer();
  }

  async importStaff(buffer: AnyBuffer): Promise<ImportResult> {
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];

    const getCellValue = (row: ExcelJS.Row, col: number): string => {
      const cell = row.getCell(col);
      return cell.text?.trim() ?? String(cell.value ?? '').trim();
    };

    let total = 0;
    let created = 0;
    let skipped = 0;
    const errors: Array<{ row: number; email: string; reason: string }> = [];

    const rows: Array<{ row: ExcelJS.Row; rowNumber: number }> = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      rows.push({ row, rowNumber });
    });

    for (const { row, rowNumber } of rows) {
      const firstName = getCellValue(row, 1);
      const lastName = getCellValue(row, 2);
      const email = getCellValue(row, 3);
      const password = getCellValue(row, 4);
      const phone = getCellValue(row, 5);
      const employeeId = getCellValue(row, 6);
      const positionRaw = getCellValue(row, 7);
      const employmentTypeRaw = getCellValue(row, 8);
      const jobTitle = getCellValue(row, 9);
      const departmentName = getCellValue(row, 10);
      const hireDate = getCellValue(row, 11);
      const baseSalary = getCellValue(row, 12);

      // Skip completely empty rows
      if (
        !firstName && !lastName && !email && !password &&
        !employeeId && !jobTitle && !departmentName && !hireDate && !baseSalary
      ) {
        skipped++;
        continue;
      }

      total++;

      // Validate required fields
      const requiredFields: Array<[string, string]> = [
        ['firstName', firstName],
        ['lastName', lastName],
        ['email', email],
        ['password', password],
        ['employeeId', employeeId],
        ['jobTitle', jobTitle],
        ['departmentName', departmentName],
        ['hireDate', hireDate],
        ['baseSalary', baseSalary],
      ];

      let missingField: string | null = null;
      for (const [fieldName, fieldValue] of requiredFields) {
        if (!fieldValue) {
          missingField = fieldName;
          break;
        }
      }
      if (missingField) {
        errors.push({ row: rowNumber, email: email || 'N/A', reason: `Missing required field: ${missingField}` });
        continue;
      }

      // Check if email already exists
      const existingUser = await this.prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        errors.push({ row: rowNumber, email, reason: 'Email already registered' });
        continue;
      }

      // Find department by name (case-insensitive)
      const department = await this.prisma.department.findFirst({
        where: { name: { contains: departmentName, mode: 'insensitive' } },
      });
      if (!department) {
        errors.push({ row: rowNumber, email, reason: `Department not found: ${departmentName}` });
        continue;
      }

      // Map position
      const validPositions = ['EXECUTIVE', 'DIRECTOR', 'MANAGER', 'TEAM_LEAD', 'SENIOR', 'JUNIOR', 'INTERN'];
      const position = validPositions.includes(positionRaw.toUpperCase()) ? positionRaw.toUpperCase() : 'JUNIOR';

      // Map employment type
      const validEmploymentTypes = ['FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERN'];
      const employmentType = validEmploymentTypes.includes(employmentTypeRaw.toUpperCase())
        ? employmentTypeRaw.toUpperCase()
        : 'FULL_TIME';

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      try {
        await this.prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email,
              password: hashedPassword,
              firstName,
              lastName,
              phone: phone || null,
              role: 'STAFF',
              status: 'ACTIVE',
              emailVerified: true,
            },
          });
          await tx.staffProfile.create({
            data: {
              userId: user.id,
              employeeId,
              position: position as any,
              employmentType: employmentType as any,
              title: jobTitle,
              departmentId: department.id,
              hireDate: new Date(hireDate),
              baseSalary: parseFloat(baseSalary) || 0,
            },
          });
        });
        created++;
      } catch (err: any) {
        errors.push({ row: rowNumber, email, reason: err?.message ?? 'Unknown error during import' });
      }
    }

    return { total, created, skipped, errors };
  }

  async importClients(buffer: AnyBuffer): Promise<ImportResult> {
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];

    const getCellValue = (row: ExcelJS.Row, col: number): string => {
      const cell = row.getCell(col);
      return cell.text?.trim() ?? String(cell.value ?? '').trim();
    };

    let total = 0;
    let created = 0;
    let skipped = 0;
    const errors: Array<{ row: number; email: string; reason: string }> = [];

    const rows: Array<{ row: ExcelJS.Row; rowNumber: number }> = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      rows.push({ row, rowNumber });
    });

    for (const { row, rowNumber } of rows) {
      const firstName = getCellValue(row, 1);
      const lastName = getCellValue(row, 2);
      const email = getCellValue(row, 3);
      const phone = getCellValue(row, 4);
      const assignedRealtorEmail = getCellValue(row, 5);

      // Skip completely empty rows
      if (!firstName && !lastName && !email) {
        skipped++;
        continue;
      }

      total++;

      // Validate required fields
      if (!firstName) {
        errors.push({ row: rowNumber, email: email || 'N/A', reason: 'Missing required field: firstName' });
        continue;
      }
      if (!lastName) {
        errors.push({ row: rowNumber, email: email || 'N/A', reason: 'Missing required field: lastName' });
        continue;
      }
      if (!email) {
        errors.push({ row: rowNumber, email: 'N/A', reason: 'Missing required field: email' });
        continue;
      }

      // Check if email already exists
      const existingUser = await this.prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        errors.push({ row: rowNumber, email, reason: 'Email already registered' });
        continue;
      }

      // Look up assigned realtor if provided
      let realtor: { id: string } | null = null;
      if (assignedRealtorEmail) {
        realtor = await this.prisma.realtorProfile.findFirst({
          where: { user: { email: assignedRealtorEmail } },
          select: { id: true },
        });
      }

      // Generate random temp password
      const tempPassword = `Temp${Math.random().toString(36).slice(2, 8).toUpperCase()}!`;
      const hashedPassword = await bcrypt.hash(tempPassword, 12);

      try {
        await this.prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email,
              password: hashedPassword,
              firstName,
              lastName,
              phone: phone || null,
              role: 'CLIENT',
              status: 'ACTIVE',
              emailVerified: true,
            },
          });
          await tx.clientProfile.create({
            data: {
              userId: user.id,
              realtorId: realtor?.id || null,
            },
          });
        });
        created++;
      } catch (err: any) {
        errors.push({ row: rowNumber, email, reason: err?.message ?? 'Unknown error during import' });
      }
    }

    return { total, created, skipped, errors };
  }

  async importRealtors(buffer: AnyBuffer): Promise<ImportResult> {
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];

    const getCellValue = (row: ExcelJS.Row, col: number): string => {
      const cell = row.getCell(col);
      return cell.text?.trim() ?? String(cell.value ?? '').trim();
    };

    let total = 0;
    let created = 0;
    let skipped = 0;
    const errors: Array<{ row: number; email: string; reason: string }> = [];

    const rows: Array<{ row: ExcelJS.Row; rowNumber: number }> = [];
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      rows.push({ row, rowNumber });
    });

    for (const { row, rowNumber } of rows) {
      const firstName = getCellValue(row, 1);
      const lastName = getCellValue(row, 2);
      const email = getCellValue(row, 3);
      const password = getCellValue(row, 4);
      const phone = getCellValue(row, 5);
      const licenseNumber = getCellValue(row, 6);
      const agency = getCellValue(row, 7);
      const specializations = getCellValue(row, 8);
      const bio = getCellValue(row, 9);

      // Skip completely empty rows
      if (!firstName && !lastName && !email && !password && !licenseNumber) {
        skipped++;
        continue;
      }

      total++;

      // Validate required fields
      const requiredFields: Array<[string, string]> = [
        ['firstName', firstName],
        ['lastName', lastName],
        ['email', email],
        ['password', password],
        ['licenseNumber', licenseNumber],
      ];

      let missingField: string | null = null;
      for (const [fieldName, fieldValue] of requiredFields) {
        if (!fieldValue) {
          missingField = fieldName;
          break;
        }
      }
      if (missingField) {
        errors.push({ row: rowNumber, email: email || 'N/A', reason: `Missing required field: ${missingField}` });
        continue;
      }

      // Check if email already exists
      const existingUser = await this.prisma.user.findUnique({ where: { email } });
      if (existingUser) {
        errors.push({ row: rowNumber, email, reason: 'Email already registered' });
        continue;
      }

      // Check license number uniqueness
      const existingLicense = await this.prisma.realtorProfile.findUnique({
        where: { licenseNumber },
      });
      if (existingLicense) {
        errors.push({ row: rowNumber, email, reason: 'License number already exists' });
        continue;
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      try {
        await this.prisma.$transaction(async (tx) => {
          const user = await tx.user.create({
            data: {
              email,
              password: hashedPassword,
              firstName,
              lastName,
              phone: phone || null,
              role: 'REALTOR',
              status: 'ACTIVE',
              emailVerified: true,
            },
          });
          await tx.realtorProfile.create({
            data: {
              userId: user.id,
              licenseNumber,
              agency: agency || null,
              bio: bio || null,
              specializations: specializations
                ? specializations.split(',').map((s) => s.trim()).filter(Boolean)
                : [],
            },
          });
        });
        created++;
      } catch (err: any) {
        errors.push({ row: rowNumber, email, reason: err?.message ?? 'Unknown error during import' });
      }
    }

    return { total, created, skipped, errors };
  }
}
