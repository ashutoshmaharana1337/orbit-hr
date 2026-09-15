import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { EmployeesService } from './employees.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { SoftDeleteService } from '../common/soft-delete.service.js';
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('EmployeesService - Core Logic', () => {
  let service: EmployeesService;
  let prisma: PrismaService;
  let softDelete: SoftDeleteService;

  const mockTenantId = 'tenant-1';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmployeesService,
        {
          provide: PrismaService,
          useValue: {
            employee: {
              findFirst: vi.fn(),
              findMany: vi.fn(),
              create: vi.fn(),
              update: vi.fn(),
            },
            // Any departmentId a test passes is treated as belonging to the tenant.
            department: {
              findFirst: vi.fn(async ({ where }: { where: { id: string } }) => ({ id: where.id })),
            },
            refreshToken: { updateMany: vi.fn() },
          },
        },
        {
          provide: SoftDeleteService,
          useValue: {
            whereActive: vi.fn((filter) => ({ ...filter, deletedAt: null })),
            whereDeleted: vi.fn((filter) => ({ ...filter, deletedAt: { not: null } })),
            softDeleteEmployee: vi.fn(),
            restoreEmployee: vi.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<EmployeesService>(EmployeesService);
    prisma = module.get<PrismaService>(PrismaService);
    softDelete = module.get<SoftDeleteService>(SoftDeleteService);
  });

  describe('Employee Creation', () => {
    it('should create an employee successfully', async () => {
      const createDto = {
        name: 'John Doe',
        email: 'john@company.com',
        title: 'Engineer',
        departmentId: 'dept-1',
        location: 'Remote',
        joinDate: '2024-01-01',
        phone: '+1234567890',
      };

      const createdEmployee = {
        id: 'emp-1',
        tenantId: mockTenantId,
        ...createDto,
        status: 'ACTIVE',
        managerId: null,
        userId: null,
        deletedAt: null,
        leaveBalance: { id: 'lb-1' },
      };

      vi.mocked(prisma.employee.create).mockResolvedValueOnce(createdEmployee);

      const result = await service.create(mockTenantId, createDto);

      expect(result.name).toBe('John Doe');
      expect(result.email).toBe('john@company.com');
      expect(result.status).toBe('ACTIVE');
    });

    it('should set default status to ACTIVE', async () => {
      const createDto = {
        name: 'Jane Doe',
        email: 'jane@company.com',
        title: 'Manager',
        departmentId: 'dept-1',
        location: 'NYC',
        joinDate: '2024-01-01',
        phone: '+1111111111',
      };

      vi.mocked(prisma.employee.create).mockResolvedValueOnce({
        id: 'emp-2',
        tenantId: mockTenantId,
        ...createDto,
        status: 'ACTIVE',
        managerId: null,
        userId: null,
        deletedAt: null,
      });

      const result = await service.create(mockTenantId, createDto);

      expect(result.status).toBe('ACTIVE');
    });
  });

  describe('Manager Validation', () => {
    it('should validate manager exists when provided', async () => {
      const createDto = {
        name: 'Report',
        email: 'report@company.com',
        title: 'Developer',
        departmentId: 'dept-1',
        location: 'Remote',
        joinDate: '2024-01-01',
        phone: '+2222222222',
        managerId: 'emp-manager',
      };

      // Manager exists
      vi.mocked(prisma.employee.findFirst).mockResolvedValueOnce({ id: 'emp-manager' });

      vi.mocked(prisma.employee.create).mockResolvedValueOnce({
        id: 'emp-3',
        tenantId: mockTenantId,
        ...createDto,
        status: 'ACTIVE',
        userId: null,
        deletedAt: null,
      });

      const result = await service.create(mockTenantId, createDto);

      expect(result).toBeDefined();
      expect(prisma.employee.findFirst).toHaveBeenCalled();
    });

    it('should throw error if manager does not exist', async () => {
      const createDto = {
        name: 'Report',
        email: 'report@company.com',
        title: 'Developer',
        departmentId: 'dept-1',
        location: 'Remote',
        joinDate: '2024-01-01',
        phone: '+3333333333',
        managerId: 'non-existent-manager',
      };

      // Manager doesn't exist
      vi.mocked(prisma.employee.findFirst).mockResolvedValueOnce(null);

      await expect(service.create(mockTenantId, createDto)).rejects.toThrow(NotFoundException);
    });
  });

  describe('Employee Lookup', () => {
    it('should find employee by ID', async () => {
      const employee = {
        id: 'emp-1',
        name: 'John Doe',
        email: 'john@company.com',
        tenantId: mockTenantId,
        status: 'ACTIVE',
        deletedAt: null,
        leaveBalance: { entitledDays: 20 },
      };

      vi.mocked(prisma.employee.findFirst).mockResolvedValueOnce(employee);

      const result = await service.findOne(mockTenantId, 'emp-1');

      expect(result.id).toBe('emp-1');
      expect(result.name).toBe('John Doe');
    });

    it('should throw 404 for non-existent employee', async () => {
      vi.mocked(prisma.employee.findFirst).mockResolvedValueOnce(null);

      await expect(service.findOne(mockTenantId, 'non-existent')).rejects.toThrow(NotFoundException);
    });

    it('should find employee by user ID', async () => {
      const employee = {
        id: 'emp-1',
        userId: 'user-1',
        name: 'John Doe',
        tenantId: mockTenantId,
        deletedAt: null,
      };

      vi.mocked(prisma.employee.findFirst).mockResolvedValueOnce(employee);

      const result = await service.findByUserId(mockTenantId, 'user-1');

      expect(result.userId).toBe('user-1');
    });

    it('should throw error if no employee for user', async () => {
      vi.mocked(prisma.employee.findFirst).mockResolvedValueOnce(null);

      await expect(service.findByUserId(mockTenantId, 'orphan-user')).rejects.toThrow(
        'No employee record linked to this account',
      );
    });
  });

  describe('Employee Update', () => {
    it('should update employee details', async () => {
      const employee = { id: 'emp-1', title: 'Engineer' };
      const updated = { ...employee, title: 'Senior Engineer' };

      vi.mocked(prisma.employee.findFirst).mockResolvedValueOnce(employee);
      vi.mocked(prisma.employee.update).mockResolvedValueOnce(updated);

      const result = await service.update(mockTenantId, 'emp-1', { title: 'Senior Engineer' });

      expect(result.title).toBe('Senior Engineer');
    });

    it('should validate new manager before update', async () => {
      const employee = { id: 'emp-1' };

      vi.mocked(prisma.employee.findFirst)
        .mockResolvedValueOnce(employee)
        .mockResolvedValueOnce(null); // New manager doesn't exist

      await expect(
        service.update(mockTenantId, 'emp-1', { managerId: 'non-existent' }),
      ).rejects.toThrow(NotFoundException);
    });
  });


  describe('Employee List', () => {
    it('should list active employees', async () => {
      const employees = [
        {
          id: 'emp-1',
          name: 'John',
          tenantId: mockTenantId,
          deletedAt: null,
        },
        {
          id: 'emp-2',
          name: 'Jane',
          tenantId: mockTenantId,
          deletedAt: null,
        },
      ];

      vi.mocked(prisma.employee.findMany).mockResolvedValueOnce(employees);

      const requester = {
        sub: 'user-1',
        tenantId: mockTenantId,
        email: 'admin@company.com',
        role: 'ADMIN' as const,
      };

      const result = await service.list(mockTenantId, requester, { limit: 10 });

      expect(result.items).toHaveLength(2);
      expect(result.items[0].name).toBe('John');
    });

    it('should support pagination with cursor', async () => {
      const employees = [{ id: 'emp-2', name: 'Jane', tenantId: mockTenantId }];

      vi.mocked(prisma.employee.findMany).mockResolvedValueOnce(employees);

      const requester = {
        sub: 'user-1',
        tenantId: mockTenantId,
        email: 'admin@company.com',
        role: 'ADMIN' as const,
      };

      const result = await service.list(mockTenantId, requester, { limit: 1, cursor: 'emp-1' });

      expect(result.items).toBeDefined();
      expect(prisma.employee.findMany).toHaveBeenCalled();
    });
  });
});
