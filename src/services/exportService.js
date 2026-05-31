const { createObjectCsvWriter } = require('csv-writer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

/**
 * Export data to CSV
 * @param {Array} data - Array of objects to export
 * @param {Array} headers - Array of header objects with id and title
 * @param {String} filename - Output filename
 * @returns {Promise<String>} - Path to generated file
 */
async function exportToCSV(data, headers, filename) {
  try {
    const filePath = path.join('/tmp', filename);
    
    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: headers
    });

    await csvWriter.writeRecords(data);
    logger.info(`CSV export completed: ${filename}`);
    
    return filePath;
  } catch (error) {
    logger.error('CSV export failed:', error);
    throw error;
  }
}

/**
 * Export products to CSV
 * @param {Array} products - Array of product documents
 * @returns {Promise<String>} - Path to generated file
 */
async function exportProductsToCSV(products) {
  const headers = [
    { id: 'name', title: 'Product Name' },
    { id: 'description', title: 'Description' },
    { id: 'priceUSD', title: 'Price (USD)' },
    { id: 'currency', title: 'Currency' },
    { id: 'stock', title: 'Stock' },
    { id: 'category', title: 'Category' },
    { id: 'isActive', title: 'Status' },
    { id: 'averageRating', title: 'Average Rating' },
    { id: 'numReviews', title: 'Number of Reviews' },
    { id: 'createdAt', title: 'Created At' }
  ];

  const data = products.map(product => ({
    name: product.name,
    description: product.description,
    priceUSD: product.priceUSD,
    currency: product.currency,
    stock: product.stock,
    category: product.category?.name || 'No Category',
    isActive: product.isActive ? 'Active' : 'Inactive',
    averageRating: product.averageRating || 0,
    numReviews: product.numReviews || 0,
    createdAt: new Date(product.createdAt).toISOString()
  }));

  return await exportToCSV(data, headers, `products-${Date.now()}.csv`);
}

/**
 * Export orders to CSV
 * @param {Array} orders - Array of order documents
 * @returns {Promise<String>} - Path to generated file
 */
async function exportOrdersToCSV(orders) {
  const headers = [
    { id: 'orderNumber', title: 'Order Number' },
    { id: 'customerEmail', title: 'Customer Email' },
    { id: 'totalPriceUSD', title: 'Total (USD)' },
    { id: 'cryptocurrency', title: 'Cryptocurrency' },
    { id: 'status', title: 'Status' },
    { id: 'itemCount', title: 'Items' },
    { id: 'createdAt', title: 'Created At' }
  ];

  const data = orders.map(order => ({
    orderNumber: order.orderNumber,
    customerEmail: order.customerEmail,
    totalPriceUSD: order.totalPriceUSD,
    cryptocurrency: order.cryptocurrency,
    status: order.status,
    itemCount: order.items?.length || 0,
    createdAt: new Date(order.createdAt).toISOString()
  }));

  return await exportToCSV(data, headers, `orders-${Date.now()}.csv`);
}

/**
 * Export users to CSV
 * @param {Array} users - Array of user documents
 * @returns {Promise<String>} - Path to generated file
 */
async function exportUsersToCSV(users) {
  const headers = [
    { id: 'name', title: 'Name' },
    { id: 'email', title: 'Email' },
    { id: 'role', title: 'Role' },
    { id: 'createdAt', title: 'Created At' }
  ];

  const data = users.map(user => ({
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: new Date(user.createdAt).toISOString()
  }));

  return await exportToCSV(data, headers, `users-${Date.now()}.csv`);
}

/**
 * Export products to PDF
 * @param {Array} products - Array of product documents
 * @returns {Promise<String>} - Path to generated file
 */
async function exportProductsToPDF(products) {
  return new Promise((resolve, reject) => {
    try {
      const filename = `products-${Date.now()}.pdf`;
      const filePath = path.join('/tmp', filename);
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // Header
      doc.fontSize(20).text('Product Report', { align: 'center' });
      doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown();

      // Table header
      const tableTop = 150;
      const col1X = 50;
      const col2X = 200;
      const col3X = 300;
      const col4X = 400;
      const col5X = 480;

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Product Name', col1X, tableTop);
      doc.text('Price (USD)', col2X, tableTop);
      doc.text('Stock', col3X, tableTop);
      doc.text('Rating', col4X, tableTop);
      doc.text('Status', col5X, tableTop);

      // Table rows
      doc.font('Helvetica');
      let y = tableTop + 20;
      const rowHeight = 20;
      const pageHeight = 700;

      products.forEach((product) => {
        if (y > pageHeight) {
          doc.addPage();
          y = 50;
        }

        const name = product.name.length > 20 ? product.name.substring(0, 20) + '...' : product.name;
        doc.text(name, col1X, y);
        doc.text(`$${product.priceUSD.toFixed(2)}`, col2X, y);
        doc.text(product.stock.toString(), col3X, y);
        doc.text(product.averageRating ? product.averageRating.toFixed(1) : 'N/A', col4X, y);
        doc.text(product.isActive ? 'Active' : 'Inactive', col5X, y);

        y += rowHeight;
      });

      // Footer
      doc.fontSize(8).text(
        `Total Products: ${products.length}`,
        50,
        doc.page.height - 50,
        { align: 'center' }
      );

      doc.end();

      stream.on('finish', () => {
        logger.info(`PDF export completed: ${filename}`);
        resolve(filePath);
      });

      stream.on('error', reject);
    } catch (error) {
      logger.error('PDF export failed:', error);
      reject(error);
    }
  });
}

/**
 * Export orders to PDF
 * @param {Array} orders - Array of order documents
 * @returns {Promise<String>} - Path to generated file
 */
async function exportOrdersToPDF(orders) {
  return new Promise((resolve, reject) => {
    try {
      const filename = `orders-${Date.now()}.pdf`;
      const filePath = path.join('/tmp', filename);
      const doc = new PDFDocument({ margin: 50 });
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // Header
      doc.fontSize(20).text('Orders Report', { align: 'center' });
      doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
      doc.moveDown();

      // Table header
      const tableTop = 150;
      const col1X = 50;
      const col2X = 150;
      const col3X = 280;
      const col4X = 380;
      const col5X = 480;

      doc.fontSize(10).font('Helvetica-Bold');
      doc.text('Order #', col1X, tableTop);
      doc.text('Customer', col2X, tableTop);
      doc.text('Amount (USD)', col3X, tableTop);
      doc.text('Crypto', col4X, tableTop);
      doc.text('Status', col5X, tableTop);

      // Table rows
      doc.font('Helvetica');
      let y = tableTop + 20;
      const rowHeight = 20;
      const pageHeight = 700;

      orders.forEach((order) => {
        if (y > pageHeight) {
          doc.addPage();
          y = 50;
        }

        doc.text(order.orderNumber, col1X, y);
        const email = order.customerEmail.length > 18 ? order.customerEmail.substring(0, 18) + '...' : order.customerEmail;
        doc.text(email, col2X, y);
        doc.text(`$${order.totalPriceUSD.toFixed(2)}`, col3X, y);
        doc.text(order.cryptocurrency, col4X, y);
        doc.text(order.status, col5X, y);

        y += rowHeight;
      });

      // Footer
      const totalRevenue = orders.reduce((sum, order) => sum + order.totalPriceUSD, 0);
      doc.fontSize(8).text(
        `Total Orders: ${orders.length} | Total Revenue: $${totalRevenue.toFixed(2)}`,
        50,
        doc.page.height - 50,
        { align: 'center' }
      );

      doc.end();

      stream.on('finish', () => {
        logger.info(`PDF export completed: ${filename}`);
        resolve(filePath);
      });

      stream.on('error', reject);
    } catch (error) {
      logger.error('PDF export failed:', error);
      reject(error);
    }
  });
}

module.exports = {
  exportToCSV,
  exportProductsToCSV,
  exportOrdersToCSV,
  exportUsersToCSV,
  exportProductsToPDF,
  exportOrdersToPDF
};
