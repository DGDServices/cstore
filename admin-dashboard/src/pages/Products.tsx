import { useEffect, useState } from 'react';
import {
  Box,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Typography,
  IconButton,
  Chip,
  TextField,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  Search,
  CheckCircle,
  Cancel,
  DragIndicator,
  FileDownload,
} from '@mui/icons-material';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import apiService from '../services/api';
import type { Product } from '../types';
import ExportDialog from '../components/common/ExportDialog';
import { downloadBlob, generateFilename } from '../utils/exportUtils';

interface SortableRowProps {
  product: Product;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

const SortableRow = ({ product, onEdit, onDelete }: SortableRowProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: product._id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    backgroundColor: isDragging ? '#f5f5f5' : 'transparent',
  };

  return (
    <TableRow ref={setNodeRef} style={style}>
      <TableCell>
        <IconButton size="small" {...attributes} {...listeners}>
          <DragIndicator />
        </IconButton>
      </TableCell>
      <TableCell>
        <Box>
          <Typography variant="body2" fontWeight="medium">
            {product.name}
          </Typography>
          <Typography variant="caption" color="textSecondary">
            {product.category?.name || 'No category'}
          </Typography>
        </Box>
      </TableCell>
      <TableCell>${product.priceUSD.toFixed(2)}</TableCell>
      <TableCell>
        <Chip
          label={product.stock}
          size="small"
          color={product.stock > 10 ? 'success' : product.stock > 0 ? 'warning' : 'error'}
        />
      </TableCell>
      <TableCell>
        {product.isActive ? (
          <Chip
            icon={<CheckCircle />}
            label="Active"
            size="small"
            color="success"
          />
        ) : (
          <Chip
            icon={<Cancel />}
            label="Inactive"
            size="small"
            color="default"
          />
        )}
      </TableCell>
      <TableCell>
        {product.averageRating ? (
          <Box>
            ⭐ {product.averageRating.toFixed(1)}
            <Typography variant="caption" color="textSecondary" sx={{ ml: 1 }}>
              ({product.numReviews})
            </Typography>
          </Box>
        ) : (
          'No reviews'
        )}
      </TableCell>
      <TableCell align="right">
        <IconButton
          size="small"
          onClick={() => onEdit(product._id)}
        >
          <Edit />
        </IconButton>
        <IconButton
          size="small"
          color="error"
          onClick={() => onDelete(product._id)}
        >
          <Delete />
        </IconButton>
      </TableCell>
    </TableRow>
  );
};

const Products = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  useEffect(() => {
    loadProducts();
  }, [page, rowsPerPage, search]);

  const loadProducts = async () => {
    try {
      setLoading(true);
      const response = await apiService.getProducts(page + 1, rowsPerPage, search);
      setProducts(response.data);
      setTotal(response.pagination?.total || 0);
    } catch (error) {
      console.error('Error loading products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePage = (_event: unknown, newPage: number) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event: React.ChangeEvent<HTMLInputElement>) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleDelete = async (productId: string) => {
    if (window.confirm('Are you sure you want to delete this product?')) {
      try {
        await apiService.deleteProduct(productId);
        loadProducts();
      } catch (error) {
        console.error('Error deleting product:', error);
        alert('Failed to delete product');
      }
    }
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = products.findIndex((p) => p._id === active.id);
      const newIndex = products.findIndex((p) => p._id === over.id);

      const reorderedProducts = arrayMove(products, oldIndex, newIndex);
      setProducts(reorderedProducts);

      // Update sort orders and send to backend
      try {
        const productOrders = reorderedProducts.map((product, index) => ({
          productId: product._id,
          sortOrder: index,
        }));

        await apiService.reorderProducts(productOrders);
      } catch (error) {
        console.error('Error reordering products:', error);
        alert('Failed to save product order');
        // Reload to revert changes
        loadProducts();
      }
    }
  };

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      let blob: Blob;
      let filename: string;

      if (format === 'csv') {
        blob = await apiService.exportProductsCSV(search);
        filename = generateFilename('products', 'csv');
      } else {
        blob = await apiService.exportProductsPDF(search);
        filename = generateFilename('products', 'pdf');
      }

      downloadBlob(blob, filename);
    } catch (error) {
      console.error('Export error:', error);
      throw error;
    }
  };

  const handleEdit = (productId: string) => {
    // TODO: Open edit dialog
    console.log('Edit product:', productId);
  };

  if (loading && products.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Products</Typography>
        <Box display="flex" gap={2}>
          <Button
            variant="outlined"
            startIcon={<FileDownload />}
            onClick={() => setExportDialogOpen(true)}
          >
            Export
          </Button>
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => {/* TODO: Open create dialog */}}
          >
            Add Product
          </Button>
        </Box>
      </Box>

      <Paper sx={{ mb: 2, p: 2 }}>
        <TextField
          fullWidth
          placeholder="Search products..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search />
              </InputAdornment>
            ),
          }}
        />
      </Paper>

      <Paper>
        <TableContainer>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell width={50}></TableCell>
                  <TableCell>Name</TableCell>
                  <TableCell>Price (USD)</TableCell>
                  <TableCell>Stock</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Rating</TableCell>
                  <TableCell align="right">Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <SortableContext
                  items={products.map((p) => p._id)}
                  strategy={verticalListSortingStrategy}
                >
                  {products.map((product) => (
                    <SortableRow
                      key={product._id}
                      product={product}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                    />
                  ))}
                </SortableContext>
              </TableBody>
            </Table>
          </DndContext>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={total}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>

      <ExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        onExport={handleExport}
        title="Export Products"
      />
    </Box>
  );
};

export default Products;
