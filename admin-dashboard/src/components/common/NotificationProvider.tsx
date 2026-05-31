import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useSelector } from 'react-redux';
import { Snackbar, Alert, AlertTitle } from '@mui/material';
import type { RootState } from '../../store';
import socketService from '../../services/socket';

interface Notification {
  id: string;
  type: 'success' | 'info' | 'warning' | 'error';
  title: string;
  message: string;
}

interface NotificationProviderProps {
  children: ReactNode;
}

const NotificationProvider = ({ children }: NotificationProviderProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { token, isAuthenticated } = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    if (isAuthenticated && token) {
      // Connect to socket
      socketService.connect(token);

      // Listen for new order notifications
      const handleNewOrder = (data: any) => {
        addNotification({
          id: `order-${Date.now()}`,
          type: 'info',
          title: 'New Order',
          message: `Order #${data.orderNumber} received - $${data.totalPriceUSD}`,
        });
      };

      // Listen for payment confirmations
      const handlePaymentConfirmed = (data: any) => {
        addNotification({
          id: `payment-${Date.now()}`,
          type: 'success',
          title: 'Payment Confirmed',
          message: `Payment for order #${data.orderNumber} confirmed`,
        });
      };

      // Listen for order status changes
      const handleOrderStatusChange = (data: any) => {
        addNotification({
          id: `status-${Date.now()}`,
          type: 'info',
          title: 'Order Status Updated',
          message: `Order #${data.orderNumber} status changed to ${data.status}`,
        });
      };

      // Listen for system alerts
      const handleSystemAlert = (data: any) => {
        addNotification({
          id: `alert-${Date.now()}`,
          type: data.severity || 'warning',
          title: 'System Alert',
          message: data.message,
        });
      };

      socketService.on('newOrder', handleNewOrder);
      socketService.on('paymentConfirmed', handlePaymentConfirmed);
      socketService.on('orderStatusChange', handleOrderStatusChange);
      socketService.on('systemAlert', handleSystemAlert);

      return () => {
        socketService.off('newOrder', handleNewOrder);
        socketService.off('paymentConfirmed', handlePaymentConfirmed);
        socketService.off('orderStatusChange', handleOrderStatusChange);
        socketService.off('systemAlert', handleSystemAlert);
        socketService.disconnect();
      };
    }
  }, [isAuthenticated, token]);

  const addNotification = (notification: Notification) => {
    setNotifications((prev) => [...prev, notification]);
  };

  const removeNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <>
      {children}
      {notifications.map((notification, index) => (
        <Snackbar
          key={notification.id}
          open={true}
          autoHideDuration={6000}
          onClose={() => removeNotification(notification.id)}
          anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
          sx={{ top: `${80 + index * 70}px !important` }}
        >
          <Alert
            onClose={() => removeNotification(notification.id)}
            severity={notification.type}
            variant="filled"
            sx={{ width: '100%' }}
          >
            <AlertTitle>{notification.title}</AlertTitle>
            {notification.message}
          </Alert>
        </Snackbar>
      ))}
    </>
  );
};

export default NotificationProvider;
