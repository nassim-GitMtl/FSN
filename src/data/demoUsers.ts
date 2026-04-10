import type { User } from '@/types';

export const DEMO_USERS: User[] = [
  { id: 'u-dispatcher', name: 'Alex Rivera', email: 'dispatcher@fsmco.com', role: 'DISPATCHER', workspace: 'SERVICE', avatarInitials: 'AR' },
  { id: 'u-coord', name: 'Morgan Lee', email: 'coordinator@fsmco.com', role: 'COORDINATOR', workspace: 'INSTALLATION', avatarInitials: 'ML' },
  { id: 'u-manager', name: 'Jordan Clarke', email: 'manager@fsmco.com', role: 'MANAGER', workspace: 'SERVICE', avatarInitials: 'JC' },
  { id: 'u-tech', name: 'Jake Morrison', email: 'jake.morrison@fsmco.com', role: 'TECHNICIAN', workspace: 'SERVICE', avatarInitials: 'JM', technicianId: 'tech-svc-1' },
  { id: 'u-billing', name: 'Taylor Brooks', email: 'billing@fsmco.com', role: 'BILLING', workspace: 'SERVICE', avatarInitials: 'TB' },
  { id: 'u-admin', name: 'Sam Carter', email: 'admin@fsmco.com', role: 'ADMIN', workspace: 'SERVICE', avatarInitials: 'SC' },
  { id: 'u-exec', name: 'Pat Donovan', email: 'exec@fsmco.com', role: 'EXECUTIVE', workspace: 'SERVICE', avatarInitials: 'PD' },
];
