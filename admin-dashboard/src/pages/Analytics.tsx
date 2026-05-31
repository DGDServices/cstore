import { useEffect, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Card,
  CardContent,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from '@mui/material';
import { TrendingUp, TrendingDown } from '@mui/icons-material';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import apiService from '../services/api';
import type { SalesAnalytics } from '../types';

interface ProductAnalytics {
  lowStockProducts: Array<{
    _id: string;
    name: string;
    stock: number;
  }>;
  outOfStockProducts: Array<{
    _id: string;
    name: string;
  }>;
  mostReviewedProducts: Array<{
    _id: string;
    name: string;
    reviewCount: number;
    avgRating: number;
  }>;
}

const Analytics = () => {
  const [salesAnalytics, setSalesAnalytics] = useState<SalesAnalytics | null>(null);
  const [productAnalytics, setProductAnalytics] = useState<ProductAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30d');

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      const [salesResponse, productResponse] = await Promise.all([
        apiService.getSalesAnalytics(period),
        apiService.getProductAnalytics(),
      ]);
      setSalesAnalytics(salesResponse.data);
      setProductAnalytics(productResponse.data);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Advanced Analytics</Typography>
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Period</InputLabel>
          <Select
            value={period}
            label="Period"
            onChange={(e) => setPeriod(e.target.value)}
          >
            <MenuItem value="7d">Last 7 Days</MenuItem>
            <MenuItem value="30d">Last 30 Days</MenuItem>
            <MenuItem value="90d">Last 90 Days</MenuItem>
            <MenuItem value="1y">Last Year</MenuItem>
          </Select>
        </FormControl>
      </Box>

      {/* Sales Metrics */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Average Order Value
              </Typography>
              <Typography variant="h4">
                ${salesAnalytics?.averageOrderValue?.toFixed(2) || '0.00'}
              </Typography>
              <Box display="flex" alignItems="center" mt={1}>
                <TrendingUp sx={{ fontSize: 20, color: 'success.main', mr: 0.5 }} />
                <Typography variant="caption" color="success.main">
                  +8.2% from last period
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Total Transactions
              </Typography>
              <Typography variant="h4">
                {salesAnalytics?.salesByDate?.reduce((acc, curr) => acc + curr.totalOrders, 0) || 0}
              </Typography>
              <Box display="flex" alignItems="center" mt={1}>
                <TrendingUp sx={{ fontSize: 20, color: 'success.main', mr: 0.5 }} />
                <Typography variant="caption" color="success.main">
                  +12.5% from last period
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Typography color="textSecondary" gutterBottom variant="body2">
                Conversion Rate
              </Typography>
              <Typography variant="h4">3.8%</Typography>
              <Box display="flex" alignItems="center" mt={1}>
                <TrendingDown sx={{ fontSize: 20, color: 'error.main', mr: 0.5 }} />
                <Typography variant="caption" color="error.main">
                  -2.1% from last period
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Revenue by Cryptocurrency */}
      <Paper sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          Revenue by Cryptocurrency
        </Typography>
        {salesAnalytics?.salesByCryptocurrency && (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={salesAnalytics.salesByCryptocurrency}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="_id" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="totalRevenue" fill="#667eea" name="Revenue ($)" />
              <Bar dataKey="totalOrders" fill="#764ba2" name="Orders" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Paper>

      {/* Product Analytics */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Low Stock Products
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell align="right">Stock</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {productAnalytics?.lowStockProducts?.map((product) => (
                    <TableRow key={product._id}>
                      <TableCell>{product.name}</TableCell>
                      <TableCell align="right">
                        <Typography
                          color={product.stock < 5 ? 'error.main' : 'warning.main'}
                          fontWeight="medium"
                        >
                          {product.stock}
                        </Typography>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!productAnalytics?.lowStockProducts?.length && (
                    <TableRow>
                      <TableCell colSpan={2} align="center">
                        <Typography variant="body2" color="textSecondary">
                          No low stock products
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Most Reviewed Products
            </Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Product</TableCell>
                    <TableCell align="right">Reviews</TableCell>
                    <TableCell align="right">Avg Rating</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {productAnalytics?.mostReviewedProducts?.map((product) => (
                    <TableRow key={product._id}>
                      <TableCell>{product.name}</TableCell>
                      <TableCell align="right">{product.reviewCount}</TableCell>
                      <TableCell align="right">⭐ {product.avgRating}</TableCell>
                    </TableRow>
                  ))}
                  {!productAnalytics?.mostReviewedProducts?.length && (
                    <TableRow>
                      <TableCell colSpan={3} align="center">
                        <Typography variant="body2" color="textSecondary">
                          No reviews yet
                        </Typography>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default Analytics;
