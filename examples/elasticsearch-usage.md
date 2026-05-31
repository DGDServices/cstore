# Elasticsearch Usage Examples

This document provides examples of how to use the Elasticsearch integration in Cryptons.com.

## Setup

### 1. Enable Elasticsearch

Add to your `.env` file:
```env
ELASTICSEARCH_ENABLED=true
ELASTICSEARCH_NODE=http://localhost:9200
```

### 2. Start Elasticsearch with Docker

```bash
# Start Elasticsearch along with other services
docker-compose --profile elasticsearch up -d

# Or if running services individually
docker-compose up -d elasticsearch
```

### 3. Verify Elasticsearch is Running

```bash
curl http://localhost:9200
```

You should see a JSON response with Elasticsearch version information.

### 4. Sync Existing Products

After enabling Elasticsearch, sync your existing products:

```bash
# Using curl (replace with your admin token)
curl -X POST http://localhost:3000/api/products/sync-elasticsearch \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Search Examples

### Basic Search

```bash
# Simple text search
curl "http://localhost:3000/api/products?search=laptop"

# Response includes searchEngine field
{
  "success": true,
  "data": {
    "products": [...],
    "pagination": {...},
    "searchEngine": "elasticsearch"  # or "mongodb" if ES unavailable
  }
}
```

### Fuzzy Search (Typo Tolerance)

Elasticsearch automatically handles typos:

```bash
# These all find "laptop" products
curl "http://localhost:3000/api/products?search=laptp"   # missing 'o'
curl "http://localhost:3000/api/products?search=loptop"  # swapped letters
curl "http://localhost:3000/api/products?search=laptpo"  # transposed
```

### Advanced Filtering

```bash
# Combine multiple filters
curl "http://localhost:3000/api/products?\
search=gaming&\
category=electronics&\
minPrice=500&\
maxPrice=2000&\
featured=true&\
minRating=4&\
sort=-rating&\
page=1&\
limit=20"
```

### Search with Sorting

```bash
# Sort by price (ascending)
curl "http://localhost:3000/api/products?search=laptop&sort=price"

# Sort by rating (descending)
curl "http://localhost:3000/api/products?search=laptop&sort=-rating"

# Sort by newest first
curl "http://localhost:3000/api/products?search=laptop&sort=-createdAt"

# Sort by name (alphabetically)
curl "http://localhost:3000/api/products?search=laptop&sort=name"
```

### Autocomplete/Suggestions

```bash
# Get search suggestions as user types
curl "http://localhost:3000/api/products/suggestions?q=lap&limit=5"

# Response
{
  "success": true,
  "data": {
    "suggestions": [
      "Laptop Computer",
      "Laptop Stand",
      "Laptop Bag",
      "Gaming Laptop",
      "Laptop Charger"
    ]
  }
}
```

## Search Features Comparison

### MongoDB Text Search (Fallback)
- ✅ Basic text search
- ✅ Simple filtering
- ❌ No fuzzy matching
- ❌ Limited relevance ranking
- ❌ No typo tolerance
- ⚠️ Must use exact words

### Elasticsearch (Enhanced)
- ✅ Advanced text search
- ✅ All filtering options
- ✅ Fuzzy matching
- ✅ Better relevance ranking
- ✅ Typo tolerance
- ✅ Partial word matching
- ✅ Multi-field search
- ✅ Autocomplete suggestions

## Performance Considerations

### When to Use Elasticsearch

**Recommended for:**
- Large product catalogs (1000+ products)
- Heavy search usage
- Need for advanced features (fuzzy search, suggestions)
- Multi-language support (future)

**May not need for:**
- Small catalogs (<100 products)
- Simple exact-match searches
- Limited resources (Elasticsearch requires ~2GB RAM)

### Resource Requirements

Elasticsearch Docker container settings (in docker-compose.yml):
```yaml
environment:
  - "ES_JAVA_OPTS=-Xms512m -Xmx512m"  # Heap size
```

Adjust based on your catalog size:
- Small (< 1K products): 512MB heap
- Medium (1K-10K products): 1GB heap
- Large (10K+ products): 2GB+ heap

## Troubleshooting

### Elasticsearch Not Available

If Elasticsearch is enabled but not available, the app automatically falls back to MongoDB:

```json
{
  "searchEngine": "mongodb"  // Indicates fallback is active
}
```

Check logs for details:
```bash
docker-compose logs app | grep -i elasticsearch
```

### Products Not Appearing in Search

1. **Check if products are indexed:**
   ```bash
   curl http://localhost:9200/products/_count
   ```

2. **Manually sync products:**
   ```bash
   curl -X POST http://localhost:3000/api/products/sync-elasticsearch \
     -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
   ```

3. **Check Elasticsearch health:**
   ```bash
   curl http://localhost:9200/_cluster/health
   ```

### Search Returns No Results

1. **Try without search term** to verify products exist:
   ```bash
   curl "http://localhost:3000/api/products"
   ```

2. **Check if using MongoDB fallback:**
   - Look for `"searchEngine": "mongodb"` in response
   - MongoDB requires exact word matches

3. **Verify Elasticsearch index:**
   ```bash
   curl http://localhost:9200/products/_search?pretty
   ```

## Admin Operations

### Manual Sync

After bulk imports or database operations:
```bash
curl -X POST http://localhost:3000/api/products/sync-elasticsearch \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Check Index Status

```bash
# Get index stats
curl http://localhost:9200/products/_stats?pretty

# Get mapping
curl http://localhost:9200/products/_mapping?pretty

# Count documents
curl http://localhost:9200/products/_count?pretty
```

### Rebuild Index

If you need to rebuild the index:

```bash
# 1. Delete the index
curl -X DELETE http://localhost:9200/products

# 2. Restart the app (it will recreate the index)
docker-compose restart app

# 3. Sync products
curl -X POST http://localhost:3000/api/products/sync-elasticsearch \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## Integration in Your Application

### Frontend Example (JavaScript)

```javascript
// Search with debouncing for autocomplete
let debounceTimer;
const searchInput = document.getElementById('search');

searchInput.addEventListener('input', (e) => {
  clearTimeout(debounceTimer);
  const query = e.target.value;
  
  if (query.length < 2) {
    hideSuggestions();
    return;
  }
  
  debounceTimer = setTimeout(async () => {
    const response = await fetch(
      `/api/products/suggestions?q=${encodeURIComponent(query)}&limit=5`
    );
    const data = await response.json();
    showSuggestions(data.data.suggestions);
  }, 300);
});

// Full search when user submits
async function searchProducts(query, filters = {}) {
  const params = new URLSearchParams({
    search: query,
    ...filters,
    page: 1,
    limit: 20
  });
  
  const response = await fetch(`/api/products?${params}`);
  const data = await response.json();
  
  // Check which search engine was used
  console.log('Search engine:', data.data.searchEngine);
  
  return data.data.products;
}
```

### Backend Example (Product Updates)

The Elasticsearch integration automatically syncs changes:

```javascript
// Create product - automatically indexed
const product = await Product.create({
  name: 'New Gaming Laptop',
  description: 'High performance laptop for gaming',
  price: 0.05,
  priceUSD: 2500,
  stock: 10
});
// ✓ Automatically indexed in Elasticsearch

// Update product - automatically updated
product.stock = 5;
await product.save();
// ✓ Automatically updated in Elasticsearch

// Soft delete - automatically updated
product.isActive = false;
await product.save();
// ✓ Automatically marked inactive in Elasticsearch
```

## Best Practices

1. **Enable Elasticsearch in production** for better user experience
2. **Keep MongoDB as fallback** - don't remove the existing search logic
3. **Monitor Elasticsearch health** - set up alerting for downtime
4. **Regular index maintenance** - sync weekly or after bulk operations
5. **Use suggestions endpoint** for better UX with autocomplete
6. **Tune heap size** based on your product catalog size
7. **Implement search analytics** to understand user search patterns
8. **Test fallback behavior** to ensure graceful degradation

## Future Enhancements

Possible improvements for the Elasticsearch integration:

- [ ] Search result highlighting
- [ ] Search analytics and tracking
- [ ] Multi-language search support
- [ ] Synonym support (laptop = notebook = portable computer)
- [ ] Aggregations for faceted search
- [ ] Did you mean? suggestions
- [ ] Related products based on search
- [ ] Search personalization based on user history
