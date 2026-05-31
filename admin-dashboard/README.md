# Cryptons Admin Dashboard

**Version:** 2.2.0  
**Last Updated:** October 2025

A **modern, responsive, feature-rich React-based admin dashboard** for the Cryptons.com cryptocurrency trading platform. Built with React 19, TypeScript, and Material-UI, this dashboard provides comprehensive management tools for platform operations, analytics, and monitoring.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Technical Specifications](#technical-specifications)
- [Getting Started](#getting-started)
- [Authentication & Security](#authentication--security)
- [Dashboard Features](#dashboard-features)
- [Project Structure](#project-structure)
- [Development](#development)
- [Performance & Optimization](#performance--optimization)
- [Browser Support](#browser-support)
- [Deployment](#deployment)
- [Testing](#testing)
- [Troubleshooting](#troubleshooting)

---

## Overview

The Cryptons Admin Dashboard is a comprehensive administrative interface designed for managing all aspects of a cryptocurrency trading platform. It provides real-time monitoring, data visualization, and management capabilities essential for platform operations.

**Key Capabilities:**
- Real-time platform metrics and analytics
- Complete product, order, and user management
- System health monitoring
- Review moderation
- Data export functionality (CSV/PDF)
- WebSocket-based real-time notifications
- Responsive design for all devices

---

## Features

### Core Functionality

#### 🔐 JWT Authentication
- **Secure Login**: Token-based authentication with automatic refresh
- **Session Management**: Automatic logout on token expiration
- **Role-Based Access**: Admin-only access control
- **Protected Routes**: All routes require valid authentication
- **Remember Me**: Optional persistent sessions

#### 📊 Dashboard Overview
- **Key Performance Indicators (KPIs)**
  - Total revenue with period comparison
  - Total orders and growth metrics
  - Active users count
  - Pending orders requiring attention
  
- **Sales Trends**
  - Interactive line charts
  - Date range selection
  - Period-over-period comparison
  - Revenue by cryptocurrency visualization
  
- **Recent Activity**
  - Latest orders with quick actions
  - Recent user registrations
  - System alerts and warnings
  - Quick navigation to detailed views

#### 📈 Advanced Analytics
- **Revenue Analytics**
  - Sales trends over time (daily, weekly, monthly)
  - Revenue breakdown by cryptocurrency (BTC, ETH, LTC, XRP)
  - Average order value tracking
  - Transaction count monitoring
  
- **Product Analytics**
  - Low stock alerts with thresholds
  - Best-selling products tracking
  - Most reviewed products
  - Product performance metrics
  
- **Period Selection**
  - Last 7 days, 30 days, 90 days, or custom range
  - Year-over-year comparisons
  - Trend analysis with visual indicators

#### 📦 Product Management
- **Product Listing**
  - Searchable product table with filters
  - Stock level indicators (low, medium, high)
  - Quick view product details
  - Pagination for large datasets
  
- **Drag-and-Drop Reordering**
  - Intuitive drag-and-drop interface (@dnd-kit)
  - Visual feedback during drag operations
  - Automatic position saving
  - Bulk reordering capabilities
  
- **Data Export**
  - CSV export with all product data
  - PDF export with formatted tables
  - Custom field selection
  - Export with applied filters

#### 🛒 Order Management
- **Order Listing**
  - Comprehensive order table
  - Status-based filtering (pending, processing, shipped, delivered, cancelled)
  - Search by order ID or customer
  - Real-time order updates
  
- **Order Details**
  - Complete order information
  - Customer details
  - Payment status and method
  - Shipping information
  - Order timeline
  
- **Status Management**
  - Update order status with one click
  - Bulk status updates
  - Status change notifications
  - Order history tracking
  
- **Data Export**
  - CSV/PDF export with filtering
  - Date range selection
  - Custom column selection
  - Formatted reports

#### 👥 User Management
- **User Directory**
  - Browse all registered users
  - Search by name, email, or username
  - Role display (admin/user)
  - Registration date tracking
  
- **User Details**
  - Complete user profile information
  - Order history
  - Account status
  - Activity logs
  
- **Data Export**
  - CSV export of user data
  - Privacy-compliant exports
  - Custom field selection
  - Filtered exports

#### ⭐ Review Moderation
- **Review Management**
  - Browse all product reviews
  - Filter by status (pending, approved, rejected)
  - Rating display with visual indicators
  - Review content preview
  
- **Moderation Actions**
  - Approve/reject reviews
  - Bulk moderation
  - Review editing
  - User feedback management

#### ⚙️ System Health Monitoring
- **Service Status**
  - Database connectivity indicator
  - Email service health check
  - API response time monitoring
  - External service status
  
- **Resource Monitoring**
  - Memory usage tracking
  - Server uptime display
  - Performance metrics
  - Error rate monitoring
  
- **Real-time Alerts**
  - Critical system warnings
  - Service outage notifications
  - Performance degradation alerts
  - Threshold-based warnings

### Advanced Features

#### 🔔 Real-time Notifications (WebSocket)
- **Order Notifications**
  - New order alerts with order details
  - Order status change notifications
  - Payment confirmation alerts
  
- **System Notifications**
  - Low stock warnings
  - Service health alerts
  - Error notifications
  - User activity alerts
  
- **Toast System**
  - Material-UI Snackbar integration
  - Auto-dismiss with configurable timeout
  - Action buttons (undo, view details)
  - Priority-based display

#### 📱 Responsive Design
- **Mobile Optimization**
  - Touch-friendly interfaces
  - Optimized layouts for small screens
  - Mobile-specific navigation
  - Swipe gestures support
  
- **Tablet Support**
  - Medium screen optimizations
  - Adaptive grid layouts
  - Touch and mouse support
  
- **Desktop Experience**
  - Full-featured interface
  - Keyboard shortcuts
  - Multiple monitor support
  - Advanced data visualizations

#### 🎨 User Experience
- **Material Design**
  - Consistent design language
  - Modern component library
  - Customizable theming
  - Accessibility compliance
  
- **Interactive Elements**
  - Loading states for all actions
  - Error handling with user feedback
  - Form validation with inline errors
  - Confirmation dialogs for critical actions
  
- **Navigation**
  - Intuitive sidebar menu
  - Breadcrumb navigation
  - Quick access shortcuts
  - Search functionality

---

## Technical Specifications

### Technical Stack

**Frontend Framework:**
- **React 19.0** - Latest React features and performance improvements
- **TypeScript 5.x** - Type safety and enhanced developer experience
- **Vite 5.x** - Lightning-fast build tool with HMR

**UI Framework:**
- **Material-UI (MUI) v6** - Comprehensive React component library
  - Pre-built components (Buttons, Tables, Cards, etc.)
  - Theming and customization
  - Responsive grid system
  - Icons library (@mui/icons-material)

**State Management:**
- **Redux Toolkit** - Modern Redux with less boilerplate
  - Slice-based architecture
  - RTK Query for API integration
  - Redux DevTools integration
  - Immutable state updates

**Routing:**
- **React Router v6** - Client-side routing
  - Protected route components
  - Lazy loading for code splitting
  - Route-based code splitting
  - Navigation guards

**Data Visualization:**
- **Recharts** - React charting library
  - Line charts for trends
  - Bar charts for comparisons
  - Pie charts for distributions
  - Area charts for cumulative data
  - Responsive charts
  - Custom tooltips and legends

**API Integration:**
- **Axios** - HTTP client
  - Interceptors for auth tokens
  - Request/response transformation
  - Error handling
  - Timeout configuration
  
- **Socket.io-client** - WebSocket client
  - Real-time event handling
  - Automatic reconnection
  - Room-based events
  - Acknowledgment callbacks

**Additional Libraries:**
- **@dnd-kit** - Modern drag-and-drop toolkit
  - Accessible drag-and-drop
  - Touch support
  - Keyboard navigation
  - Custom drag overlays
  
- **Papaparse** - CSV parser/generator
  - Fast CSV parsing
  - Stream support
  - UTF-8 handling
  - Large file support
  
- **jsPDF** - PDF generation
  - Client-side PDF creation
  - Custom styling
  - Table support
  - Image embedding

**Development Tools:**
- **ESLint** - Code linting
- **Prettier** - Code formatting  
- **TypeScript ESLint** - TypeScript-specific linting
- **Vite DevTools** - Development utilities

### Architecture

**Component Structure:**
```
src/
├── components/         # Reusable UI components
│   ├── charts/        # Chart components
│   ├── common/        # Common components (buttons, inputs, etc.)
│   ├── layout/        # Layout components (sidebar, header, etc.)
│   └── modals/        # Modal dialogs
├── pages/             # Page components (route-level)
├── services/          # API services and external integrations
├── store/             # Redux store and slices
├── types/             # TypeScript type definitions
├── utils/             # Utility functions and helpers
├── hooks/             # Custom React hooks
├── constants/         # Application constants
└── styles/            # Global styles and themes
```

**Design Patterns:**
- **Container/Presenter Pattern**: Separation of logic and presentation
- **Custom Hooks**: Reusable stateful logic
- **Higher-Order Components**: Cross-cutting concerns
- **Render Props**: Flexible component composition
- **Redux Slices**: Feature-based state organization

---

## Getting Started

### Prerequisites

**System Requirements:**
- **Node.js**: 16.x, 18.x, or 20.x (LTS recommended)
- **npm**: 8.x or higher
- **Backend API**: Running Cryptons backend server (default: `http://localhost:3000`)
- **Admin Account**: Valid admin user credentials

**Optional:**
- **Git**: For version control
- **VS Code**: Recommended editor with extensions:
  - ESLint
  - Prettier
  - TypeScript and JavaScript Language Features
  - ES7+ React/Redux/React-Native snippets

### Installation

#### Step 1: Clone and Navigate

```bash
# If cloning the entire repository
git clone https://github.com/thewriterben/cstore.git
cd cstore/admin-dashboard

# Or if already in the cstore directory
cd admin-dashboard
```

#### Step 2: Install Dependencies

```bash
npm install
```

**Note:** This will install all dependencies including React, Material-UI, Redux, and other required packages. Installation typically takes 2-5 minutes depending on your internet connection.

#### Step 3: Configure Environment

```bash
# Copy the example environment file
cp .env.example .env.development
```

**Edit `.env.development`** if your backend API runs on a different URL:

```env
# Backend API base URL
VITE_API_URL=http://localhost:3000/api

# WebSocket URL for real-time features
VITE_SOCKET_URL=http://localhost:3000

# Optional: Set to 'true' to enable debug mode
VITE_DEBUG=false
```

**Environment Variables:**
- `VITE_API_URL`: Backend API endpoint (must include `/api`)
- `VITE_SOCKET_URL`: WebSocket server URL (no trailing slash)
- `VITE_DEBUG`: Enable verbose logging for debugging

#### Step 4: Start Development Server

```bash
npm run dev
```

**Output:**
```
  VITE v5.x.x  ready in 324 ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: http://192.168.1.x:5173/
  ➜  press h to show help
```

The dashboard will be available at **`http://localhost:5173`**

**Hot Module Replacement (HMR):** Changes to source files will automatically reload in the browser.

#### Step 5: Access the Dashboard

1. Ensure the backend server is running at `http://localhost:3000`
2. Open your browser to `http://localhost:5173`
3. Log in with admin credentials:
   - **Role**: Must be `admin`
   - **Username/Email**: Your admin account
   - **Password**: Your admin password

### Building for Production

#### Production Build

```bash
npm run build
```

**Build Output:**
- Optimized bundle in `dist/` directory
- Minified JavaScript and CSS
- Asset optimization and compression
- Source maps for debugging (optional)

**Build Statistics:**
```
vite v5.x.x building for production...
✓ 342 modules transformed.
dist/index.html                   0.51 kB │ gzip:  0.32 kB
dist/assets/index-[hash].css     12.34 kB │ gzip:  3.21 kB
dist/assets/index-[hash].js     345.67 kB │ gzip: 98.76 kB
✓ built in 3.45s
```

#### Preview Production Build Locally

```bash
npm run preview
```

This starts a local server to preview the production build at `http://localhost:4173`

---

## Authentication & Security

### Authentication System

The admin dashboard implements a secure JWT-based authentication system with the following features:

#### Access Control
- **Admin-Only Access**: Only users with the `admin` role can access the dashboard
- **Role Verification**: Backend validates user role on each request
- **Protected Routes**: All dashboard routes require valid authentication
- **Automatic Redirection**: Unauthenticated users redirected to login

#### Token Management
- **JWT Tokens**: Secure JSON Web Tokens for authentication
- **Token Storage**: Tokens stored in localStorage or sessionStorage
- **Automatic Refresh**: Tokens refreshed before expiration
- **Token Expiration**: Automatic logout on token expiration
- **Logout Cleanup**: Complete token removal on logout

#### Session Management
- **Remember Me**: Option to persist session across browser restarts
- **Idle Timeout**: Optional automatic logout after inactivity (configurable)
- **Multiple Tabs**: Synchronized auth state across browser tabs
- **Concurrent Sessions**: Support for multiple device logins (if enabled on backend)

### Security Features

#### Transport Security
- **HTTPS Required**: Production deployments must use HTTPS
- **Secure Cookies**: HttpOnly and Secure flags for cookies
- **CORS Protection**: Cross-origin request protection
- **CSRF Protection**: Cross-site request forgery prevention

#### API Security
- **Token Injection**: Automatic JWT token injection in API requests
- **Request Interceptors**: Axios interceptors for authentication
- **Error Handling**: Secure error messages (no sensitive data leakage)
- **Rate Limiting**: Backend enforces rate limits on API endpoints

#### Client-Side Security
- **XSS Prevention**: Input sanitization and output encoding
- **Content Security Policy**: CSP headers configured
- **Dependency Security**: Regular security audits with npm audit
- **No Sensitive Data**: No passwords or secrets stored in client

### Creating an Admin User

**Important:** Create an admin user before accessing the dashboard.

#### Method 1: Via Backend API

```bash
# Using curl
curl -X POST http://localhost:3000/api/users/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Admin User",
    "email": "admin@example.com",
    "username": "admin",
    "password": "SecurePassword123!",
    "role": "admin"
  }'
```

#### Method 2: Via MongoDB Direct Update

```javascript
// In MongoDB shell or MongoDB Compass
use cryptons; // or your database name

// Update existing user to admin
db.users.updateOne(
  { email: "user@example.com" },
  { $set: { role: "admin" } }
);
```

#### Method 3: Via Backend Script

```javascript
// scripts/create-admin.js
const User = require('./src/models/User');
const bcrypt = require('bcryptjs');

async function createAdmin() {
  const hashedPassword = await bcrypt.hash('SecurePassword123!', 10);
  
  await User.create({
    name: 'Admin User',
    email: 'admin@example.com',
    username: 'admin',
    password: hashedPassword,
    role: 'admin'
  });
  
  console.log('Admin user created successfully!');
}

createAdmin();
```

### Login Process

1. Navigate to `http://localhost:5173` (or your deployment URL)
2. Enter admin credentials on the login page
3. Click "Login" or press Enter
4. On successful authentication:
   - JWT token stored in browser
   - Redirected to dashboard home
   - Navigation sidebar becomes available
5. On failed authentication:
   - Error message displayed
   - Attempt counter incremented
   - Account locked after multiple failures (backend protection)

### Security Best Practices

**For Administrators:**
- Use strong, unique passwords (minimum 12 characters)
- Enable two-factor authentication (if available on backend)
- Log out when leaving your workstation
- Don't share admin credentials
- Regularly update passwords
- Monitor access logs

**For Developers:**
- Never commit credentials to version control
- Use environment variables for sensitive configuration
- Keep dependencies updated (`npm audit fix`)
- Review security reports in CI/CD pipeline
- Test authentication flows regularly
- Implement rate limiting on login attempts

**Production Requirements:**
- HTTPS/TLS required (no HTTP)
- Strong JWT secret (32+ characters, random)
- Short token expiration times (15-60 minutes)
- Refresh token rotation
- IP whitelisting for admin access (optional)
- VPN or bastion host for additional security

---

## Dashboard Features

*Detailed information about each dashboard feature*

### Dashboard Home

**Purpose:** Provides an at-a-glance view of platform performance and recent activity.

**Components:**
- **KPI Cards**: Total revenue, orders, users, pending orders
- **Sales Chart**: 7-day revenue trend with interactive tooltips
- **Recent Orders Table**: Latest 10 orders with quick actions
- **Quick Actions**: Navigate to key sections

**Real-time Updates:**
- Order counts update via WebSocket
- Revenue updates on new orders
- Pending orders alert when threshold exceeded

### Analytics Page

**Purpose:** Deep dive into platform analytics and business intelligence.

**Features:**
- **Period Selection**: Last 7/30/90 days or custom date range
- **Sales Trend Chart**: Line chart showing revenue over time
- **Revenue by Cryptocurrency**: Bar chart comparing BTC, ETH, LTC, XRP
- **Average Order Value**: Metric with trend indicator
- **Transaction Count**: Total transactions in period
- **Low Stock Alerts**: Products below stock threshold
- **Top Reviewed Products**: Most-reviewed items with ratings

**Export Options:**
- Export charts as PNG images
- Export data as CSV
- Generate PDF reports

### Product Management

**Purpose:** Comprehensive product catalog management.

**Capabilities:**
- **View All Products**: Paginated table with search
- **Search**: Real-time search by name or description
- **Filter**: By category, stock level, status
- **Sort**: By name, price, stock, created date
- **Drag-and-Drop**: Reorder products for display priority
- **Quick Edit**: Inline editing for simple updates
- **Stock Indicators**: Visual alerts for low stock
- **Bulk Actions**: Select multiple products for batch operations
- **Export**: CSV/PDF export with applied filters

**Stock Management:**
- Color-coded stock indicators (red: low, yellow: medium, green: high)
- Configurable low stock threshold
- Stock history tracking
- Restock alerts

### Order Management

**Purpose:** Monitor and manage customer orders.

**Features:**
- **Order List**: All orders with status, date, customer, amount
- **Status Filters**: Quick filter by order status
- **Order Details**: Modal with complete order information
- **Status Updates**: Change order status with tracking
- **Customer Info**: Quick view customer details
- **Payment Status**: Payment method and confirmation
- **Timeline**: Order history with status changes
- **Export**: Filtered export to CSV/PDF

**Order Statuses:**
- Pending: Awaiting payment confirmation
- Processing: Payment confirmed, preparing shipment
- Shipped: Order dispatched
- Delivered: Successfully delivered
- Cancelled: Order cancelled by customer or admin

### User Management

**Purpose:** Manage platform users and accounts.

**Features:**
- **User Directory**: Browse all registered users
- **Search**: Find users by name, email, username
- **User Details**: View complete user profile
- **Order History**: View user's order history
- **Role Management**: Update user roles (admin/user)
- **Account Status**: Enable/disable user accounts
- **Activity Logs**: View user activity (if available)
- **Export**: User data export with privacy compliance

**User Roles:**
- **Admin**: Full platform access
- **User**: Customer access only

### Review Moderation

**Purpose:** Manage and moderate product reviews.

**Features:**
- **Review Queue**: All reviews with status
- **Filter by Status**: Pending, approved, rejected
- **Rating Display**: Star rating visualization
- **Review Content**: Full review text and metadata
- **Moderation Actions**: Approve, reject, or flag reviews
- **Bulk Moderation**: Select multiple reviews for batch actions
- **User Information**: Review author details
- **Product Link**: Quick link to reviewed product

**Moderation Workflow:**
1. New reviews appear as "Pending"
2. Admin reviews content for appropriateness
3. Approve legitimate reviews
4. Reject spam or inappropriate content
5. Approved reviews appear on product pages

### System Health

**Purpose:** Monitor platform infrastructure and services.

**Monitoring:**
- **Database**: Connection status and response time
- **Email Service**: SMTP connection and delivery status
- **Memory Usage**: Server memory utilization
- **Uptime**: Server uptime duration
- **API Response Time**: Average API latency
- **Error Rate**: Recent error count

**Alerts:**
- Critical: Database down, email service failure
- Warning: High memory usage, slow API response
- Info: System restarts, configuration changes

**Refresh:**
- Auto-refresh every 30 seconds
- Manual refresh button
- Historical data view (if available)

---

## Project Structure

### Directory Organization

```
admin-dashboard/
├── public/                 # Static assets
│   ├── favicon.ico
│   └── robots.txt
│
├── src/                    # Source code
│   ├── components/         # Reusable React components
│   │   ├── charts/        # Chart components (LineChart, BarChart, etc.)
│   │   ├── common/        # Common UI components (Button, Input, Card, etc.)
│   │   ├── layout/        # Layout components (Sidebar, Header, Footer)
│   │   ├── modals/        # Modal dialogs
│   │   └── tables/        # Table components with pagination, sorting
│   │
│   ├── pages/             # Page-level components (routes)
│   │   ├── Dashboard.tsx  # Dashboard home page
│   │   ├── Analytics.tsx  # Analytics page
│   │   ├── Products.tsx   # Product management
│   │   ├── Orders.tsx     # Order management
│   │   ├── Users.tsx      # User management
│   │   ├── Reviews.tsx    # Review moderation
│   │   ├── SystemHealth.tsx # System monitoring
│   │   └── Login.tsx      # Login page
│   │
│   ├── services/          # API services and external integrations
│   │   ├── api.ts         # Axios configuration and interceptors
│   │   ├── authService.ts # Authentication API calls
│   │   ├── productService.ts # Product API calls
│   │   ├── orderService.ts   # Order API calls
│   │   ├── userService.ts    # User API calls
│   │   └── socketService.ts  # WebSocket client
│   │
│   ├── store/             # Redux store and slices
│   │   ├── index.ts       # Store configuration
│   │   ├── authSlice.ts   # Authentication state
│   │   ├── productSlice.ts # Product state
│   │   ├── orderSlice.ts   # Order state
│   │   ├── userSlice.ts    # User state
│   │   └── notificationSlice.ts # Notification state
│   │
│   ├── types/             # TypeScript type definitions
│   │   ├── index.ts       # Common types
│   │   ├── api.ts         # API response types
│   │   ├── models.ts      # Data model types
│   │   └── components.ts  # Component prop types
│   │
│   ├── utils/             # Utility functions and helpers
│   │   ├── formatters.ts  # Data formatting (dates, currency, etc.)
│   │   ├── validators.ts  # Form validation
│   │   ├── export.ts      # Export functionality (CSV, PDF)
│   │   └── constants.ts   # Application constants
│   │
│   ├── hooks/             # Custom React hooks
│   │   ├── useAuth.ts     # Authentication hook
│   │   ├── useApi.ts      # API call hook
│   │   ├── useWebSocket.ts # WebSocket hook
│   │   └── useDebounce.ts # Debounce hook
│   │
│   ├── styles/            # Global styles and themes
│   │   ├── theme.ts       # MUI theme configuration
│   │   └── global.css     # Global CSS
│   │
│   ├── App.tsx            # Root application component
│   ├── main.tsx           # Application entry point
│   └── vite-env.d.ts      # Vite type definitions
│
├── dist/                  # Production build output (generated)
│   ├── assets/           # Compiled assets with hashes
│   └── index.html        # Entry HTML file
│
├── .env.example           # Example environment variables
├── .env.development       # Development environment variables
├── .gitignore            # Git ignore rules
├── index.html            # HTML template
├── package.json          # NPM dependencies and scripts
├── tsconfig.json         # TypeScript configuration
├── tsconfig.node.json    # TypeScript config for Node.js tools
├── vite.config.ts        # Vite configuration
└── README.md             # This file
```

### Key Files

**Configuration Files:**
- `vite.config.ts`: Vite build tool configuration
- `tsconfig.json`: TypeScript compiler options
- `package.json`: Dependencies and scripts
- `.env.development`: Environment-specific configuration

**Entry Points:**
- `index.html`: HTML template
- `src/main.tsx`: Application bootstrap
- `src/App.tsx`: Root React component

**State Management:**
- Redux store in `src/store/`
- Slice-based architecture
- RTK Query for API caching

**Routing:**
- React Router v6 in `src/App.tsx`
- Protected route wrapper
- Lazy loading for code splitting

---

## Development

### Development Workflow

#### Starting Development

1. **Start Backend Server**
   ```bash
   # In the main cstore directory
   npm run dev
   ```

2. **Start Dashboard Development Server**
   ```bash
   # In admin-dashboard directory
   npm run dev
   ```

3. **Open Browser**
   - Navigate to `http://localhost:5173`
   - Login with admin credentials
   - Changes auto-reload with HMR

#### Available Scripts

```bash
# Development
npm run dev              # Start dev server with HMR
npm run build            # Build for production
npm run preview          # Preview production build locally

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint errors automatically
npm run format           # Format code with Prettier
npm run type-check       # Run TypeScript type checking

# Testing (if configured)
npm test                 # Run tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report
```

### Development Best Practices

#### Code Organization
- Keep components small and focused (< 200 lines)
- Use TypeScript interfaces for all props
- Extract reusable logic into custom hooks
- Create utility functions for common operations
- Follow the single responsibility principle

#### State Management
- Use Redux for global application state
- Use local state (useState) for component-specific state
- Use context for theme and configuration
- Normalize data structures in Redux
- Avoid prop drilling (use Redux or context)

#### API Integration
- Use service functions for all API calls
- Implement error handling for all requests
- Show loading states during API calls
- Cache responses when appropriate
- Implement optimistic updates for better UX

#### Performance
- Lazy load routes and components
- Memoize expensive computations with useMemo
- Memoize callback functions with useCallback
- Virtualize long lists (react-window)
- Optimize images and assets

#### Testing
- Write unit tests for utility functions
- Write integration tests for components
- Test API service functions with mocks
- Test Redux reducers and actions
- Maintain >80% code coverage

### Debugging

#### Browser DevTools
- **React DevTools**: Inspect component tree and props
- **Redux DevTools**: Debug state changes
- **Network Tab**: Monitor API calls
- **Console**: View logs and errors

#### Debug Configuration

```typescript
// src/config/debug.ts
export const DEBUG = {
  API: import.meta.env.VITE_DEBUG === 'true',
  REDUX: import.meta.env.VITE_DEBUG === 'true',
  WEBSOCKET: import.meta.env.VITE_DEBUG === 'true',
};

// Usage in code
if (DEBUG.API) {
  console.log('API Request:', config);
}
```

#### Common Issues

**Issue: API calls failing**
- Solution: Check backend server is running
- Verify VITE_API_URL in .env.development
- Check browser console for CORS errors
- Verify JWT token is valid

**Issue: WebSocket not connecting**
- Solution: Check VITE_SOCKET_URL configuration
- Verify backend Socket.io server is running
- Check browser console for connection errors
- Verify firewall settings

**Issue: Hot reload not working**
- Solution: Restart Vite dev server
- Clear browser cache
- Check for syntax errors in code
- Verify Vite configuration

### Code Style Guidelines

#### TypeScript
```typescript
// Use interfaces for object types
interface Product {
  id: string;
  name: string;
  price: number;
}

// Use types for unions and intersections
type Status = 'pending' | 'approved' | 'rejected';

// Always type function parameters and return values
function formatPrice(price: number): string {
  return `$${price.toFixed(2)}`;
}
```

#### React Components
```typescript
// Functional components with TypeScript
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export const Button: React.FC<ButtonProps> = ({ 
  label, 
  onClick, 
  disabled = false 
}) => {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
};
```

#### Redux
```typescript
// Use Redux Toolkit slices
import { createSlice, PayloadAction } from '@reduxjs/toolkit';

const productSlice = createSlice({
  name: 'products',
  initialState: { items: [], loading: false },
  reducers: {
    setProducts: (state, action: PayloadAction<Product[]>) => {
      state.items = action.payload;
    },
  },
});
```

---

## Performance & Optimization

### Performance Features

#### Code Splitting
- **Route-based splitting**: Each page loads on-demand
- **Component lazy loading**: Large components load when needed
- **Dynamic imports**: Third-party libraries loaded asynchronously

```typescript
// Route-based code splitting
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Analytics = lazy(() => import('./pages/Analytics'));
```

#### Bundle Optimization
- **Tree shaking**: Removes unused code
- **Minification**: Reduces bundle size
- **Compression**: Gzip/Brotli compression
- **Asset optimization**: Images and fonts optimized

#### Caching Strategies
- **API response caching**: RTK Query caches API responses
- **Asset caching**: Static assets cached by browser
- **Service worker**: Offline caching (if implemented)

#### React Optimizations
```typescript
// Memoize components
const ExpensiveComponent = React.memo(({ data }) => {
  return <div>{/* Render data */}</div>;
});

// Memoize values
const expensiveValue = useMemo(() => {
  return computeExpensiveValue(data);
}, [data]);

// Memoize callbacks
const handleClick = useCallback(() => {
  doSomething(id);
}, [id]);
```

### Performance Metrics

**Target Metrics:**
- First Contentful Paint (FCP): < 1.5s
- Time to Interactive (TTI): < 3.5s
- Largest Contentful Paint (LCP): < 2.5s
- Total Bundle Size: < 500KB (gzipped)

**Monitoring:**
- Use Lighthouse for performance audits
- Monitor Core Web Vitals
- Track bundle size with webpack-bundle-analyzer
- Monitor API response times

### Optimization Techniques

#### Image Optimization
- Use appropriate image formats (WebP, AVIF)
- Implement lazy loading for images
- Use responsive images with srcset
- Compress images before uploading

#### Data Management
- Paginate large data sets
- Implement virtual scrolling for long lists
- Debounce search and filter inputs
- Cache frequently accessed data

#### Network Optimization
- Minimize API calls
- Batch API requests when possible
- Implement request deduplication
- Use HTTP/2 multiplexing

---

## Browser Support

### Supported Browsers

#### Desktop Browsers
- **Chrome**: Latest 2 versions ✅
- **Firefox**: Latest 2 versions ✅
- **Safari**: Latest 2 versions ✅
- **Edge**: Latest 2 versions ✅
- **Opera**: Latest version ✅

#### Mobile Browsers
- **Chrome Mobile**: Latest version ✅
- **Safari iOS**: iOS 13+ ✅
- **Firefox Mobile**: Latest version ✅
- **Samsung Internet**: Latest version ✅

### Browser Requirements

**Minimum Requirements:**
- ES6 support (native or polyfilled)
- localStorage and sessionStorage
- WebSocket support (for real-time features)
- Fetch API

**Polyfills:**
The application includes necessary polyfills for:
- Promise
- Fetch
- Object.assign
- Array methods (map, filter, reduce, etc.)

### Mobile Experience

#### Responsive Design
- **Mobile-first approach**: Optimized for small screens
- **Touch-friendly**: Large tap targets (min 44x44px)
- **Swipe gestures**: Natural mobile interactions
- **Adaptive layouts**: Optimized for each screen size

#### Mobile Optimizations
- Reduced bundle size for faster loading
- Lazy loading for images and components
- Touch-optimized tables and charts
- Mobile-specific navigation

#### Screen Size Support
- **Extra Small**: < 600px (phones)
- **Small**: 600-960px (tablets portrait)
- **Medium**: 960-1280px (tablets landscape, small laptops)
- **Large**: 1280-1920px (desktops)
- **Extra Large**: > 1920px (large desktops)

### Accessibility

**WCAG 2.1 Level AA Compliance:**
- Keyboard navigation support
- Screen reader compatibility
- Sufficient color contrast (4.5:1 minimum)
- Focus indicators
- ARIA labels and roles
- Alt text for images

**Testing Tools:**
- axe DevTools for accessibility auditing
- Lighthouse accessibility score
- NVDA/JAWS screen reader testing

---

## Deployment

### Deployment Options

The admin dashboard can be deployed in two ways:

#### Option 1: Integrated Deployment (Recommended)

Deploy the dashboard as part of the backend application. The backend serves the built dashboard files.

**Steps:**

1. **Build the Dashboard**
   ```bash
   cd admin-dashboard
   npm run build
   ```

2. **Copy Build to Backend**
   ```bash
   # The backend is configured to serve files from admin-dashboard/dist
   # No manual copy needed if using the integrated setup
   ```

3. **Deploy Backend with Dashboard**
   ```bash
   cd ..
   # Deploy using your preferred method (Docker, Kubernetes, etc.)
   docker build -t cryptons:latest .
   docker run -p 3000:3000 cryptons:latest
   ```

4. **Access Dashboard**
   - Dashboard available at: `http://your-domain.com/admin`
   - Backend API at: `http://your-domain.com/api`

**Advantages:**
- Single deployment process
- Unified domain (no CORS issues)
- Simplified authentication
- Shared SSL certificate
- Easier to maintain

**Backend Configuration:**
```javascript
// In backend server.js or similar
app.use('/admin', express.static(path.join(__dirname, 'admin-dashboard/dist')));
app.get('/admin/*', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin-dashboard/dist/index.html'));
});
```

#### Option 2: Standalone Deployment

Deploy the dashboard independently to a static hosting service.

**Supported Platforms:**
- Netlify
- Vercel
- AWS S3 + CloudFront
- GitHub Pages
- Azure Static Web Apps
- Google Cloud Storage

**Steps for Netlify:**

1. **Build for Production**
   ```bash
   npm run build
   ```

2. **Deploy to Netlify**
   ```bash
   # Install Netlify CLI
   npm install -g netlify-cli

   # Deploy
   netlify deploy --prod --dir=dist
   ```

3. **Configure Environment**
   - Set `VITE_API_URL` to your backend URL
   - Set `VITE_SOCKET_URL` to your WebSocket server URL

**Steps for Vercel:**

1. **Install Vercel CLI**
   ```bash
   npm install -g vercel
   ```

2. **Deploy**
   ```bash
   vercel --prod
   ```

3. **Configure Build Settings**
   ```json
   {
     "buildCommand": "npm run build",
     "outputDirectory": "dist",
     "framework": "vite"
   }
   ```

**Steps for AWS S3 + CloudFront:**

1. **Build Application**
   ```bash
   npm run build
   ```

2. **Upload to S3**
   ```bash
   aws s3 sync dist/ s3://your-bucket-name --delete
   ```

3. **Configure CloudFront**
   - Create CloudFront distribution
   - Point to S3 bucket
   - Configure custom domain
   - Enable HTTPS

4. **Set Environment Variables**
   - Update API URLs in build configuration
   - Rebuild and redeploy

**Advantages:**
- Independent scaling
- CDN-based delivery (faster global access)
- Separate deployment pipeline
- Zero server maintenance

**Disadvantages:**
- CORS configuration required on backend
- More complex authentication setup
- Multiple domains to manage

### Production Checklist

**Before deploying to production:**

- [ ] **Environment Configuration**
  - [ ] Set production API URL
  - [ ] Configure WebSocket URL
  - [ ] Remove debug flags
  - [ ] Set appropriate timeout values

- [ ] **Security**
  - [ ] Enable HTTPS/TLS
  - [ ] Configure Content Security Policy
  - [ ] Set secure cookie flags
  - [ ] Enable CORS with specific origins
  - [ ] Implement rate limiting

- [ ] **Performance**
  - [ ] Enable asset compression (Gzip/Brotli)
  - [ ] Configure CDN for static assets
  - [ ] Enable browser caching
  - [ ] Minimize bundle size
  - [ ] Optimize images

- [ ] **Monitoring**
  - [ ] Set up error tracking (Sentry, etc.)
  - [ ] Configure analytics
  - [ ] Enable performance monitoring
  - [ ] Set up uptime monitoring
  - [ ] Configure logging

- [ ] **Testing**
  - [ ] Run full test suite
  - [ ] Perform load testing
  - [ ] Test on multiple browsers
  - [ ] Test on mobile devices
  - [ ] Verify all features work

- [ ] **Documentation**
  - [ ] Update deployment documentation
  - [ ] Document environment variables
  - [ ] Create runbook for common issues
  - [ ] Document rollback procedure

### Environment Variables for Production

```env
# .env.production
VITE_API_URL=https://api.your-domain.com/api
VITE_SOCKET_URL=https://api.your-domain.com
VITE_DEBUG=false
VITE_ENABLE_ANALYTICS=true
VITE_SENTRY_DSN=your-sentry-dsn
```

### CI/CD Integration

**GitHub Actions Example:**

```yaml
name: Deploy Admin Dashboard

on:
  push:
    branches: [main]
    paths:
      - 'admin-dashboard/**'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        working-directory: ./admin-dashboard
        run: npm ci
        
      - name: Build
        working-directory: ./admin-dashboard
        run: npm run build
        env:
          VITE_API_URL: ${{ secrets.API_URL }}
          VITE_SOCKET_URL: ${{ secrets.SOCKET_URL }}
          
      - name: Deploy
        # Deploy to your hosting service
        run: |
          # Example: Deploy to Netlify
          npx netlify-cli deploy --prod --dir=admin-dashboard/dist
```

---

## Testing

### Testing Strategy

#### Unit Tests
- Test individual functions and components
- Mock external dependencies
- Focus on business logic
- Fast execution (< 1s per test)

#### Integration Tests
- Test component interactions
- Test Redux state changes
- Test API service functions
- Verify data flow

#### End-to-End Tests
- Test complete user workflows
- Test across multiple pages
- Verify critical paths (login, create order, etc.)
- Run in real browser environment

### Testing Tools

**Recommended Stack:**
- **Jest**: Test runner and assertion library
- **React Testing Library**: Component testing
- **MSW**: API mocking
- **Cypress**: End-to-end testing

### Example Tests

**Component Test:**
```typescript
import { render, screen } from '@testing-library/react';
import { Button } from './Button';

describe('Button', () => {
  it('renders with label', () => {
    render(<Button label="Click me" onClick={() => {}} />);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const onClick = jest.fn();
    render(<Button label="Click" onClick={onClick} />);
    screen.getByText('Click').click();
    expect(onClick).toHaveBeenCalled();
  });
});
```

**Redux Test:**
```typescript
import { configureStore } from '@reduxjs/toolkit';
import productReducer, { setProducts } from './productSlice';

describe('productSlice', () => {
  it('sets products', () => {
    const store = configureStore({ reducer: { products: productReducer } });
    const products = [{ id: '1', name: 'Test' }];
    
    store.dispatch(setProducts(products));
    
    expect(store.getState().products.items).toEqual(products);
  });
});
```

**API Service Test:**
```typescript
import { rest } from 'msw';
import { setupServer } from 'msw/node';
import { getProducts } from './productService';

const server = setupServer(
  rest.get('/api/products', (req, res, ctx) => {
    return res(ctx.json([{ id: '1', name: 'Test' }]));
  })
);

beforeAll(() => server.listen());
afterAll(() => server.close());

describe('productService', () => {
  it('fetches products', async () => {
    const products = await getProducts();
    expect(products).toHaveLength(1);
    expect(products[0].name).toBe('Test');
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Run specific test file
npm test -- Button.test.tsx

# Run tests matching pattern
npm test -- --testNamePattern="Button"
```

### Test Coverage Goals

**Target Coverage:**
- **Statements**: > 80%
- **Branches**: > 75%
- **Functions**: > 80%
- **Lines**: > 80%

**Priority Areas:**
- Business logic functions: 100%
- API service functions: > 90%
- Redux reducers: > 90%
- Critical components: > 85%

---

## Troubleshooting

### Common Issues

#### Authentication Issues

**Problem:** Login fails with "Invalid credentials"
- **Solution**: Verify admin user exists with correct role
- Check backend server is running
- Verify API URL in environment configuration
- Check browser console for API errors

**Problem:** Token expired errors
- **Solution**: Token expiration is configured on backend
- Implement token refresh logic
- Check JWT_SECRET matches between dashboard and backend
- Verify token expiration time is appropriate

#### API Connection Issues

**Problem:** API calls return CORS errors
- **Solution**: Configure CORS on backend to allow dashboard origin
- For standalone deployment, add dashboard URL to CORS whitelist
- Verify VITE_API_URL includes protocol (http/https)

**Problem:** 404 errors on API calls
- **Solution**: Verify VITE_API_URL includes `/api` path
- Check backend routes are correctly configured
- Verify backend server is running on expected port

#### WebSocket Issues

**Problem:** Real-time notifications not working
- **Solution**: Check VITE_SOCKET_URL configuration
- Verify Socket.io server is running on backend
- Check browser console for WebSocket connection errors
- Verify firewall allows WebSocket connections

#### Build Issues

**Problem:** Build fails with TypeScript errors
- **Solution**: Run `npm run type-check` to identify issues
- Fix type errors in source code
- Verify all dependencies are installed
- Check tsconfig.json configuration

**Problem:** Build succeeds but application doesn't work
- **Solution**: Check browser console for errors
- Verify environment variables are set correctly
- Check asset paths in build output
- Test production build locally with `npm run preview`

#### Performance Issues

**Problem:** Dashboard loads slowly
- **Solution**: Enable production build optimizations
- Implement code splitting for large components
- Optimize images and assets
- Enable CDN for static assets
- Check network tab for slow API calls

**Problem:** UI feels sluggish
- **Solution**: Use React DevTools Profiler to identify slow renders
- Memoize expensive computations
- Implement virtualization for long lists
- Reduce unnecessary re-renders

### Debug Mode

Enable debug mode for verbose logging:

```env
# .env.development
VITE_DEBUG=true
```

This enables:
- API request/response logging
- Redux action logging
- WebSocket event logging
- Performance timing logs

### Getting Help

**Documentation:**
- Review this README
- Check backend API documentation
- Consult Material-UI documentation
- Review Redux Toolkit documentation

**Community Support:**
- Open a [GitHub Issue](https://github.com/thewriterben/cstore/issues)
- Check existing issues for solutions
- Join project discussions

**Reporting Bugs:**
Include in bug reports:
- Dashboard version
- Browser and version
- Steps to reproduce
- Error messages and stack traces
- Screenshots if applicable
- Network logs from browser DevTools

---

## License

This project is part of the Cryptons.com cryptocurrency marketplace.

**License:** MIT  
**Version:** 2.2.0  
**Last Updated:** October 2025

---

## Acknowledgments

**Built With:**
- React team for the amazing framework
- Material-UI team for the component library
- Redux team for state management
- Vite team for the build tool
- Open source community for various libraries

**Special Thanks:**
- Contributors to the Cryptons.com project
- Security researchers for responsible disclosures
- Community members for feedback and suggestions

---

**📊 Professional admin dashboard for cryptocurrency trading platforms**  
**⚠️ Development/Educational project - Not for production use with real funds**  
**📅 Status as of October 2025**

For more information, see the [main project README](../README.md)
