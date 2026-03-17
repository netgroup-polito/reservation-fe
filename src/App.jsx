import React, { useContext, useEffect } from 'react';
import { BrowserRouter as Router, Navigate, Route, Routes, useNavigate } from 'react-router-dom';
import MainLayout from './components/Layout/MainLayout';
import BookingCalendar from './components/Booking/BookingCalendar';
import AdminPanel from './components/Admin/AdminPanel';
import ProfileManagement from './components/Profile/ProfileManagement';
import Dashboard from './components/Dashboard/Dashboard';
import MyBookingsPage from './components/Booking/MyBookingsPage';
import NotificationsPage from './components/Notifications/NotificationsPage';
import SiteManagement from './components/Admin/SiteManagement';
import IsoManagement from './components/Admin/IsoManagement'; 
import { AuthContext } from './context/AuthContext';
import { SiteContext } from './context/SiteContext';
import { Box, CircularProgress, Typography } from '@mui/material';
import { ErrorProvider, useError } from './context/ErrorContext';
import ErrorNotification from './components/Common/ErrorNotification';
import ResourceExplorer from './components/Resources/ResourceExplorer';
import { SiteRoles } from './services/siteService';

// Initialize the global error handler
const ErrorInitializer = ({ children }) => {
  const { handleApiError } = useError();
  
  useEffect(() => {
    // Inject the error handler into the global environment
    // Will be accessible from API service modules
    window.__errorHandler = handleApiError;
    
    return () => {
      // Remove the error handler when the component unmounts
      delete window.__errorHandler;
    };
  }, [handleApiError]);
  
  return children;
};

// Wrapper component for routes with layout
const LayoutWrapper = ({ element, currentSection, requiredRole }) => {
    const { currentUser, loading, isAuthorized } = useContext(AuthContext);
    const { canManageSites } = useContext(SiteContext);
    const navigate = useNavigate();

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', flexDirection: 'column', gap: 2 }}>
                <CircularProgress />
                <Typography>Loading...</Typography>
            </Box>
        );
    }

    if (!currentUser) {
        return <Navigate to="/" replace />;
    }

    // Special handling for sites section - use canManageSites
    if (currentSection === 'sites' && !canManageSites()) {
        return <Navigate to="/calendar" replace />;
    }
    
    // Regular role-based permission check for other sections
    else if (requiredRole && !isAuthorized(requiredRole)) {
        // If user attempts to access dashboard but is not admin, redirect to calendar
        if (currentSection === 'dashboard') {
            return <Navigate to="/calendar" replace />;
        }
        // For other admin-only sections, redirect to home
        return <Navigate to="/calendar" replace />;
    }

    const handleSectionChange = (section) => {
        switch(section) {
            case 'dashboard':
                navigate('/');
                break;
            case 'calendar':
                navigate('/calendar');
                break;
            case 'mybookings':
                navigate('/mybookings');
                break;
            case 'admin':
                navigate('/admin');
                break;
            case 'profile':
                navigate('/profile');
                break;
            case 'notifications':
                navigate('/notifications');
                break;
            case 'resources':
                navigate('/resources');
                break;
            case 'sites':
                navigate('/sites');
                break;
            case 'isos': // <-- AGGIUNTO: Caso per la navigazione ISO
                navigate('/isos');
                break;
            default:
                navigate('/');
        }
    };

    return (
        <MainLayout currentSection={currentSection} onSectionChange={handleSectionChange}>
            {element}
        </MainLayout>
    );
};

const App = () => {
    const { currentUser } = useContext(AuthContext);

    return (
        <ErrorProvider>
            <ErrorInitializer>
                <Router>
                    <Routes>
                        <Route
                            path="/"
                            element={
                                <LayoutWrapper
                                    element={<Dashboard />}
                                    currentSection="dashboard"
                                    requiredRole={SiteRoles.SITE_ADMIN}
                                />
                            }
                        />
                        <Route
                            path="/resources"
                            element={
                                <LayoutWrapper
                                    element={<ResourceExplorer />}
                                    currentSection="resources"
                                    requiredRole={SiteRoles.USER}
                                />
                            }
                        />
                        <Route
                            path="/calendar"
                            element={
                                <LayoutWrapper
                                    element={<BookingCalendar />}
                                    currentSection="calendar"
                                    requiredRole={SiteRoles.USER}
                                />
                            }
                        />
                        <Route
                            path="/mybookings"
                            element={
                                <LayoutWrapper
                                    element={<MyBookingsPage />}
                                    currentSection="mybookings"
                                    requiredRole={SiteRoles.USER}
                                />
                            }
                        />
                        <Route
                            path="/admin"
                            element={
                                <LayoutWrapper
                                    element={<AdminPanel />}
                                    currentSection="admin"
                                    requiredRole={SiteRoles.SITE_ADMIN}
                                />
                            }
                        />
                        
                        {/* --- NUOVA ROTTA GESTIONE ISO --- */}
                        <Route
                            path="/isos"
                            element={
                                <LayoutWrapper
                                    element={<IsoManagement />}
                                    currentSection="isos"
                                    requiredRole={SiteRoles.SITE_ADMIN}
                                />
                            }
                        />
                        {/* ------------------------------- */}

                        <Route
                            path="/profile"
                            element={
                                <LayoutWrapper
                                    element={<ProfileManagement />}
                                    currentSection="profile"
                                    requiredRole={SiteRoles.USER}
                                />
                            }
                        />
                        <Route
                            path="/notifications"
                            element={
                                <LayoutWrapper
                                    element={<NotificationsPage />}
                                    currentSection="notifications"
                                    requiredRole={SiteRoles.USER}
                                />
                            }
                        />
                        {/* Route for site management - now uses custom canManageSites check */}
                        <Route
                            path="/sites"
                            element={
                                <LayoutWrapper
                                    element={<SiteManagement />}
                                    currentSection="sites"
                                    requiredRole={null} /* Custom check in LayoutWrapper */
                                />
                            }
                        />
                        {/* Route for Keycloak redirects */}
                        <Route path="/callback" element={<Navigate to="/" replace />} />
                        {/* Fallback route */}
                        <Route path="*" element={<Navigate to="/calendar" replace />} />
                    </Routes>
                    
                    {/* Error notification component */}
                    <ErrorNotification />
                </Router>
            </ErrorInitializer>
        </ErrorProvider>
    );
};

export default App;