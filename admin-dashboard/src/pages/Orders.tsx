import { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Typography,
  Chip,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Button,
} from '@mui/material';
import { FileDownload } from '@mui/icons-material';
import { format } from 'date-fns';
import apiService from '../services/api';
import type { Order } from '../types';
import ExportDialog from '../components/common/ExportDialog';
import { downloadBlob, generateFilename } from '../utils/exportUtils';

const Orders = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [page, rowsPerPage, statusFilter]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await apiService.getOrders(page + 1, rowsPerPage, statusFilter);
      setOrders(response.data || []);
      setTotal(response.pagination?.total || 0);
    } catch (error) {
      console.error('Error loading orders:', error);
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending':
        return 'warning';
      case 'paid':
      case 'confirmed':
        return 'success';
      case 'shipped':
        return 'info';
      case 'delivered':
        return 'success';
      case 'cancelled':
        return 'error';
      default:
        return 'default';
    }
  };

  const handleExport = async (format: 'csv' | 'pdf') => {
    try {
      let blob: Blob;
      let filename: string;

      if (format === 'csv') {
        blob = await apiService.exportOrdersCSV(statusFilter);
        filename = generateFilename('orders', 'csv');
      } else {
        blob = await apiService.exportOrdersPDF(statusFilter);
        filename = generateFilename('orders', 'pdf');
      }

      downloadBlob(blob, filename);
    } catch (error) {
      console.error('Export error:', error);
      throw error;
    }
  };

  if (loading && orders.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Orders</Typography>
        <Button
          variant="outlined"
          startIcon={<FileDownload />}
          onClick={() => setExportDialogOpen(true)}
        >
          Export
        </Button>
      </Box>

      <Paper sx={{ mb: 2, p: 2 }}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={statusFilter}
            label="Status"
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(0);
            }}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="paid">Paid</MenuItem>
            <MenuItem value="confirmed">Confirmed</MenuItem>
            <MenuItem value="shipped">Shipped</MenuItem>
            <MenuItem value="delivered">Delivered</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
          </Select>
        </FormControl>
      </Paper>

      <Paper>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Order #</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Items</TableCell>
                <TableCell>Total</TableCell>
                <TableCell>Cryptocurrency</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Date</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order._id} hover>
                  <TableCell>{order.orderNumber}</TableCell>
                  <TableCell>{order.user?.email || order.customerEmail}</TableCell>
                  <TableCell>{order.items.length}</TableCell>
                  <TableCell>${order.totalPriceUSD.toFixed(2)}</TableCell>
                  <TableCell>
                    <Chip label={order.cryptocurrency} size="small" />
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={order.status}
                      color={getStatusColor(order.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>{format(new Date(order.createdAt), 'MM/dd/yyyy HH:mm')}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
        title="Export Orders"
      />
    </Box>
  );
};

export default Orders;
