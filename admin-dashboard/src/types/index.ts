export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'admin';
  createdAt: string;
}

export interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  priceUSD: number;
  stock: number;
  category?: Category;
  images?: string[];
  isActive: boolean;
  averageRating?: number;
  numReviews?: number;
  sortOrder?: number;
  createdAt: string;
}

export interface Category {
  _id: string;
  name: string;
  slug: string;
  description?: string;
  isActive: boolean;
}

export interface Order {
  _id: string;
  orderNumber: string;
  user?: User;
  customerEmail: string;
  items: OrderItem[];
  totalPrice: number;
  totalPriceUSD: number;
  cryptocurrency: string;
  paymentAddress: string;
  status: 'pending' | 'paid' | 'confirmed' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: string;
  updatedAt: string;
}

export interface OrderItem {
  product: string | Product;
  productName: string;
  quantity: number;
  price: number;
  priceUSD: number;
}

export interface DashboardStats {
  overview: {
    totalUsers: number;
    totalProducts: number;
    activeProducts: number;
    totalOrders: number;
    pendingOrders: number;
    confirmedOrders: number;
    totalRevenue: number;
    totalReviews: number;
  };
  recentOrders: Order[];
  topProducts: TopProduct[];
}

export interface TopProduct {
  _id: string;
  name: string;
  totalSold: number;
  revenue: number;
}

export interface SalesAnalytics {
  salesByDate: SalesByDate[];
  salesByCryptocurrency: SalesByCrypto[];
  averageOrderValue: number;
}

export interface SalesByDate {
  _id: string;
  totalOrders: number;
  totalRevenue: number;
}

export interface SalesByCrypto {
  _id: string;
  totalOrders: number;
  totalRevenue: number;
}

export interface SystemHealth {
  database: {
    status: string;
    connected: boolean;
  };
  email: {
    configured: boolean;
    verified: boolean;
  };
  server: {
    memoryUsage: {
      heapUsed: number;
      heapTotal: number;
      external: number;
    };
    uptime: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}
