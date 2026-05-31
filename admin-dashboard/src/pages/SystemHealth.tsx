import { useEffect, useState } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  CircularProgress,
  Chip,
} from '@mui/material';
import {
  CheckCircle,
  Error,
  Storage,
  Email,
  Memory,
  Schedule,
} from '@mui/icons-material';
import apiService from '../services/api';
import type { SystemHealth as SystemHealthType } from '../types';

const SystemHealth = () => {
  const [health, setHealth] = useState<SystemHealthType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSystemHealth();
    const interval = setInterval(loadSystemHealth, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadSystemHealth = async () => {
    try {
      setLoading(true);
      const response = await apiService.getSystemHealth();
      setHealth(response.data);
    } catch (error) {
      console.error('Error loading system health:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number) => {
    return (bytes / 1024 / 1024).toFixed(2) + ' MB';
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${days}d ${hours}h ${minutes}m`;
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
      <Typography variant="h4" gutterBottom>
        System Health
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Storage sx={{ mr: 1 }} />
                <Typography variant="h6">Database Status</Typography>
              </Box>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Typography variant="body2" color="textSecondary">
                  Connection Status
                </Typography>
                {health?.database.connected ? (
                  <Chip
                    icon={<CheckCircle />}
                    label="Connected"
                    color="success"
                    size="small"
                  />
                ) : (
                  <Chip
                    icon={<Error />}
                    label="Disconnected"
                    color="error"
                    size="small"
                  />
                )}
              </Box>
              <Typography variant="caption" color="textSecondary" sx={{ mt: 2, display: 'block' }}>
                Status: {health?.database.status}
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Email sx={{ mr: 1 }} />
                <Typography variant="h6">Email Service</Typography>
              </Box>
              <Box display="flex" alignItems="center" justifyContent="space-between" mb={1}>
                <Typography variant="body2" color="textSecondary">
                  Configuration
                </Typography>
                {health?.email.configured ? (
                  <Chip
                    icon={<CheckCircle />}
                    label="Configured"
                    color="success"
                    size="small"
                  />
                ) : (
                  <Chip
                    icon={<Error />}
                    label="Not Configured"
                    color="error"
                    size="small"
                  />
                )}
              </Box>
              <Box display="flex" alignItems="center" justifyContent="space-between">
                <Typography variant="body2" color="textSecondary">
                  Verification
                </Typography>
                {health?.email.verified ? (
                  <Chip
                    icon={<CheckCircle />}
                    label="Verified"
                    color="success"
                    size="small"
                  />
                ) : (
                  <Chip
                    icon={<Error />}
                    label="Not Verified"
                    color="warning"
                    size="small"
                  />
                )}
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Memory sx={{ mr: 1 }} />
                <Typography variant="h6">Memory Usage</Typography>
              </Box>
              <Box mb={1}>
                <Typography variant="body2" color="textSecondary">
                  Heap Used: {formatBytes(health?.server.memoryUsage.heapUsed || 0)}
                </Typography>
              </Box>
              <Box mb={1}>
                <Typography variant="body2" color="textSecondary">
                  Heap Total: {formatBytes(health?.server.memoryUsage.heapTotal || 0)}
                </Typography>
              </Box>
              <Box>
                <Typography variant="body2" color="textSecondary">
                  External: {formatBytes(health?.server.memoryUsage.external || 0)}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Box display="flex" alignItems="center" mb={2}>
                <Schedule sx={{ mr: 1 }} />
                <Typography variant="h6">Server Uptime</Typography>
              </Box>
              <Typography variant="h4">
                {formatUptime(health?.server.uptime || 0)}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SystemHealth;
