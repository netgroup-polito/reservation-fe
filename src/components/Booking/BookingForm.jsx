import React, { useContext, useEffect, useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  TextField,
  Typography,
  Divider,
  Alert,
  CircularProgress,
  Paper,
  Chip,
  Link,
  Tabs,           
  Tab, 
  FormControlLabel, 
  Checkbox,
  Stack,
  IconButton,
  Tooltip,
  ListSubheader
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { fetchUsers, getSshKeys } from '../../services/userService';
import { fetchResourceTypes } from '../../services/resourceTypeService';
import { fetchActiveIsos, fetchUserFavorites, deleteUserFavorite } from '../../services/isoService'; 
import { formatDateForInput, formatDate } from '../../utils/dateUtils';
import { AuthContext } from '../../context/AuthContext';
import useApiError from '../../hooks/useApiError';
import { checkEventConflicts } from '../../services/bookingService';
import { ResourceStatus } from '../../services/resourceService';
import DeleteIcon from '@mui/icons-material/Delete';

// --- UTILITY: SANIFICAZIONE URL (NUOVA) ---
const sanitizeAndValidateUrl = (url) => {
  if (!url) return { valid: false, clean: '' };
  let clean = url.trim();
  // Rimuovi caratteri pericolosi base
  clean = clean.replace(/[<>"';]/g, '');
  // Protocollo obbligatorio
  if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      return { valid: false, clean };
  }
  // Check struttura URL
  try {
      new URL(clean);
      return { valid: true, clean };
  } catch (e) {
      return { valid: false, clean };
  }
};

const BookingForm = ({ open, onClose, booking, onSave, onDelete, resources }) => {
  const { t } = useTranslation();
  const { currentUser, isSiteAdmin } = useContext(AuthContext);
  const { withErrorHandling, notifyFormError } = useApiError();
  const navigate = useNavigate();
  
  // --- FORM STATE ---
  const [formData, setFormData] = useState({
    title: '',
    resourceId: '',
    start: null,
    end: null,
    description: '',
    userId: '',
    customParameters: '',
    // operatingSystem: rimosso dallo state diretto, gestito dai nuovi stati sotto
  });

  // --- NEW OS SELECTION STATE ---
  const [osSelectionType, setOsSelectionType] = useState('STANDARD'); // STANDARD, FAVORITE, CUSTOM
  const [selectedIsoId, setSelectedIsoId] = useState('');
  const [selectedFavoriteId, setSelectedFavoriteId] = useState('');
  const [customImageUrl, setCustomImageUrl] = useState('');
  const [customChecksumUrl, setCustomChecksumUrl] = useState('');
  const [saveAsFavorite, setSaveAsFavorite] = useState(false);
  const [favoriteAlias, setFavoriteAlias] = useState('');

  // --- DATA LISTS ---
  const [users, setUsers] = useState([]);
  const [resourceTypes, setResourceTypes] = useState([]);
  const [isoImages, setIsoImages] = useState([]); 
  const [userFavorites, setUserFavorites] = useState([]); // NUOVO

  const [customParameterValues, setCustomParameterValues] = useState({});
  const [errors, setErrors] = useState({});
  const [useCurrentUser, setUseCurrentUser] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [validationMessage, setValidationMessage] = useState(null);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [affectedResources, setAffectedResources] = useState([]);

  // --- SSH KEYS STATE ---
  const [walletKeys, setWalletKeys] = useState([]); 
  const [loadingKeys, setLoadingKeys] = useState(false);

 const activeResources = resources
    .filter(resource => resource.status === ResourceStatus.ACTIVE)
    .sort((a, b) => {
      // 1. Ordine alfabetico per Tipo (es. "Server" prima di "Switch")
      const typeA = resourceTypes.find(t => t.id === a.typeId)?.name || '';
      const typeB = resourceTypes.find(t => t.id === b.typeId)?.name || '';
      const typeDiff = typeA.localeCompare(typeB);
      
      if (typeDiff !== 0) return typeDiff;

      // 2. Ordine alfabetico per Nome della risorsa (a parità di Tipo)
      const nameA = a.name || '';
      const nameB = b.name || '';
      return nameA.localeCompare(nameB);
    });

  // --- LOGIC: IS IT A SERVER? ---
  const isServerResource = useMemo(() => {
    if (!formData.resourceId) return false;
    const selectedResource = resources.find(r => r.id === formData.resourceId);
    if (!selectedResource) return false;
    const type = resourceTypes.find(rt => rt.id === selectedResource.typeId);
    return type?.name?.toLowerCase() === 'server';
  }, [formData.resourceId, resources, resourceTypes]);

  // --- CHECK PERMISSIONS ---
  const canUseCustomIso = () => {
    if (!currentUser) return false;
    if (isSiteAdmin && isSiteAdmin()) return true;
    const roles = currentUser.roles || [];
    return roles.includes('custom-iso-uploader') || roles.includes('CUSTOM-ISO-UPLOADER');
  };

  // --- LOAD DATA (ISOs & Favorites) ---
  useEffect(() => {
    if (open) {
      const loadData = async () => {
        try {
          // 1. Carica ISO Ufficiali
          const isos = await fetchActiveIsos();
          setIsoImages(isos);

          // 2. Carica Preferiti Utente (se loggato)
          if (currentUser) {
             try {
                 // Nota: Assumo che fetchUserFavorites esista nel service, se non c'è ritorna array vuoto
                 const favs = await fetchUserFavorites(currentUser.id);
                 setUserFavorites(favs || []);
             } catch (e) {
                 console.warn("Could not fetch favorites (feature might be disabled)", e);
                 setUserFavorites([]);
             }
          }
        } catch (e) {
          console.error("Failed to load ISO data", e);
        }
      };
      loadData();
    }
  }, [open, currentUser]);

  // --- LOAD WALLET KEYS ---
  useEffect(() => {
    if (open && currentUser && !isReadOnly) {
      const loadKeys = async () => {
        setLoadingKeys(true);
        try {
          const keys = await getSshKeys(); 
          if (Array.isArray(keys)) {
            setWalletKeys(keys);
          }
        } catch (e) {
          console.error("Failed to load SSH keys", e);
        } finally {
          setLoadingKeys(false);
        }
      };
      loadKeys();
    }
  }, [open, currentUser, isReadOnly]);

  // Load users (admin only)
  useEffect(() => {
    const loadUsers = async () => {
      if (isSiteAdmin()) {
        await withErrorHandling(async () => {
          const usersData = await fetchUsers();
          setUsers(usersData);
        }, { errorMessage: t('errors.unableToLoadUserList'), showError: true });
      }
    };
    loadUsers();
  }, [isSiteAdmin, withErrorHandling, t]);

  // Load resource types
  useEffect(() => {
    const loadResourceTypes = async () => {
      await withErrorHandling(async () => {
        const resourceTypesData = await fetchResourceTypes();
        setResourceTypes(resourceTypesData);
      }, { errorMessage: t('errors.unableToLoadResourceTypes'), showError: true });
    };
    loadResourceTypes();
  }, [withErrorHandling, t]);

  // --- POPULATE FORM ---
  useEffect(() => {
    if (booking) {
      const isOwnBooking = booking.userId === currentUser?.id;
      const canEdit = isOwnBooking || isSiteAdmin();
      setIsReadOnly(!canEdit);
      
      const bookingForOtherUser = isSiteAdmin() && booking.userId && booking.userId !== currentUser?.id;
      setUseCurrentUser(!bookingForOtherUser);
      
      // Base Form Data
      setFormData({
        id: booking.id,
        title: booking.title || '',
        resourceId: booking.resourceId || '',
        start: booking.start,
        end: booking.end,
        description: booking.description || '',
        userId: booking.userId || currentUser?.id || '',
        customParameters: booking.customParameters || '',
        operatingSystem: booking.operatingSystem || '' // Legacy field for display only
      });

      // --- NEW OS LOGIC POPULATION ---
      // Cerchiamo di capire che tipo di OS era selezionato
      if (booking.osSelectionType) {
          // Se è una prenotazione nuova con i nuovi campi
          setOsSelectionType(booking.osSelectionType);
          setSelectedIsoId(booking.selectedIsoId || '');
          setSelectedFavoriteId(booking.selectedFavoriteId || '');
          setCustomImageUrl(booking.imageUrl || ''); 
          setCustomChecksumUrl(booking.checksumUrl || '');
      } else {
          // Retro-compatibilità: proviamo a indovinare dal vecchio campo operatingSystem
          const currentOs = booking.operatingSystem;
          const knownIso = isoImages.find(i => i.displayName === currentOs || i.name === currentOs);
          
          if (knownIso) {
              setOsSelectionType('STANDARD');
              setSelectedIsoId(knownIso.id);
          } else if (currentOs && (currentOs.startsWith('http') || booking.imageUrl)) {
              setOsSelectionType('CUSTOM');
              setCustomImageUrl(booking.imageUrl || currentOs);
              setCustomChecksumUrl(booking.checksumUrl || '');
          } else {
              setOsSelectionType('STANDARD');
              setSelectedIsoId('');
          }
      }
      // Reset campi salvataggio preferito
      setSaveAsFavorite(false);
      setFavoriteAlias('');

      // Custom Params
      if (booking.customParameters) {
        try {
          const customParams = JSON.parse(booking.customParameters);
          if (typeof customParams === 'object' && customParams !== null) {
            setCustomParameterValues(customParams);
          }
        } catch (e) {
          console.error('Error parsing custom parameters:', e);
          setCustomParameterValues({});
        }
      } else {
        setCustomParameterValues({});
      }
    } else {
      resetForm();
    }
  }, [booking, currentUser, isSiteAdmin, isoImages]);

  // Update affected resources
  useEffect(() => {
    if (formData.resourceId) {
      const selectedResource = resources.find(r => r.id === formData.resourceId);
      if (!selectedResource) {
        setAffectedResources([]);
        return;
      }
      if (selectedResource.subResourceIds && selectedResource.subResourceIds.length > 0) {
        const childResources = resources.filter(r => selectedResource.subResourceIds.includes(r.id));
        setAffectedResources(childResources);
      } 
      else if (selectedResource.parentId) {
        const parentResource = resources.find(r => r.id === selectedResource.parentId);
        if (parentResource) {
          const siblingResources = resources.filter(r => r.id !== selectedResource.id && r.parentId === parentResource.id);
          setAffectedResources([parentResource, ...siblingResources]);
        } else {
          setAffectedResources([]);
        }
      } else {
        setAffectedResources([]);
      }
    } else {
      setAffectedResources([]);
    }
  }, [formData.resourceId, resources]);

  const resetForm = () => {
    const now = new Date();
    const startTime = new Date(now.getTime() + 5 * 60 * 1000); 
    
    setFormData({
      title: '',
      resourceId: '',
      operatingSystem: '',
      start: startTime,
      end: new Date(startTime.getTime() + 60 * 60 * 1000),
      description: '',
      userId: currentUser?.id || '',
      customParameters: '',
    });
    
    // Reset New State
    setOsSelectionType('STANDARD');
    setSelectedIsoId('');
    setSelectedFavoriteId('');
    setCustomImageUrl('');
    setCustomChecksumUrl('');
    setSaveAsFavorite(false);
    setFavoriteAlias('');

    setUseCurrentUser(true);
    setCustomParameterValues({});
    setErrors({});
    setValidationMessage(null);
    setIsReadOnly(false);
    setAffectedResources([]);
  };

  const getResourceCustomParameters = () => {
    if (!formData.resourceId) return [];
    const selectedResource = resources.find(r => r.id === formData.resourceId);
    if (!selectedResource || !selectedResource.typeId) return [];
    const resourceType = resourceTypes.find(rt => rt.id === selectedResource.typeId);
    if (!resourceType || !resourceType.customParameters) return [];
    try {
      return JSON.parse(resourceType.customParameters);
    } catch (e) {
      console.error('Error parsing custom parameters:', e);
      return [];
    }
  };

  const handleCustomParameterChange = (parameterLabel, value) => {
    if (isReadOnly || isSubmitting) return;
    setCustomParameterValues({ ...customParameterValues, [parameterLabel]: value });
    if (errors[`customParam_${parameterLabel}`]) {
      setErrors({ ...errors, [`customParam_${parameterLabel}`]: undefined });
    }
  };

  const handleChange = (e) => {
    if (isReadOnly || isSubmitting) return;
    const { name, value } = e.target;
    // Nota: 'operatingSystem' non viene più gestito qui direttamente per l'input, ma dalla funzione renderOsSelection
    setFormData({ ...formData, [name]: value });
    if (name === 'resourceId') { 
        setCustomParameterValues({}); 
    }
    if (errors[name]) { setErrors({ ...errors, [name]: undefined }); }
    setValidationMessage(null);
  };

  const handleDateChange = (e) => {
    if (isReadOnly || isSubmitting) return;
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: new Date(value) });
    setValidationMessage(null);
  };

  const handleUserSelectionChange = (useCurrentUserValue) => {
    if (isReadOnly || isSubmitting) return;
    setUseCurrentUser(useCurrentUserValue);
    if (useCurrentUserValue) {
      setFormData({ ...formData, userId: currentUser?.id || '' });
    } else {
      setFormData({ ...formData, userId: formData.userId !== currentUser?.id ? formData.userId : '' });
    }
    setValidationMessage(null);
  };

  const handleDeleteFavorite = async () => {
    if (!selectedFavoriteId) return;

    if (window.confirm("Sei sicuro di voler eliminare questo preferito?")) {
      await withErrorHandling(async () => {
        await deleteUserFavorite(selectedFavoriteId);
        // Aggiorna la lista locale rimuovendo l'id
        setUserFavorites(prev => prev.filter(f => f.id !== selectedFavoriteId));
        // Resetta la selezione
        setSelectedFavoriteId('');
      }, { errorMessage: "Errore durante la cancellazione", showError: true });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.title) newErrors.title = t('bookingForm.titleRequired');
    
    // --- VALIDAZIONE OS CONDIZIONALE (NUOVA) ---
    if (isServerResource) {
        if (osSelectionType === 'STANDARD') {
            if (!selectedIsoId) newErrors.osSelection = "Please select an Operating System";
        } else if (osSelectionType === 'FAVORITE') {
            if (!selectedFavoriteId) newErrors.osSelection = "Please select a Favorite Image";
        } else if (osSelectionType === 'CUSTOM') {
            const urlCheck = sanitizeAndValidateUrl(customImageUrl);
            if (!urlCheck.valid) newErrors.customImageUrl = "Invalid Image URL (must be http/https)";
            
            if (customChecksumUrl) {
                const chkCheck = sanitizeAndValidateUrl(customChecksumUrl);
                if (!chkCheck.valid) newErrors.customChecksumUrl = "Invalid Checksum URL";
            }
            if (saveAsFavorite && !favoriteAlias.trim()) {
                newErrors.favoriteAlias = "Alias is required to save favorite";
            }
        }
    }

    if (!formData.resourceId) newErrors.resourceId = t('bookingForm.resourceRequired');
    if (!formData.start) newErrors.start = t('bookingForm.startDateRequired');
    if (!formData.end) {
      newErrors.end = t('bookingForm.endDateRequired');
    } else if (formData.end <= formData.start) {
      newErrors.end = t('bookingForm.endDateAfterStart');
    }
    if (!formData.userId) newErrors.userId = t('bookingForm.userRequired');

    const customParams = getResourceCustomParameters();
    customParams.forEach(param => {
      if (param.required) {
        const value = customParameterValues[param.label];
        if (!value || value.trim() === '') {
          newErrors[`customParam_${param.label}`] = t('bookingForm.customParameterRequired', { label: param.label });
        }
      }
    });
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkConflicts = async () => {
    if(!validateForm()) return;
    if (!formData.resourceId || !formData.start || !formData.end) return false;
    setIsChecking(true);
    try {
      const result = await withErrorHandling(async () => {
        return await checkEventConflicts(formData.resourceId, formData.start, formData.end, formData.id);
      }, { errorMessage: t('bookingForm.unableToCheckAvailability'), showError: true, rethrowError: true });
      if (result) {
        if (result.data === false) {
          setValidationMessage({ type: 'error', text: result.message || t('bookingForm.resourceUnavailable') });
          return false;
        } else if (result.success === false) {
          setValidationMessage({ type: 'error', text: result.message || t('bookingForm.checkConflictsError') });
          return false;
        } else {
          setValidationMessage({ type: 'success', text: t('bookingForm.resourceAvailable') });
          return true;
        }
      }
      return false;
    } catch (error) {
      console.error('Error checking conflicts:', error);
      return false;
    } finally {
      setIsChecking(false);
    }
  };

  const handleSubmit = async () => {
    if (useCurrentUser && currentUser) { formData.userId = currentUser.id; }
    if (validateForm()) {
      setIsSubmitting(true);
      setValidationMessage(null);
      try {
        if (!validationMessage || validationMessage.type !== 'success') {
          const noConflicts = await checkConflicts();
          if (!noConflicts) {
            if (!window.confirm(t('bookingForm.confirmConflictContinue'))) {
              setIsSubmitting(false);
              return; 
            }
          }
        }

        const customParams = getResourceCustomParameters();
        let customParametersJson = '';
        const filledParams = {};
        if (customParams.length > 0) {
          customParams.forEach(param => {
            const value = customParameterValues[param.label];
            if (value && value.trim() !== '') filledParams[param.label] = value.trim();
          });
        }
        if (Object.keys(filledParams).length > 0) customParametersJson = JSON.stringify(filledParams);

        // --- PREPARAZIONE PAYLOAD (AGGIORNATA) ---
        // Sanifica URL
        const cleanImageUrl = sanitizeAndValidateUrl(customImageUrl).clean;
        const cleanChecksumUrl = sanitizeAndValidateUrl(customChecksumUrl).clean;

        const dataToSave = {
          ...formData,
          customParameters: customParametersJson,
          
          // NUOVI CAMPI PROVISIONING
          osSelectionType: isServerResource ? osSelectionType : null,
          
          selectedIsoId: (isServerResource && osSelectionType === 'STANDARD') ? selectedIsoId : null,
          selectedFavoriteId: (isServerResource && osSelectionType === 'FAVORITE') ? selectedFavoriteId : null,
          
          customImageUrl: (isServerResource && osSelectionType === 'CUSTOM') ? cleanImageUrl : null,
          customChecksumUrl: (isServerResource && osSelectionType === 'CUSTOM') ? cleanChecksumUrl : null,
          customChecksumType: 'sha256', 
          
          saveAsFavorite: (isServerResource && osSelectionType === 'CUSTOM') ? saveAsFavorite : false,
          favoriteAlias: (isServerResource && osSelectionType === 'CUSTOM') ? favoriteAlias : null
        };
        
        // Rimuoviamo il vecchio campo operatingSystem per non creare confusione (o lo lasciamo a null)
        delete dataToSave.operatingSystem;
        
        await onSave(dataToSave);
      } catch (error) {
        console.error("Error during save:", error);
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const errorFields = Object.keys(errors).map(field => t(`bookingForm.${field}`) || field);
      if (errorFields.length > 0) notifyFormError(`${t('bookingForm.correctErrorFields')} ${errorFields.join(', ')}`);
    }
  };

  const handleDeleteClick = async () => {
    if (formData.id) {
      setIsSubmitting(true);
      try { await onDelete(formData.id); } 
      catch (error) { console.error("Error during delete:", error); } 
      finally { setIsSubmitting(false); }
    }
  };

  const getResourceName = (resourceId) => {
    const resource = resources.find(r => r.id === resourceId);
    return resource ? resource.name : t('bookingForm.unknownResource');
  };

  const getUserName = (userId) => {
    if (userId === currentUser?.id) return `${currentUser.firstName} ${currentUser.lastName}` || currentUser.username || t('bookingForm.you');
    const user = users.find(u => u.id === userId);
    if (user) return (user.firstName && user.lastName) ? `${user.firstName} ${user.lastName}` : (user.username || user.name || t('userManagement.user'));
    return t('bookingForm.unknownUser');
  };

  const renderAffectedResources = () => {
    if (affectedResources.length === 0) return null;
    const selectedResource = resources.find(r => r.id === formData.resourceId);
    if (!selectedResource) return null;
    const isParent = selectedResource.subResourceIds && selectedResource.subResourceIds.length > 0;
    return (
      <Paper elevation={0} variant="outlined" sx={{ p: 2, mt: 2, mb: 1, bgcolor: 'background.paper' }}>
        <Typography variant="subtitle1" color="primary" gutterBottom fontWeight="bold" sx={{ display: 'flex', alignItems: 'center' }}>
          <Box component="span" sx={{ mr: 1 }}>⚠️</Box>
          {isParent ? t('bookingForm.parentResourceExplanation') : t('bookingForm.childResourceExplanation')}
        </Typography>
        <Divider sx={{ my: 1 }} />
        <Typography variant="body2" gutterBottom>
          {isParent ? t('bookingForm.parentResourceDetail') : t('bookingForm.childResourceDetail')}
        </Typography>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, mt: 1, pl: 2 }}>
          {!isParent && selectedResource.parentId && (
            <Box sx={{ mb: 1 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>📂 {t('bookingForm.parentResourceLabel')}: <Chip label={affectedResources.find(r => r.id === selectedResource.parentId)?.name} size="small" color="primary" sx={{ ml: 1 }} /></Typography>
            </Box>
          )}
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {affectedResources.filter(r => r.id !== selectedResource.parentId).map(resource => (
              <Chip key={resource.id} label={resource.name} size="small" variant="outlined" />
            ))}
          </Box>
        </Box>
      </Paper>
    );
  };

  
  const renderOsSelection = () => {
    if (!isServerResource) return null;

    const userCanUseCustom = canUseCustomIso();

    return (
        <Box sx={{ mt: 2, mb: 2, p: 2, border: '1px solid #ddd', borderRadius: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('bookingForm.osImageTitle')}</Typography>
            
            <Tabs 
                value={osSelectionType} 
                onChange={(e, v) => setOsSelectionType(v)} 
                variant="fullWidth" 
                textColor="primary" 
                indicatorColor="primary"
                sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
            >
                <Tab label={t('bookingForm.tabPublic')} value="STANDARD" />
                
                {userCanUseCustom && (
                    <Tab label={t('bookingForm.tabFavorites')} value="FAVORITE" disabled={userFavorites.length === 0} />
                )}
                
                {userCanUseCustom && (
                    <Tab label={t('bookingForm.tabCustomUrl')} value="CUSTOM" />
                )}
            </Tabs>

            {osSelectionType === 'STANDARD' && (
                <FormControl fullWidth error={!!errors.osSelection}>
                    <InputLabel>{t('bookingForm.selectOfficialImage')}</InputLabel>
                    <Select 
                        value={selectedIsoId} 
                        label={t('bookingForm.selectOfficialImage')}
                        onChange={(e) => setSelectedIsoId(e.target.value)}
                    >
                        {isoImages.map(iso => (
                            <MenuItem key={iso.id} value={iso.id}>
                                {iso.displayName}
                            </MenuItem>
                        ))}
                    </Select>
                    <FormHelperText>{errors.osSelection}</FormHelperText>
                </FormControl>
            )}

            {userCanUseCustom && osSelectionType === 'FAVORITE' && (
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1, mt: 1 }}>
                    <FormControl fullWidth error={!!errors.osSelection}>
                        <InputLabel>{t('bookingForm.selectFavorite')}</InputLabel>
                        <Select 
                            value={selectedFavoriteId} 
                            label={t('bookingForm.selectFavorite')}
                            onChange={(e) => setSelectedFavoriteId(e.target.value)}
                        >
                            {userFavorites.map(fav => (
                                <MenuItem key={fav.id} value={fav.id}>
                                    <Box>
                                        <Typography variant="body1">{fav.alias}</Typography>
                                        <Typography variant="caption" color="text.secondary">({fav.imageUrl})</Typography>
                                    </Box>
                                </MenuItem>
                            ))}
                        </Select>
                        <FormHelperText>{errors.osSelection}</FormHelperText>
                    </FormControl>

                    <Tooltip title={t('bookingForm.deleteFavoriteTooltip')}>
                        <span>
                            <IconButton 
                                onClick={handleDeleteFavorite} 
                                disabled={!selectedFavoriteId || isSubmitting}
                                color="error"
                                sx={{ mt: 1 }}
                            >
                                <DeleteIcon />
                            </IconButton>
                        </span>
                    </Tooltip>
                </Box>
            )}

            {userCanUseCustom && osSelectionType === 'CUSTOM' && (
                <Stack spacing={2}>
                    <TextField 
                        label={t('bookingForm.customUrlLabel')} 
                        fullWidth 
                        value={customImageUrl} 
                        onChange={(e) => setCustomImageUrl(e.target.value)}
                        error={!!errors.customImageUrl}
                        helperText={errors.customImageUrl || t('bookingForm.customUrlHelper')}
                        placeholder="http://192.168.1.1/images/my-distro.qcow2"
                    />
                    <TextField 
                        label={t('bookingForm.customChecksumLabel')} 
                        fullWidth 
                        value={customChecksumUrl} 
                        onChange={(e) => setCustomChecksumUrl(e.target.value)}
                        error={!!errors.customChecksumUrl}
                        helperText={errors.customChecksumUrl || t('bookingForm.customChecksumHelper')}
                    />
                    
                    <Box sx={{ p: 1, bgcolor: 'background.default', borderRadius: 1 }}>
                        <FormControlLabel 
                            control={<Checkbox checked={saveAsFavorite} onChange={(e) => setSaveAsFavorite(e.target.checked)} />} 
                            label={t('bookingForm.saveToFavorites')} 
                        />
                        {saveAsFavorite && (
                            <TextField 
                                label={t('bookingForm.favoriteAliasLabel')} 
                                size="small" 
                                fullWidth 
                                value={favoriteAlias}
                                onChange={(e) => setFavoriteAlias(e.target.value)}
                                error={!!errors.favoriteAlias}
                                helperText={errors.favoriteAlias}
                                sx={{ mt: 1 }}
                            />
                        )}
                    </Box>
                </Stack>
            )}
        </Box>
    );
  };

  const renderReadOnlyView = () => {
    const resourceName = getResourceName(formData.resourceId);
    const userName = getUserName(formData.userId);
    
    // Lookup display name dinamico
    const currentOs = formData.operatingSystem;
    const isoInfo = isoImages.find(i => i.id === currentOs); // Potrebbe non funzionare se è custom, ma è solo visuale
    const osDisplayName = isoInfo ? isoInfo.displayName : (currentOs || 'Not Specified');

    return (
      <>
        <DialogTitle>{t('bookingForm.bookingDetails')}</DialogTitle>
        <DialogContent>
          <Paper elevation={0} variant="outlined" sx={{ p: 3, mb: 2, mt: 1 }}>
            <Typography variant="h6" gutterBottom>{formData.title}</Typography>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">{t('bookingForm.resource')}</Typography>
              <Typography variant="body1">{resourceName}</Typography>
            </Box>
            
            {/* MOSTRA OS SOLO SE PRESENTE E SE È UN SERVER */}
            {isServerResource && (
                <Box sx={{ mb: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">Operating System</Typography>
                    <Typography variant="body1" sx={{ fontWeight: 'bold', color: 'primary.main' }}>
                        {osDisplayName}
                    </Typography>
                </Box>
            )}

            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">{t('bookingForm.period')}</Typography>
              <Typography variant="body1">{formatDate(formData.start, 'dddd D MMMM YYYY')}</Typography>
              <Typography variant="body2">{formatDate(formData.start, 'HH:mm')} - {formatDate(formData.end, 'HH:mm')}</Typography>
            </Box>
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2" color="text.secondary">{t('bookingForm.bookedBy')}</Typography>
              <Typography variant="body1">{userName}</Typography>
            </Box>
            {formData.description && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="subtitle2" color="text.secondary">{t('bookingForm.description')}</Typography>
                <Typography variant="body1">{formData.description}</Typography>
              </Box>
            )}
            
            {renderAffectedResources()}
          </Paper>
          <Alert severity="info">{t('bookingForm.viewingOtherBooking')}</Alert>
        </DialogContent>
        <DialogActions><Button onClick={onClose}>{t('common.close')}</Button></DialogActions>
      </>
    );
  };

  const renderEditForm = () => {
    // --- LOGICA DI RAGGRUPPAMENTO PER LISTSUBHEADER ---
    const groupedResources = activeResources.reduce((groups, resource) => {
      const typeName = resourceTypes.find(t => t.id === resource.typeId)?.name || 'Altro';
      if (!groups[typeName]) groups[typeName] = [];
      groups[typeName].push(resource);
      return groups;
    }, {});

    return (
      <>
        <DialogTitle>{formData.id ? t('bookingForm.editBooking') : t('bookingForm.newBooking')}</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <TextField label={t('bookingForm.title')} name="title" fullWidth value={formData.title} onChange={handleChange} margin="normal" required error={!!errors.title} helperText={errors.title} disabled={isSubmitting || isReadOnly} />

            <FormControl fullWidth margin="normal" required error={!!errors.resourceId} disabled={isSubmitting || isReadOnly}>
              <InputLabel>{t('bookingForm.resource')}</InputLabel>
              <Select name="resourceId" value={formData.resourceId || ''} label={t('bookingForm.resource')} onChange={handleChange}>
                <MenuItem value="">
                  <em>{t('bookingForm.selectResource')}</em>
                </MenuItem>
                
                {Object.entries(groupedResources).map(([typeName, groupResources]) => [
                  <ListSubheader 
                    key={`header-${typeName}`} 
                    sx={{ 
                      lineHeight: '36px', 
                      fontWeight: 'bold', 
                      color: 'primary.main',
                      bgcolor: 'background.default' 
                    }}
                  >
                    {typeName}
                  </ListSubheader>,
                  groupResources.map(resource => (
                    <MenuItem key={resource.id} value={resource.id} sx={{ pl: 4 }}>
                      <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                        <Typography component="span" fontWeight="medium">{resource.name}</Typography>
                        <Typography component="span" variant="caption" color="text.secondary">{resource.specs}</Typography>
                      </Box>
                    </MenuItem>
                  ))
                ])}
              </Select>
              {errors.resourceId && <FormHelperText>{errors.resourceId}</FormHelperText>}
            </FormControl>

            {/* --- NUOVO COMPONENTE DI SELEZIONE OS --- */}
            {renderOsSelection()}

            {renderAffectedResources()}

            {isSiteAdmin() && (
              <Box sx={{ mt: 3, mb: 2 }}>
                <Divider sx={{ mb: 2 }}><Typography variant="caption" color="text.secondary">{t('bookingForm.bookingUser')}</Typography></Divider>
                <Alert severity="info" sx={{ mb: 2 }}>{t('bookingForm.adminBookingNote')}</Alert>
                <FormControl fullWidth disabled={isSubmitting || isReadOnly}>
                  <Select value={useCurrentUser ? 'current' : 'other'} onChange={(e) => handleUserSelectionChange(e.target.value === 'current')} disabled={isSubmitting || isReadOnly}>
                    <MenuItem value="current">{t('bookingForm.bookInMyName')} ({currentUser?.name || currentUser?.username})</MenuItem>
                    <MenuItem value="other">{t('bookingForm.bookForAnotherUser')}</MenuItem>
                  </Select>
                </FormControl>
                {!useCurrentUser && (
                  <FormControl fullWidth margin="normal" required error={!!errors.userId} disabled={isSubmitting || isReadOnly}>
                    <InputLabel>{t('bookingForm.selectUser')}</InputLabel>
                    <Select name="userId" value={formData.userId || ''} label={t('bookingForm.selectUser')} onChange={handleChange} disabled={isSubmitting || isReadOnly}>
                      <MenuItem value="">{t('bookingForm.selectUser')}</MenuItem>
                      {users.map(user => (<MenuItem key={user.id} value={user.id}>{user.name || user.username || `${user.firstName} ${user.lastName}`}</MenuItem>))}
                    </Select>
                  </FormControl>
                )}
              </Box>
            )}

            {/* --- SEZIONE SSH: VISIBILE SOLO SE È UN SERVER --- */}
            {isServerResource && (
                <Box sx={{ mt: 3, mb: 2, p: 2, border: '1px solid #e0e0e0', borderRadius: 1, backgroundColor: 'rgba(25, 118, 210, 0.04)' }}>
                    <Typography variant="subtitle2" color="primary" sx={{ mb: 1, display: 'flex', alignItems: 'center' }}>
                        <Box component="span" sx={{ mr: 1 }}>🔑</Box> {t('bookingForm.sshConfigTitle')}
                    </Typography>
                    
                    {loadingKeys ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 1 }}><CircularProgress size={20} /></Box>
                    ) : walletKeys.length > 0 ? (
                        <Box>
                            <Typography variant="body2" sx={{ mb: 1 }}>
                                {t('bookingForm.sshKeysFoundCount', { count: walletKeys.length })}
                            </Typography>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                                {walletKeys.map(k => (
                                    <Chip key={k.id} label={k.label} size="small" variant="outlined" color="primary" />
                                ))}
                            </Box>
                            <FormHelperText sx={{ mt: 1 }}>{t('bookingForm.sshKeysInjectionHelper')}</FormHelperText>
                        </Box>
                    ) : (
                        <Alert severity="warning" variant="outlined">
                            {t('bookingForm.sshNoKeysFound')} <Link component="button" onClick={() => { onClose(); navigate('/profile'); }}>{t('bookingForm.sshAddKeyLink')}</Link> {t('bookingForm.sshNoKeysWarning')}
                        </Alert>
                    )}
                </Box>
            )}

            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2, mt: 2 }}>
              <TextField label={t('bookingForm.startDateTime')} name="start" type="datetime-local" fullWidth value={formatDateForInput(formData.start)} onChange={handleDateChange} InputLabelProps={{ shrink: true }} required error={!!errors.start} helperText={errors.start} disabled={isSubmitting || isReadOnly} />
              <TextField label={t('bookingForm.endDateTime')} name="end" type="datetime-local" fullWidth value={formatDateForInput(formData.end)} onChange={handleDateChange} InputLabelProps={{ shrink: true }} required error={!!errors.end} helperText={errors.end} disabled={isSubmitting || isReadOnly} />
            </Box>
            
            <Button variant="outlined" color="primary" onClick={checkConflicts} disabled={isChecking || isSubmitting} fullWidth sx={{ mt: 2 }}>{isChecking ? t('bookingForm.checking') : t('bookingForm.checkAvailability')}</Button>
            {validationMessage && <Alert severity={validationMessage.type} sx={{ mt: 2 }}>{validationMessage.text}</Alert>}

            {/* Custom Parameters Section (INVARIATA) */}
            {(() => {
              const customParams = getResourceCustomParameters();
              if (customParams.length === 0) return null;
              return (
                <Box sx={{ mt: 3, mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 'medium' }}>{t('bookingForm.customParameters')}</Typography>
                  <Paper variant="outlined" sx={{ p: 2, bgcolor: 'background.paper' }}>
                    {customParams.map((param, index) => (
                      <TextField key={param.label} label={`${param.label}${param.required ? ' *' : ''}`} fullWidth value={customParameterValues[param.label] || ''} onChange={(e) => handleCustomParameterChange(param.label, e.target.value)} margin={index === 0 ? "none" : "normal"} required={param.required} error={!!errors[`customParam_${param.label}`]} helperText={errors[`customParam_${param.label}`]} disabled={isSubmitting || isReadOnly} multiline rows={2} />
                    ))}
                  </Paper>
                </Box>
              );
            })()}

            <TextField label={t('bookingForm.description')} name="description" fullWidth multiline rows={4} value={formData.description || ''} onChange={handleChange} margin="normal" disabled={isSubmitting || isReadOnly} />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={isSubmitting}>{t('common.cancel')}</Button>
          <Button variant="contained" color="primary" onClick={handleSubmit} disabled={isSubmitting}>{formData.id ? t('common.update') : t('common.confirm')}</Button>
          {formData.id && <Button variant="contained" color="error" onClick={handleDeleteClick} disabled={isSubmitting}>{t('common.delete')}</Button>}
        </DialogActions>
      </>
    );
  };

  

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      {isReadOnly ? renderReadOnlyView() : renderEditForm()}
    </Dialog>
  );
};

export default BookingForm;