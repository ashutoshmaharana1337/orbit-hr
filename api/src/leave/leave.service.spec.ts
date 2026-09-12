import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { LeaveService } from './leave.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SoftDeleteService } from '../common/soft-delete.service.js';
import { EmployeesService } from '../employees/employees.service.js';
import { LeaveBalancesService } from '../leave-balances/leave-balances.service.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

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
            leaveRequest: {
              findMany: vi.fn(),
              findFirst: vi.fn(),
              create: vi.fn(),
              update: vi.fn(),
            },
            leaveBalance: {
              findFirst: vi.fn(),
              findUniqueOrThrow: vi.fn(),
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
    it('should create a leave request with correct days calculation', async () => {
      const mockEmployee = { id: 'emp-1', tenantId: mockTenantId };

      vi.mocked(employees.findByUserId).mockResolvedValueOnce(mockEmployee);

      const createDto = {
        type: 'ANNUAL',
        startDate: '2024-03-01',
        endDate: '2024-03-05', // 5 days
        reason: 'Vacation',
      };

      const createdRequest = {
        id: 'leave-1',
        tenantId: mockTenantId,
        employeeId: 'emp-1',
        type: 'ANNUAL',
        startDate: new Date('2024-03-01'),
        endDate: new Date('2024-03-05'),
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
    });

    it('should calculate single day correctly', async () => {
      const mockEmployee = { id: 'emp-1', tenantId: mockTenantId };

      vi.mocked(employees.findByUserId).mockResolvedValueOnce(mockEmployee);

      const createDto = {
        type: 'SICK',
        startDate: '2024-03-01',
        endDate: '2024-03-01', // 1 day
        reason: 'Sick leave',
      };

      const createdRequest = {
        id: 'leave-2',
        tenantId: mockTenantId,
        employeeId: 'emp-1',
        type: 'SICK',
        startDate: new Date('2024-03-01'),
        endDate: new Date('2024-03-01'),
        days: 1,
        reason: 'Sick leave',
        status: 'PENDING',
        decidedAt: null,
        decidedBy: null,
      };

      vi.mocked(prisma.leaveRequest.create).mockResolvedValueOnce(createdRequest);

      const result = await service.create(mockTenantId, 'user-1', createDto);

      expect(result.days).toBe(1);
    });

    it('should reject invalid date ranges', async () => {
      const mockEmployee = { id: 'emp-1', tenantId: mockTenantId };

      vi.mocked(employees.findByUserId).mockResolvedValueOnce(mockEmployee);

      const createDto = {
        type: 'ANNUAL',
        startDate: '2024-03-05',
        endDate: '2024-03-01', // End before start
        reason: 'Invalid',
      };

      await expect(service.create(mockTenantId, 'user-1', createDto)).rejects.toThrow(
        'endDate must be on or after startDate',
      );
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
        employee: { id: 'emp-1', userId: 'user-1', managerId: null },
      };

      const mockPolicy = { id: 'policy-1', name: 'Annual Leave', tenantId: mockTenantId };

      const lowBalance = {
        id: 'balance-1',
        employeeId: 'emp-1',
        leavePolicyId: 'policy-1',
        entitledDays: 5,
        usedDays: 2, // Only 3 days left
        year: new Date().getFullYear(),
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
    it('should retrieve leave balance for employee', async () => {
      const mockEmployee = { id: 'emp-1', tenantId: mockTenantId, deletedAt: null };

      const mockBalance = {
        id: 'balance-1',
        employeeId: 'emp-1',
        entitledDays: 20,
        usedDays: 5,
      };

      vi.mocked(prisma.employee.findFirst).mockResolvedValueOnce(mockEmployee);
      vi.mocked(prisma.leaveBalance.findUniqueOrThrow).mockResolvedValueOnce(mockBalance);

      const requester = {
        sub: 'user-admin',
        tenantId: mockTenantId,
        email: 'admin@company.com',
        role: 'ADMIN' as const,
      };

      const result = await service.balance(mockTenantId, 'emp-1', requester);

      expect(result.entitledDays).toBe(20);
      expect(result.usedDays).toBe(5);
    });

    it('should allow employee to view own balance', async () => {
      const mockEmployee = { id: 'emp-1', tenantId: mockTenantId, deletedAt: null };

      const mockBalance = {
        id: 'balance-1',
        employeeId: 'emp-1',
        entitledDays: 20,
        usedDays: 5,
      };

      vi.mocked(prisma.employee.findFirst).mockResolvedValueOnce(mockEmployee);
      vi.mocked(employees.findByUserId).mockResolvedValueOnce(mockEmployee);
      vi.mocked(prisma.leaveBalance.findUniqueOrThrow).mockResolvedValueOnce(mockBalance);

      const requester = {
        sub: 'user-1',
        tenantId: mockTenantId,
        email: 'john@company.com',
        role: 'EMPLOYEE' as const,
      };

      const result = await service.balance(mockTenantId, 'emp-1', requester);

      expect(result).toBeDefined();
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
