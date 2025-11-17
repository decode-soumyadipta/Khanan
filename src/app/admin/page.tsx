'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid ,
  Card,
  CardContent,
  Chip,
  Avatar,
  Button,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  MenuItem,
  FormControl,
  InputLabel,
  Select,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Switch,
  FormControlLabel
} from '@mui/material';
import {
  People,
  Security,
  Assignment,
  Schedule,
  Add,
  Edit,
  Delete,
  Visibility,
  CheckCircle,
  Cancel,
  Warning,
  AdminPanelSettings,
  Group,
  Policy,
  AccessTime
} from '@mui/icons-material';
import { useAuth } from '@/contexts/AuthContext';
import { useSnackbar } from '@/contexts/SnackbarContext';
import apiClient from '@/services/apiClient';

// Types based on your backend
interface AvailablePermission {
  _id: string;
  permissionKey: string;
  module: string;
  resource: string;
  action: string;
  category: string;
  scope: string;
  severityLevel: string;
  description: string;
  isSystemPermission: boolean;
  requiresSuperAdmin: boolean;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface User {
  _id: string;
  name: string;
  email: string;
  phone: string;
  designation: string;
  department: string;
  isActive: boolean;
  lastLoginAt?: string;
}

interface UserWithPermissions {
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

interface ExpiringItem {
  userId: string;
  name: string;
  email: string;
  stateCode: string;
  role: string;
  permission?: any;
  expiresAt: string;
}

interface ExpiringItemsResponse {
  expiringPermissions: ExpiringItem[];
  expiringRoles: ExpiringItem[];
  thresholdDate?: string;
}

interface ApiResponse<T> {
  status: string;
  message?: string;
  data: T;
}

interface UsersResponse {
  users: UserWithPermissions[];
  total: number;
}

interface PermissionsResponse {
  permissions: AvailablePermission[];
  modules: string[];
  categories: string[];
}

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`admin-tabpanel-${index}`}
      aria-labelledby={`admin-tab-${index}`}
      {...other}
    >
      {value === index && <Box sx={{ p: 3 }}>{children}</Box>}
    </div>
  );
}

interface NewPermissionForm {
  permissionKey: string;
  module: string;
  resource: string;
  action: string;
  category: string;
  scope: string;
  severityLevel: string;
  description: string;
  isSystemPermission: boolean;
  requiresSuperAdmin: boolean;
}

export default function AdminDashboard() {
  const { user, permissions, isSuperAdmin, hasPermission, hasModuleAccess } = useAuth();
  const { showSnackbar } = useSnackbar();
  
  const [activeTab, setActiveTab] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [users, setUsers] = useState<UserWithPermissions[]>([]);
  const [availablePermissions, setAvailablePermissions] = useState<AvailablePermission[]>([]);
  const [expiringItems, setExpiringItems] = useState<ExpiringItemsResponse>({ 
    expiringPermissions: [], 
    expiringRoles: [] 
  });
  
  // Dialog states
  const [permissionDialogOpen, setPermissionDialogOpen] = useState<boolean>(false);
  const [selectedUser, setSelectedUser] = useState<UserWithPermissions | null>(null);
  
  // New permission form
  const [newPermission, setNewPermission] = useState<NewPermissionForm>({
    permissionKey: '',
    module: '',
    resource: '',
    action: '',
    category: '',
    scope: 'state',
    severityLevel: 'medium',
    description: '',
    isSystemPermission: false,
    requiresSuperAdmin: false
  });

  // Check if user has admin access
  useEffect(() => {
    if (!hasModuleAccess('user_management') && !hasModuleAccess('role_management') && !isSuperAdmin()) {
      showSnackbar('Access denied: Admin privileges required', 'error');
    }
  }, [hasModuleAccess, isSuperAdmin, showSnackbar]);

  // Fetch data based on active tab
  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const fetchData = async (): Promise<void> => {
    try {
      setLoading(true);
      
      switch (activeTab) {
        case 0: // Dashboard
          await Promise.all([
            fetchUsers(),
            fetchExpiringItems()
          ]);
          break;
        case 1: // User Management
          await fetchUsers();
          break;
        case 2: // Permission Management
          await fetchAvailablePermissions();
          break;
        case 3: // Expiry Management
          await fetchExpiringItems();
          break;
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
      showSnackbar('Failed to load admin data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async (): Promise<void> => {
    try {
      const response = await apiClient.get<ApiResponse<UsersResponse>>('/admin/users');
      setUsers(response.data.data.users || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  };

  const fetchAvailablePermissions = async (): Promise<void> => {
    try {
      const response = await apiClient.get<ApiResponse<PermissionsResponse>>('/admin/available-permissions');
      setAvailablePermissions(response.data.data.permissions || []);
    } catch (error) {
      console.error('Error fetching permissions:', error);
      throw error;
    }
  };

  const fetchExpiringItems = async (): Promise<void> => {
    try {
      const response = await apiClient.get<ApiResponse<ExpiringItemsResponse>>('/admin/expiring-items?days=7');
      setExpiringItems(response.data.data || { expiringPermissions: [], expiringRoles: [] });
    } catch (error) {
      console.error('Error fetching expiring items:', error);
      throw error;
    }
  };

  const handleCreatePermission = async (): Promise<void> => {
    try {
      if (!isSuperAdmin()) {
        showSnackbar('Only super admins can create permissions', 'error');
        return;
      }

      await apiClient.post('/admin/available-permissions', newPermission);
      showSnackbar('Permission created successfully', 'success');
      setPermissionDialogOpen(false);
      setNewPermission({
        permissionKey: '',
        module: '',
        resource: '',
        action: '',
        category: '',
        scope: 'state',
        severityLevel: 'medium',
        description: '',
        isSystemPermission: false,
        requiresSuperAdmin: false
      });
      fetchAvailablePermissions();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.data?.message || 'Failed to create permission';
      showSnackbar(errorMessage, 'error');
    }
  };

  const handleAddTemporaryPermission = async (userId: string, permissionData: any): Promise<void> => {
    try {
      await apiClient.post(`/admin/users/${userId}/permissions/temporary`, permissionData);
      showSnackbar('Temporary permission added successfully', 'success');
      fetchUsers();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.data?.message || 'Failed to add permission';
      showSnackbar(errorMessage, 'error');
    }
  };

  const handleApprovePermission = async (approvalData: any): Promise<void> => {
    try {
      await apiClient.post('/admin/permissions/approve', approvalData);
      showSnackbar('Permission approved successfully', 'success');
      fetchUsers();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.data?.message || 'Failed to approve permission';
      showSnackbar(errorMessage, 'error');
    }
  };

  const getStatusColor = (status: string): "success" | "warning" | "error" | "default" => {
    switch (status) {
      case 'active': return 'success';
      case 'pending_approval': return 'warning';
      case 'suspended': return 'error';
      case 'inactive': return 'default';
      default: return 'default';
    }
  };

  const getAccessTierColor = (tier: string): "error" | "warning" | "info" | "secondary" | "primary" | "default" => {
    switch (tier) {
      case 'ntro_privileged': return 'error';
      case 'government': return 'warning';
      case 'enterprise': return 'info';
      case 'premium': return 'secondary';
      case 'standard': return 'primary';
      default: return 'default';
    }
  };

  const handleTabChange = (event: React.SyntheticEvent, newValue: number): void => {
    setActiveTab(newValue);
  };

  const handlePermissionFormChange = (field: keyof NewPermissionForm, value: string | boolean): void => {
    setNewPermission(prev => ({
      ...prev,
      [field]: value
    }));
  };

  if (!hasModuleAccess('user_management') && !hasModuleAccess('role_management') && !isSuperAdmin()) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="error">
          You don't have permission to access the admin dashboard. Please contact your administrator.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ flexGrow: 1, p: 3 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <AdminPanelSettings fontSize="large" />
          Admin Dashboard
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage users, permissions, and system configurations
        </Typography>
      </Box>

      {/* Access Level Info */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Access Level
              </Typography>
              <Typography variant="h5" component="div">
                Level {permissions?.accessLevel?.globalVerificationLevel || 1}
              </Typography>
              <Chip 
                label={isSuperAdmin() ? 'Super Admin' : 'Administrator'} 
                color={isSuperAdmin() ? 'error' : 'primary'}
                size="small"
                sx={{ mt: 1 }}
              />
            </CardContent>
          </Card>
        </Grid>
        
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Total Users
              </Typography>
              <Typography variant="h5" component="div">
                {users.length}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <People fontSize="small" color="action" />
                <Typography variant="body2" sx={{ ml: 1 }}>
                  Managed
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Available Permissions
              </Typography>
              <Typography variant="h5" component="div">
                {availablePermissions.length}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <Security fontSize="small" color="action" />
                <Typography variant="body2" sx={{ ml: 1 }}>
                  System
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <Card>
            <CardContent>
              <Typography color="text.secondary" gutterBottom>
                Expiring Soon
              </Typography>
              <Typography variant="h5" component="div">
                {expiringItems.expiringPermissions.length + expiringItems.expiringRoles.length}
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', mt: 1 }}>
                <AccessTime fontSize="small" color="action" />
                <Typography variant="body2" sx={{ ml: 1 }}>
                  Next 7 days
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Tabs */}
      <Paper sx={{ width: '100%' }}>
        <Tabs
          value={activeTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
        >
          <Tab icon={<Assignment />} label="Dashboard" />
          <Tab icon={<People />} label="User Management" />
          <Tab icon={<Security />} label="Permission Management" />
          <Tab icon={<Schedule />} label="Expiry Management" />
        </Tabs>

        {/* Dashboard Tab */}
        <TabPanel value={activeTab} index={0}>
          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={3}>
              {/* Recent Users */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="h6" gutterBottom>
                  Recent Users
                </Typography>
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>User</TableCell>
                        <TableCell>Department</TableCell>
                        <TableCell>Status</TableCell>
                        <TableCell>Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {users.slice(0, 5).map((userData) => (
                        <TableRow key={userData._id}>
                          <TableCell>
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Avatar sx={{ width: 32, height: 32 }}>
                                {userData.userId.name.charAt(0)}
                              </Avatar>
                              <Box>
                                <Typography variant="body2" fontWeight="bold">
                                  {userData.userId.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {userData.userId.email}
                                </Typography>
                              </Box>
                            </Box>
                          </TableCell>
                          <TableCell>{userData.userId.department}</TableCell>
                          <TableCell>
                            <Chip
                              label={userData.status}
                              size="small"
                              color={getStatusColor(userData.status)}
                            />
                          </TableCell>
                          <TableCell>
                            <IconButton 
                              size="small" 
                              onClick={() => setSelectedUser(userData)}
                            >
                              <Visibility fontSize="small" />
                            </IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Grid>

              {/* Expiring Items */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="h6" gutterBottom>
                  Expiring Soon
                </Typography>
                <List dense>
                  {[...expiringItems.expiringPermissions, ...expiringItems.expiringRoles]
                    .slice(0, 5)
                    .map((item, index) => (
                    <ListItem key={index} divider>
                      <ListItemIcon>
                        <Warning color="warning" />
                      </ListItemIcon>
                      <ListItemText
                        primary={item.name}
                        secondary={
                          <Box>
                            <Typography variant="caption" display="block">
                              {item.role} • {item.stateCode}
                            </Typography>
                            <Typography variant="caption" color="error">
                              Expires: {new Date(item.expiresAt).toLocaleDateString()}
                            </Typography>
                          </Box>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              </Grid>
            </Grid>
          )}
        </TabPanel>

        {/* User Management Tab */}
        <TabPanel value={activeTab} index={1}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              User Management ({users.length} users)
            </Typography>
            <Button
              variant="contained"
              startIcon={<Add />}
              disabled={!hasPermission('user_management', 'create')}
            >
              Add User
            </Button>
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>User</TableCell>
                    <TableCell>Department</TableCell>
                    <TableCell>Designation</TableCell>
                    <TableCell>Access Tier</TableCell>
                    <TableCell>Verification Level</TableCell>
                    <TableCell>Status</TableCell>
                    <TableCell>Last Login</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {users.map((userData) => (
                    <TableRow key={userData._id}>
                      <TableCell>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 32, height: 32 }}>
                            {userData.userId.name.charAt(0)}
                          </Avatar>
                          <Box>
                            <Typography variant="body2" fontWeight="bold">
                              {userData.userId.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {userData.userId.email}
                            </Typography>
                          </Box>
                        </Box>
                      </TableCell>
                      <TableCell>{userData.userId.department}</TableCell>
                      <TableCell>{userData.userId.designation}</TableCell>
                      <TableCell>
                        <Chip
                          label={userData.accessTier}
                          size="small"
                          color={getAccessTierColor(userData.accessTier)}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={`Level ${userData.globalVerificationLevel}`}
                          size="small"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={userData.status}
                          size="small"
                          color={getStatusColor(userData.status)}
                        />
                      </TableCell>
                      <TableCell>
                        {userData.userId.lastLoginAt 
                          ? new Date(userData.userId.lastLoginAt).toLocaleDateString()
                          : 'Never'
                        }
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          <IconButton 
                            size="small" 
                            onClick={() => setSelectedUser(userData)}
                            disabled={!hasPermission('user_management', 'read')}
                          >
                            <Visibility fontSize="small" />
                          </IconButton>
                          <IconButton 
                            size="small"
                            disabled={!hasPermission('user_management', 'update')}
                          >
                            <Edit fontSize="small" />
                          </IconButton>
                          <IconButton 
                            size="small"
                            disabled={!hasPermission('user_management', 'delete')}
                          >
                            <Delete fontSize="small" />
                          </IconButton>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        {/* Permission Management Tab */}
        <TabPanel value={activeTab} index={2}>
          <Box sx={{ mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6">
              Available Permissions ({availablePermissions.length} permissions)
            </Typography>
            {isSuperAdmin() && (
              <Button
                variant="contained"
                startIcon={<Add />}
                onClick={() => setPermissionDialogOpen(true)}
              >
                Create Permission
              </Button>
            )}
          </Box>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <TableContainer component={Paper}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Permission Key</TableCell>
                    <TableCell>Module</TableCell>
                    <TableCell>Resource</TableCell>
                    <TableCell>Action</TableCell>
                    <TableCell>Category</TableCell>
                    <TableCell>Scope</TableCell>
                    <TableCell>Severity</TableCell>
                    <TableCell>System</TableCell>
                    <TableCell>Status</TableCell>
                    {isSuperAdmin() && <TableCell>Actions</TableCell>}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {availablePermissions.map((permission) => (
                    <TableRow key={permission._id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight="bold">
                          {permission.permissionKey}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {permission.description}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={permission.module} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>{permission.resource}</TableCell>
                      <TableCell>{permission.action}</TableCell>
                      <TableCell>{permission.category}</TableCell>
                      <TableCell>{permission.scope}</TableCell>
                      <TableCell>
                        <Chip
                          label={permission.severityLevel}
                          size="small"
                          color={
                            permission.severityLevel === 'critical' ? 'error' :
                            permission.severityLevel === 'high' ? 'warning' :
                            permission.severityLevel === 'medium' ? 'info' : 'default'
                          }
                        />
                      </TableCell>
                      <TableCell>
                        {permission.isSystemPermission ? (
                          <CheckCircle color="success" />
                        ) : (
                          <Cancel color="disabled" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={permission.isActive ? 'Active' : 'Inactive'}
                          size="small"
                          color={permission.isActive ? 'success' : 'default'}
                        />
                      </TableCell>
                      {isSuperAdmin() && (
                        <TableCell>
                          <IconButton size="small">
                            <Edit fontSize="small" />
                          </IconButton>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </TabPanel>

        {/* Expiry Management Tab */}
        <TabPanel value={activeTab} index={3}>
          <Typography variant="h6" gutterBottom>
            Expiring Permissions and Roles (Next 7 Days)
          </Typography>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={3}>
              {/* Expiring Permissions */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Warning color="warning" />
                      Expiring Permissions ({expiringItems.expiringPermissions.length})
                    </Typography>
                    <List dense>
                      {expiringItems.expiringPermissions.map((item, index) => (
                        <ListItem key={index} divider>
                          <ListItemText
                            primary={item.name}
                            secondary={
                              <Box>
                                <Typography variant="caption" display="block">
                                  {item.email}
                                </Typography>
                                <Typography variant="caption" display="block">
                                  {item.role} • {item.stateCode}
                                </Typography>
                                <Typography variant="caption" color="error">
                                  Expires: {new Date(item.expiresAt).toLocaleDateString()}
                                </Typography>
                              </Box>
                            }
                          />
                          <Button size="small" variant="outlined">
                            Extend
                          </Button>
                        </ListItem>
                      ))}
                      {expiringItems.expiringPermissions.length === 0 && (
                        <ListItem>
                          <ListItemText primary="No permissions expiring in the next 7 days" />
                        </ListItem>
                      )}
                    </List>
                  </CardContent>
                </Card>
              </Grid>

              {/* Expiring Roles */}
              <Grid size={{ xs: 12, md: 6 }}>
                <Card>
                  <CardContent>
                    <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Warning color="warning" />
                      Expiring Roles ({expiringItems.expiringRoles.length})
                    </Typography>
                    <List dense>
                      {expiringItems.expiringRoles.map((item, index) => (
                        <ListItem key={index} divider>
                          <ListItemText
                            primary={item.name}
                            secondary={
                              <Box>
                                <Typography variant="caption" display="block">
                                  {item.email}
                                </Typography>
                                <Typography variant="caption" display="block">
                                  {item.role} • {item.stateCode}
                                </Typography>
                                <Typography variant="caption" color="error">
                                  Expires: {new Date(item.expiresAt).toLocaleDateString()}
                                </Typography>
                              </Box>
                            }
                          />
                          <Button size="small" variant="outlined">
                            Extend
                          </Button>
                        </ListItem>
                      ))}
                      {expiringItems.expiringRoles.length === 0 && (
                        <ListItem>
                          <ListItemText primary="No roles expiring in the next 7 days" />
                        </ListItem>
                      )}
                    </List>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          )}
        </TabPanel>
      </Paper>

      {/* Create Permission Dialog */}
      <Dialog 
        open={permissionDialogOpen} 
        onClose={() => setPermissionDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Create New Permission</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Permission Key"
                value={newPermission.permissionKey}
                onChange={(e) => handlePermissionFormChange('permissionKey', e.target.value)}
                placeholder="MODULE_RESOURCE_ACTION"
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Module</InputLabel>
                <Select
                  value={newPermission.module}
                  label="Module"
                  onChange={(e) => handlePermissionFormChange('module', e.target.value)}
                >
                  <MenuItem value="user_management">User Management</MenuItem>
                  <MenuItem value="role_management">Role Management</MenuItem>
                  <MenuItem value="system_config">System Configuration</MenuItem>
                  <MenuItem value="mining_operations">Mining Operations</MenuItem>
                  <MenuItem value="compliance_monitoring">Compliance Monitoring</MenuItem>
                  <MenuItem value="intelligence_analytics">Intelligence Analytics</MenuItem>
                  <MenuItem value="data_export">Data Export</MenuItem>
                  <MenuItem value="public_interface">Public Interface</MenuItem>
                  <MenuItem value="audit_logs">Audit Logs</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <TextField
                fullWidth
                label="Resource"
                value={newPermission.resource}
                onChange={(e) => handlePermissionFormChange('resource', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Action</InputLabel>
                <Select
                  value={newPermission.action}
                  label="Action"
                  onChange={(e) => handlePermissionFormChange('action', e.target.value)}
                >
                  <MenuItem value="create">Create</MenuItem>
                  <MenuItem value="read">Read</MenuItem>
                  <MenuItem value="update">Update</MenuItem>
                  <MenuItem value="delete">Delete</MenuItem>
                  <MenuItem value="approve">Approve</MenuItem>
                  <MenuItem value="manage">Manage</MenuItem>
                  <MenuItem value="execute">Execute</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={newPermission.category}
                  label="Category"
                  onChange={(e) => handlePermissionFormChange('category', e.target.value)}
                >
                  <MenuItem value="technical">Technical</MenuItem>
                  <MenuItem value="administrative">Administrative</MenuItem>
                  <MenuItem value="intelligence">Intelligence</MenuItem>
                  <MenuItem value="compliance">Compliance</MenuItem>
                  <MenuItem value="public">Public</MenuItem>
                  <MenuItem value="system">System</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12, sm: 6 }}>
              <FormControl fullWidth>
                <InputLabel>Scope</InputLabel>
                <Select
                  value={newPermission.scope}
                  label="Scope"
                  onChange={(e) => handlePermissionFormChange('scope', e.target.value)}
                >
                  <MenuItem value="global">Global</MenuItem>
                  <MenuItem value="national">National</MenuItem>
                  <MenuItem value="state">State</MenuItem>
                  <MenuItem value="district">District</MenuItem>
                  <MenuItem value="organization">Organization</MenuItem>
                  <MenuItem value="personal">Personal</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid size={{ xs: 12 }}>
              <TextField
                fullWidth
                multiline
                rows={3}
                label="Description"
                value={newPermission.description}
                onChange={(e) => handlePermissionFormChange('description', e.target.value)}
              />
            </Grid>
            <Grid size={{ xs: 12 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={newPermission.isSystemPermission}
                    onChange={(e) => handlePermissionFormChange('isSystemPermission', e.target.checked)}
                  />
                }
                label="System Permission"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={newPermission.requiresSuperAdmin}
                    onChange={(e) => handlePermissionFormChange('requiresSuperAdmin', e.target.checked)}
                  />
                }
                label="Requires Super Admin"
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPermissionDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleCreatePermission}
            variant="contained"
            disabled={!newPermission.permissionKey || !newPermission.module || !newPermission.resource || !newPermission.action}
          >
            Create Permission
          </Button>
        </DialogActions>
      </Dialog>

      {/* User Details Dialog */}
      <Dialog
        open={!!selectedUser}
        onClose={() => setSelectedUser(null)}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          User Details: {selectedUser?.userId.name}
        </DialogTitle>
        <DialogContent>
          {selectedUser && (
            <Grid container spacing={3}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="h6" gutterBottom>Basic Information</Typography>
                <List dense>
                  <ListItem>
                    <ListItemText primary="Name" secondary={selectedUser.userId.name} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Email" secondary={selectedUser.userId.email} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Phone" secondary={selectedUser.userId.phone} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Designation" secondary={selectedUser.userId.designation} />
                  </ListItem>
                  <ListItem>
                    <ListItemText primary="Department" secondary={selectedUser.userId.department} />
                  </ListItem>
                </List>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Typography variant="h6" gutterBottom>Access Information</Typography>
                <List dense>
                  <ListItem>
                    <ListItemText 
                      primary="Access Tier" 
                      secondary={
                        <Chip 
                          label={selectedUser.accessTier} 
                          size="small" 
                          color={getAccessTierColor(selectedUser.accessTier)}
                        />
                      } 
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Verification Level" 
                      secondary={`Level ${selectedUser.globalVerificationLevel}`} 
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Status" 
                      secondary={
                        <Chip 
                          label={selectedUser.status} 
                          size="small" 
                          color={getStatusColor(selectedUser.status)}
                        />
                      } 
                    />
                  </ListItem>
                  <ListItem>
                    <ListItemText 
                      primary="Last Login" 
                      secondary={
                        selectedUser.userId.lastLoginAt 
                          ? new Date(selectedUser.userId.lastLoginAt).toLocaleString()
                          : 'Never'
                      } 
                    />
                  </ListItem>
                </List>
              </Grid>
              <Grid size={{ xs: 12 }}>
                <Typography variant="h6" gutterBottom>State Access</Typography>
                {selectedUser.states.map((state, index) => (
                  <Card key={index} variant="outlined" sx={{ mb: 2 }}>
                    <CardContent>
                      <Typography variant="subtitle1">
                        {state.stateName} ({state.stateCode})
                      </Typography>
                      <Box sx={{ mt: 1 }}>
                        {state.roles.map((role, roleIndex) => (
                          <Chip
                            key={roleIndex}
                            label={role.role}
                            size="small"
                            sx={{ mr: 1, mb: 1 }}
                            color={role.isActive ? 'primary' : 'default'}
                          />
                        ))}
                      </Box>
                    </CardContent>
                  </Card>
                ))}
              </Grid>
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedUser(null)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}