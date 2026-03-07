import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  CircularProgress,
  InputAdornment,
  TextField,
  Tooltip,
  Typography,
  MenuItem,
  Snackbar,
  Alert,
  Stack,
  ToggleButtonGroup,
  ToggleButton
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import CategoryIcon from '@mui/icons-material/Category';
import GridViewIcon from '@mui/icons-material/GridView';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import TableViewIcon from '@mui/icons-material/TableView';
import ResourceCard from '../Resources/ResourceCard';
import ResourceForm from '../Resources/ResourceForm';
import ResourceHierarchyView from '../Resources/ResourceHierarchyView';
import ResourceTable from '../Resources/ResourceTable';
import {
  createResource,
  deleteResource,
  fetchResources,
  updateResource,
  ResourceStatus
} from '../../services/resourceService';
import { fetchResourceTypes } from '../../services/resourceTypeService';
import useApiError from '../../hooks/useApiError';
import { useSite } from '../../context/SiteContext';

const ResourceManagement = ({ onSwitchToResourceType }) => {
  const { t } = useTranslation();
  const { withErrorHandling } = useApiError();
  const [resources, setResources] = useState([]);
  const [resourceTypes, setResourceTypes] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isResourceModalOpen, setIsResourceModalOpen] = useState(false);
  const [selectedResource, setSelectedResource] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [notification, setNotification] = useState(null);
  const { currentSite } = useSite();
  const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'hierarchy'

  // Show a notification
  const showNotification = (message, severity = 'success') => {
    setNotification({ message, severity });
    
    // Remove the notification after 6 seconds
    setTimeout(() => {
      setNotification(null);
    }, 6000);
  };

  // Load resources and resource types
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        await withErrorHandling(async () => {
          const [resourcesData, resourceTypesData] = await Promise.all([
            fetchResources(currentSite?.id ? {siteId: currentSite.id} : {}),
            fetchResourceTypes(currentSite?.id ? {siteId: currentSite.id} : {})
          ]);
          setResources(resourcesData);
          setResourceTypes(resourceTypesData);
        }, {
          errorMessage: t('errors.unableToLoadResources'),
          showError: true
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, [needsRefresh, withErrorHandling, t, currentSite]);

  // Filter resources based on search, type, and status
  const filteredResources = resources.filter(resource => {
    const matchesSearch = searchTerm === '' ||
        resource.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        resource.specs?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        resource.location?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesType = filterType === '' || resource.typeId === parseInt(filterType);

    const matchesStatus = filterStatus === '' ||
        resource.status === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  })
  // Sort resources by type name, then by resource name alphabetically
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

  const handleViewModeChange = (event, newMode) => {
    if (newMode !== null) {
      setViewMode(newMode);
    }
  };

  const handleAddResource = () => {
    setSelectedResource(null);
    setIsResourceModalOpen(true);
  };

  const handleEditResource = (resource) => {
    setSelectedResource(resource);
    setIsResourceModalOpen(true);
  };

  const handleSaveResource = async (resourceData) => {
    // Ensure that status and typeId are numbers
    const preparedData = {
      ...resourceData,
      status: typeof resourceData.status === 'string' ? resourceData.status : Number(resourceData.status),
      typeId: Number(resourceData.typeId)
    };

    const result = await withErrorHandling(async () => {
      if (preparedData.id) {
        // Update an existing resource
        const updatedResource = await updateResource(preparedData.id, preparedData);
        return { success: updatedResource.id, updated: true, resource: updatedResource };
      } else {
        // Create a new resource
        const newResource = await createResource(preparedData);
        return { success: newResource.id, updated: false, resource: newResource };
      }
    }, {
      errorMessage: preparedData.id 
        ? t('resourceManagement.unableToUpdateResource', {name: preparedData.name}) 
        : t('resourceManagement.unableToCreateResource', {name: preparedData.name}),
      showError: true
    });

    if (result.success) {
      if (result.updated) {
        // Update existing resources
        setResources(resources.map(resource =>
            resource.id === result.resource.id ? result.resource : resource
        ));
        showNotification(t('resourceManagement.resourceUpdatedSuccess', {name: result.resource.name}));
      } else {
        // Add new resource
        setResources([...resources, result.resource]);
        showNotification(t('resourceManagement.resourceCreatedSuccess', {name: result.resource.name}));
      }
      setIsResourceModalOpen(false);
    }
  };

  const handleDeleteResource = async (resourceId) => {
    // Find the resource name before deleting it
    const resourceToDelete = resources.find(r => r.id === resourceId);
    const resourceName = resourceToDelete ? resourceToDelete.name : t('resourceManagement.selected');
    let confirm = window.confirm(
        t('resourceManagement.confirmDeleteResource', {name: resourceName}) + '\n' + t('resourceManagement.actionCannotBeUndone')
    );

    if (!confirm) {
      return;
    }

    try {
      // Close menu before starting the operation
      const response = await withErrorHandling(async () => {
        return await deleteResource(resourceId);
      }, {
        errorMessage: t('resourceManagement.unableToDeleteResource', {name: resourceName}),
        showError: true
      });
      
      // Check if response exists and has success property set to true
      // or if response is truthy (for backward compatibility)
      if (response.success) {
        setResources(resources.filter(resource => resource.id !== resourceId));
        setIsResourceModalOpen(false);
        showNotification(t('resourceManagement.resourceDeletedSuccess', {name: resourceName}));
      }
    } catch (error) {
      console.error('Unhandled error during resource deletion:', error);
    }
  };

  // Handle resource hierarchy updates from drag and drop operations
  const handleResourceHierarchyUpdated = () => {
    // Trigger a refresh of the resource data
    setNeedsRefresh(prev => !prev);
    
    // Show a notification
    showNotification(t('resourceHierarchy.hierarchyUpdated'), 'success');
  };

  // Modified to redirect to resource type management
  const handleAddResourceType = () => {
    onSwitchToResourceType();
  };

  return (
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3, alignItems: 'center' }}>
          <Typography variant="h6">{t('resourceManagement.title')}</Typography>
          <Button
              variant="contained"
              color="primary"
              startIcon={<AddIcon />}
              onClick={handleAddResource}
          >
            {t('resourceManagement.addResource')}
          </Button>
        </Box>

        <Stack 
          direction={{ xs: 'column', sm: 'row' }} 
          spacing={2} 
          sx={{ mb: 3 }}
          alignItems="flex-start"
          flexWrap="wrap"
        >
          <TextField
              placeholder={t('resourceManagement.searchResources')}
              variant="outlined"
              size="small"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ flexGrow: 1, minWidth: { xs: '100%', sm: 'auto' } }}
              InputProps={{
                startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon />
                    </InputAdornment>
                ),
              }}
          />

          <Box sx={{ 
            display: 'flex', 
            gap: 1, 
            alignItems: 'center', 
            flexWrap: 'wrap',
            width: { xs: '100%', sm: 'auto' }
          }}>
            <TextField
                select
                label={t('resourceManagement.type')}
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                size="small"
                sx={{ minWidth: 150 }}
                InputProps={{
                  startAdornment: (
                      <InputAdornment position="start">
                        <FilterListIcon />
                      </InputAdornment>
                  ),
                }}
            >
              <MenuItem value="">{t('resourceManagement.allTypes')}</MenuItem>
              {resourceTypes.map((type) => (
                  <MenuItem key={type.id} value={type.id}>
                    {type.name}
                  </MenuItem>
              ))}
            </TextField>

            <TextField
                select
                label={t('resourceManagement.status')}
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                size="small"
                sx={{ minWidth: 150 }}
            >
              <MenuItem value="">{t('resourceManagement.allStatuses')}</MenuItem>
              <MenuItem value={ResourceStatus.ACTIVE}>{t('resourceManagement.active')}</MenuItem>
              <MenuItem value={ResourceStatus.MAINTENANCE}>{t('resourceManagement.maintenance')}</MenuItem>
              <MenuItem value={ResourceStatus.UNAVAILABLE}>{t('resourceManagement.unavailable')}</MenuItem>
            </TextField>

            <Tooltip title={t('resourceManagement.addNewType')}>
              <Button
                  variant="outlined"
                  size="small"
                  onClick={handleAddResourceType}
                  sx={{ minWidth: 'auto', height: 40 }}
              >
                <CategoryIcon />
              </Button>
            </Tooltip>
            
            <ToggleButtonGroup
              value={viewMode}
              exclusive
              onChange={handleViewModeChange}
              aria-label="view mode"
              size="small"
            >
              <ToggleButton value="grid" aria-label="grid view">
                <Tooltip title={t('resourceManagement.gridView')}>
                  <GridViewIcon />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="table" aria-label="table view">
                <Tooltip title={t('resourceManagement.tableView')}>
                  <TableViewIcon />
                </Tooltip>
              </ToggleButton>
              <ToggleButton value="hierarchy" aria-label="hierarchy view">
                <Tooltip title={t('resourceManagement.hierarchyView')}>
                  <AccountTreeIcon />
                </Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Stack>

        {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
        ) : (
            viewMode === 'grid' ? (
              <Box sx={{ 
                display: 'grid', 
                gridTemplateColumns: { 
                  xs: '1fr', 
                  sm: 'repeat(2, 1fr)', 
                  lg: 'repeat(3, 1fr)' 
                }, 
                gap: 3 
              }}>
                {filteredResources.length === 0 ? (
                    <Box sx={{ gridColumn: '1 / -1', textAlign: 'center', py: 4 }}>
                      <Typography variant="body1" color="text.secondary">
                        {t('resourceManagement.noResourcesFound')}
                      </Typography>
                    </Box>
                ) : (
                    filteredResources.map(resource => (
                        <ResourceCard
                            key={resource.id}
                            resource={resource}
                            resourceType={resourceTypes.find(t => t.id === resource.typeId)}
                            onEdit={() => handleEditResource(resource)}
                            onDelete={() => handleDeleteResource(resource.id)}
                        />
                    ))
                )}
              </Box>
            ) : viewMode === 'table' ? (
              <ResourceTable 
                resources={filteredResources}
                resourceTypes={resourceTypes}
                onResourceSelect={(resource) => handleEditResource(resource)}
              />
            ) : (
              <ResourceHierarchyView 
                resources={filteredResources}
                resourceTypes={resourceTypes}
                onResourceSelect={(resource) => handleEditResource(resource)}
                isAdminView={true}
                onResourceHierarchyUpdated={handleResourceHierarchyUpdated}
              />
            )
        )}

        <ResourceForm
            open={isResourceModalOpen}
            onClose={() => setIsResourceModalOpen(false)}
            resource={selectedResource}
            resourceTypes={resourceTypes}
            allResources={resources}
            onSave={handleSaveResource}
            onDelete={handleDeleteResource}
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

export default ResourceManagement;