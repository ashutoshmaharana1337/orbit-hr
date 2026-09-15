import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { LeaveService } from './leave.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SoftDeleteService } from '../common/soft-delete.service.js';
import { EmployeesService } from '../employees/employees.service.js';
import { LeaveBalancesService } from '../leave-balances/leave-balances.service.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

/** UTC-midnight Monday at least a week ahead, so "not in the past" and weekday checks are deterministic. */
function nextMonday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + 7 + ((8 - d.getUTCDay()) % 7));
  return d;
}
function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86_400_000);
}
function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

describe('LeaveService - Core Logic', () => {
  let service: LeaveService;
  let prisma: PrismaService;
  let employees: EmployeesService;
  let leaveBalances: LeaveBalancesService;

  const mockTenantId = 'tenant-1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeaveService,
        {
          provide: PrismaService,
          useValue: {
            tenant: {
              findUnique: vi.fn(async () => ({ timezone: 'UTC' })),
            },
            leaveRequest: {
              findMany: vi.fn(),
              findFirst: vi.fn(),
              create: vi.fn(),
              update: vi.fn(),
            },
            leaveBalance: {
              findFirst: vi.fn(),
              findMany: vi.fn(),
              update: vi.fn(),
            },
            employee: {
              findFirst: vi.fn(),
            },
            leavePolicy: {
              findFirst: vi.fn(),
            },
          },
        },
        {
          provide: EmployeesService,
          useValue: {
            findByUserId: vi.fn(),
          },
        },
        {
          provide: LeaveBalancesService,
          useValue: {
            deductDays: vi.fn(),
          },
        },
        {
          provide: SoftDeleteService,
          useValue: {
            whereActive: vi.fn((filter) => ({ ...filter, deletedAt: null })),
          },
        },
      ],
    }).compile();

    service = module.get<LeaveService>(LeaveService);
    prisma = module.get<PrismaService>(PrismaService);
    employees = module.get<EmployeesService>(EmployeesService);
    leaveBalances = module.get<LeaveBalancesService>(LeaveBalancesService);
  });

  describe('Leave Request Creation', () => {
    const monday = nextMonday();

    it('should create a leave request with correct days calculation', async () => {
      const mockEmployee = { id: 'emp-1', tenantId: mockTenantId };

      vi.mocked(employees.findByUserId).mockResolvedValueOnce(mockEmployee);

      const createDto = {
        type: 'ANNUAL',
        startDate: iso(monday),
        endDate: iso(addDays(monday, 4)), // Mon-Fri: 5 working days
        reason: 'Vacation',
      };

      const createdRequest = {
        id: 'leave-1',
        tenantId: mockTenantId,
        employeeId: 'emp-1',
        type: 'ANNUAL',
        startDate: monday,
        endDate: addDays(monday, 4),
        days: 5,
        reason: 'Vacation',
        status: 'PENDING',
        decidedAt: null,
        decidedBy: null,
      };

      vi.mocked(prisma.leaveRequest.create).mockResolvedValueOnce(createdRequest);

      const result = await service.create(mockTenantId, 'user-1', createDto);

      expect(result.days).toBe(5);
      expect(result.status).toBe('PENDING');
      expect(result.type).toBe('ANNUAL');
      expect(prisma.leaveRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ days: 5 }) }),
      );
    });

    it('should exclude weekends from the days calculation', async () => {
      vi.mocked(employees.findByUserId).mockResolvedValueOnce({ id: 'emp-1', tenantId: mockTenantId });
      vi.mocked(prisma.leaveRequest.create).mockResolvedValueOnce({ id: 'leave-1', days: 6 });

      await service.create(mockTenantId, 'user-1', {
        type: 'UNPAID',
        startDate: iso(monday),
        endDate: iso(addDays(monday, 7)), // Mon..next Mon spans a weekend: 6 working days
        reason: 'Long break',
      });

      expect(prisma.leaveRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ days: 6 }) }),
      );
    });

    it('should calculate single day correctly', async () => {
      const mockEmployee = { id: 'emp-1', tenantId: mockTenantId };

      vi.mocked(employees.findByUserId).mockResolvedValueOnce(mockEmployee);

      const createDto = {
        type: 'SICK',
        startDate: iso(monday),
        endDate: iso(monday), // 1 day
        reason: 'Sick leave',
      };

      const createdRequest = {
        id: 'leave-2',
        tenantId: mockTenantId,
        employeeId: 'emp-1',
        type: 'SICK',
        startDate: monday,
        endDate: monday,
        days: 1,
        reason: 'Sick leave',
        status: 'PENDING',
        decidedAt: null,
        decidedBy: null,
      };

      vi.mocked(prisma.leaveRequest.create).mockResolvedValueOnce(createdRequest);

      const result = await service.create(mockTenantId, 'user-1', createDto);

      expect(result.days).toBe(1);
      expect(prisma.leaveRequest.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ days: 1 }) }),
      );
    });

    it('should reject invalid date ranges', async () => {
      const mockEmployee = { id: 'emp-1', tenantId: mockTenantId };

      vi.mocked(employees.findByUserId).mockResolvedValueOnce(mockEmployee);

      const createDto = {
        type: 'ANNUAL',
        startDate: iso(addDays(monday, 4)),
        endDate: iso(monday), // End before start
        reason: 'Invalid',
      };

      await expect(service.create(mockTenantId, 'user-1', createDto)).rejects.toThrow(
        'endDate must be on or after startDate',
      );
    });

    it('should reject a startDate in the past', async () => {
      vi.mocked(employees.findByUserId).mockResolvedValueOnce({ id: 'emp-1', tenantId: mockTenantId });

      await expect(
        service.create(mockTenantId, 'user-1', {
          type: 'ANNUAL',
          startDate: '2024-03-01',
          endDate: '2024-03-05',
          reason: 'Too late',
        }),
      ).rejects.toThrow('startDate cannot be in the past');
      expect(prisma.leaveRequest.create).not.toHaveBeenCalled();
    });

    it('should reject a range overlapping an existing PENDING/APPROVED request', async () => {
      vi.mocked(employees.findByUserId).mockResolvedValueOnce({ id: 'emp-1', tenantId: mockTenantId });
      vi.mocked(prisma.leaveRequest.findFirst).mockResolvedValueOnce({ id: 'leave-existing' });

      await expect(
        service.create(mockTenantId, 'user-1', {
          type: 'ANNUAL',
          startDate: iso(monday),
          endDate: iso(addDays(monday, 1)),
          reason: 'Overlap',
        }),
      ).rejects.toThrow(ConflictException);
      expect(prisma.leaveRequest.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employeeId: 'emp-1',
            status: { in: ['PENDING', 'APPROVED'] },
          }),
        }),
      );
      expect(prisma.leaveRequest.create).not.toHaveBeenCalled();
    });

    it('should reject a range that contains no working days', async () => {
      vi.mocked(employees.findByUserId).mockResolvedValueOnce({ id: 'emp-1', tenantId: mockTenantId });

      await expect(
        service.create(mockTenantId, 'user-1', {
          type: 'ANNUAL',
          startDate: iso(addDays(monday, 5)), // Saturday
          endDate: iso(addDays(monday, 6)), // Sunday
          reason: 'Weekend',
        }),
      ).rejects.toThrow('Range contains no working days');
    });

    it('should reject when the balance cannot cover the request', async () => {
      vi.mocked(employees.findByUserId).mockResolvedValueOnce({ id: 'emp-1', tenantId: mockTenantId });
      vi.mocked(prisma.leavePolicy.findFirst).mockResolvedValueOnce({ id: 'policy-1', name: 'Annual Leave' });
      vi.mocked(prisma.leaveBalance.findFirst).mockResolvedValueOnce({ id: 'balance-1', balanceDays: 3 });

      await expect(
        service.create(mockTenantId, 'user-1', {
          type: 'ANNUAL',
          startDate: iso(monday),
          endDate: iso(addDays(monday, 4)), // 5 working days, only 3 available
          reason: 'Too long',
        }),
      ).rejects.toThrow('Insufficient leave balance (3 days available)');
      expect(prisma.leaveBalance.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ leavePolicyId: 'policy-1', year: monday.getUTCFullYear() }),
        }),
      );
    });

    it('should skip the balance check for WORK_FROM_HOME', async () => {
      vi.mocked(employees.findByUserId).mockResolvedValueOnce({ id: 'emp-1', tenantId: mockTenantId });
      vi.mocked(prisma.leaveRequest.create).mockResolvedValueOnce({ id: 'leave-3', days: 1 });

      await service.create(mockTenantId, 'user-1', {
        type: 'WORK_FROM_HOME',
        startDate: iso(monday),
        endDate: iso(monday),
        reason: 'Plumber',
      });

      expect(prisma.leavePolicy.findFirst).not.toHaveBeenCalled();
      expect(prisma.leaveBalance.findFirst).not.toHaveBeenCalled();
      expect(prisma.leaveRequest.create).toHaveBeenCalled();
    });
  });

  describe('Leave Request Listing', () => {
    it('should list all requests for ADMIN', async () => {
      const requests = [
        {
          id: 'leave-1',
          tenantId: mockTenantId,
          type: 'ANNUAL',
          status: 'PENDING',
          employee: { id: 'emp-1', name: 'John', departmentId: 'dept-1' },
        },
      ];

      vi.mocked(prisma.leaveRequest.findMany).mockResolvedValueOnce(requests);

      const requester = {
        sub: 'user-admin',
        tenantId: mockTenantId,
        email: 'admin@company.com',
        role: 'ADMIN' as const,
      };

      const result = await service.list(mockTenantId, requester, { limit: 10 });

      expect(result.items).toHaveLength(1);
      expect(prisma.leaveRequest.findMany).toHaveBeenCalled();
    });

    it('should filter by status for ADMIN', async () => {
      vi.mocked(prisma.leaveRequest.findMany).mockResolvedValueOnce([]);

      const requester = {
        sub: 'user-admin',
        tenantId: mockTenantId,
        email: 'admin@company.com',
        role: 'ADMIN' as const,
      };

      await service.list(mockTenantId, requester, { limit: 10, status: 'PENDING' });

      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'PENDING',
          }),
        }),
      );
    });

    it('should show only own requests for EMPLOYEE', async () => {
      const mockEmployee = { id: 'emp-1', tenantId: mockTenantId };

      vi.mocked(employees.findByUserId).mockResolvedValueOnce(mockEmployee);
      vi.mocked(prisma.leaveRequest.findMany).mockResolvedValueOnce([]);

      const requester = {
        sub: 'user-1',
        tenantId: mockTenantId,
        email: 'john@company.com',
        role: 'EMPLOYEE' as const,
      };

      await service.list(mockTenantId, requester, { limit: 10 });

      expect(prisma.leaveRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            employeeId: 'emp-1',
          }),
        }),
      );
    });
  });

  describe('Leave Request Approval', () => {
    it('should reject double-approval', async () => {
      const approvedRequest = {
        id: 'leave-1',
        tenantId: mockTenantId,
        status: 'APPROVED',
        decidedAt: new Date(),
        employee: { id: 'emp-1', userId: 'user-1', managerId: null },
      };

      vi.mocked(prisma.leaveRequest.findFirst).mockResolvedValueOnce(approvedRequest);

      const approver = {
        sub: 'user-admin',
        tenantId: mockTenantId,
        email: 'admin@company.com',
        role: 'ADMIN' as const,
      };

      await expect(service.decide(mockTenantId, 'leave-1', approver, true)).rejects.toThrow(
        'This request has already been decided',
      );
    });

    it('should prevent employee from approving own request', async () => {
      const request = {
        id: 'leave-1',
        tenantId: mockTenantId,
        status: 'PENDING',
        employee: { id: 'emp-1', userId: 'user-1', managerId: null }, // Same user
      };

      vi.mocked(prisma.leaveRequest.findFirst).mockResolvedValueOnce(request);

      const approver = {
        sub: 'user-1', // Same as request employee's user
        tenantId: mockTenantId,
        email: 'john@company.com',
        role: 'ADMIN' as const,
      };

      await expect(service.decide(mockTenantId, 'leave-1', approver, true)).rejects.toThrow(
        'You cannot approve or reject your own leave request',
      );
    });

    it('should reject if balance would be exceeded', async () => {
      const request = {
        id: 'leave-1',
        tenantId: mockTenantId,
        employeeId: 'emp-1',
        type: 'ANNUAL',
        days: 10,
        status: 'PENDING',
        startDate: new Date(Date.UTC(2027, 2, 1)),
        endDate: new Date(Date.UTC(2027, 2, 12)),
        employee: { id: 'emp-1', userId: 'user-1', managerId: null },
      };

      const mockPolicy = { id: 'policy-1', name: 'Annual Leave', tenantId: mockTenantId };

      const lowBalance = {
        id: 'balance-1',
        employeeId: 'emp-1',
        leavePolicyId: 'policy-1',
        entitledDays: 5,
        usedDays: 2, // Only 3 days left
        year: 2027,
        tenantId: mockTenantId,
      };

      vi.mocked(prisma.leaveRequest.findFirst).mockResolvedValueOnce(request);
      vi.mocked(prisma.leavePolicy.findFirst).mockResolvedValueOnce(mockPolicy);
      vi.mocked(prisma.leaveBalance.findFirst).mockResolvedValueOnce(lowBalance);

      const approver = {
        sub: 'user-admin',
        tenantId: mockTenantId,
        email: 'admin@company.com',
        role: 'ADMIN' as const,
      };

      await expect(service.decide(mockTenantId, 'leave-1', approver, true)).rejects.toThrow(
        'Approving this request would exceed the remaining leave balance',
      );
      // Balance year follows the leave's start date, not the approval date
      expect(prisma.leaveBalance.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ year: 2027 }) }),
      );
      expect(leaveBalances.deductDays).not.toHaveBeenCalled();
    });

    it('should deduct from the balance year of the leave start date on approval', async () => {
      const request = {
        id: 'leave-1',
        tenantId: mockTenantId,
        employeeId: 'emp-1',
        type: 'SICK',
        days: 2,
        status: 'PENDING',
        startDate: new Date(Date.UTC(2027, 0, 4)),
        endDate: new Date(Date.UTC(2027, 0, 5)),
        employee: { id: 'emp-1', userId: 'user-1', managerId: null },
      };

      vi.mocked(prisma.leaveRequest.findFirst).mockResolvedValueOnce(request);
      vi.mocked(prisma.leavePolicy.findFirst).mockResolvedValueOnce({ id: 'policy-sick', name: 'Sick Leave' });
      vi.mocked(prisma.leaveBalance.findFirst).mockResolvedValueOnce({
        id: 'balance-2',
        entitledDays: 10,
        usedDays: 0,
        balanceDays: 10,
        year: 2027,
      });
      vi.mocked(prisma.leaveRequest.update).mockResolvedValueOnce({ id: 'leave-1', status: 'APPROVED' });

      const approver = {
        sub: 'user-admin',
        tenantId: mockTenantId,
        email: 'admin@company.com',
        role: 'ADMIN' as const,
      };

      const result = await service.decide(mockTenantId, 'leave-1', approver, true);

      expect(result.status).toBe('APPROVED');
      expect(leaveBalances.deductDays).toHaveBeenCalledWith(mockTenantId, 'emp-1', 'policy-sick', 2027, 2);
    });

    it('should reject approval if manager lacks authority', async () => {
      const request = {
        id: 'leave-1',
        tenantId: mockTenantId,
        status: 'PENDING',
        employee: { id: 'emp-1', userId: 'user-1', managerId: 'emp-manager' }, // Has a manager
      };

      const otherManagerEmployee = { id: 'emp-other-manager' };

      vi.mocked(prisma.leaveRequest.findFirst).mockResolvedValueOnce(request);
      vi.mocked(employees.findByUserId).mockResolvedValueOnce(otherManagerEmployee);

      const approver = {
        sub: 'user-other-manager',
        tenantId: mockTenantId,
        email: 'other-manager@company.com',
        role: 'MANAGER' as const,
      };

      await expect(service.decide(mockTenantId, 'leave-1', approver, true)).rejects.toThrow(
        'You can only decide requests for your direct reports',
      );
    });

    it('should reject if leave request not found', async () => {
      vi.mocked(prisma.leaveRequest.findFirst).mockResolvedValueOnce(null);

      const approver = {
        sub: 'user-admin',
        tenantId: mockTenantId,
        email: 'admin@company.com',
        role: 'ADMIN' as const,
      };

      await expect(service.decide(mockTenantId, 'leave-1', approver, true)).rejects.toThrow(NotFoundException);
    });
  });

  describe('Leave Balance', () => {
    const mockBalances = [
      {
        id: 'balance-1',
        employeeId: 'emp-1',
        year: 2026,
        entitledDays: 20,
        usedDays: 5,
        balanceDays: 15,
        leavePolicy: { id: 'policy-1', name: 'Annual Leave' },
      },
      {
        id: 'balance-2',
        employeeId: 'emp-1',
        year: 2026,
        entitledDays: 10,
        usedDays: 0,
        balanceDays: 10,
        leavePolicy: { id: 'policy-2', name: 'Sick Leave' },
      },
    ];

    it('should retrieve leave balance for employee', async () => {
      const mockEmployee = { id: 'emp-1', tenantId: mockTenantId, deletedAt: null };

      vi.mocked(prisma.employee.findFirst).mockResolvedValueOnce(mockEmployee);
      vi.mocked(prisma.leaveBalance.findMany).mockResolvedValueOnce(mockBalances);

      const requester = {
        sub: 'user-admin',
        tenantId: mockTenantId,
        email: 'admin@company.com',
        role: 'ADMIN' as const,
      };

      const result = await service.balance(mockTenantId, 'emp-1', requester, 2026);

      expect(result).toHaveLength(2);
      expect(result[0].policy).toEqual({ id: 'policy-1', name: 'Annual Leave' });
      expect(result[0].entitledDays).toBe(20);
      expect(result[0].usedDays).toBe(5);
      expect(result[0].balanceDays).toBe(15);
      expect(prisma.leaveBalance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ employeeId: 'emp-1', year: 2026 }) }),
      );
    });

    it('should default to the current year', async () => {
      vi.mocked(prisma.employee.findFirst).mockResolvedValueOnce({ id: 'emp-1', tenantId: mockTenantId });
      vi.mocked(prisma.leaveBalance.findMany).mockResolvedValueOnce([]);

      const requester = {
        sub: 'user-admin',
        tenantId: mockTenantId,
        email: 'admin@company.com',
        role: 'ADMIN' as const,
      };

      await service.balance(mockTenantId, 'emp-1', requester);

      expect(prisma.leaveBalance.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ year: new Date().getFullYear() }) }),
      );
    });

    it('should allow employee to view own balance', async () => {
      const mockEmployee = { id: 'emp-1', tenantId: mockTenantId, deletedAt: null };

      vi.mocked(prisma.employee.findFirst).mockResolvedValueOnce(mockEmployee);
      vi.mocked(employees.findByUserId).mockResolvedValueOnce(mockEmployee);
      vi.mocked(prisma.leaveBalance.findMany).mockResolvedValueOnce(mockBalances);

      const requester = {
        sub: 'user-1',
        tenantId: mockTenantId,
        email: 'john@company.com',
        role: 'EMPLOYEE' as const,
      };

      const result = await service.balance(mockTenantId, 'emp-1', requester);

      expect(result).toBeDefined();
      expect(result).toHaveLength(2);
    });

    it('should prevent employee from viewing others balance without permission', async () => {
      const targetEmployee = { id: 'emp-1', tenantId: mockTenantId, deletedAt: null };
      const requesterEmployee = { id: 'emp-2', tenantId: mockTenantId };

      vi.mocked(prisma.employee.findFirst).mockResolvedValueOnce(targetEmployee);
      vi.mocked(employees.findByUserId).mockResolvedValueOnce(requesterEmployee);

      const requester = {
        sub: 'user-2',
        tenantId: mockTenantId,
        email: 'other@company.com',
        role: 'EMPLOYEE' as const,
      };

      await expect(service.balance(mockTenantId, 'emp-1', requester)).rejects.toThrow(
        "You cannot view this employee's leave balance",
      );
    });

    it('should throw if employee not found', async () => {
      vi.mocked(prisma.employee.findFirst).mockResolvedValueOnce(null);

      const requester = {
        sub: 'user-admin',
        tenantId: mockTenantId,
        email: 'admin@company.com',
        role: 'ADMIN' as const,
      };

      await expect(service.balance(mockTenantId, 'emp-1', requester)).rejects.toThrow(NotFoundException);
    });
  });
});
