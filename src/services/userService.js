/**
 * Service for user-related API operations
 */
import apiRequest from './apiCore';

/**
 * Get all users
 * @returns {Promise<Array>} List of users
 */
export const fetchUsers = (filters = {}) => {
    const queryParams = [];
  
    if (filters.siteId) {
      queryParams.push(`siteId=${filters.siteId}`);
    }

    const queryString = queryParams.length > 0 ? `?${queryParams.join('&')}` : '';
    return apiRequest(`/users${queryString}`);
};

/**
 * Get user by ID
 * @param {number} id - User ID
 * @returns {Promise<Object>} User data
 */
export const fetchUser = (id) => apiRequest(`/users/${id}`);

/**
 * Get current user profile
 * @returns {Promise<Object>} Current user profile
 */
export const fetchCurrentUser = () => apiRequest('/users/me');

// --- NUOVI METODI WALLET (Gestione Multi-Chiave) ---

/**
 * Get ALL SSH keys for the current user (Wallet)
 * @returns {Promise<Array>} List of SSH Key objects
 */
export const getSshKeys = () => apiRequest('/users/me/ssh-keys');

/**
 * Add a new SSH key to the wallet
 * @param {string} label - Friendly name for the key
 * @param {string} sshPublicKey - The actual key string
 * @returns {Promise<Object>} The created key object
 */
export const addSshKey = (label, sshPublicKey) => 
  apiRequest('/users/me/ssh-keys', 'POST', { label, sshPublicKey });

/**
 * Delete a specific SSH key from the wallet
 * @param {number} keyId - ID of the key to delete
 * @returns {Promise<Object>} Deletion response
 */
export const deleteSshKey = (keyId) => apiRequest(`/users/me/ssh-keys/${keyId}`, 'DELETE');

/**
 * Update a specific SSH key in the wallet
 * @param {number} keyId - ID of the key to update
 * @param {Object} keyData - Data to update ({ label, sshPublicKey })
 * @returns {Promise<Object>} Updated key object
 */
export const updateSshKey = (keyId, keyData) => 
  apiRequest(`/users/me/ssh-keys/${keyId}`, 'PUT', keyData);

// -------------------------------------------------------------

/**
 * Create a new user
 * @param {Object} userData - New user data
 * @returns {Promise<Object>} Created user
 */
export const createUser = (userData) => {
    const preparedData = {
        username: userData.username,
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        password: userData.password,
        roles: userData.roles || ['USER'],
        avatar: userData.avatar || '',
        siteId: userData.siteId || ''
        // RIMOSSO: sshPublicKey non viene più inviato qui
    };

    return apiRequest('/users', 'POST', preparedData);
};

/**
 * Update an existing user
 * @param {number} id - User ID
 * @param {Object} userData - Updated user data
 * @returns {Promise<Object>} Updated user
 */
export const updateUser = (id, userData) => {
    const preparedData = {};

    if (userData.username) preparedData.username = userData.username;
    if (userData.email) preparedData.email = userData.email;
    if (userData.firstName) preparedData.firstName = userData.firstName;
    if (userData.lastName) preparedData.lastName = userData.lastName;
    if (userData.password) preparedData.password = userData.password;
    if (userData.roles) preparedData.roles = userData.roles;
    if (userData.avatar) preparedData.avatar = userData.avatar;
    // RIMOSSO: sshPublicKey

    return apiRequest(`/users/${id}`, 'PUT', preparedData);
};

/**
 * Update current user profile
 * @param {Object} userData - Updated profile data
 * @returns {Promise<Object>} Updated profile
 */
export const updateProfile = (userData) => {
    const preparedData = {};

    if (userData.username) preparedData.username = userData.username;
    if (userData.email) preparedData.email = userData.email;
    if (userData.firstName) preparedData.firstName = userData.firstName;
    if (userData.lastName) preparedData.lastName = userData.lastName;
    if (userData.password) preparedData.password = userData.password;
    if (userData.avatar) preparedData.avatar = userData.avatar;
    // RIMOSSO: sshPublicKey

    return apiRequest('/users/me', 'PUT', preparedData);
};

/**
 * Delete a user
 * @param {number} id - User ID
 * @returns {Promise<Object>} Deletion response
 */
export const deleteUser = (id) => apiRequest(`/users/${id}`, 'DELETE');

// --- ROLE MANAGEMENT (Custom ISO) ---

/**
 * Assign the 'custom-iso-uploader' role to a user
 * @param {string} userId - ID of the user
 * @returns {Promise<Object>} Response
 */
export const assignCustomIsoRole = (userId) => 
  apiRequest(`/users/${userId}/roles/custom-iso-uploader`, 'PUT');

/**
 * Remove the 'custom-iso-uploader' role from a user
 * @param {string} userId - ID of the user
 * @returns {Promise<Object>} Response
 */
export const removeCustomIsoRole = (userId) => 
  apiRequest(`/users/${userId}/roles/custom-iso-uploader`, 'DELETE');