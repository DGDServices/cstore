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
  Grid,
  Card,
  CardContent,
  Divider,
} from '@mui/material';
import {
  Visibility as VisibilityIcon,
  Send as SendIcon,
  Cancel as CancelIcon,
  Refresh as RefreshIcon,
} from '@mui/icons-material';
import { useNotification } from '../components/common/NotificationProvider';
import api from '../services/api';

interface PodOrder {
  _id: string;
  order: {
    orderNumber?: string;
    customerEmail: string;
    totalPrice: number;
  };
  status: string;
  printifyOrderId?: string;
  items: Array<{
    podProduct: {
      title: string;
    };
    quantity: number;
    price: number;
  }>;
  shippingAddress: {
    firstName: string;
    lastName: string;
    country: string;
    city: string;
  };
  tracking?: {
    number: string;
    carrier: string;
    url: string;
  };
  totalPrice: number;
  totalCost: number;
  createdAt: string;
  submittedAt?: string;
  shippedAt?: string;
}

const PodOrders = () => {
  const [orders, setOrders] = useState<PodOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(20);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<PodOrder | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const { showNotification } = useNotification();

  useEffect(() => {
    fetchOrders();
  }, [page, rowsPerPage, statusFilter]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await api.getPodOrders(
        page + 1,
        rowsPerPage,
        statusFilter
      );
      
      setOrders(response.data.orders);
      setTotal(response.data.pagination.total);
    } catch (error: any) {
      showNotification(
        error.response?.data?.message || 'Failed to fetch POD orders',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetails = async (orderId: string) => {
    try {
      const response = await api.getPodOrder(orderId);
      setSelectedOrder(response.data.order);
      setDetailsDialogOpen(true);
    } catch (error: any) {
      showNotification(
        error.response?.data?.message || 'Failed to fetch order details',
        'error'
      );
    }
  };

  const handleSubmitOrder = async (orderId: string) => {
    if (!window.confirm('Submit this order to Printify for production?')) {
      return;
    }

    try {
      await api.submitPodOrder(orderId);
      showNotification('Order submitted to Printify successfully', 'success');
      fetchOrders();
    } catch (error: any) {
      showNotification(
        error.response?.data?.message || 'Failed to submit order',
        'error'
      );
    }
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!window.confirm('Are you sure you want to cancel this order?')) {
      return;
    }

    try {
      await api.cancelPodOrder(orderId);
      showNotification('Order cancelled successfully', 'success');
      fetchOrders();
    } catch (error: any) {
      showNotification(
        error.response?.data?.message || 'Failed to cancel order',
        'error'
      );
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft':
        return 'default';
      case 'pending':
        return 'warning';
      case 'in_production':
        return 'info';
      case 'shipped':
        return 'primary';
      case 'delivered':
        return 'success';
      case 'cancelled':
        return 'error';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: string) => {
    return status.replace(/_/g, ' ').toUpperCase();
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
        <Typography variant="h4" gutterBottom>
          Print-on-Demand Orders
        </Typography>
        <Button
          variant="outlined"
          startIcon={<RefreshIcon />}
          onClick={fetchOrders}
        >
          Refresh
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 2 }}>
        <FormControl size="small" sx={{ minWidth: 200 }}>
          <InputLabel>Status Filter</InputLabel>
          <Select
            value={statusFilter}
            label="Status Filter"
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="draft">Draft</MenuItem>
            <MenuItem value="pending">Pending</MenuItem>
            <MenuItem value="in_production">In Production</MenuItem>
            <MenuItem value="shipped">Shipped</MenuItem>
            <MenuItem value="delivered">Delivered</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
            <MenuItem value="failed">Failed</MenuItem>
          </Select>
        </FormControl>
      </Paper>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
          <CircularProgress />
        </Box>
      ) : orders.length === 0 ? (
        <Alert severity="info">No POD orders found.</Alert>
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Order ID</TableCell>
                <TableCell>Customer</TableCell>
                <TableCell>Items</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Printify ID</TableCell>
                <TableCell>Total</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {orders.map((order) => (
                <TableRow key={order._id}>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                      {order._id.substring(0, 8)}...
                    </Typography>
                  </TableCell>
                  <TableCell>{order.order.customerEmail}</TableCell>
                  <TableCell>
                    {order.items.reduce((sum, item) => sum + item.quantity, 0)} items
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={getStatusLabel(order.status)}
                      color={getStatusColor(order.status) as any}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {order.printifyOrderId ? (
                      <Typography variant="caption" sx={{ fontFamily: 'monospace' }}>
                        {order.printifyOrderId}
                      </Typography>
                    ) : (
                      '-'
                    )}
                  </TableCell>
                  <TableCell>${order.totalPrice.toFixed(2)}</TableCell>
                  <TableCell>
                    {new Date(order.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell align="right">
                    <Tooltip title="View Details">
                      <IconButton
                        size="small"
                        onClick={() => handleViewDetails(order._id)}
                      >
                        <VisibilityIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {order.status === 'draft' && (
                      <Tooltip title="Submit to Printify">
                        <IconButton
                          size="small"
                          onClick={() => handleSubmitOrder(order._id)}
                          color="primary"
                        >
                          <SendIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                    {(order.status === 'pending' || order.status === 'draft') && (
                      <Tooltip title="Cancel Order">
                        <IconButton
                          size="small"
                          onClick={() => handleCancelOrder(order._id)}
                          color="error"
                        >
                          <CancelIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
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

      {/* Order Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>POD Order Details</DialogTitle>
        <DialogContent>
          {selectedOrder && (
            <Box sx={{ mt: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Order Information
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <Typography variant="body2" gutterBottom>
                        <strong>Order ID:</strong> {selectedOrder._id}
                      </Typography>
                      <Typography variant="body2" gutterBottom>
                        <strong>Status:</strong>{' '}
                        <Chip
                          label={getStatusLabel(selectedOrder.status)}
                          color={getStatusColor(selectedOrder.status) as any}
                          size="small"
                        />
                      </Typography>
                      {selectedOrder.printifyOrderId && (
                        <Typography variant="body2" gutterBottom>
                          <strong>Printify ID:</strong> {selectedOrder.printifyOrderId}
                        </Typography>
                      )}
                      <Typography variant="body2" gutterBottom>
                        <strong>Created:</strong>{' '}
                        {new Date(selectedOrder.createdAt).toLocaleString()}
                      </Typography>
                      {selectedOrder.submittedAt && (
                        <Typography variant="body2" gutterBottom>
                          <strong>Submitted:</strong>{' '}
                          {new Date(selectedOrder.submittedAt).toLocaleString()}
                        </Typography>
                      )}
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Shipping Address
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <Typography variant="body2">
                        {selectedOrder.shippingAddress.firstName}{' '}
                        {selectedOrder.shippingAddress.lastName}
                      </Typography>
                      <Typography variant="body2">
                        {selectedOrder.shippingAddress.city},{' '}
                        {selectedOrder.shippingAddress.country}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                {selectedOrder.tracking && (
                  <Grid item xs={12}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6" gutterBottom>
                          Tracking Information
                        </Typography>
                        <Divider sx={{ mb: 2 }} />
                        <Typography variant="body2" gutterBottom>
                          <strong>Carrier:</strong> {selectedOrder.tracking.carrier}
                        </Typography>
                        <Typography variant="body2" gutterBottom>
                          <strong>Tracking Number:</strong>{' '}
                          {selectedOrder.tracking.number}
                        </Typography>
                        {selectedOrder.tracking.url && (
                          <Button
                            size="small"
                            href={selectedOrder.tracking.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Track Package
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  </Grid>
                )}

                <Grid item xs={12}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6" gutterBottom>
                        Items
                      </Typography>
                      <Divider sx={{ mb: 2 }} />
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Product</TableCell>
                            <TableCell align="right">Quantity</TableCell>
                            <TableCell align="right">Price</TableCell>
                            <TableCell align="right">Total</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {selectedOrder.items.map((item, index) => (
                            <TableRow key={index}>
                              <TableCell>{item.podProduct.title}</TableCell>
                              <TableCell align="right">{item.quantity}</TableCell>
                              <TableCell align="right">
                                ${item.price.toFixed(2)}
                              </TableCell>
                              <TableCell align="right">
                                ${(item.price * item.quantity).toFixed(2)}
                              </TableCell>
                            </TableRow>
                          ))}
                          <TableRow>
                            <TableCell colSpan={3} align="right">
                              <strong>Total:</strong>
                            </TableCell>
                            <TableCell align="right">
                              <strong>${selectedOrder.totalPrice.toFixed(2)}</strong>
                            </TableCell>
                          </TableRow>
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDetailsDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default PodOrders;
