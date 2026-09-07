import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// Seeding is a system-level bootstrap, not simulated user traffic — it
// needs to write rows for a tenant it creates itself, across every table,
// with no per-request tenant context. Connect with the privileged role
// (bypasses RLS) rather than the app's restricted runtime role.
const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_DATABASE_URL } },
});

const departments = ['Engineering', 'Design', 'Sales', 'Marketing', 'People', 'Finance'] as const;

type SeedEmployee = {
  name: string;
  email: string;
  title: string;
  department: (typeof departments)[number];
  location: string;
  status: 'ACTIVE' | 'ON_LEAVE' | 'INACTIVE';
  managerName: string | null;
  joinDate: string;
  phone: string;
};

const employees: SeedEmployee[] = [
  { name: 'Ananya Rao', email: 'ananya.rao@acme.dev', title: 'VP of Engineering', department: 'Engineering', location: 'Bengaluru', status: 'ACTIVE', managerName: null, joinDate: '2019-03-11', phone: '+91 98450 11223' },
  { name: 'Diego Ramirez', email: 'diego.ramirez@acme.dev', title: 'Senior Backend Engineer', department: 'Engineering', location: 'Remote — Mexico City', status: 'ACTIVE', managerName: 'Ananya Rao', joinDate: '2021-06-01', phone: '+52 55 1234 5678' },
  { name: 'Priya Menon', email: 'priya.menon@acme.dev', title: 'Frontend Engineer', department: 'Engineering', location: 'Bengaluru', status: 'ON_LEAVE', managerName: 'Ananya Rao', joinDate: '2022-01-17', phone: '+91 90080 33445' },
  { name: 'Wei Chen', email: 'wei.chen@acme.dev', title: 'Platform Engineer', department: 'Engineering', location: 'Singapore', status: 'ACTIVE', managerName: 'Ananya Rao', joinDate: '2020-09-23', phone: '+65 8123 4567' },
  { name: 'Sarah Johnson', email: 'sarah.johnson@acme.dev', title: 'Head of Design', department: 'Design', location: 'London', status: 'ACTIVE', managerName: null, joinDate: '2018-11-05', phone: '+44 7700 900123' },
  { name: 'Kabir Malhotra', email: 'kabir.malhotra@acme.dev', title: 'Product Designer', department: 'Design', location: 'Bengaluru', status: 'ACTIVE', managerName: 'Sarah Johnson', joinDate: '2022-08-14', phone: '+91 99001 22334' },
  { name: 'Emma Novak', email: 'emma.novak@acme.dev', title: 'VP of Sales', department: 'Sales', location: 'New York', status: 'ACTIVE', managerName: null, joinDate: '2019-07-29', phone: '+1 212 555 0148' },
  { name: 'Rahul Verma', email: 'rahul.verma@acme.dev', title: 'Account Executive', department: 'Sales', location: 'Mumbai', status: 'ON_LEAVE', managerName: 'Emma Novak', joinDate: '2021-02-08', phone: '+91 98200 55667' },
  { name: 'Olivia Brown', email: 'olivia.brown@acme.dev', title: 'Sales Development Rep', department: 'Sales', location: 'New York', status: 'ACTIVE', managerName: 'Emma Novak', joinDate: '2023-04-03', phone: '+1 212 555 0199' },
  { name: 'Marcus Lee', email: 'marcus.lee@acme.dev', title: 'Marketing Manager', department: 'Marketing', location: 'Singapore', status: 'ACTIVE', managerName: null, joinDate: '2020-05-19', phone: '+65 8234 5678' },
  { name: 'Fatima Al-Sayed', email: 'fatima.alsayed@acme.dev', title: 'Content Strategist', department: 'Marketing', location: 'Remote — Dubai', status: 'ACTIVE', managerName: 'Marcus Lee', joinDate: '2022-10-11', phone: '+971 50 123 4567' },
  { name: 'Girija Kuanr', email: 'girija.kuanr@acme.dev', title: 'HR Business Partner', department: 'People', location: 'Bengaluru', status: 'ACTIVE', managerName: null, joinDate: '2021-01-25', phone: '+91 98765 43210' },
  { name: 'Thomas Weber', email: 'thomas.weber@acme.dev', title: 'Talent Acquisition Lead', department: 'People', location: 'Berlin', status: 'ACTIVE', managerName: 'Girija Kuanr', joinDate: '2022-03-07', phone: '+49 30 1234567' },
  { name: 'Nadia Petrova', email: 'nadia.petrova@acme.dev', title: 'Finance Controller', department: 'Finance', location: 'London', status: 'ACTIVE', managerName: null, joinDate: '2019-09-16', phone: '+44 7700 900456' },
  { name: 'Arjun Nair', email: 'arjun.nair@acme.dev', title: 'Financial Analyst', department: 'Finance', location: 'Bengaluru', status: 'INACTIVE', managerName: 'Nadia Petrova', joinDate: '2020-12-01', phone: '+90352 11009' },
];

async function main() {
  console.log('Seeding...');

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'acme-inc' },
    update: {},
    create: { name: 'Acme Inc.', slug: 'acme-inc' },
  });

  const passwordHash = await bcrypt.hash('password123', 10);

  // Pass 1: create all employees without managerId
  const created: Record<string, string> = {};
  for (const e of employees) {
    const employee = await prisma.employee.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email: e.email } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: e.name,
        email: e.email,
        title: e.title,
        department: e.department,
        location: e.location,
        status: e.status,
        joinDate: new Date(e.joinDate),
        phone: e.phone,
        leaveBalance: { create: { annualUsed: Math.floor(Math.random() * 6), sickUsed: Math.floor(Math.random() * 4) } },
      },
    });
    created[e.name] = employee.id;
  }

  // Pass 2: wire manager relationships
  for (const e of employees) {
    if (!e.managerName) continue;
    await prisma.employee.update({
      where: { id: created[e.name] },
      data: { managerId: created[e.managerName] },
    });
  }

  // One login user: Girija Kuanr as ADMIN, linked to her employee record
  const adminEmployeeId = created['Girija Kuanr'];
  const adminUser = await prisma.user.upsert({
    where: { email: 'girija.kuanr@acme.dev' },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'girija.kuanr@acme.dev',
      passwordHash,
      role: 'ADMIN',
    },
  });
  await prisma.employee.update({ where: { id: adminEmployeeId }, data: { userId: adminUser.id } });

  // Additional logins: one manager-level login per remaining department
  const managerLogins: Array<{ name: string; email: string }> = [
    { name: 'Ananya Rao', email: 'ananya.rao@acme.dev' },
    { name: 'Sarah Johnson', email: 'sarah.johnson@acme.dev' },
    { name: 'Emma Novak', email: 'emma.novak@acme.dev' },
    { name: 'Marcus Lee', email: 'marcus.lee@acme.dev' },
    { name: 'Nadia Petrova', email: 'nadia.petrova@acme.dev' },
  ];

  for (const l of managerLogins) {
    const employeeId = created[l.name];
    const user = await prisma.user.upsert({
      where: { email: l.email },
      update: {},
      create: {
        tenantId: tenant.id,
        email: l.email,
        passwordHash,
        role: 'MANAGER',
      },
    });
    await prisma.employee.update({ where: { id: employeeId }, data: { userId: user.id } });
  }

  // Today's attendance for everyone but the on-leave/inactive folks
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const statuses: Array<'PRESENT' | 'LATE' | 'WFH'> = ['PRESENT', 'PRESENT', 'WFH', 'PRESENT', 'LATE'];
  let i = 0;
  for (const e of employees) {
    if (e.status !== 'ACTIVE') continue;
    const status = statuses[i % statuses.length];
    i++;
    await prisma.attendanceRecord.upsert({
      where: { employeeId_date: { employeeId: created[e.name], date: today } },
      update: {},
      create: {
        tenantId: tenant.id,
        employeeId: created[e.name],
        date: today,
        status,
        clockIn: new Date(`${today.toISOString().slice(0, 10)}T${status === 'LATE' ? '10:12' : '09:0' + ((i % 5) + 1)}:00Z`),
        hours: status === 'LATE' ? 7.2 : 8.4,
      },
    });
  }

  // A few leave requests
  const leaveSeeds = [
    { name: 'Priya Menon', type: 'SICK' as const, start: '2026-09-01', end: '2026-09-03', reason: 'Flu recovery', status: 'APPROVED' as const },
    { name: 'Rahul Verma', type: 'ANNUAL' as const, start: '2026-09-02', end: '2026-09-06', reason: 'Family trip', status: 'APPROVED' as const },
    { name: 'Kabir Malhotra', type: 'WORK_FROM_HOME' as const, start: '2026-09-05', end: '2026-09-05', reason: 'Home repairs', status: 'PENDING' as const },
    { name: 'Fatima Al-Sayed', type: 'ANNUAL' as const, start: '2026-09-14', end: '2026-09-18', reason: 'Wedding', status: 'PENDING' as const },
    { name: 'Wei Chen', type: 'ANNUAL' as const, start: '2026-10-01', end: '2026-10-05', reason: 'Vacation', status: 'PENDING' as const },
    { name: 'Thomas Weber', type: 'SICK' as const, start: '2026-09-03', end: '2026-09-03', reason: 'Not feeling well', status: 'PENDING' as const },
  ];

  for (const l of leaveSeeds) {
    const start = new Date(l.start);
    const end = new Date(l.end);
    const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
    await prisma.leaveRequest.create({
      data: {
        tenantId: tenant.id,
        employeeId: created[l.name],
        type: l.type,
        startDate: start,
        endDate: end,
        days,
        reason: l.reason,
        status: l.status,
        decidedAt: l.status === 'PENDING' ? null : new Date(),
      },
    });
  }

  console.log(`Seeded tenant "${tenant.name}" (${tenant.slug}) with ${employees.length} employees.`);
  console.log('Logins (password123):');
  console.log('  girija.kuanr@acme.dev  (ADMIN, People)');
  console.log('  ananya.rao@acme.dev    (MANAGER, Engineering)');
  console.log('  sarah.johnson@acme.dev (MANAGER, Design)');
  console.log('  emma.novak@acme.dev    (MANAGER, Sales)');
  console.log('  marcus.lee@acme.dev    (MANAGER, Marketing)');
  console.log('  nadia.petrova@acme.dev (MANAGER, Finance)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
