import React, { useState, useEffect } from 'react';
import { 
    Box, Paper, Table, TableBody, TableCell, TableContainer, 
    TableHead, TableRow, Typography, TextField, Button, 
    IconButton, Tooltip, Card, CardContent, Chip, Alert
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';
import DesktopWindowsIcon from '@mui/icons-material/DesktopWindows';
import LinkIcon from '@mui/icons-material/Link';
import { fetchAllIsosAdmin, saveIso, deleteIso } from '../../services/isoService';
import useApiError from '../../hooks/useApiError';

// Regex per feedback visivo immediato (inizia con http o https)
const URL_REGEX = /^(https?:\/\/)/;

const IsoManagement = () => {
    const [isos, setIsos] = useState([]);
    // Nota: 'name' è l'ID testuale (es. ubuntu), 'id' è quello numerico del DB (null per nuovi)
    const [newIso, setNewIso] = useState({ 
        name: '', 
        displayName: '', 
        imageUrl: '', 
        checksumUrl: '', 
        checksumType: 'sha256', // Default
        active: true 
    });
    
    const { withErrorHandling } = useApiError();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const loadIsos = async () => {
        await withErrorHandling(async () => {
            const data = await fetchAllIsosAdmin();
            setIsos(data);
        });
    };

    useEffect(() => {
        loadIsos();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        
        // Validazione Frontend pre-invio
        if (newIso.imageUrl && !URL_REGEX.test(newIso.imageUrl)) {
            alert("L'URL dell'immagine deve iniziare con http:// o https://");
            return;
        }

        setIsSubmitting(true);
        try {
            await withErrorHandling(async () => {
                await saveIso(newIso);
                // Reset form
                setNewIso({ name: '', displayName: '', imageUrl: '', checksumUrl: '', checksumType: 'sha256', active: true });
                await loadIsos();
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm("Sei sicuro di voler eliminare questa immagine OS?")) {
            await withErrorHandling(async () => {
                await deleteIso(id);
                await loadIsos();
            });
        }
    };

    // Helper per validazione visiva
    const isUrlInvalid = (url) => url.length > 0 && !URL_REGEX.test(url);

    return (
        <Box sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', mb: 1, fontWeight: 'bold', color: 'primary.main' }}>
                <DesktopWindowsIcon sx={{ mr: 1 }} />
                Gestione Immagini ISO
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Configura le immagini di sistema. Le immagini verranno validate (ping) dal server al momento del salvataggio.
            </Typography>

            {/* FORM DI AGGIUNTA */}
            <Card variant="outlined" sx={{ mb: 4, bgcolor: '#f8f9fa', borderRadius: 2 }}>
                <CardContent>
                    <Typography variant="subtitle2" fontWeight="bold" gutterBottom color="primary">
                        AGGIUNGI NUOVA ISO
                    </Typography>
                    <Box component="form" onSubmit={handleSave} sx={{ mt: 2 }}>
                        {/* Prima riga: Identificativi */}
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 2fr' }, gap: 2, mb: 2 }}>
                            <TextField
                                size="small"
                                label="ID Interno (es. ubuntu-24)"
                                value={newIso.name}
                                onChange={e => setNewIso({...newIso, name: e.target.value})}
                                required
                                helperText="Identificativo univoco (slug)"
                                disabled={isSubmitting}
                            />
                            <TextField
                                size="small"
                                label="Nome Visualizzato (es. Ubuntu 24.04 LTS)"
                                value={newIso.displayName}
                                onChange={e => setNewIso({...newIso, displayName: e.target.value})}
                                required
                                helperText="Come appare nel menu agli utenti"
                                disabled={isSubmitting}
                            />
                        </Box>
                        
                        {/* Seconda riga: URL */}
                        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '2fr 1fr' }, gap: 2, mb: 2 }}>
                            <TextField
                                size="small"
                                label="Image URL (.qcow2 / .img)"
                                value={newIso.imageUrl}
                                onChange={e => setNewIso({...newIso, imageUrl: e.target.value})}
                                required
                                placeholder="http://192.168.1.50/images/ubuntu.qcow2"
                                error={isUrlInvalid(newIso.imageUrl)}
                                helperText={isUrlInvalid(newIso.imageUrl) ? "Deve iniziare con http/https" : "URL diretto al file"}
                                disabled={isSubmitting}
                                InputProps={{ endAdornment: <LinkIcon color="action" fontSize="small" /> }}
                            />
                            <TextField
                                size="small"
                                label="Checksum URL (.sha256)"
                                value={newIso.checksumUrl}
                                onChange={e => setNewIso({...newIso, checksumUrl: e.target.value})}
                                placeholder="http://.../SHA256SUMS"
                                error={isUrlInvalid(newIso.checksumUrl)}
                                helperText={isUrlInvalid(newIso.checksumUrl) ? "Deve iniziare con http/https" : "Opzionale ma raccomandato"}
                                disabled={isSubmitting}
                            />
                        </Box>

                        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <Button 
                                type="submit" 
                                variant="contained" 
                                startIcon={isSubmitting ? <CircularProgress size={20} color="inherit"/> : <AddCircleOutlineIcon />}
                                disabled={isSubmitting || isUrlInvalid(newIso.imageUrl)}
                                sx={{ px: 4, py: 1 }}
                            >
                                {isSubmitting ? 'Verifica e Salvataggio...' : 'Aggiungi ISO'}
                            </Button>
                        </Box>
                    </Box>
                </CardContent>
            </Card>

            {/* TABELLA */}
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
                <Table sx={{ minWidth: 800 }}>
                    <TableHead sx={{ bgcolor: '#eee' }}>
                        <TableRow>
                            <TableCell sx={{ fontWeight: 'bold' }}>ID</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Nome</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }}>Configurazione URL</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }} align="center">Stato</TableCell>
                            <TableCell sx={{ fontWeight: 'bold' }} align="right">Azioni</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {isos.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                                    Nessuna immagine configurata.
                                </TableCell>
                            </TableRow>
                        ) : (
                            isos.map((iso) => (
                                <TableRow key={iso.id} hover>
                                    <TableCell>
                                        <Chip label={iso.name} size="small" variant="outlined" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }} />
                                    </TableCell>
                                    <TableCell sx={{ fontWeight: 'medium' }}>{iso.displayName}</TableCell>
                                    <TableCell>
                                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                                            <Tooltip title={iso.imageUrl}>
                                                <Typography variant="caption" sx={{ 
                                                    fontFamily: 'monospace', 
                                                    bgcolor: iso.imageUrl ? 'rgba(0,0,0,0.04)' : 'rgba(255,0,0,0.1)',
                                                    p: 0.5, borderRadius: 1,
                                                    display: 'flex', alignItems: 'center', width: 'fit-content', maxWidth: 300,
                                                    whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                                                }}>
                                                    <Box component="span" sx={{ mr: 1, fontSize: '10px' }}>💿</Box> 
                                                    {iso.imageUrl || "URL MANCANTE"}
                                                </Typography>
                                            </Tooltip>
                                            {iso.checksumUrl && (
                                                <Tooltip title={iso.checksumUrl}>
                                                    <Typography variant="caption" sx={{ fontFamily: 'monospace', color: 'text.secondary', display: 'flex', alignItems: 'center' }}>
                                                        <Box component="span" sx={{ mr: 1, fontSize: '10px' }}>🛡️</Box> Checksum OK
                                                    </Typography>
                                                </Tooltip>
                                            )}
                                        </Box>
                                    </TableCell>
                                    <TableCell align="center">
                                        {iso.imageUrl ? (
                                            <Chip label="Attiva" color="success" size="small" variant="filled" />
                                        ) : (
                                            <Chip label="Incompleta" color="error" size="small" />
                                        )}
                                    </TableCell>
                                    <TableCell align="right">
                                        <IconButton color="error" onClick={() => handleDelete(iso.id)}>
                                            <DeleteIcon />
                                        </IconButton>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};

// Componente dummy per CircularProgress se non importato (ma è in MUI)
const CircularProgress = ({size}) => <Box sx={{ width: size, height: size, borderRadius: '50%', border: '2px solid white', borderTopColor: 'transparent', animation: 'spin 1s linear infinite' }} />;

export default IsoManagement;