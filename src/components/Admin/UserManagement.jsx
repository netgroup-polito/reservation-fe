import React, { useEffect, useState, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button, 
  CircularProgress,
  Stack,
  InputAdornment,
  MenuItem,
  TextField,
  Typography,
  Snackbar,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Switch,
  Tooltip,
  IconButton,
  Chip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import SecurityIcon from '@mui/icons-material/Security';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import PersonIcon from '@mui/icons-material/Person';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import DiscFullIcon from '@mui/icons-material/DiscFull';

import UserForm from '../Users/UserForm';
import { 
  createUser, 
  deleteUser, 
  fetchUsers, 
  updateUser, 
  assignCustomIsoRole, 
  removeCustomIsoRole 
} from '../../services/userService';
import useApiError from '../../hooks/useApiError';
import { SiteRoles } from '../../services/siteService';
import { AuthContext } from '../../context/AuthContext';
import { useSite } from '../../context/SiteContext';

const UserManagement = () => {
  const { t } = useTranslation();
  const { withErrorHandling } = useApiError();
  const { isGlobalAdmin } = useContext(AuthContext);
  const { currentSite } = useSite();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [notification, setNotification] = useState(null);

  // Check if user can manage Global Admins
  const canManageGlobalAdmins = isGlobalAdmin && isGlobalAdmin();

  // Show a notification
  const showNotification = (message, severity = 'success') => {
    setNotification({ message, severity });
    
    // Remove the notification after 6 seconds
    setTimeout(() => {
      setNotification(null);
    }, 6000);
  };

  // Load users
  useEffect(() => {
    const loadUsers = async () => {
      setIsLoading(true);
      try {
        await withErrorHandling(async () => {
          const usersData = await fetchUsers(currentSite ? { siteId: currentSite.id } : {});
          setUsers(usersData);
        }, {
          errorMessage: t('errors.unableToLoadUserList'),
          showError: true
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadUsers();
  }, [withErrorHandling, t, currentSite]);

 
  // Handle Custom ISO Role Toggle
  const handleIsoToggle = async (user, checked) => {
    // Salvo lo stato precedente per il rollback in caso di errore API
    const originalUsers = [...users];
    
    // Nome del ruolo target per il confronto (sempre normalizzato)
    const TARGET_ROLE_CLEAN = 'custom-iso-uploader';

    // Funzione di utilità interna per pulire le stringhe dei ruoli
    const normalizeRole = (role) => 
      role.replace(/^ROLE_/, '')   // Toglie il prefisso Spring ROLE_
          .toLowerCase()           // Tutto in minuscolo
          .replace(/_/g, '-');     // Sostituisce underscore con trattini

    // 1. Optimistic Update: Aggiorno la UI immediatamente
    setUsers(prevUsers => prevUsers.map(u => {
      if (u.id === user.id) {
        const currentRoles = u.roles || [];
        
        const newRoles = checked 
          ? [...currentRoles, 'CUSTOM-ISO-UPLOADER'] // Aggiungo (formato standard BE)
          : currentRoles.filter(r => normalizeRole(r) !== TARGET_ROLE_CLEAN); // Rimuovo con filtro robusto
        
        return { ...u, roles: newRoles };
      }
      return u;
    }));

  // 2. Chiamata API
  try {
    if (checked) {
      await assignCustomIsoRole(user.id);
      showNotification("Custom ISO upload permission granted", "success");
    } else {
      await removeCustomIsoRole(user.id);
      showNotification("Custom ISO upload permission revoked", "info");
    }
  } catch (error) {
    // 3. Revert in caso di fallimento: l'utente non vedrà il toggle saltare
    console.error("Failed to update role", error);
    setUsers(originalUsers);
    showNotification("Failed to update permissions on server", "error");
  }
};

  // Helper to check if user has the custom iso role
  const hasCustomIsoRole = (user) => {
    if (!user || !user.roles) return false;
    return user.roles.some(r => r.toLowerCase() === 'custom-iso-uploader');
  };

  // Filter users based on search and role
  const filteredUsers = users.filter(user => {
    const matchesSearch = searchTerm === '' ||
        (user.username && user.username.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (user.firstName && user.firstName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (user.lastName && user.lastName.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (user.email && user.email.toLowerCase().includes(searchTerm.toLowerCase()));

    // Handle role filtering with the new role structure
    if (filterRole === '') return matchesSearch;
    
    // Handle array of roles
    if (Array.isArray(user.roles)) {
      return matchesSearch && 
             user.roles.some(role => role.toUpperCase() === filterRole.toUpperCase());
    }  
    return false;
  });

  const handleAddUser = () => {
    setSelectedUser(null);
    setIsUserModalOpen(true);
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setIsUserModalOpen(true);
  };

  const handleSaveUser = async (userData) => {
    const result = await withErrorHandling(async () => {
      if (userData.id) {
        // Update an existing user
        const updatedUser = await updateUser(userData.id, userData);
        return { updated: true, user: updatedUser, success: true };
      } else {
        // Create a new user
        const newUser = await createUser(userData);
        return { updated: false, user: newUser, success: true };
      }
    }, {
      errorMessage: userData.id 
        ? t('userManagement.unableToUpdateUser', { username: userData.username }) 
        : t('userManagement.unableToCreateUser', { username: userData.username }),
      showError: true
    });

    if (result && result.success) {
      if (result.updated) {
        // Update existing users
        setUsers(users.map(user =>
            user.id === result.user.id ? result.user : user
        ));
        showNotification(t('userManagement.userUpdatedSuccess', { username: result.user.username }));
      } else {
        // Add new user
        setUsers([...users, result.user]);
        showNotification(t('userManagement.userCreatedSuccess', { username: result.user.username }));
      }
      setIsUserModalOpen(false);
    }
  };

  const handleDeleteUser = async (userId) => {
    // Find the user's name before deleting
    const userToDelete = users.find(u => u.id === userId);
    const userName = userToDelete ? (userToDelete.username || `${userToDelete.firstName} ${userToDelete.lastName}`) : t('userManagement.selected');

    const confirmation = window.confirm(
      `${t('userManagement.confirmDeleteUser')} "${userName}"? ${t('userManagement.actionCannotBeUndone')}`
    );
    
    if (!confirmation) {
      return;
    }

    const success = await withErrorHandling(async () => {
      await deleteUser(userId);
      return true;
    }, {
      errorMessage: t('userManagement.unableToDeleteUser', { username: userName }),
      showError: true
    });

    if (success) {
      setUsers(users.filter(user => user.id !== userId));
      setIsUserModalOpen(false);
      showNotification(t('userManagement.userDeletedSuccess', { username: userName }));
    }
  };

  return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center' }}>
          <Typography variant="h6">{t('userManagement.title')}</Typography>
          <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleAddUser}
          >
            {t('userManagement.addUser')}
          </Button>
        </Box>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ mb: 3 }}>
          <TextField
              placeholder={t('userManagement.searchUsers')}
              variant="outlined"
              size="small"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ flexGrow: 1 }}
              InputProps={{
                startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                ),
              }}
          />

          <TextField
              select
              label={t('userManagement.role')}
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              size="small"
              sx={{ minWidth: 200 }}
              InputProps={{
                startAdornment: (
                    <InputAdornment position="start">
                      <FilterListIcon />
                    </InputAdornment>
                ),
              }}
          >
            <MenuItem value="">{t('userManagement.allRoles')}</MenuItem>
            
            <MenuItem value={SiteRoles.USER}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <PersonIcon color="primary" />
                <Typography>{t('userManagement.user')}</Typography>
              </Stack>
            </MenuItem>
            
            <MenuItem value={SiteRoles.SITE_ADMIN}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <SupervisorAccountIcon sx={{ color: '#f44336' }} />
                <Typography>{t('userManagement.siteAdministrator')}</Typography>
              </Stack>
            </MenuItem>
            
            {canManageGlobalAdmins && (
              <MenuItem value={SiteRoles.GLOBAL_ADMIN}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <SecurityIcon sx={{ color: 'gold' }} />
                  <Typography>{t('userManagement.globalAdministrator')}</Typography>
                </Stack>
              </MenuItem>
            )}
          </TextField>
        </Stack>

        {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
        ) : (
            <TableContainer component={Paper}>
              <Table sx={{ minWidth: 650 }} aria-label="user table">
                <TableHead>
                  <TableRow sx={{ backgroundColor: 'action.hover' }}>
                    <TableCell>Username</TableCell>
                    <TableCell>Email</TableCell>
                    <TableCell>Role</TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        <DiscFullIcon fontSize="small" color="action" />
                        Custom ISO
                      </Box>
                    </TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                        <Typography variant="body1" color="text.secondary">
                          {t('userManagement.noUsersFound')}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map((user) => (
                      <TableRow key={user.id} hover>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                            <Box sx={{ 
                              width: 32, height: 32, borderRadius: '50%', 
                              bgcolor: 'primary.main', color: 'white',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '0.875rem'
                            }}>
                              {user.firstName ? user.firstName.charAt(0) : (user.username ? user.username.charAt(0).toUpperCase() : 'U')}
                            </Box>
                            <Box>
                              <Typography variant="subtitle2">{user.username}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {user.firstName} {user.lastName}
                              </Typography>
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={1}>
                            {user.roles && user.roles.map((role) => {
                              // Filter out internal roles if needed, or show meaningful ones
                              if (role.includes('site_admin') || role === 'GLOBAL_ADMIN' || role === 'USER') {
                                return (
                                  <Chip 
                                    key={role} 
                                    label={role.replace('_', ' ')} 
                                    size="small" 
                                    color={role === 'GLOBAL_ADMIN' ? 'warning' : (role.includes('site_admin') ? 'error' : 'default')}
                                    variant="outlined"
                                  />
                                );
                              }
                              return null;
                            })}
                          </Stack>
                        </TableCell>
                        
                        {/* --- CUSTOM ISO SWITCH COLUMN --- */}
                        <TableCell align="center">
                          <Tooltip title={hasCustomIsoRole(user) ? "Revoke Custom ISO upload" : "Grant Custom ISO upload"}>
                            <Switch
                              checked={hasCustomIsoRole(user)}
                              onChange={(e) => handleIsoToggle(user, e.target.checked)}
                              color="primary"
                              size="small"
                            />
                          </Tooltip>
                        </TableCell>

                        <TableCell align="right">
                          <IconButton onClick={() => handleEditUser(user)} color="primary" size="small">
                            <EditIcon />
                          </IconButton>
                          <IconButton onClick={() => handleDeleteUser(user.id)} color="error" size="small">
                            <DeleteIcon />
                          </IconButton>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
        )}

        <UserForm
            open={isUserModalOpen}
            onClose={() => setIsUserModalOpen(false)}
            user={selectedUser}
            onSave={handleSaveUser}
            onDelete={handleDeleteUser}
        />

        {/* Notification for successful operations */}
        <Snackbar
          open={!!notification}
          autoHideDuration={6000}
          onClose={() => setNotification(null)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        >
          {notification && (
            <Alert
              onClose={() => setNotification(null)}
              severity={notification.severity}
              sx={{ width: '100%' }}
            >
              {notification.message}
            </Alert>
          )}
        </Snackbar>
      </Box>
  );
};

export default UserManagement;