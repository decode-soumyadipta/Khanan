export interface AvailablePermission {
  _id: string;
  permissionKey: string;
  module: string;
  resource: string;
  action: string;
  category: string;
  scope: string;
  description: string;
  isActive: boolean;
  severityLevel: string;
  isSystemPermission: boolean;
  requiresSuperAdmin: boolean;
}

export interface UserFormData {
  name: string;
  email: string;
  phone: string;
  designation: string;
  department: string;
  employeeId: string;
}

export interface PermissionAssignment {
  permissionId: string;
  stateCode: string;
  role: string;
  expiresAt: string;
  approvalRequired: boolean;
  conditions: any;
}

export interface District {
  districtName: string;
  districtCode: string;
  category: string;
}

export interface StateRole {
  role: string;
  permissions: string[];
}

export interface StateAccess {
  stateCode: string;
  stateName: string;
  region: string;
  districts: District[];
  roles: StateRole[];
}

export interface TemporaryRole {
  role: string;
  stateCode: string;
  expiresAt: string;
  permissions: string[];
}

export interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  department: string;
  isActive: boolean;
  lastLoginAt?: string;
}

export interface UserWithPermissions {
  _id: string;
  userId: User;
  states: Array<{
    stateName: string;
    stateCode: string;
    region: string;
    districts: Array<{
      districtName: string;
      districtCode: string;
      category: string;
      isActive: boolean;
      activatedAt: string;
    }>;
    roles: Array<{
      role: string;
      description: string;
      level: number;
      category: string;
      permissions: Array<any>;
      roleStatus: string;
      isActive: boolean;
      assignedAt: string;
    }>;
    isActive: boolean;
  }>;
  globalVerificationLevel: number;
  accessTier: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface UserManagementModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  mode?: 'create' | 'edit' | 'permissions';
  initialUser?: any;
}