import apiRequest from './apiCore';

export const fetchActiveIsos = () => apiRequest('/iso-images');
export const fetchAllIsosAdmin = () => apiRequest('/iso-images/admin');
export const saveIso = (isoData) => apiRequest('/iso-images', 'POST', isoData);
export const deleteIso = (id) => apiRequest(`/iso-images/${id}`, 'DELETE');

// --- NUOVA FUNZIONE MANCANTE ---
export const fetchUserFavorites = (userId) => apiRequest(`/iso-images/favorites?userId=${userId}`);

// --- NUOVA FUNZIONE PER CANCELLARE IL PREFERITO ---
export const deleteUserFavorite = (id) => apiRequest(`/iso-images/favorites/${id}`, 'DELETE');