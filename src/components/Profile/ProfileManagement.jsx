import React, { useContext, useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Paper,
  Stack,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
  Alert,
  Chip,
  Snackbar,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Tooltip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  ListItemIcon
} from '@mui/material';
import { 
  Edit as EditIcon, 
  Save as SaveIcon, 
  Cancel as CancelIcon, 
  Visibility as VisibilityIcon, 
  VisibilityOff as VisibilityOffIcon,
  ContentCopy as ContentCopyIcon,
  Key as KeyIcon,
  ExpandMore as ExpandMoreIcon,
  DeleteOutline as DeleteOutlineIcon,
  Security,
  SupervisorAccount,
  Person,
  Add as AddIcon
} from '@mui/icons-material';
import { AuthContext } from '../../context/AuthContext';
import { 
    updateProfile, 
    getSshKeys, 
    addSshKey, 
    deleteSshKey,
    updateSshKey // Assicurati di aver aggiunto questa funzione in userService.js!
} from '../../services/userService';
import useApiError from '../../hooks/useApiError';
import { SiteRoles } from '../../services/siteService';

const ProfileManagement = () => {
  const { t } = useTranslation();
  const { currentUser, setCurrentUser, loading, getUserHighestRole } = useContext(AuthContext);
  const { withErrorHandling } = useApiError();
  const [isEditing, setIsEditing] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [notification, setNotification] = useState(null);
  const [passwordError, setPasswordError] = useState('');

  // --- STATO WALLET ---
  const [walletKeys, setWalletKeys] = useState([]);
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [newKeyContent, setNewKeyContent] = useState('');
  const [loadingKeys, setLoadingKeys] = useState(false);
  const [isSubmittingKey, setIsSubmittingKey] = useState(false);

  // --- STATO EDIT KEY ---
  const [editingKeyId, setEditingKeyId] = useState(null); // ID della chiave in modifica

  // Translations helpers aggiornato
  const profileTranslations = {
    userIdCopied: t('profile.userIdCopied'),
    copyUserId: t('profile.copyUserId'),
    walletTitle: t('profile.walletTitle'),
    noKeys: t('profile.noKeysFound'),
    addKey: t('profile.addUpdateKey')
  }

  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    password: '',
    confirmPassword: ''
  });
  const [sshKeyExpanded, setSshKeyExpanded] = useState(false);

  // Load user profile data
  useEffect(() => {
    if (currentUser) {
      setProfileData({
        firstName: currentUser.firstName || '',
        lastName: currentUser.lastName || '',
        email: currentUser.email || '',
        username: currentUser.username || currentUser.name || '',
        password: '',
        confirmPassword: ''
      });
    }
  }, [currentUser]);

  // --- LOAD WALLET KEYS ---
  useEffect(() => {
    if (sshKeyExpanded && currentUser) {
        fetchWalletKeys();
    }
  }, [sshKeyExpanded, currentUser]);

  const fetchWalletKeys = async () => {
    setLoadingKeys(true);
    try {
        await withErrorHandling(async () => {
            const keys = await getSshKeys();
            if(keys) setWalletKeys(keys);
        }, { showError: false });
    } finally {
        setLoadingKeys(false);
    }
  };

  // Get user highest role
  const userHighestRole = currentUser ? getUserHighestRole() : SiteRoles.USER;

  // Get role info based on role
  const getRoleInfo = (role) => {
    switch (role) {
      case SiteRoles.GLOBAL_ADMIN:
        return { 
          color: 'gold', 
          label: t('userManagement.globalAdministrator'),
          icon: <Security fontSize="small" />
        };
      case SiteRoles.SITE_ADMIN:
        return { 
          color: '#f44336', 
          label: t('userManagement.siteAdministrator'),
          icon: <SupervisorAccount fontSize="small" />
        };
      default:
        return { 
          color: 'primary.main', 
          label: t('userManagement.user'),
          icon: <Person fontSize="small" />
        };
    }
  };

  const roleInfo = getRoleInfo(userHighestRole);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfileData({
      ...profileData,
      [name]: value
    });
    
    if ((name === 'password' || name === 'confirmPassword') && passwordError) {
      setPasswordError('');
    }
  };

  const handleToggleEdit = () => {
    if (isEditing) {
      // Reset form if cancelling edit
      if (currentUser) {
        setProfileData({
          firstName: currentUser.firstName || '',
          lastName: currentUser.lastName || '',
          email: currentUser.email || '',
          username: currentUser.username || currentUser.name || '',
          password: '',
          confirmPassword: ''
        });
      }
      setPasswordError(''); 
    }
    setIsEditing(!isEditing);
  };

  const showNotification = (message, severity = 'success') => {
    setNotification({ message, severity });
    setTimeout(() => {
      setNotification(null);
    }, 6000);
  };

  // --- WALLET ACTIONS (Add/Update/Delete) ---

  const handleEditClick = (key) => {
    setEditingKeyId(key.id);
    setNewKeyLabel(key.label);
    setNewKeyContent(key.sshPublicKey);
    // Scroll to form (optional, for better UX)
    const formElement = document.getElementById('ssh-key-form');
    if(formElement) formElement.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCancelKeyEdit = () => {
    setEditingKeyId(null);
    setNewKeyLabel('');
    setNewKeyContent('');
  };

  const handleKeySubmit = async () => {
      if (!newKeyLabel || !newKeyContent) return;

      // Basic Validation
      if (!newKeyContent.startsWith('ssh-') && !newKeyContent.startsWith('ecdsa-') && !newKeyContent.startsWith('sk-')) {
          showNotification(t('profile.invalidKeyFormat'), 'error');
          return;
      }

      setIsSubmittingKey(true);
      try {
          await withErrorHandling(async () => {
              if (editingKeyId) {
                  // UPDATE
                  const updatedKey = await updateSshKey(editingKeyId, {
                      label: newKeyLabel,
                      sshPublicKey: newKeyContent
                  });
                  setWalletKeys(walletKeys.map(k => k.id === editingKeyId ? updatedKey : k));
                  showNotification(t('profile.sshKeyUpdated'));
              } else {
                  // CREATE
                  const addedKey = await addSshKey(newKeyLabel, newKeyContent);
                  setWalletKeys([...walletKeys, addedKey]);
                  showNotification(t('profile.sshKeyAdded'));
              }
              // Reset form
              handleCancelKeyEdit();
          }, { errorMessage: t('profile.sshKeySaveError') });
      } finally {
          setIsSubmittingKey(false);
      }
    };

    const handleDeleteKey = async (id) => {
      if (!window.confirm(t('profile.confirmDeleteSshKey'))) return;

      try {
          await withErrorHandling(async () => {
              await deleteSshKey(id);
              setWalletKeys(walletKeys.filter(k => k.id !== id));
              
              // If deleting the key currently being edited, reset form
              if (editingKeyId === id) {
                  handleCancelKeyEdit();
              }
              
              showNotification(t('profile.sshKeyDeleted'));
          }, { errorMessage: t('profile.sshKeyDeleteError') });
      } catch (e) {
          console.error(e);
      }
    };
  
  // --- PROFILE UPDATE ---
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (profileData.password && profileData.password !== profileData.confirmPassword) {
      setPasswordError(t('profile.passwordsDoNotMatch'));
      return;
    }
    
    setIsSaving(true);

    try {
      const updatedData = {
        firstName: profileData.firstName,
        lastName: profileData.lastName,
        email: profileData.email
      };

      if (profileData.password) {
        updatedData.password = profileData.password;
      }

      const user = await withErrorHandling(async () => {
        return await updateProfile(updatedData);
      }, {
        errorMessage: t('profile.unableToUpdateProfile'),
        showError: true
      });
      
      if(user && user.id) {
        const updatedUser = {
          ...currentUser,
          firstName: profileData.firstName,
          lastName: profileData.lastName,
          email: profileData.email,
          ...user
        };
        
        showNotification(t('profile.profileUpdatedSuccess'));
        setIsEditing(false);
        setCurrentUser(updatedUser);
        
        setProfileData({
          ...profileData,
          password: '', 
          confirmPassword: '' 
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 5 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!currentUser) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography variant="h6" color="error">
          {t('profile.userNotAuthenticated')}
        </Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Paper elevation={2} sx={{ p: 3 }}>
        <Box sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          mb: 3 
        }}>
          <Typography variant="h5">{t('profile.title')}</Typography>
          <Button
            variant={isEditing ? "outlined" : "contained"}
            color={isEditing ? "error" : "primary"}
            startIcon={isEditing ? <CancelIcon /> : <EditIcon />}
            onClick={handleToggleEdit}
            disabled={isSaving}
          >
            {isEditing ? t('profile.cancel') : t('profile.editProfile')}
          </Button>
        </Box>

        <form onSubmit={handleSubmit}>
          <Stack 
            direction={{ xs: 'column', md: 'row' }} 
            spacing={3}
            alignItems="flex-start"
          >
            {/* Left Column: Avatar and User Details */}
            <Box 
              sx={{ 
                width: { xs: '100%', md: '30%' }, 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'center' 
              }}
            >
              <Avatar
                sx={{
                  width: 120,
                  height: 120,
                  fontSize: '3rem',
                  mb: 2,
                  bgcolor: roleInfo.color,
                  border: userHighestRole === SiteRoles.GLOBAL_ADMIN ? '2px solid white' : 'none'
                }}
              >
                {currentUser.avatar || 'U'}
              </Avatar>

              <Card sx={{ width: '100%', mt: 2 }}>
                <CardContent>
                  <Stack direction="column" spacing={2} sx={{ width: '100%' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Typography variant="subtitle2" color="text.secondary">
                        {t('profile.role')}
                      </Typography>
                      <Chip
                        icon={roleInfo.icon}
                        label={roleInfo.label}
                        sx={{
                          color: roleInfo.color,
                          fontWeight: 'bold',
                          border: `1px solid ${roleInfo.color}`
                        }}
                        size="small"
                      />
                    </Box>
                    <Box sx={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      backgroundColor: 'action.hover',
                      borderRadius: 1,
                      p: 1
                    }}>
                      <Box>
                        <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.5 }}>
                          {t('profile.userId')}
                        </Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>
                          {currentUser.keycloakId || currentUser.id}
                        </Typography>
                      </Box>
                      <IconButton
                        size="small"
                        onClick={() => {
                          navigator.clipboard.writeText((currentUser.keycloakId || currentUser.id).toString());
                          showNotification(profileTranslations.userIdCopied, 'info');
                        }}
                        title={profileTranslations.copyUserId}
                      >
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Box>
                    <Box>
                      <Typography variant="subtitle2" color="text.secondary">
                        {t('profile.username')}
                      </Typography>
                      <Typography variant="body1">
                        {currentUser.username || currentUser.name || ''}
                      </Typography>
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Box>

            {/* Right Column: Editable Profile Fields */}
            <Box sx={{ flexGrow: 1, width: { xs: '100%', md: '70%' } }}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                  <TextField
                    label={t('profile.firstName')}
                    name="firstName"
                    value={profileData.firstName}
                    onChange={handleChange}
                    fullWidth
                    disabled={!isEditing}
                    required={isEditing}
                    margin="normal"
                  />
                  <TextField
                    label={t('profile.lastName')}
                    name="lastName"
                    value={profileData.lastName}
                    onChange={handleChange}
                    fullWidth
                    disabled={!isEditing}
                    required={isEditing}
                    margin="normal"
                  />
                </Stack>
                
                <TextField
                  label={t('profile.email')}
                  name="email"
                  type="email"
                  value={profileData.email}
                  onChange={handleChange}
                  fullWidth
                  disabled={!isEditing}
                  required={isEditing}
                  margin="normal"
                />
                
                {isEditing && (
                  <>
                    <TextField
                      label={t('profile.newPassword')}
                      name="password"
                      type={showPassword ? "text" : "password"}
                      value={profileData.password}
                      onChange={handleChange}
                      fullWidth
                      margin="normal"
                      error={!!passwordError}
                      helperText={passwordError}
                      InputProps={{
                        endAdornment: (
                          <InputAdornment position="end">
                            <IconButton
                              onClick={() => setShowPassword(!showPassword)}
                              edge="end"
                            >
                              {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                            </IconButton>
                          </InputAdornment>
                        )
                      }}
                    />
                    
                    {profileData.password && (
                      <TextField
                        label={t('profile.confirmPassword')}
                        name="confirmPassword"
                        type={showConfirmPassword ? "text" : "password"}
                        value={profileData.confirmPassword}
                        onChange={handleChange}
                        fullWidth
                        margin="normal"
                        error={!!passwordError}
                        helperText={passwordError && !profileData.password ? '' : passwordError}
                        InputProps={{
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                edge="end"
                              >
                                {showConfirmPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                              </IconButton>
                            </InputAdornment>
                          )
                        }}
                      />
                    )}
                  </>
                )}

                {/* SSH Key Management Section */}
                <Accordion 
                  expanded={sshKeyExpanded} 
                  onChange={() => setSshKeyExpanded(!sshKeyExpanded)}
                  sx={{ mt: 2, bgcolor: 'background.paper' }}
                >
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="ssh-key-content"
                    id="ssh-key-header"
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center' }}>
                      <KeyIcon sx={{ mr: 1, color: 'text.secondary' }} />
                      <Typography variant="subtitle1">{t('profile.sshKeyManagement')}</Typography>
                    </Box>
                  </AccordionSummary>
                  <AccordionDetails>
                    {/* --- Key Wallet (SERVER Storage) --- */}
                    <Box sx={{ mt: 1 }}>
                      <Typography variant="subtitle2" color="primary" sx={{ mb: 2 }}>
                        {profileTranslations.walletTitle}
                      </Typography>
                      
                      {/* Loading State for Wallet */}
                      {loadingKeys && (
                         <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}><CircularProgress size={20}/></Box>
                      )}

                      {/* List of saved keys */}
                      {!loadingKeys && walletKeys.length > 0 ? (
                        <List dense sx={{ bgcolor: 'action.hover', borderRadius: 1, mb: 2 }}>
                          {walletKeys.map((key) => (
                            <ListItem key={key.id} divider>
                              <ListItemIcon>
                                <KeyIcon fontSize="small" sx={{ color: key.label === 'Default' ? 'gray' : 'primary.main' }} />
                              </ListItemIcon>
                              <ListItemText 
                                primary={
                                  <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
                                    {key.label}
                                    {key.label === 'Default' && <Chip label="Legacy" size="small" sx={{ ml: 1, height: 16, fontSize: '0.6rem' }} />}
                                  </Box>
                                } 
                                secondary={key.sshPublicKey ? key.sshPublicKey.substring(0, 40) + '...' : '...'} 
                                secondaryTypographyProps={{ style: { fontFamily: 'monospace', fontSize: '0.8rem' } }}
                              />
                              <ListItemSecondaryAction>
                                <Tooltip title="Edit">
                                    <IconButton edge="end" onClick={() => handleEditClick(key)} sx={{ mr: 1 }}>
                                        <EditIcon fontSize="small" />
                                    </IconButton>
                                </Tooltip>
                                <Tooltip title={t('common.delete') || "Delete"}>
                                  <IconButton edge="end" onClick={() => handleDeleteKey(key.id)} color="error">
                                    <DeleteOutlineIcon fontSize="small" />
                                  </IconButton>
                                </Tooltip>
                              </ListItemSecondaryAction>
                            </ListItem>
                          ))}
                        </List>
                      ) : (
                        !loadingKeys && (
                            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                              {profileTranslations.noKeys}
                            </Typography>
                        )
                      )}

                      {/* Add/Edit Key Form Aggiornato con traduzioni */}
                      <Box id="ssh-key-form" sx={{ display: 'flex', gap: 2, flexDirection: 'column', mt: 2, p: 2, border: '1px dashed #ccc', borderRadius: 1, bgcolor: editingKeyId ? '#f0f7ff' : 'transparent' }}>
                        <Typography variant="caption" fontWeight="bold" color={editingKeyId ? "primary" : "textPrimary"}>
                            {editingKeyId ? t('profile.editingKey') : profileTranslations.addKey}
                        </Typography>
                        <TextField 
                          label={t('profile.keyLabelPlaceholder')}
                          size="small"
                          value={newKeyLabel}
                          onChange={(e) => setNewKeyLabel(e.target.value)}
                        />
                        <TextField 
                          label={t('profile.sshPublicKey')}
                          size="small"
                          multiline
                          rows={2}
                          value={newKeyContent}
                          onChange={(e) => setNewKeyContent(e.target.value)}
                          placeholder="ssh-rsa AAAA..."
                          sx={{ fontFamily: 'monospace' }}
                        />
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                            {editingKeyId && (
                                <Button 
                                    variant="outlined" 
                                    size="small" 
                                    startIcon={<CancelIcon />}
                                    onClick={handleCancelKeyEdit}
                                >
                                    {t('common.cancel')}
                                </Button>
                            )}
                            <Button 
                              variant="contained" 
                              size="small"
                              color={editingKeyId ? "primary" : "secondary"}
                              startIcon={isSubmittingKey ? <CircularProgress size={20} color="inherit"/> : (editingKeyId ? <SaveIcon /> : <AddIcon />)} 
                              onClick={handleKeySubmit}
                              disabled={!newKeyLabel || !newKeyContent || isSubmittingKey}
                            >
                              {editingKeyId ? t('profile.updateKey') : t('profile.addToWallet')}
                            </Button>
                        </Box>
                      </Box>
                    </Box>
                  </AccordionDetails>
                </Accordion>

                {isEditing && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
                    <Button
                      type="submit"
                      variant="contained"
                      color="primary"
                      startIcon={isSaving ? <CircularProgress size={20} color="inherit" /> : <SaveIcon />}
                      disabled={isSaving}
                    >
                      {isSaving ? t('profile.saving') : t('profile.saveChanges')}
                    </Button>
                  </Box>
                )}
              </Stack>
            </Box>
          </Stack>
        </form>
      </Paper>
      
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

export default ProfileManagement;