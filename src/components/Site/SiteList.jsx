import React, { useState, useEffect, useCallback, useContext } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Card,
  CardContent,
  IconButton,
  TextField,
  Typography,
  Chip,
  Snackbar,
  Alert,
  Fade,
  Divider,
  Tooltip,
  Skeleton
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import DeleteIcon from '@mui/icons-material/Delete';
import GroupIcon from '@mui/icons-material/Group';
import DomainIcon from '@mui/icons-material/Domain';
import InfoIcon from '@mui/icons-material/Info';
import { fetchSites, deleteSite } from '../../services/siteService';
import SiteForm from './SiteForm';
import SiteDetailsDrawer from './SiteDetailsDrawer';
import useApiError from '../../hooks/useApiError';
import { AuthContext } from '../../context/AuthContext';
import { useSite } from '../../context/SiteContext';

const SiteList = () => {
  const { t } = useTranslation();
  const { withErrorHandling } = useApiError();
  const { isGlobalAdmin, isSiteAdmin } = useContext(AuthContext);
  const { canManageSite } = useSite();
  const [sites, setSites] = useState([]);
  const [filteredSites, setFilteredSites] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [selectedFederation, setSelectedFederation] = useState(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);
  const [notification, setNotification] = useState(null);

  // MODIFICA 1: Filtro sicuro con Optional Chaining (?.)
  useEffect(() => {
    const search = searchTerm?.toLowerCase() || '';
    const filtered = sites.filter(site => {
      const siteName = site?.name?.toLowerCase() || '';
      const siteDesc = site?.description?.toLowerCase() || '';
      return siteName.includes(search) || siteDesc.includes(search);
    });
    setFilteredSites(filtered);
  }, [sites, searchTerm]);

  // Load sites from API with useCallback to avoid ESLint dependency warnings
  const loadSites = useCallback(async () => {
    setIsLoading(true);
    try {
      await withErrorHandling(async () => {
        const sitesData = await fetchSites();
        
        // For site admins, filter only sites they can manage
        if (!isGlobalAdmin()) {
          // MODIFICA 2: Controllo di sicurezza su site.name per isSiteAdmin
          const managableSites = sitesData.filter(site => 
            canManageSite(site?.id) || isSiteAdmin(site?.name || '')
          );
          setSites(managableSites);
          setFilteredSites(managableSites);
        } else {
          // Global admins see all sites
          setSites(sitesData);
          setFilteredSites(sitesData);
        }
      }, {
        errorMessage: t('sites.unableToLoadSites'),
        showError: true
      });
    } finally {
      setIsLoading(false);
    }
  }, [withErrorHandling, t, isGlobalAdmin, canManageSite, isSiteAdmin]);

  // Load sites
  useEffect(() => {
    loadSites();
  }, [loadSites]);
  
  // Show a notification
  const showNotification = (message, severity = 'success') => {
    setNotification({ message, severity });
    setTimeout(() => setNotification(null), 6000);
  };

  // Handle add site
  const handleAddSite = () => {
    setSelectedFederation(null);
    setIsFormOpen(true);
  };

  // Handle view site details
  const handleViewFederationDetails = (site) => {
    setSelectedFederation(site);
    setIsDetailDrawerOpen(true);
  };

  // Handle delete site
  const handleDeleteFederation = async (site) => {
    // Check if user can delete this site
    if (!isGlobalAdmin() && !canManageSite(site?.id)) {
      showNotification(
        t('sites.noPermissionToDelete', { name: site?.name || 'Unknown' }),
        'error'
      );
      return;
    }

    const confirmed = window.confirm(
      t('sites.confirmDeleteSite', { name: site?.name || 'Unknown' })
    );

    if (!confirmed) return;

    try {
      await withErrorHandling(async () => {
        await deleteSite(site.id);
        setSites(sites.filter(f => f.id !== site.id));
        showNotification(
          t('sites.siteDeletedSuccess', { name: site?.name || 'Unknown' }),
          'success'
        );
      }, {
        errorMessage: t('sites.unableToDeleteSite', { name: site?.name || 'Unknown' }),
        showError: true
      });
    } catch (error) {
      console.error('Error deleting site:', error);
    }
  };

  // Handle site form save
  const handleSaveSite = (site) => {
    // Add new site
    setSites([...sites, site]);
    showNotification(
      t('sites.siteCreatedSuccess', { name: site?.name || 'Unknown' }),
      'success'
    );
    
    setIsFormOpen(false);
  };

  // site card component
  const FederationCard = ({ federation }) => {
    // MODIFICA 3: Messo al sicuro federation.name
    const canManageThisSite = isGlobalAdmin() || canManageSite(federation?.id) || isSiteAdmin(federation?.name || '');
    
    return (
      <Fade in={true} timeout={300}>
        <Card 
          sx={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            cursor: 'pointer',
            transition: 'transform 0.2s, box-shadow 0.2s',
            '&:hover': {
              transform: 'translateY(-4px)',
              boxShadow: 6
            },
            position: 'relative',
            overflow: 'visible'
          }} 
          onClick={() => handleViewFederationDetails(federation)}
        >
          <CardContent sx={{ flexGrow: 1, p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
              <DomainIcon sx={{ fontSize: 28, mr: 1, color: 'primary.main' }} />
              <Typography variant="h6" sx={{ flexGrow: 1, fontWeight: 'medium' }}>
                {federation?.name || 'Unnamed Site'}
              </Typography>
              {canManageThisSite && (
                <Box>
                  <Tooltip title={t('common.delete')}>
                    <IconButton
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteFederation(federation);
                      }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              )}
            </Box>

            {federation?.description && (
              <>
                <Divider sx={{ my: 1 }} />
                <Typography 
                  variant="body2" 
                  color="text.secondary" 
                  sx={{ 
                    mb: 2,
                    display: '-webkit-box',
                    overflow: 'hidden',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 3,
                    lineHeight: '1.5em',
                    maxHeight: '4.5em'
                  }}
                >
                  {federation.description}
                </Typography>
              </>
            )}

            <Box sx={{ mt: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Chip
                icon={<GroupIcon />}
                label={t('sites.members', { count: federation?.memberCount || 0 })}
                size="small"
                variant="outlined"
                color="primary"
              />
              <Typography variant="caption" color="text.secondary">
                ID: {federation?.id || 'N/A'}
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Fade>
    );
  };

  // Rendering the skeleton loader
  const renderSkeletons = () => {
    return Array(6).fill(0).map((_, index) => (
      <Box key={index} sx={{ width: '100%', height: '100%' }}>
        <Skeleton variant="rectangular" height={180} animation="wave" />
      </Box>
    ));
  };

  return (
    <Box sx={{ p: 3 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center' }}>
        <Typography variant="h5">{t('sites.title')}</Typography>
        <Button
          variant="contained"
          color="primary"
          startIcon={<AddIcon />}
          onClick={handleAddSite}
        >
          {t('sites.addSite')}
        </Button>
      </Box>

      <Box sx={{ position: 'relative', mb: 3 }}>
        <Box sx={{ position: 'absolute', left: 10, top: 8, zIndex: 1 }}>
          <SearchIcon color="action" />
        </Box>
        <TextField
          placeholder={t('sites.searchSites')}
          variant="outlined"
          size="small"
          fullWidth
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          sx={{ 
            '& .MuiOutlinedInput-root': { 
              paddingLeft: '36px' 
            }
          }}
        />
        {searchTerm && (
          <Box sx={{ position: 'absolute', right: 10, top: 8, zIndex: 1 }}>
            <IconButton 
              size="small" 
              onClick={() => setSearchTerm('')} 
              aria-label="clear search"
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        )}
      </Box>

      {isLoading ? (
        <Box sx={{ 
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: 3
        }}>
          {renderSkeletons()}
        </Box>
      ) : (
        <>
          {filteredSites.length === 0 ? (
            <Box sx={{ 
              display: 'flex', 
              flexDirection: 'column',
              alignItems: 'center', 
              justifyContent: 'center', 
              py: 8,
              textAlign: 'center'
            }}>
              <InfoIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
              <Typography color="text.secondary" variant="h6">
                {t('sites.noSitesFound')}
              </Typography>
              <Button 
                variant="outlined" 
                startIcon={<AddIcon />} 
                onClick={handleAddSite}
                sx={{ mt: 2 }}
              >
                {t('sites.addSite')}
              </Button>
            </Box>
          ) : (
            <Box sx={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
              gap: 3
            }}>
              {filteredSites.map((federation) => (
                <FederationCard key={federation?.id || Math.random()} federation={federation} />
              ))}
            </Box>
          )}
        </>
      )}

      {/* Site Form Dialog */}
      <SiteForm
        open={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        federation={selectedFederation}
        onSave={handleSaveSite}
      />

      {/* Site Details Drawer */}
      <SiteDetailsDrawer
        open={isDetailDrawerOpen}
        onClose={() => setIsDetailDrawerOpen(false)}
        federation={selectedFederation}
        onEdit={() => {
          setIsDetailDrawerOpen(false);
          setIsFormOpen(true);
        }}
        onDelete={() => {
          setIsDetailDrawerOpen(false);
          handleDeleteFederation(selectedFederation);
        }}
        onFederationChanged={() => loadSites()}
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

export default SiteList;
