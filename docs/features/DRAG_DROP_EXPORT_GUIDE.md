# Drag-and-Drop and Export Features Guide

## Overview

This guide covers the newly implemented drag-and-drop product management and CSV/PDF export features for the Cryptons.com admin dashboard.

## Features

### 1. Drag-and-Drop Product Reordering

The Products page now supports drag-and-drop reordering, allowing admins to easily reorganize products by dragging them to new positions.

#### How It Works

1. Navigate to the Products page in the admin dashboard
2. Click and hold the drag handle icon (⋮⋮) on the left side of any product row
3. Drag the product to a new position in the list
4. Release to drop the product in its new position
5. The new order is automatically saved to the database

#### Technical Implementation

**Frontend (React + @dnd-kit):**
```tsx
// Products.tsx uses DndContext and SortableContext
<DndContext
  sensors={sensors}
  collisionDetection={closestCenter}
  onDragEnd={handleDragEnd}
>
  <SortableContext
    items={products.map((p) => p._id)}
    strategy={verticalListSortingStrategy}
  >
    {products.map((product) => (
      <SortableRow key={product._id} product={product} />
    ))}
  </SortableContext>
</DndContext>
```

**Backend API:**
```javascript
// PUT /api/admin/products/reorder
{
  "productOrders": [
    { "productId": "product_id_1", "sortOrder": 0 },
    { "productId": "product_id_2", "sortOrder": 1 }
  ]
}
```

The `sortOrder` field in the Product model stores the position of each product.

### 2. CSV Export

Export data to CSV format for use in Excel, Google Sheets, or other spreadsheet applications.

#### Available Exports

**Products Export:**
- Navigate to Products page
- Click "Export" button
- Select "CSV" format
- File downloads with columns: Name, Description, Price (USD), Currency, Stock, Category, Status, Rating, Reviews, Created Date

**Orders Export:**
- Navigate to Orders page
- Click "Export" button
- Select "CSV" format
- File downloads with columns: Order Number, Customer Email, Total (USD), Cryptocurrency, Status, Items, Created Date
- Filters: Status (pending, confirmed, etc.)

**Users Export:**
- Navigate to Users page
- Click "Export" button
- CSV format only (privacy consideration)
- File downloads with columns: Name, Email, Role, Created Date

#### Example CSV Output

```csv
Product Name,Description,Price (USD),Currency,Stock,Category,Status,Average Rating,Number of Reviews,Created At
Bitcoin Hardware Wallet,Secure cold storage for Bitcoin,59.99,BTC,150,Hardware Wallets,Active,4.5,24,2024-01-15T10:30:00.000Z
```

### 3. PDF Export

Export data to PDF format for professional reports and printable documents.

#### Available Exports

**Products PDF:**
- Professional table format
- Company branding ready
- Columns: Product Name, Price (USD), Stock, Rating, Status
- Footer with total product count

**Orders PDF:**
- Professional table format
- Columns: Order #, Customer, Amount (USD), Crypto, Status
- Footer with total orders and revenue

#### Example PDF Layout

```
┌────────────────────────────────────────────────────────┐
│                    Product Report                       │
│              Generated: 2024-01-15 10:30               │
├────────────────────────────────────────────────────────┤
│ Product Name    │ Price │ Stock │ Rating │ Status     │
├─────────────────┼───────┼───────┼────────┼────────────┤
│ Hardware Wallet │ $59.99│  150  │  4.5   │ Active     │
│ Trading Course  │ $299  │   50  │  4.8   │ Active     │
└────────────────────────────────────────────────────────┘
                 Total Products: 2
```

## API Endpoints

### Product Reordering

```http
PUT /api/admin/products/reorder
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "productOrders": [
    { "productId": "60d5ec49f1a2c8b1f8e4e1a1", "sortOrder": 0 },
    { "productId": "60d5ec49f1a2c8b1f8e4e1a2", "sortOrder": 1 }
  ]
}
```

### Export Endpoints

#### Products CSV
```http
GET /api/admin/products/export/csv?search=wallet&category=60d5ec49f1a2c8b1f8e4e1a1
Authorization: Bearer <admin_token>
```

#### Products PDF
```http
GET /api/admin/products/export/pdf?search=wallet
Authorization: Bearer <admin_token>
```

#### Orders CSV
```http
GET /api/admin/orders/export/csv?status=confirmed&startDate=2024-01-01&endDate=2024-01-31
Authorization: Bearer <admin_token>
```

#### Orders PDF
```http
GET /api/admin/orders/export/pdf?status=confirmed
Authorization: Bearer <admin_token>
```

#### Users CSV
```http
GET /api/admin/users/export/csv?role=user&search=john
Authorization: Bearer <admin_token>
```

## Frontend Components

### ExportDialog Component

Reusable dialog component for selecting export format:

```tsx
<ExportDialog
  open={exportDialogOpen}
  onClose={() => setExportDialogOpen(false)}
  onExport={handleExport}
  title="Export Products"
/>
```

Features:
- Radio button selection between CSV and PDF
- Progress indicator during export
- Error handling with user feedback
- Automatic file download

### Export Utility Functions

```typescript
// Download a blob as a file
downloadBlob(blob: Blob, filename: string)

// Generate timestamped filename
generateFilename(prefix: string, extension: string)
```

## Backend Services

### Export Service

Located at `src/services/exportService.js`, provides:

```javascript
// CSV Exports
exportProductsToCSV(products)
exportOrdersToCSV(orders)
exportUsersToCSV(users)

// PDF Exports
exportProductsToPDF(products)
exportOrdersToPDF(orders)

// Generic CSV export
exportToCSV(data, headers, filename)
```

#### Features:
- Automatic file cleanup after download
- Temporary file storage in `/tmp`
- Error logging
- Support for large datasets
- Formatted output with proper headers

## Database Changes

### Product Model

Added `sortOrder` field:

```javascript
sortOrder: {
  type: Number,
  default: 0
}
```

Index added for performance:
```javascript
productSchema.index({ sortOrder: 1 });
```

## Security

### Authentication
- All export and reorder endpoints require admin role authentication
- JWT token validation on every request

### Data Privacy
- User exports exclude sensitive data (passwords, tokens)
- Only essential user information included (name, email, role)

### File Security
- Temporary files created with unique names
- Automatic cleanup after download
- Files stored in system temp directory

## Performance Considerations

### Drag-and-Drop
- Optimistic UI updates for smooth experience
- Batch API calls for multiple reorders
- Debouncing for rapid movements

### Exports
- Pagination support for large datasets
- Streaming for CSV generation
- Memory-efficient PDF rendering
- Query optimization with indexes

### Best Practices
- Use filters to reduce export size
- Export during off-peak hours for large datasets
- CSV format recommended for datasets > 1000 records
- PDF format best for reports and presentations

## Usage Examples

### Export All Active Products to CSV
1. Navigate to Products page
2. Leave search empty
3. Click "Export" button
4. Select "CSV"
5. Click "Export"
6. File downloads as `products-2024-01-15T10-30-00.csv`

### Export Orders for Last Month (PDF)
1. Navigate to Orders page
2. Filter by date range: Last 30 days
3. Click "Export" button
4. Select "PDF"
5. Click "Export"
6. File downloads as `orders-2024-01-15T10-30-00.pdf`

### Reorder Products
1. Navigate to Products page
2. Locate product to move
3. Click and hold drag handle (⋮⋮)
4. Drag to new position
5. Release mouse
6. Order automatically saved

## Troubleshooting

### Export Button Not Working
- Check admin authentication
- Verify network connection
- Check browser console for errors

### Drag-and-Drop Not Working
- Ensure JavaScript is enabled
- Try refreshing the page
- Check for browser compatibility (Chrome, Firefox, Safari, Edge supported)

### Large Export Takes Long Time
- Use filters to reduce dataset size
- Try CSV format instead of PDF
- Export during off-peak hours

### File Download Blocked
- Check browser popup blocker settings
- Allow downloads from the admin dashboard domain
- Check download folder permissions

## Browser Compatibility

### Drag-and-Drop
- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

### Export Downloads
- ✅ All modern browsers
- ✅ Mobile browsers (iOS Safari, Chrome Mobile)

## Future Enhancements

Potential improvements for future versions:

1. **Scheduled Exports**: Automatic daily/weekly exports via email
2. **Custom Export Fields**: Select specific columns to export
3. **Export Templates**: Save export configurations for reuse
4. **Bulk Category Assignment**: Drag products to categories
5. **Multi-Select Drag**: Move multiple products at once
6. **Excel Format**: Direct .xlsx export support
7. **Export History**: Track all exports with audit log
8. **Email Delivery**: Send exports directly to email addresses

## Support

For issues or questions:
- Check API documentation in `docs/API_ENDPOINTS.md`
- Review error logs in browser console
- Contact system administrator for server-side issues
