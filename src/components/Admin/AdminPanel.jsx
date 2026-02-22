import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Paper, Tab, Tabs } from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import PeopleIcon from '@mui/icons-material/People';
import CategoryIcon from '@mui/icons-material/Category';
import ReceiptIcon from '@mui/icons-material/Receipt';
import WebhookIcon from '@mui/icons-material/Webhook';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows'; // <-- AGGIUNTO: Icona per gli OS
import ResourceManagement from './ResourceManagement';
import UserManagement from './UserManagement';
import ResourceTypeManagement from './ResourceTypeManagement';
import AuditLogsManagement from './AuditLogsManagement';
import WebhookManagement from './WebhookManagement';
import IsoManagement from './IsoManagement'; // <-- AGGIUNTO: Import del componente creato nello Step 1

const AdminPanel = () => {
  const { t } = useTranslation();
  const [currentTab, setCurrentTab] = useState(0);
  const [openResourceTypeForm, setOpenResourceTypeForm] = useState(false);

  const handleTabChange = (event, newValue) => {
    setCurrentTab(newValue);
  };

  // Function to switch to resource type tab and open the form
  const handleSwitchToResourceType = () => {
    setCurrentTab(1); // Switch to the "Resource Types" tab (index 1)
    setOpenResourceTypeForm(true); // Set the flag to open the form
  };

  return (
    <Box sx={{ p: 3 }}>
      <Paper elevation={2} sx={{ p: 2 }}>
        <Tabs
          value={currentTab}
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
        >
          <Tab
            label={t('adminPanel.resourceManagement')}
            icon={<StorageIcon />}
            sx={{ flexGrow: 1 }}
          />
          <Tab
            label={t('adminPanel.resourceTypes')}
            icon={<CategoryIcon />}
            sx={{ flexGrow: 1 }}
          />
          <Tab
            label={t('adminPanel.userManagement')}
            icon={<PeopleIcon />}
            sx={{ flexGrow: 1 }}
          />
          <Tab
            label={t('adminPanel.auditLogs')}
            icon={<ReceiptIcon />}
            sx={{ flexGrow: 1 }}
          />
          {/* --- NUOVA TAB GESTIONE OS --- */}
          <Tab
            label="GESTIONE OS" // Nota: Puoi aggiungere 'adminPanel.isoManagement' al tuo file i18n
            icon={<DesktopWindowsIcon />}
            sx={{ flexGrow: 1 }}
          />
          {/* ---------------------------- */}
          <Tab
            label={t('adminPanel.webhooks')}
            icon={<WebhookIcon />}
            sx={{ flexGrow: 1 }}
          />
        </Tabs>

        <Box sx={{ mt: 3 }}>
          {currentTab === 0 && (
            <ResourceManagement
              onSwitchToResourceType={handleSwitchToResourceType}
            />
          )}
          {currentTab === 1 && (
            <ResourceTypeManagement
              openFormOnMount={openResourceTypeForm}
              resetOpenFormFlag={() => setOpenResourceTypeForm(false)}
            />
          )}
          {currentTab === 2 && <UserManagement />}
          {currentTab === 3 && <AuditLogsManagement />}
          
          {/* --- NUOVO CONTENUTO TAB ISO --- */}
          {currentTab === 4 && <IsoManagement />}
          
          {/* Scaliamo l'indice dei Webhook a 5 */}
          {currentTab === 5 && <WebhookManagement />}
        </Box>
      </Paper>
    </Box>
  );
};

export default AdminPanel;