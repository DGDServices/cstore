// API Base URL
const API_URL = window.location.origin + '/api';

// State
let products = [];
let selectedProduct = null;
let currentOrder = null;
let currentLanguage = localStorage.getItem('language') || 'en';
let supportedCryptocurrencies = [
    { symbol: 'BTC', name: 'Bitcoin' },
    { symbol: 'ETH', name: 'Ethereum' },
    { symbol: 'USDT', name: 'Tether' }
];

// Product icons mapping
const productIcons = {
    '1': '💻',
    '2': '🎧',
    '3': '⌚',
    '4': '⌨️',
    '5': '🖥️'
};

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    initializeLanguage();
    await loadSupportedCryptocurrencies();
    await loadProducts();
    setupNavigation();
    setupEventListeners();
});

// Initialize language
function initializeLanguage() {
    const languageSelect = document.getElementById('language-select');
    if (languageSelect) {
        languageSelect.value = currentLanguage;
        languageSelect.addEventListener('change', (e) => {
            currentLanguage = e.target.value;
            localStorage.setItem('language', currentLanguage);
            // Set cookie for server-side language detection
            document.cookie = `i18next=${currentLanguage}; path=/; max-age=31536000`;
            // Reload to apply language changes
            window.location.reload();
        });
    }
}

// Get API headers with language
function getHeaders() {
    return {
        'Content-Type': 'application/json',
        'Accept-Language': currentLanguage
    };
}

// Load supported cryptocurrencies from API
async function loadSupportedCryptocurrencies() {
    try {
        const response = await fetch(`${API_URL}/cryptocurrencies?lng=${currentLanguage}`, {
            headers: getHeaders()
        });
        const data = await response.json();

        if (data.success && data.data && Array.isArray(data.data.cryptocurrencies)) {
            supportedCryptocurrencies = data.data.cryptocurrencies;
        }
    } catch (error) {
        console.error('Error loading supported cryptocurrencies:', error);
    }
}

// Load products from API
async function loadProducts() {
    try {
        const response = await fetch(`${API_URL}/products?lng=${currentLanguage}`, {
            headers: getHeaders()
        });
        const data = await response.json();
        
        if (data.success) {
            products = data.products;
            displayProducts(products);
        }
    } catch (error) {
        console.error('Error loading products:', error);
        showError('Failed to load products. Please refresh the page.');
    }
}

// Display products in grid
function displayProducts(products) {
    const grid = document.getElementById('products-grid');
    grid.innerHTML = '';
    
    products.forEach(product => {
        const card = createProductCard(product);
        grid.appendChild(card);
    });
}

// Create product card element
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.onclick = () => showProductModal(product);
    
    const stockStatus = product.stock === 0 ? 'out-of-stock' : 
                       product.stock <= 5 ? 'low-stock' : '';
    
    card.innerHTML = `
        <div class="product-image">
            ${productIcons[product.id] || '📦'}
        </div>
        <div class="product-info">
            <div class="product-name">${product.name}</div>
            <div class="product-description">${product.description}</div>
            <div class="product-price">
                <span class="crypto-price">${product.price} ${product.currency}</span>
                <span class="usd-price">~$${product.priceUSD}</span>
            </div>
            <div class="product-stock ${stockStatus}">
                ${product.stock > 0 ? `${product.stock} in stock` : 'Out of stock'}
            </div>
            <button class="btn" ${product.stock === 0 ? 'disabled' : ''}>
                ${product.stock === 0 ? 'Out of Stock' : 'Buy Now'}
            </button>
        </div>
    `;
    
    return card;
}

// Show product modal
function showProductModal(product) {
    if (product.stock === 0) return;
    
    selectedProduct = product;
    const modal = document.getElementById('product-modal');
    const modalBody = document.getElementById('modal-body');
    
    modalBody.innerHTML = `
        <h2>${product.name}</h2>
        <div class="product-image" style="margin-bottom: 1rem;">
            ${productIcons[product.id] || '📦'}
        </div>
        <p style="margin-bottom: 1rem;">${product.description}</p>
        <div class="product-price" style="margin-bottom: 1.5rem;">
            <span class="crypto-price">${product.price} ${product.currency}</span>
            <span class="usd-price">~$${product.priceUSD}</span>
        </div>
        <div class="product-stock" style="margin-bottom: 1.5rem;">
            ${product.stock} available
        </div>
        
        <form id="order-form">
            <div class="form-group">
                <label for="quantity">Quantity:</label>
                <input type="number" id="quantity" name="quantity" min="1" max="${product.stock}" value="1" required>
            </div>
            
            <div class="form-group">
                <label for="email">Email Address:</label>
                <input type="email" id="email" name="email" placeholder="your@email.com" required>
            </div>
            
            <div class="form-group">
                <label for="cryptocurrency">Payment Method:</label>
                <select id="cryptocurrency" name="cryptocurrency" required>
                    ${supportedCryptocurrencies.map(crypto =>
                        `<option value="${crypto.symbol}">${crypto.name} (${crypto.symbol})</option>`
                    ).join('')}
                </select>
            </div>
            
            <button type="submit" class="btn">Proceed to Payment</button>
        </form>
    `;
    
    modal.classList.remove('hidden');
    
    // Setup form submission
    document.getElementById('order-form').onsubmit = async (e) => {
        e.preventDefault();
        await createOrder();
    };
}

// Create order
async function createOrder() {
    const quantity = parseInt(document.getElementById('quantity').value);
    const email = document.getElementById('email').value;
    const cryptocurrency = document.getElementById('cryptocurrency').value;
    
    try {
        const response = await fetch(`${API_URL}/orders`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                productId: selectedProduct.id,
                quantity: quantity,
                customerEmail: email,
                cryptocurrency: cryptocurrency
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            currentOrder = data.order;
            closeModal();
            showPaymentSection();
        } else {
            showError(data.message || 'Failed to create order');
        }
    } catch (error) {
        console.error('Error creating order:', error);
        showError('Failed to create order. Please try again.');
    }
}

// Show payment section
function showPaymentSection() {
    // Hide products section
    document.getElementById('products-section').classList.add('hidden');
    
    // Show payment section
    const paymentSection = document.getElementById('payment-section');
    paymentSection.classList.remove('hidden');
    
    const paymentDetails = document.getElementById('payment-details');
    paymentDetails.innerHTML = `
        <div class="order-summary">
            <h3>Order Summary</h3>
            <div class="order-item">
                <span>Product:</span>
                <strong>${currentOrder.productName}</strong>
            </div>
            <div class="order-item">
                <span>Quantity:</span>
                <strong>${currentOrder.quantity}</strong>
            </div>
            <div class="order-item">
                <span>Payment Method:</span>
                <strong>${currentOrder.cryptocurrency}</strong>
            </div>
            <div class="order-item">
                <span>Total:</span>
                <strong>${currentOrder.totalPrice} ${currentOrder.cryptocurrency} (~$${currentOrder.totalPriceUSD})</strong>
            </div>
        </div>
        
        <div class="payment-instructions">
            <h3>Payment Instructions</h3>
            <ol>
                <li>Send exactly <strong>${currentOrder.totalPrice} ${currentOrder.cryptocurrency}</strong> to the address below</li>
                <li>After sending, enter your transaction hash</li>
                <li>Your order will be confirmed once payment is verified</li>
            </ol>
        </div>
        
        <div class="form-group">
            <label>Payment Address:</label>
            <div class="payment-address">${currentOrder.paymentAddress}</div>
        </div>
        
        <form id="payment-form">
            <div class="form-group">
                <label for="transaction-hash">Transaction Hash:</label>
                <input type="text" id="transaction-hash" name="transactionHash" 
                       placeholder="Enter your transaction hash" required>
            </div>
            
            <button type="submit" class="btn">Confirm Payment</button>
            <button type="button" class="btn back-button" onclick="goBackToProducts()">
                Cancel Order
            </button>
        </form>
    `;
    
    // Setup payment form submission
    document.getElementById('payment-form').onsubmit = async (e) => {
        e.preventDefault();
        await confirmPayment();
    };
}

// Confirm payment
async function confirmPayment() {
    const transactionHash = document.getElementById('transaction-hash').value;
    
    try {
        const response = await fetch(`${API_URL}/payments/confirm`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                orderId: currentOrder.id,
                transactionHash: transactionHash
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            showSuccessMessage();
        } else {
            showError(data.message || 'Failed to confirm payment');
        }
    } catch (error) {
        console.error('Error confirming payment:', error);
        showError('Failed to confirm payment. Please try again.');
    }
}

// Show success message
function showSuccessMessage() {
    const paymentDetails = document.getElementById('payment-details');
    paymentDetails.innerHTML = `
        <div class="success-message">
            <h3>✅ Payment Confirmed!</h3>
            <p>Your order has been successfully placed and payment confirmed.</p>
            <p>Order ID: <strong>${currentOrder.id}</strong></p>
            <p>A confirmation email has been sent to <strong>${currentOrder.customerEmail}</strong></p>
        </div>
        
        <button class="btn" onclick="goBackToProducts()">Continue Shopping</button>
    `;
}

// Go back to products
function goBackToProducts() {
    showProductsSection();
    
    // Reset state
    currentOrder = null;
    selectedProduct = null;
    
    // Reload products to update stock
    loadProducts();
}

// Close modal
function closeModal() {
    document.getElementById('product-modal').classList.add('hidden');
}

// Show error message
function showError(message) {
    alert(message);
}

// Setup event listeners
function setupEventListeners() {
    // Close modal when clicking X
    document.querySelector('.close').onclick = closeModal;
    
    // Close modal when clicking outside
    window.onclick = (event) => {
        const modal = document.getElementById('product-modal');
        if (event.target === modal) {
            closeModal();
        }
    };
}

function setupNavigation() {
    const productsNavButton = document.getElementById('nav-products');
    const cfvNavButton = document.getElementById('nav-cfv');

    if (productsNavButton) {
        productsNavButton.onclick = () => {
            showProductsSection();
        };
    }

    if (cfvNavButton) {
        cfvNavButton.onclick = async () => {
            showCFVSection();
            await loadCFVData();
        };
    }
}

function showProductsSection() {
    document.getElementById('products-section').classList.remove('hidden');
    document.getElementById('cfv-section').classList.add('hidden');
    document.getElementById('order-section').classList.add('hidden');
    document.getElementById('payment-section').classList.add('hidden');
    toggleActiveNavButton('products');
}

function showCFVSection() {
    document.getElementById('products-section').classList.add('hidden');
    document.getElementById('cfv-section').classList.remove('hidden');
    document.getElementById('order-section').classList.add('hidden');
    document.getElementById('payment-section').classList.add('hidden');
    toggleActiveNavButton('cfv');
}

function toggleActiveNavButton(section) {
    const productsNavButton = document.getElementById('nav-products');
    const cfvNavButton = document.getElementById('nav-cfv');
    if (!productsNavButton || !cfvNavButton) {
        return;
    }

    productsNavButton.classList.toggle('active', section === 'products');
    cfvNavButton.classList.toggle('active', section === 'cfv');
}

async function loadCFVData() {
    const cfvContent = document.getElementById('cfv-content');
    if (!cfvContent) {
        return;
    }

    cfvContent.innerHTML = '<p>Loading CFV data...</p>';

    try {
        const response = await fetch(`${API_URL}/cfv/summary`, {
            headers: getHeaders()
        });
        const contentType = response.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            throw new Error('CFV endpoint returned non-JSON response');
        }
        const data = await response.json();

        if (!data.success || !data.data || !Array.isArray(data.data.coins)) {
            throw new Error('Invalid CFV summary response');
        }

        const rows = data.data.coins.map((coin) => {
            const status = coin.valuationStatus || 'unknown';
            const statusClass = status.replace(/\s+/g, '-');
            const currentPrice = formatUsdValue(coin.currentPrice);
            const fairValue = formatUsdValue(coin.fairValue);
            const difference = formatPercentage(coin.percentageDifference);

            return `
                <tr>
                    <td><strong>${coin.symbol}</strong></td>
                    <td>${coin.name}</td>
                    <td>${currentPrice}</td>
                    <td>${fairValue}</td>
                    <td class="cfv-status ${statusClass}">${status}</td>
                    <td>${difference}</td>
                </tr>
            `;
        }).join('');

        cfvContent.innerHTML = `
            <div class="cfv-table-wrapper">
                <table class="cfv-table">
                    <thead>
                        <tr>
                            <th>Symbol</th>
                            <th>Name</th>
                            <th>Current Price</th>
                            <th>Fair Value</th>
                            <th>Valuation Status</th>
                            <th>% Difference</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    } catch (error) {
        console.error('Error loading CFV data:', error);
        cfvContent.innerHTML = '<p>CFV data is currently unavailable.</p>';
    }
}

function formatUsdValue(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return 'N/A';
    }
    if (value >= 1) {
        return `$${value.toFixed(2)}`;
    }
    if (value >= 0.01) {
        return `$${value.toFixed(4)}`;
    }
    return `$${value.toFixed(8)}`;
}

function formatPercentage(value) {
    if (typeof value !== 'number' || Number.isNaN(value)) {
        return 'N/A';
    }
    return `${value.toFixed(2)}%`;
}
