#!/bin/bash

# Load Test Database Seeding Script for Phase 5
# Creates a test tenant with 2,000+ employees and 5 years of historical data
# Usage: ./scripts/seed-load-test.sh --employees 2000 --years 5

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Default parameters
NUM_EMPLOYEES=2000
YEARS_OF_HISTORY=5

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --employees)
            NUM_EMPLOYEES="$2"
            shift 2
            ;;
        --years)
            YEARS_OF_HISTORY="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

log_title() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}   $1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

log_pass() {
    echo -e "${GREEN}✓ $1${NC}"
}

log_info() {
    echo -e "${YELLOW}→ $1${NC}"
}

log_error() {
    echo -e "${RED}✗ $1${NC}"
}

log_title "Load Test Database Seeding"

echo ""
echo -e "${YELLOW}Configuration:${NC}"
echo -e "  Employees:       $NUM_EMPLOYEES"
echo -e "  Years of History: $YEARS_OF_HISTORY"
echo ""

# Check environment
if [ -z "$DATABASE_URL" ]; then
    log_error "DATABASE_URL not set"
    exit 1
fi

if [ -z "$DIRECT_DATABASE_URL" ]; then
    log_error "DIRECT_DATABASE_URL not set"
    exit 1
fi

log_pass "Environment variables configured"

# Create the seed script
SEED_SCRIPT="$PROJECT_ROOT/api/prisma/seed-load-test.ts"

cat > "$SEED_SCRIPT" << 'EOF'
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { businessDateUTC } from '../src/attendance/business-time.js';

interface EnvConfig {
  NUM_EMPLOYEES: number;
  YEARS_OF_HISTORY: number;
}

const config: EnvConfig = {
  NUM_EMPLOYEES: parseInt(process.env.NUM_EMPLOYEES || '2000'),
  YEARS_OF_HISTORY: parseInt(process.env.YEARS_OF_HISTORY || '5'),
};

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.DIRECT_DATABASE_URL } },
});

const departments = ['Engineering', 'Design', 'Sales', 'Marketing', 'People', 'Finance', 'Operations', 'Legal', 'Support'];
const locations = [
  'Bengaluru', 'New York', 'London', 'Singapore', 'Remote — Mexico City', 'Berlin',
  'Remote — Dubai', 'Tokyo', 'Sydney', 'Toronto', 'São Paulo', 'Paris'
];
const titles = [
  'VP of Engineering', 'Senior Backend Engineer', 'Frontend Engineer', 'Platform Engineer',
  'Head of Design', 'Product Designer', 'UX Designer',
  'VP of Sales', 'Account Executive', 'Sales Development Rep',
  'Marketing Manager', 'Content Strategist', 'Growth Lead',
  'HR Business Partner', 'Talent Acquisition Lead', 'People Operations Manager',
  'Finance Controller', 'Financial Analyst', 'Accountant',
  'Operations Manager', 'Process Analyst', 'Administrator',
  'General Counsel', 'Legal Associate', 'Compliance Officer',
  'Support Manager', 'Customer Support Specialist', 'Technical Support Engineer'
];

function generateName(index: number): string {
  const firstNames = ['Ananya', 'Diego', 'Priya', 'Wei', 'Sarah', 'Kabir', 'Emma', 'Rahul', 'Olivia', 'Marcus',
    'Fatima', 'Girija', 'Thomas', 'Nadia', 'Arjun', 'Sophie', 'Raj', 'Luna', 'Ivan', 'Zainab'];
  const lastNames = ['Rao', 'Ramirez', 'Menon', 'Chen', 'Johnson', 'Malhotra', 'Novak', 'Verma', 'Brown', 'Lee',
    'Al-Sayed', 'Kuanr', 'Weber', 'Petrova', 'Nair', 'Martin', 'Gupta', 'Singh', 'Kumar', 'Patel'];
  const firstName = firstNames[index % firstNames.length];
  const lastName = lastNames[(index * 7) % lastNames.length];
  return `${firstName} ${lastName} ${Math.floor(index / (firstNames.length * lastNames.length))}`.trim();
}

function generateEmail(name: string, index: number): string {
  const baseEmail = name.toLowerCase().replace(/\s+/g, '.').replace(/\d+$/, '');
  return `${baseEmail}.${index}@loadtest.dev`;
}

function getRandomItem<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

async function main() {
  console.log(`\nSeeding load test data with ${config.NUM_EMPLOYEES} employees and ${config.YEARS_OF_HISTORY} years of history...`);

  // Create tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: 'loadtest-tenant' },
    update: {},
    create: {
      name: 'Load Test Tenant',
      slug: 'loadtest-tenant',
      timezone: 'Asia/Kolkata',
      lateCutoffMinutes: 30,
    },
  });
  console.log(`✓ Created tenant: ${tenant.name}`);

  // Create departments
  const deptMap: Record<string, string> = {};
  for (const dept of departments) {
    const d = await prisma.department.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: dept } },
      update: {},
      create: { tenantId: tenant.id, name: dept },
    });
    deptMap[dept] = d.id;
  }
  console.log(`✓ Created ${departments.length} departments`);

  // Create employees
  const employeeMap: Record<string, string> = {};
  const passwordHash = await bcrypt.hash('password123', 10);

  console.log(`Creating ${config.NUM_EMPLOYEES} employees...`);
  const batchSize = 100;

  for (let i = 0; i < config.NUM_EMPLOYEES; i++) {
    const name = generateName(i);
    const email = generateEmail(name, i);
    const dept = getRandomItem(departments);
    const location = getRandomItem(locations);
    const title = getRandomItem(titles);

    const joinDate = new Date();
    joinDate.setFullYear(joinDate.getFullYear() - Math.floor(Math.random() * 5)); // 0-5 years ago

    const employee = await prisma.employee.upsert({
      where: { tenantId_email: { tenantId: tenant.id, email } },
      update: {},
      create: {
        tenantId: tenant.id,
        name,
        email,
        title,
        departmentId: deptMap[dept],
        location,
        status: Math.random() > 0.1 ? 'ACTIVE' : (Math.random() > 0.5 ? 'INACTIVE' : 'ON_LEAVE'),
        joinDate,
        phone: `+${Math.floor(Math.random() * 90000000000) + 10000000000}`,
        leaveBalance: {
          create: {
            annualUsed: Math.floor(Math.random() * 15),
            sickUsed: Math.floor(Math.random() * 5),
            unpaidUsed: Math.floor(Math.random() * 3),
          },
        },
      },
    });

    employeeMap[name] = employee.id;

    if ((i + 1) % batchSize === 0) {
      console.log(`  ${i + 1}/${config.NUM_EMPLOYEES} employees created...`);
    }
  }
  console.log(`✓ Created ${config.NUM_EMPLOYEES} employees`);

  // Set up manager relationships (20% of employees are managers)
  const employeeIds = Object.values(employeeMap);
  const managerIds = employeeIds.slice(0, Math.ceil(employeeIds.length * 0.2));

  console.log(`Setting up manager relationships...`);
  let managedCount = 0;
  for (let i = 0; i < employeeIds.length; i++) {
    if (i < managerIds.length) continue; // Skip managers themselves
    const managerId = managerIds[Math.floor(Math.random() * managerIds.length)];
    await prisma.employee.update({
      where: { id: employeeIds[i] },
      data: { managerId },
    });
    managedCount++;
    if ((managedCount + 1) % 200 === 0) {
      console.log(`  ${managedCount} employees assigned managers...`);
    }
  }
  console.log(`✓ Assigned managers to ${managedCount} employees`);

  // Create attendance records for 5 years
  const statuses: Array<'PRESENT' | 'LATE' | 'WFH' | 'ABSENT'> = ['PRESENT', 'PRESENT', 'PRESENT', 'LATE', 'WFH', 'ABSENT'];
  const startDate = new Date();
  startDate.setFullYear(startDate.getFullYear() - config.YEARS_OF_HISTORY);

  console.log(`Creating attendance records for ${config.YEARS_OF_HISTORY} years...`);
  let attendanceCount = 0;

  for (let dayOffset = 0; dayOffset < 365 * config.YEARS_OF_HISTORY; dayOffset++) {
    const currentDate = new Date(startDate);
    currentDate.setUTCDate(currentDate.getUTCDate() + dayOffset);

    // Skip weekends
    const dayOfWeek = currentDate.getUTCDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) continue;

    for (const employeeId of employeeIds) {
      // 70% chance of having attendance record
      if (Math.random() > 0.7) continue;

      const status = getRandomItem(statuses);
      const hours = status === 'ABSENT' ? 0 : (status === 'LATE' ? 7.2 : 8.4);

      try {
        await prisma.attendanceRecord.upsert({
          where: { employeeId_date: { employeeId, date: currentDate } },
          update: {},
          create: {
            tenantId: tenant.id,
            employeeId,
            date: currentDate,
            status,
            clockIn: new Date(`${currentDate.toISOString().slice(0, 10)}T${status === 'LATE' ? '10:30' : '09:15'}:00Z`),
            clockOut: status === 'ABSENT' ? null : new Date(`${currentDate.toISOString().slice(0, 10)}T18:00:00Z`),
            hours,
          },
        });
        attendanceCount++;
      } catch (e) {
        // Ignore duplicates
      }
    }

    if ((dayOffset + 1) % 50 === 0) {
      console.log(`  Processed ${dayOffset + 1}/${365 * config.YEARS_OF_HISTORY} days...`);
    }
  }
  console.log(`✓ Created ${attendanceCount} attendance records`);

  // Create leave requests
  const leaveTypes: Array<'ANNUAL' | 'SICK' | 'WORK_FROM_HOME' | 'UNPAID'> = ['ANNUAL', 'SICK', 'WORK_FROM_HOME'];
  const leaveStatuses: Array<'PENDING' | 'APPROVED' | 'REJECTED'> = ['PENDING', 'APPROVED', 'REJECTED'];

  console.log(`Creating leave requests...`);
  let leaveCount = 0;

  for (let i = 0; i < employeeIds.length; i++) {
    // 3-5 leave requests per employee
    const numLeaves = Math.floor(Math.random() * 3) + 3;

    for (let j = 0; j < numLeaves; j++) {
      const startDateObj = new Date();
      startDateObj.setUTCDate(startDateObj.getUTCDate() + Math.floor(Math.random() * 365));
      const endDateObj = new Date(startDateObj);
      endDateObj.setUTCDate(endDateObj.getUTCDate() + Math.floor(Math.random() * 10));

      const days = Math.round((endDateObj.getTime() - startDateObj.getTime()) / 86400000) + 1;

      try {
        await prisma.leaveRequest.create({
          data: {
            tenantId: tenant.id,
            employeeId: employeeIds[i],
            type: getRandomItem(leaveTypes),
            startDate: startDateObj,
            endDate: endDateObj,
            days,
            reason: `Leave request ${j + 1}`,
            status: getRandomItem(leaveStatuses),
            decidedAt: Math.random() > 0.3 ? new Date() : null,
          },
        });
        leaveCount++;
      } catch (e) {
        // Ignore conflicts
      }
    }

    if ((i + 1) % 200 === 0) {
      console.log(`  Created leave requests for ${i + 1}/${employeeIds.length} employees...`);
    }
  }
  console.log(`✓ Created ${leaveCount} leave requests`);

  // Create one admin user for testing
  const adminUser = await prisma.user.upsert({
    where: { email: 'loadtest.admin@loadtest.dev' },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'loadtest.admin@loadtest.dev',
      passwordHash,
      role: 'ADMIN',
    },
  });
  console.log(`✓ Created admin user: loadtest.admin@loadtest.dev`);

  console.log(`\n✓ Load test database seeding complete!`);
  console.log(`\nTenant: ${tenant.name} (${tenant.slug})`);
  console.log(`Employees: ${config.NUM_EMPLOYEES}`);
  console.log(`Attendance records: ${attendanceCount}`);
  console.log(`Leave requests: ${leaveCount}`);
  console.log(`\nAdmin login: loadtest.admin@loadtest.dev (password: password123)`);
}

main()
  .catch((e) => {
    console.error('Seeding failed:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
EOF

log_info "Running seed script with $NUM_EMPLOYEES employees and $YEARS_OF_HISTORY years of history..."

cd "$PROJECT_ROOT/api"

# Set environment variables
export NUM_EMPLOYEES="$NUM_EMPLOYEES"
export YEARS_OF_HISTORY="$YEARS_OF_HISTORY"

# Run the seed script using tsx
npx tsx "$SEED_SCRIPT"

if [ $? -eq 0 ]; then
    log_pass "Database seeding completed successfully"
else
    log_error "Database seeding failed"
    exit 1
fi

# Clean up
rm -f "$SEED_SCRIPT"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Load Test Database Ready${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${GREEN}You can now run load tests with:${NC}"
echo -e "  ./scripts/run-load-test.sh"
echo ""
