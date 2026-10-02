import axios from 'axios';
import type { AxiosInstance, InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor to add auth token
    this.api.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('adminToken');
        if (token && config.headers) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Response interceptor to handle errors
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem('adminToken');
          localStorage.removeItem('adminUser');
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }
    );
  }

  // Auth endpoints
  async login(email: string, password: string) {
    const response = await this.api.post('/auth/login', { email, password });
    return response.data;
  }

  async getProfile() {
    const response = await this.api.get('/auth/profile');
    return response.data;
  }

  // Dashboard endpoints
  async getDashboardStats(startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const response = await this.api.get(`/admin/dashboard/stats?${params.toString()}`);
    return response.data;
  }

  async getSalesAnalytics(period = '30d') {
    const response = await this.api.get(`/admin/analytics/sales?period=${period}`);
    return response.data;
  }

  async getProductAnalytics() {
    const response = await this.api.get('/admin/analytics/products');
    return response.data;
  }

  async getSystemHealth() {
    const response = await this.api.get('/admin/system/health');
    return response.data;
  }

  async getActivityLog(limit = 20) {
    const response = await this.api.get(`/admin/activity?limit=${limit}`);
    return response.data;
  }

  // User management
  async getUsers(page = 1, limit = 10, search?: string, role?: string) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (search) params.append('search', search);
    if (role) params.append('role', role);
    
    const response = await this.api.get(`/admin/users?${params.toString()}`);
    return response.data;
  }

  async getUserDetails(userId: string) {
    const response = await this.api.get(`/admin/users/${userId}`);
    return response.data;
  }

  async updateUserRole(userId: string, role: string) {
    const response = await this.api.put(`/admin/users/${userId}/role`, { role });
    return response.data;
  }

  async deleteUser(userId: string) {
    const response = await this.api.delete(`/admin/users/${userId}`);
    return response.data;
  }

  // Product management
  async getProducts(page = 1, limit = 10, search?: string) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (search) params.append('search', search);
    
    const response = await this.api.get(`/products?${params.toString()}`);
    return response.data;
  }

  async getProduct(productId: string) {
    const response = await this.api.get(`/products/${productId}`);
    return response.data;
  }

  async createProduct(productData: any) {
    const response = await this.api.post('/products', productData);
    return response.data;
  }

  async updateProduct(productId: string, productData: any) {
    const response = await this.api.put(`/products/${productId}`, productData);
    return response.data;
  }

  async deleteProduct(productId: string) {
    const response = await this.api.delete(`/products/${productId}`);
    return response.data;
  }

  async reorderProducts(productOrders: Array<{ productId: string; sortOrder: number }>) {
    const response = await this.api.put('/admin/products/reorder', { productOrders });
    return response.data;
  }

  async exportProductsCSV(search?: string, category?: string) {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (category) params.append('category', category);
    
    const response = await this.api.get(`/admin/products/export/csv?${params.toString()}`, {
      responseType: 'blob'
    });
    return response.data;
  }

  async exportProductsPDF(search?: string, category?: string) {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (category) params.append('category', category);
    
    const response = await this.api.get(`/admin/products/export/pdf?${params.toString()}`, {
      responseType: 'blob'
    });
    return response.data;
  }

  // Order management
  async getOrders(page = 1, limit = 10, status?: string) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    if (status) params.append('status', status);
    
    const response = await this.api.get(`/admin/orders?${params.toString()}`);
    return response.data;
  }

  async getOrder(orderId: string) {
    const response = await this.api.get(`/orders/${orderId}`);
    return response.data;
  }

  async updateOrderStatus(orderId: string, status: string) {
    const response = await this.api.put(`/orders/${orderId}/status`, { status });
    return response.data;
  }

  async exportOrdersCSV(status?: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const response = await this.api.get(`/admin/orders/export/csv?${params.toString()}`, {
      responseType: 'blob'
    });
    return response.data;
  }

  async exportOrdersPDF(status?: string, startDate?: string, endDate?: string) {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    
    const response = await this.api.get(`/admin/orders/export/pdf?${params.toString()}`, {
      responseType: 'blob'
    });
    return response.data;
  }

  // Reviews moderation
  async getPendingReviews(page = 1, limit = 10) {
    const params = new URLSearchParams();
    params.append('page', page.toString());
    params.append('limit', limit.toString());
    
    const response = await this.api.get(`/admin/reviews/pending?${params.toString()}`);
    return response.data;
  }

  async approveReview(reviewId: string) {
    const response = await this.api.put(`/reviews/${reviewId}/approve`);
    return response.data;
  }

  async exportUsersCSV(role?: string, search?: string) {
    const params = new URLSearchParams();
    if (role) params.append('role', role);
    if (search) params.append('search', search);
    
    const response = await this.api.get(`/admin/users/export/csv?${params.toString()}`, {
      responseType: 'blob'
    });
    return response.data;
  }
}

export default new ApiService();
