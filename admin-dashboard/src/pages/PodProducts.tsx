import { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  IconButton,
  Chip,
  TextField,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Tooltip,
} from '@mui/material';
import {
  Sync as SyncIcon,
  Publish as PublishIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useNotification } from '../components/common/NotificationProvider';
import api from '../services/api';

interface PodProduct {
  _id: string;
  title: string;
  printifyProductId: string;
  syncStatus: string;
  isPublished: boolean;
  isActive: boolean;
  variants: Array<{
    title: string;
    price: number;
    isEnabled: boolean;
  }>;
  lastSyncedAt?: string;
  createdAt: string;
}

const PodProducts = () => {
  const [products, setProducts] = useState<PodProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [syncStatusFilter, setSyncStatusFilter] = useState('');
  const [publishedFilter, setPublishedFilter] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<PodProduct | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const { showNotification } = useNotification();

  useEffect(() => {
    fetchProducts();
  }, [page, rowsPerPage, search, syncStatusFilter, publishedFilter]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const isPublished = publishedFilter === '' ? undefined : publishedFilter === 'true';
      const response = await api.getPodProducts(
        page + 1,
        rowsPerPage,
        search,
        syncStatusFilter,
        isPublished
      );
      
      setProducts(response.data.products);
      setTotal(response.data.pagination.total);
    } catch (error: any) {
      showNotification(
        error.response?.data?.message || 'Failed to fetch POD products',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSyncAll = async () => {
    try {
      setSyncing(true);
      const response = await api.syncPodProducts();
      showNotification(
        `Synced ${response.data.synced} products successfully`,
        'success'
      );
      fetchProducts();
    } catch (error: any) {
      showNotification(
        error.response?.data?.message || 'Failed to sync products',
        'error'
      );
    } finally {
      setSyncing(false);
    }
  };

  const handleSyncSingle = async (productId: string) => {
    try {
      await api.syncSinglePodProduct(productId);
      showNotification('Product synced successfully', 'success');
      fetchProducts();
    } catch (error: any) {
      showNotification(
        error.response?.data?.message || 'Failed to sync product',
        'error'
      );
    }
  };

  const handlePublish = async (productId: string) => {
    try {
      await api.publishPodProduct(productId);
      showNotification('Product published successfully', 'success');
      fetchProducts();
    } catch (error: any) {
      showNotification(
        error.response?.data?.message || 'Failed to publish product',
        'error'
      );
    }
  };

  const handleEdit = (product: PodProduct) => {
    setSelectedProduct(product);
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedProduct) return;

    try {
      await api.updatePodProduct(selectedProduct._id, {
        isActive: selectedProduct.isActive,
      });
      showNotification('Product updated successfully', 'success');
      setEditDialogOpen(false);
      fetchProducts();
    } catch (error: any) {
      showNotification(
        error.response?.data?.message || 'Failed to update product',
        'error'
      );
    }
  };

  const handleDelete = async (productId: string) => {
    if (!window.confirm('Are you sure you want to delete this product?')) {
      return;
    }

    try {
      await api.deletePodProduct(productId);
      showNotification('Product deleted successfully', 'success');
      fetchProducts();
    } catch (error: any) {
      showNotification(
        error.response?.data?.message || 'Failed to delete product',
        'error'
      );
    }
  };

  const getSyncStatusColor = (status: string) => {
    switch (status) {
      case 'synced':
        return 'success';
      case 'pending':
        return 'warning';
      case 'failed':
        return 'error';
      case 'out_of_sync':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Print-on-Demand Products
        </Typography>
        <Box>
          <Button
            variant="outlined"
            startIcon={syncing ? <CircularProgress size={20} /> : <SyncIcon />}
            onClick={handleSyncAll}
            disabled={syncing}
            sx={{ mr: 1 }}
          >
            Sync All Products
          </Button>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={fetchProducts}
          >
            Refresh
          </Button>
        </Box>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label="Search Products"
            variant="outlined"
            size="small"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ flexGrow: 1 }}
          />
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Sync Status</InputLabel>
            <Select
              value={syncStatusFilter}
              label="Sync Status"
              onChange={(e) => setSyncStatusFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="synced">Synced</MenuItem>
              <MenuItem value="pending">Pending</MenuItem>
              <MenuItem value="failed">Failed</MenuItem>
              <MenuItem value="out_of_sync">Out of Sync</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" sx={{ minWidth: 150 }}>
            <InputLabel>Published</InputLabel>
            <Select
              value={publishedFilter}
              label="Published"
              onChange={(e) => setPublishedFilter(e.target.value)}
            >
              <MenuItem value="">All</MenuItem>
              <MenuItem value="true">Published</MenuItem>
              <MenuItem value="false">Not Published</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : products.length === 0 ? (
        <Alert severity="info">
          No POD products found. Click "Sync All Products" to import from Printify.
        </Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Printify ID</TableCell>
                <TableCell>Variants</TableCell>
                <TableCell>Sync Status</TableCell>
                <TableCell>Published</TableCell>
                <TableCell>Active</TableCell>
                <TableCell>Last Synced</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {products.map((product) => (
                <TableRow key={product._id}>
                  <TableCell>{product.title}</TableCell>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                      {product.printifyProductId}
                    </Typography>
                  </TableCell>
                  <TableCell>{product.variants?.length || 0}</TableCell>
                  <TableCell>
                    <Chip
                      label={product.syncStatus}
                      color={getSyncStatusColor(product.syncStatus) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={product.isPublished ? 'Yes' : 'No'}
                      color={product.isPublished ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={product.isActive ? 'Yes' : 'No'}
                      color={product.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {product.lastSyncedAt
                      ? new Date(product.lastSyncedAt).toLocaleDateString()
                      : 'Never'}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="Sync Product">
                      <IconButton
                        size="small"
                        onClick={() => handleSyncSingle(product._id)}
                      >
                        <SyncIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {!product.isPublished && (
                      <Tooltip title="Publish Product">
                        <IconButton
                          size="small"
                          onClick={() => handlePublish(product._id)}
                        >
                          <PublishIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    <Tooltip title="Edit Product">
                      <IconButton
                        size="small"
                        onClick={() => handleEdit(product)}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete Product">
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(product._id)}
                        color="error"
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={total}
            page={page}
            onPageChange={(_, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => {
              setRowsPerPage(parseInt(e.target.value, 10));
              setPage(0);
            }}
          />
        </TableContainer>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)}>
        <DialogTitle>Edit POD Product</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Active Status</InputLabel>
            <Select
              value={selectedProduct?.isActive ? 'true' : 'false'}
              label="Active Status"
              onChange={(e) =>
                setSelectedProduct(
                  selectedProduct
                    ? { ...selectedProduct, isActive: e.target.value === 'true' }
                    : null
                )
              }
            >
              <MenuItem value="true">Active</MenuItem>
              <MenuItem value="false">Inactive</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleSaveEdit} variant="contained">
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PodProducts;
