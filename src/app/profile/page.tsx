'use client';
import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';

export default function AuthDebugPage() {
  const {
    user,
    permissions,
    isAuthenticated,
    loading,
    getUserRoles,
    getUserStates,
    getUserDistricts,
    hasPermission,
    hasModuleAccess,
    canManageResource,
    isSuperAdmin,
    getAccessLevel,
    getAccessTier,
    refreshUser,
    logout,
    checkAuth,
    showLogin
  } = useAuth();

  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'user' | 'permissions' | 'states' | 'session'>('user');

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshUser();
    setRefreshing(false);
  };

  const handleRecheck = async () => {
    setRefreshing(true);
    await checkAuth();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading authentication data...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            <h2 className="text-lg font-bold">Not Authenticated</h2>
            <p>Please log in to view authentication data</p>
          </div>
          <button
            onClick={() => showLogin()}
            className="bg-blue-600 text-white px-6 py-2 rounded hover:bg-blue-700"
          >
            Show Login Modal
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-6xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm border p-6 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Authentication Debug</h1>
              <p className="text-gray-600 mt-1">Complete authentication context data</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700 disabled:opacity-50"
              >
                {refreshing ? 'Refreshing...' : 'Refresh Data'}
              </button>
              <button
                onClick={handleRecheck}
                disabled={refreshing}
                className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {refreshing ? 'Checking...' : 'Re-check Auth'}
              </button>
              <button
                onClick={logout}
                className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
              >
                Logout
              </button>
            </div>
          </div>

          {/* Status Badges */}
          <div className="flex gap-4 mt-4">
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${isAuthenticated ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
              {isAuthenticated ? '✅ Authenticated' : '❌ Not Authenticated'}
            </div>
            <div className={`px-3 py-1 rounded-full text-sm font-medium ${isSuperAdmin() ? 'bg-red-100 text-red-800' : 'bg-blue-100 text-blue-800'}`}>
              {isSuperAdmin() ? '👑 Super Admin' : `Level ${getAccessLevel()}`}
            </div>
            <div className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm font-medium">
              Tier: {getAccessTier()}
            </div>
            <div className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm font-medium">
              Roles: {getUserRoles().length}
            </div>
            <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm font-medium">
              States: {getUserStates().length}
            </div>
            <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
              Permissions: {permissions?.allPermissions?.length || 0}
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-white rounded-lg shadow-sm border mb-6">
          <div className="border-b">
            <nav className="flex -mb-px">
              {[
                { id: 'user', name: 'User Info', icon: '👤' },
                { id: 'permissions', name: 'Permissions', icon: '🔐' },
                { id: 'states', name: 'States & Roles', icon: '🗺️' },
                { id: 'session', name: 'Session Tools', icon: '⚡' }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center px-6 py-3 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <span className="mr-2">{tab.icon}</span>
                  {tab.name}
                </button>
              ))}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="p-6">
            {/* User Info Tab */}
            {activeTab === 'user' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Basic Information</h3>
                    <dl className="space-y-2">
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Name:</dt>
                        <dd className="font-medium">{user?.name}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Email:</dt>
                        <dd className="font-medium">{user?.email}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Phone:</dt>
                        <dd className="font-medium">{user?.phone}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Designation:</dt>
                        <dd className="font-medium">{user?.designation}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Department:</dt>
                        <dd className="font-medium">{user?.department}</dd>
                      </div>
                    </dl>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Account Status</h3>
                    <dl className="space-y-2">
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Access Level:</dt>
                        <dd className="font-medium">Level {getAccessLevel()}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Access Tier:</dt>
                        <dd className="font-medium capitalize">{getAccessTier()}</dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Super Admin:</dt>
                        <dd className={`font-medium ${isSuperAdmin() ? 'text-green-600' : 'text-red-600'}`}>
                          {isSuperAdmin() ? 'Yes' : 'No'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Active:</dt>
                        <dd className={`font-medium ${user?.isActive ? 'text-green-600' : 'text-red-600'}`}>
                          {user?.isActive ? 'Yes' : 'No'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Verified:</dt>
                        <dd className={`font-medium ${user?.isVerified ? 'text-green-600' : 'text-red-600'}`}>
                          {user?.isVerified ? 'Yes' : 'No'}
                        </dd>
                      </div>
                      <div className="flex justify-between">
                        <dt className="text-gray-600">Last Login:</dt>
                        <dd className="font-medium">
                          {user?.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Never'}
                        </dd>
                      </div>
                    </dl>
                  </div>
                </div>

                {/* Quick Permission Check */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Quick Permission Check</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { resource: 'user_management', action: 'manage', label: 'Manage Users' },
                      { resource: 'mining_analysis', action: 'create', label: 'Create Analysis' },
                      { resource: 'compliance_reports', action: 'read', label: 'View Reports' },
                      { resource: 'system_config', action: 'manage', label: 'System Config' }
                    ].map((perm) => (
                      <div key={perm.resource} className="text-center">
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                          hasPermission(perm.resource, perm.action) 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {hasPermission(perm.resource, perm.action) ? '✅' : '❌'} {perm.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Module Access Check */}
                <div className="bg-gray-50 rounded-lg p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">Module Access</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                      { module: 'user_management', label: 'User Management' },
                      { module: 'mining_operations', label: 'Mining Operations' },
                      { module: 'compliance_monitoring', label: 'Compliance' },
                      { module: 'intelligence_analytics', label: 'Analytics' }
                    ].map((mod) => (
                      <div key={mod.module} className="text-center">
                        <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                          hasModuleAccess(mod.module) 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {hasModuleAccess(mod.module) ? '✅' : '❌'} {mod.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Permissions Tab */}
            {activeTab === 'permissions' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-gray-900">
                    All Permissions ({permissions?.allPermissions?.length || 0})
                  </h3>
                  <div className="text-sm text-gray-500">
                    Flattened permissions for easy access
                  </div>
                </div>

                {!permissions?.allPermissions || permissions.allPermissions.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No permissions found
                  </div>
                ) : (
                  <div className="bg-white border rounded-lg overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Resource
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Action
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Module
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Role
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            State
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Scope
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {permissions.allPermissions.map((permission, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              {permission.resource}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                permission.action === 'manage' 
                                  ? 'bg-purple-100 text-purple-800'
                                  : permission.action === 'create'
                                  ? 'bg-green-100 text-green-800'
                                  : permission.action === 'read'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}>
                                {permission.action}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {permission.module}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {permission.role}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              {permission.state}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                              <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                                permission.scope === 'national' 
                                  ? 'bg-red-100 text-red-800'
                                  : permission.scope === 'global'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-green-100 text-green-800'
                              }`}>
                                {permission.scope}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Access Level Information */}
                {permissions?.accessLevel && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Access Level Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-white rounded">
                        <div className="text-2xl font-bold text-blue-600">
                          {permissions.accessLevel.globalVerificationLevel}
                        </div>
                        <div className="text-sm text-gray-600">Verification Level</div>
                      </div>
                      <div className="text-center p-4 bg-white rounded">
                        <div className="text-xl font-bold text-green-600 capitalize">
                          {permissions.accessLevel.accessTier}
                        </div>
                        <div className="text-sm text-gray-600">Access Tier</div>
                      </div>
                      <div className="text-center p-4 bg-white rounded">
                        <div className="text-2xl font-bold text-red-600">
                          {permissions.accessLevel.isSuperAdmin ? 'Yes' : 'No'}
                        </div>
                        <div className="text-sm text-gray-600">Super Admin</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* States & Roles Tab */}
            {activeTab === 'states' && (
              <div className="space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-gray-900">
                    States & Roles ({permissions?.states?.length || 0})
                  </h3>
                  <div className="text-sm text-gray-500">
                    Hierarchical structure from API
                  </div>
                </div>

                {!permissions?.states || permissions.states.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No states found
                  </div>
                ) : (
                  <div className="space-y-4">
                    {permissions.states.map((state, stateIndex) => (
                      <div key={stateIndex} className="bg-white border rounded-lg overflow-hidden">
                        <div className="bg-gray-50 px-6 py-4 border-b">
                          <div className="flex justify-between items-center">
                            <div>
                              <h4 className="font-semibold text-gray-900">
                                {state.stateName} ({state.stateCode})
                              </h4>
                              <p className="text-sm text-gray-600 mt-1">
                                Region: {state.region} | Districts: {state.districts?.length || 0} | Roles: {state.roles?.length || 0}
                              </p>
                            </div>
                            <div className="text-right">
                              <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm ${
                                state.isActive 
                                  ? 'bg-green-100 text-green-800' 
                                  : 'bg-red-100 text-red-800'
                              }`}>
                                {state.isActive ? 'Active' : 'Inactive'}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="p-6">
                          {/* Districts */}
                          {state.districts && state.districts.length > 0 && (
                            <div className="mb-6">
                              <h5 className="font-medium text-gray-900 mb-3">Districts</h5>
                              <div className="flex flex-wrap gap-2">
                                {state.districts.map((district, districtIndex) => (
                                  <span
                                    key={districtIndex}
                                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                                      district.isActive
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-gray-100 text-gray-800'
                                    }`}
                                  >
                                    {district.districtName} ({district.districtCode})
                                    {district.isActive && ' ✅'}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Roles */}
                          {state.roles && state.roles.length > 0 && (
                            <div>
                              <h5 className="font-medium text-gray-900 mb-3">Roles & Permissions</h5>
                              <div className="space-y-4">
                                {state.roles.map((role, roleIndex) => (
                                  <div key={roleIndex} className="border rounded-lg p-4">
                                    <div className="flex justify-between items-start mb-3">
                                      <div>
                                        <h6 className="font-medium text-gray-900">{role.role}</h6>
                                        <p className="text-sm text-gray-600">{role.description}</p>
                                        <div className="flex gap-2 mt-1">
                                          <span className="text-xs text-gray-500">Level: {role.level}</span>
                                          <span className="text-xs text-gray-500">Category: {role.category}</span>
                                        </div>
                                      </div>
                                      <div className="flex gap-2">
                                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                                          role.roleStatus === 'active'
                                            ? 'bg-green-100 text-green-800'
                                            : 'bg-red-100 text-red-800'
                                        }`}>
                                          {role.roleStatus}
                                        </span>
                                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs ${
                                          role.isActive
                                            ? 'bg-blue-100 text-blue-800'
                                            : 'bg-gray-100 text-gray-800'
                                        }`}>
                                          {role.isActive ? 'Active' : 'Inactive'}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Role Permissions */}
                                    {role.permissions && role.permissions.length > 0 && (
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                        {role.permissions.map((permission, permIndex) => (
                                          <div
                                            key={permIndex}
                                            className={`flex justify-between items-center p-2 rounded text-sm ${
                                              permission.status === 'active'
                                                ? 'bg-gray-50'
                                                : 'bg-red-50'
                                            }`}
                                          >
                                            <div>
                                              <span className="font-medium">{permission.resource}</span>
                                              <span className="text-gray-600 ml-2">• {permission.action}</span>
                                            </div>
                                            <span className={`text-xs px-2 py-1 rounded ${
                                              permission.status === 'active'
                                                ? 'bg-green-100 text-green-800'
                                                : 'bg-red-100 text-red-800'
                                            }`}>
                                              {permission.status}
                                            </span>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Jurisdictions Summary */}
                {permissions?.jurisdictions && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    <h3 className="font-semibold text-gray-900 mb-3">Jurisdictions Summary</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-white rounded">
                        <div className="text-2xl font-bold text-blue-600">
                          {permissions.jurisdictions.states.length}
                        </div>
                        <div className="text-sm text-gray-600">States</div>
                      </div>
                      <div className="text-center p-4 bg-white rounded">
                        <div className="text-2xl font-bold text-green-600">
                          {permissions.jurisdictions.districts.length}
                        </div>
                        <div className="text-sm text-gray-600">Districts</div>
                      </div>
                      <div className="text-center p-4 bg-white rounded">
                        <div className="text-2xl font-bold text-red-600">
                          {permissions.jurisdictions.national ? 'Yes' : 'No'}
                        </div>
                        <div className="text-sm text-gray-600">National Access</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Session Tools Tab */}
            {activeTab === 'session' && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="font-semibold text-gray-900 mb-4">Session Management</h3>
                    <div className="space-y-4">
                      <button
                        onClick={handleRefresh}
                        disabled={refreshing}
                        className="w-full bg-green-600 text-white py-2 px-4 rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        {refreshing ? 'Refreshing User Data...' : 'Refresh User Data'}
                      </button>
                      <button
                        onClick={handleRecheck}
                        disabled={refreshing}
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 disabled:opacity-50"
                      >
                        {refreshing ? 'Checking Authentication...' : 'Re-check Authentication'}
                      </button>
                      <button
                        onClick={logout}
                        className="w-full bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700"
                      >
                        Logout & Clear Session
                      </button>
                    </div>
                  </div>

                  <div className="bg-gray-50 rounded-lg p-6">
                    <h3 className="font-semibold text-gray-900 mb-4">Permission Utilities</h3>
                    <div className="space-y-3">
                      {[
                        { resource: 'user_management', action: 'manage', label: 'User Management' },
                        { resource: 'mining_analysis', action: 'create', label: 'Create Analysis' },
                        { resource: 'compliance_reports', action: 'approve', label: 'Approve Reports' },
                        { resource: 'system_config', action: 'manage', label: 'System Config' }
                      ].map((perm) => (
                        <div key={perm.resource} className="flex justify-between items-center p-2 bg-white rounded">
                          <span className="text-sm font-medium">{perm.label}</span>
                          <span className={`text-xs px-2 py-1 rounded ${
                            hasPermission(perm.resource, perm.action) 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {hasPermission(perm.resource, perm.action) ? 'Can Access' : 'No Access'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Raw Data Summary */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="font-semibold text-gray-900 mb-4">Raw Data Summary</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div className="bg-white p-4 rounded">
                      <div className="text-2xl font-bold text-blue-600">{getUserStates().length}</div>
                      <div className="text-sm text-gray-600">States</div>
                    </div>
                    <div className="bg-white p-4 rounded">
                      <div className="text-2xl font-bold text-green-600">{permissions?.allPermissions?.length || 0}</div>
                      <div className="text-sm text-gray-600">Permissions</div>
                    </div>
                    <div className="bg-white p-4 rounded">
                      <div className="text-2xl font-bold text-purple-600">{getUserRoles().length}</div>
                      <div className="text-sm text-gray-600">Roles</div>
                    </div>
                    <div className="bg-white p-4 rounded">
                      <div className="text-2xl font-bold text-orange-600">{getUserDistricts().length}</div>
                      <div className="text-sm text-gray-600">Districts</div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Info */}
        <div className="bg-white rounded-lg shadow-sm border p-4">
          <div className="text-center text-sm text-gray-500">
            Auth Context Loaded • User ID: {user?.id} • Last Updated: {new Date().toLocaleString()}
          </div>
        </div>
      </div>
    </div>
  );
}