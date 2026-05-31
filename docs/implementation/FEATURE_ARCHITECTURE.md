# Drag-and-Drop and Export Features - Architecture

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Admin Dashboard (React)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │ Products Page  │  │  Orders Page   │  │  Users Page     │  │
│  │                │  │                │  │                 │  │
│  │ [Drag Handle]  │  │ [Export Btn]   │  │ [Export Btn]    │  │
│  │ [Export Btn]   │  │                │  │                 │  │
│  └────────┬───────┘  └───────┬────────┘  └────────┬────────┘  │
│           │                   │                     │            │
│           v                   v                     v            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              @dnd-kit (Drag-and-Drop)                   │   │
│  │  - DndContext, SortableContext                          │   │
│  │  - useSortable hook                                     │   │
│  │  - arrayMove utility                                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              ExportDialog Component                      │   │
│  │  - Format selection (CSV/PDF)                           │   │
│  │  - Progress indicator                                   │   │
│  │  - Error handling                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                API Service Layer                         │   │
│  │  - reorderProducts(productOrders)                       │   │
│  │  - exportProductsCSV(filters)                           │   │
│  │  - exportProductsPDF(filters)                           │   │
│  │  - exportOrdersCSV(filters)                             │   │
│  │  - exportOrdersPDF(filters)                             │   │
│  │  - exportUsersCSV(filters)                              │   │
│  └────────────────────┬────────────────────────────────────┘   │
│                       │                                          │
└───────────────────────┼──────────────────────────────────────────┘
                        │
                        │ HTTP/HTTPS
                        │
┌───────────────────────┼──────────────────────────────────────────┐
│                       v                                          │
│              Backend Server (Node.js/Express)                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                Admin Routes Middleware                   │   │
│  │  - protect (JWT Authentication)                         │   │
│  │  - authorize('admin') (Role Check)                      │   │
│  └────────────────────┬────────────────────────────────────┘   │
│                       │                                          │
│                       v                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Admin Controller                            │   │
│  │                                                          │   │
│  │  reorderProducts()                                      │   │
│  │  ├─ Validate productOrders array                        │   │
│  │  ├─ Create bulk update operations                       │   │
│  │  └─ Update Product.sortOrder via bulkWrite()            │   │
│  │                                                          │   │
│  │  exportProductsCSV()                                    │   │
│  │  ├─ Query products with filters                         │   │
│  │  ├─ Call exportService.exportProductsToCSV()            │   │
│  │  ├─ Stream file download                                │   │
│  │  └─ Cleanup temp file                                   │   │
│  │                                                          │   │
│  │  exportProductsPDF()                                    │   │
│  │  ├─ Query products with filters                         │   │
│  │  ├─ Call exportService.exportProductsToPDF()            │   │
│  │  ├─ Stream file download                                │   │
│  │  └─ Cleanup temp file                                   │   │
│  │                                                          │   │
│  │  exportOrdersCSV() / exportOrdersPDF()                  │   │
│  │  exportUsersCSV()                                       │   │
│  └────────────────────┬────────────────────────────────────┘   │
│                       │                                          │
│                       v                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              Export Service                              │   │
│  │                                                          │   │
│  │  exportProductsToCSV(products)                          │   │
│  │  ├─ Map product data to CSV format                      │   │
│  │  ├─ Use csv-writer library                              │   │
│  │  └─ Return file path                                    │   │
│  │                                                          │   │
│  │  exportProductsToPDF(products)                          │   │
│  │  ├─ Create PDFDocument with pdfkit                      │   │
│  │  ├─ Add header and branding                             │   │
│  │  ├─ Generate table with product data                    │   │
│  │  ├─ Add footer with totals                              │   │
│  │  └─ Return file path                                    │   │
│  │                                                          │   │
│  │  Similar methods for Orders and Users                   │   │
│  └────────────────────┬────────────────────────────────────┘   │
│                       │                                          │
│                       v                                          │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              MongoDB Database                            │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │ Product Collection                               │  │   │
│  │  │  - _id                                           │  │   │
│  │  │  - name                                          │  │   │
│  │  │  - description                                   │  │   │
│  │  │  - priceUSD                                      │  │   │
│  │  │  - stock                                         │  │   │
│  │  │  - category                                      │  │   │
│  │  │  - sortOrder ← NEW FIELD                        │  │   │
│  │  │  - isActive                                      │  │   │
│  │  │  - averageRating                                 │  │   │
│  │  │  - numReviews                                    │  │   │
│  │  │                                                  │  │   │
│  │  │  Indexes:                                        │  │   │
│  │  │  - { sortOrder: 1 } ← NEW INDEX                 │  │   │
│  │  │  - { category: 1, isActive: 1 }                 │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │ Order Collection                                 │  │   │
│  │  │  - orderNumber, customer, items, status, etc.   │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  │                                                          │   │
│  │  ┌──────────────────────────────────────────────────┐  │   │
│  │  │ User Collection                                  │  │   │
│  │  │  - name, email, role, createdAt                 │  │   │
│  │  └──────────────────────────────────────────────────┘  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              File System (/tmp)                          │   │
│  │  - products-timestamp.csv                               │   │
│  │  - products-timestamp.pdf                               │   │
│  │  - orders-timestamp.csv                                 │   │
│  │  - orders-timestamp.pdf                                 │   │
│  │  - users-timestamp.csv                                  │   │
│  │  (Files auto-deleted after download)                    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

## Data Flow Diagrams

### 1. Drag-and-Drop Product Reordering

```
User Action: Drag Product from Position 2 to Position 0
│
├─> Frontend: Capture drag event
│   └─> useSortable hook detects movement
│
├─> Frontend: Update local state optimistically
│   └─> arrayMove([product1, product2, product3], 2, 0)
│   └─> UI immediately reflects new order
│
├─> Frontend: Calculate new sort orders
│   └─> products.map((p, index) => ({ productId: p._id, sortOrder: index }))
│
├─> Frontend: API call
│   └─> PUT /api/admin/products/reorder
│   └─> Body: { productOrders: [...] }
│
├─> Backend: Validate request
│   └─> Check JWT token
│   └─> Check admin role
│   └─> Validate productOrders array
│
├─> Backend: Bulk update database
│   └─> Product.bulkWrite([
│       { updateOne: { filter: { _id: id1 }, update: { sortOrder: 0 } } },
│       { updateOne: { filter: { _id: id2 }, update: { sortOrder: 1 } } },
│       ...
│     ])
│
├─> Backend: Return success
│   └─> { success: true, message: "Products reordered successfully" }
│
└─> Frontend: Confirm success or revert on error
```

### 2. CSV Export Flow

```
User Action: Click "Export" → Select "CSV"
│
├─> Frontend: Open ExportDialog
│   └─> User selects CSV format
│   └─> User clicks "Export" button
│
├─> Frontend: Show loading indicator
│   └─> CircularProgress displayed
│
├─> Frontend: API call
│   └─> GET /api/admin/products/export/csv?search=wallet
│   └─> Set responseType: 'blob'
│
├─> Backend: Authenticate & authorize
│   └─> Verify JWT token
│   └─> Check admin role
│
├─> Backend: Query database
│   └─> Product.find({ isActive: true, name: /wallet/i })
│       .populate('category')
│       .sort({ sortOrder: 1 })
│
├─> Backend: Generate CSV file
│   └─> exportService.exportProductsToCSV(products)
│   └─> csv-writer creates file in /tmp
│   └─> Returns: /tmp/products-1705315800000.csv
│
├─> Backend: Stream file download
│   └─> res.download(filePath, filename)
│   └─> Set headers: Content-Type, Content-Disposition
│
├─> Backend: Cleanup
│   └─> fs.unlink(filePath) after download
│
├─> Frontend: Receive blob
│   └─> Blob { size: 12345, type: 'text/csv' }
│
├─> Frontend: Trigger download
│   └─> downloadBlob(blob, 'products-2024-01-15.csv')
│   └─> Create temporary <a> element
│   └─> Set href to blob URL
│   └─> Trigger click()
│   └─> Clean up blob URL
│
└─> User: File downloaded to Downloads folder
```

### 3. PDF Export Flow

```
User Action: Click "Export" → Select "PDF"
│
├─> Frontend: Similar to CSV flow
│   └─> API call: GET /api/admin/products/export/pdf
│
├─> Backend: Query products
│   └─> Same as CSV flow
│
├─> Backend: Generate PDF
│   └─> exportService.exportProductsToPDF(products)
│   └─> const doc = new PDFDocument()
│   └─> Add header: "Product Report"
│   └─> Add timestamp
│   └─> Create table:
│       ├─> Headers: Product Name | Price | Stock | Rating | Status
│       └─> Rows: For each product
│           └─> doc.text(product.name, x, y)
│   └─> Add footer: "Total Products: X"
│   └─> doc.end()
│   └─> Returns: /tmp/products-1705315800000.pdf
│
├─> Backend: Stream file download
│   └─> res.download(filePath)
│   └─> Content-Type: application/pdf
│
├─> Backend: Cleanup
│   └─> fs.unlink(filePath)
│
└─> Frontend: Download PDF file
```

## Component Hierarchy

```
App
└── AdminDashboard
    ├── Products Page
    │   ├── Header
    │   │   ├── Title
    │   │   └── Actions
    │   │       ├── Export Button
    │   │       └── Add Product Button
    │   ├── Search Bar
    │   ├── Products Table (with DndContext)
    │   │   ├── Table Head
    │   │   │   └── Columns: [Drag Handle | Name | Price | Stock | Status | Rating | Actions]
    │   │   └── Table Body (SortableContext)
    │   │       └── SortableRow (for each product)
    │   │           ├── Drag Handle (DragIndicator icon)
    │   │           ├── Product Info
    │   │           ├── Price
    │   │           ├── Stock Chip
    │   │           ├── Status Chip
    │   │           ├── Rating
    │   │           └── Actions (Edit, Delete)
    │   ├── Pagination
    │   └── ExportDialog
    │       ├── Dialog Title
    │       ├── Dialog Content
    │       │   └── Radio Group
    │       │       ├── CSV Option
    │       │       └── PDF Option
    │       └── Dialog Actions
    │           ├── Cancel Button
    │           └── Export Button (with loading state)
    │
    ├── Orders Page
    │   ├── Header (with Export Button)
    │   ├── Status Filter
    │   ├── Orders Table
    │   ├── Pagination
    │   └── ExportDialog
    │
    └── Users Page
        ├── Header (with Export Button)
        ├── Search Bar
        ├── Users Table
        ├── Pagination
        └── ExportDialog
```

## State Management

### Products Page State

```typescript
{
  products: Product[],           // Current page of products
  loading: boolean,              // Loading indicator
  page: number,                  // Current page number
  rowsPerPage: number,           // Items per page
  total: number,                 // Total product count
  search: string,                // Search query
  exportDialogOpen: boolean      // Export dialog visibility
}
```

### Drag-and-Drop State

```typescript
// Managed by @dnd-kit
{
  activeId: string | null,       // ID of item being dragged
  overId: string | null,         // ID of item being hovered over
  isDragging: boolean,           // Drag in progress
  transform: {                   // Current drag position
    x: number,
    y: number
  }
}
```

## Security Flow

```
Request → JWT Middleware → Role Middleware → Controller → Response
│
├─> JWT Middleware (protect)
│   ├─ Extract token from Authorization header
│   ├─ Verify token signature
│   ├─ Check expiration
│   ├─ Load user from database
│   └─> Attach user to request object
│
├─> Role Middleware (authorize('admin'))
│   ├─ Check req.user.role === 'admin'
│   ├─ If not admin: Return 403 Forbidden
│   └─> Continue to controller
│
├─> Controller
│   ├─ Process request
│   ├─ Query database
│   ├─ Generate export or update records
│   └─> Return response
│
└─> Response to client
```

## Performance Optimizations

### Frontend
- Optimistic UI updates for drag-and-drop
- Debouncing for search input
- Pagination to limit data loaded
- Lazy loading for table rows
- Memoization of expensive computations

### Backend
- Database indexes on sortOrder field
- Efficient bulk updates with bulkWrite
- Streaming file downloads
- Automatic file cleanup
- Query optimization with select() and lean()

### Database
- Indexes on frequently queried fields
- Compound indexes for complex queries
- Lean queries for read-only operations
- Pagination support

## Error Handling

```
Frontend Error Flow:
├─> Network error
│   └─> Show error toast
│   └─> Keep previous state
│
├─> API error (4xx, 5xx)
│   └─> Parse error message
│   └─> Show user-friendly message
│   └─> Revert optimistic updates
│
└─> Export error
    └─> Show dialog error message
    └─> Log to console
    └─> Keep dialog open for retry

Backend Error Flow:
├─> Authentication error
│   └─> Return 401 Unauthorized
│
├─> Authorization error
│   └─> Return 403 Forbidden
│
├─> Validation error
│   └─> Return 400 Bad Request
│   └─> Include validation details
│
├─> Database error
│   └─> Log error
│   └─> Return 500 Internal Server Error
│
└─> File system error
    └─> Log error
    └─> Return 500 Internal Server Error
```

## Dependencies

### Frontend
```json
{
  "@dnd-kit/core": "^6.x",
  "@dnd-kit/sortable": "^7.x",
  "@dnd-kit/utilities": "^3.x",
  "papaparse": "^5.x"
}
```

### Backend
```json
{
  "csv-writer": "^1.x",
  "pdfkit": "^0.x"
}
```

## File Structure

```
cstore/
├── admin-dashboard/
│   └── src/
│       ├── components/
│       │   └── common/
│       │       └── ExportDialog.tsx          ← NEW
│       ├── pages/
│       │   ├── Products.tsx                  ← MODIFIED (added DnD)
│       │   ├── Orders.tsx                    ← MODIFIED (added export)
│       │   └── Users.tsx                     ← MODIFIED (added export)
│       ├── services/
│       │   └── api.ts                        ← MODIFIED (new methods)
│       ├── types/
│       │   └── index.ts                      ← MODIFIED (sortOrder)
│       └── utils/
│           └── exportUtils.ts                ← NEW
│
└── src/
    ├── controllers/
    │   └── adminController.js                ← MODIFIED (new exports)
    ├── models/
    │   └── Product.js                        ← MODIFIED (sortOrder)
    ├── routes/
    │   └── adminRoutes.js                    ← MODIFIED (new routes)
    └── services/
        └── exportService.js                  ← NEW
```
