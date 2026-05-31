# Elasticsearch Integration Guide

This document provides a comprehensive guide to the Elasticsearch integration in CStore for advanced product search.

## Overview

CStore integrates with Elasticsearch to provide enhanced search capabilities including:
- **Fuzzy Search**: Automatic typo tolerance
- **Better Relevance**: Elasticsearch scoring for more relevant results
- **Multi-field Search**: Searches across name, description, and category
- **Advanced Filtering**: Combine multiple filters efficiently
- **Autocomplete**: Real-time search suggestions
- **Graceful Fallback**: Uses MongoDB if Elasticsearch is unavailable

## Architecture

```
┌─────────────┐
│   Client    │
└──────┬──────┘
       │ GET /api/products?search=laptop
       ▼
┌─────────────────┐
│ Product         │
│ Controller      │
└────┬────────┬───┘
     │        │
     ▼        ▼
┌────────┐ ┌──────────┐
│  ES    │ │ MongoDB  │
│Service │ │(Fallback)│
└────┬───┘ └──────────┘
     │
     ▼
┌──────────────┐
│Elasticsearch │
│   Cluster    │
└──────────────┘
```

### Request Flow

1. **Search Request** → Product Controller receives search request
2. **ES Check** → Controller checks if Elasticsearch is enabled and available
3. **ES Search** → If available, Elasticsearch performs the search
4. **MongoDB Enhancement** → Full product details fetched from MongoDB
5. **Fallback** → If ES unavailable, MongoDB text search is used
6. **Response** → Results returned with `searchEngine` indicator

## Configuration

### Environment Variables

Add to your `.env` file:

```env
# Elasticsearch Configuration (Optional)
ELASTICSEARCH_ENABLED=false
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_USERNAME=
ELASTICSEARCH_PASSWORD=
```

**Variables:**
- `ELASTICSEARCH_ENABLED`: Set to `true` to enable Elasticsearch
- `ELASTICSEARCH_NODE`: Elasticsearch server URL
- `ELASTICSEARCH_USERNAME`: Optional authentication username
- `ELASTICSEARCH_PASSWORD`: Optional authentication password

### Docker Compose

The Elasticsearch service is included in `docker-compose.yml` with the `elasticsearch` profile:

```yaml
elasticsearch:
  image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
  container_name: cstore-elasticsearch
  environment:
    - discovery.type=single-node
    - xpack.security.enabled=false
    - "ES_JAVA_OPTS=-Xms512m -Xmx512m"
  ports:
    - "9200:9200"
  profiles:
    - elasticsearch
```

**To start with Elasticsearch:**
```bash
docker-compose --profile elasticsearch up -d
```

## Implementation Details

### Index Structure

The products index has the following mapping:

```javascript
{
  properties: {
    name: {
      type: 'text',
      analyzer: 'product_analyzer',
      fields: {
        keyword: { type: 'keyword' },        // For exact matching
        suggest: { type: 'completion' }      // For autocomplete
      }
    },
    description: {
      type: 'text',
      analyzer: 'product_analyzer'
    },
    category: { type: 'keyword' },
    categoryName: { type: 'text' },
    price: { type: 'float' },
    priceUSD: { type: 'float' },
    stock: { type: 'integer' },
    isActive: { type: 'boolean' },
    featured: { type: 'boolean' },
    averageRating: { type: 'float' },
    numReviews: { type: 'integer' },
    createdAt: { type: 'date' },
    updatedAt: { type: 'date' }
  }
}
```

### Custom Analyzer

The `product_analyzer` provides:
- Lowercase normalization
- ASCII folding (converts accented characters)
- Standard tokenization

### Automatic Synchronization

Products are automatically synchronized with Elasticsearch on:

1. **Product Creation** (`POST /api/products`)
   ```javascript
   await elasticsearchService.indexProduct(product);
   ```

2. **Product Update** (`PUT /api/products/:id`)
   ```javascript
   await elasticsearchService.updateProduct(productId, updates);
   ```

3. **Product Deletion** (`DELETE /api/products/:id`)
   ```javascript
   await elasticsearchService.updateProduct(productId, { isActive: false });
   ```

## API Enhancements

### Enhanced Product Search

**Endpoint:** `GET /api/products`

**New Query Parameters:**
- `featured` - Filter for featured products (boolean)
- `minRating` - Minimum average rating (0-5)

**Enhanced Behavior:**
- Fuzzy matching on `search` parameter
- Multi-field search (name, description, category)
- Better relevance ranking
- Typo tolerance

**Response Enhancement:**
```json
{
  "success": true,
  "data": {
    "products": [...],
    "pagination": {...},
    "searchEngine": "elasticsearch"  // Indicates which engine was used
  }
}
```

### Search Suggestions

**Endpoint:** `GET /api/products/suggestions`

**Query Parameters:**
- `q` - Search query (minimum 2 characters)
- `limit` - Maximum suggestions (default: 5)

**Response:**
```json
{
  "success": true,
  "data": {
    "suggestions": [
      "Laptop Computer",
      "Laptop Stand",
      "Laptop Bag"
    ]
  }
}
```

### Manual Sync

**Endpoint:** `POST /api/products/sync-elasticsearch`

**Auth:** Admin only

**Use Cases:**
- Initial Elasticsearch setup
- After bulk product imports
- Recovery from Elasticsearch issues

## Service API

The `elasticsearchService` module provides:

### Initialization
```javascript
initializeClient()    // Initialize ES client
isEnabled()           // Check if ES is enabled
isAvailable()         // Check if ES is reachable
createProductsIndex() // Create index with mappings
```

### CRUD Operations
```javascript
indexProduct(product)              // Index a single product
updateProduct(productId, updates)  // Update product in ES
deleteProduct(productId)           // Delete from ES
bulkIndexProducts(products)        // Bulk index multiple products
```

### Search Operations
```javascript
searchProducts(params)             // Advanced search
getSuggestions(query, limit)       // Get autocomplete suggestions
syncAllProducts(ProductModel)      // Sync all from MongoDB
```

## Error Handling

### Graceful Degradation

If Elasticsearch is unavailable, the application:
1. Logs a warning
2. Falls back to MongoDB text search
3. Sets `searchEngine: 'mongodb'` in response
4. Continues operating normally

### Error Scenarios

| Scenario | Behavior |
|----------|----------|
| ES disabled | Uses MongoDB, no errors |
| ES unreachable | Logs warning, uses MongoDB |
| ES index missing | Automatically recreated on app start |
| ES search fails | Falls back to MongoDB |
| ES sync fails | Logs error, continues operation |

## Monitoring

### Health Checks

Check Elasticsearch availability:
```bash
curl http://localhost:9200/_cluster/health
```

Check index status:
```bash
curl http://localhost:9200/products/_stats
```

### Application Logs

The application logs Elasticsearch operations:
```
info: Elasticsearch client initialized
info: Products index created successfully
info: Successfully synced 150 products to Elasticsearch
warn: Elasticsearch is not available: connection refused
```

## Performance

### Search Performance

Typical response times (1000 products):
- MongoDB text search: 50-100ms
- Elasticsearch search: 10-30ms
- Elasticsearch with filters: 15-40ms

### Resource Usage

**Elasticsearch Container:**
- Memory: 512MB-2GB (configured via `ES_JAVA_OPTS`)
- CPU: Low (< 5% idle, < 30% under load)
- Disk: ~50MB per 1000 products

**Recommendations:**
- Small catalogs (< 1K products): 512MB heap
- Medium catalogs (1K-10K): 1GB heap
- Large catalogs (10K+): 2GB heap

## Testing

### Unit Tests

Elasticsearch tests are in `tests/elasticsearch.test.js`:
```bash
npm test tests/elasticsearch.test.js
```

Tests verify:
- Service initialization
- Graceful handling when disabled
- CRUD operations
- Search functionality
- Error handling

### Integration Tests

Updated product tests include:
- Suggestions endpoint
- Sync endpoint
- Enhanced search parameters

### Manual Testing

```bash
# 1. Start services
docker-compose --profile elasticsearch up -d

# 2. Enable in .env
ELASTICSEARCH_ENABLED=true

# 3. Test search
curl "http://localhost:3000/api/products?search=test"

# 4. Check response includes
#    "searchEngine": "elasticsearch"
```

## Troubleshooting

### Common Issues

#### 1. Elasticsearch Not Starting

**Symptom:** Container exits or won't start

**Solution:**
```bash
# Check logs
docker-compose logs elasticsearch

# Common issue: Not enough memory
# Increase Docker memory allocation to 4GB+
```

#### 2. Products Not Appearing in Search

**Solution:**
```bash
# Sync products manually
curl -X POST http://localhost:3000/api/products/sync-elasticsearch \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

#### 3. Search Returns MongoDB Results

**Symptom:** `"searchEngine": "mongodb"` in response

**Causes:**
- `ELASTICSEARCH_ENABLED=false` in .env
- Elasticsearch container not running
- Network connectivity issues

**Solution:**
```bash
# Check if ES is running
curl http://localhost:9200

# Check application logs
docker-compose logs app | grep -i elasticsearch
```

#### 4. Out of Memory Errors

**Symptom:** Elasticsearch container restarting

**Solution:**
```yaml
# In docker-compose.yml, increase heap size
environment:
  - "ES_JAVA_OPTS=-Xms1g -Xmx1g"
```

## Best Practices

### Development
1. Keep Elasticsearch optional for local development
2. Test both ES and MongoDB fallback paths
3. Use suggestions endpoint for better UX
4. Monitor ES availability in logs

### Production
1. Enable Elasticsearch for better performance
2. Set up monitoring and alerting
3. Regular index maintenance and optimization
4. Backup Elasticsearch data
5. Scale ES cluster for high traffic

### Operations
1. Sync products after bulk imports
2. Monitor ES health and performance
3. Set appropriate heap sizes
4. Use connection pooling
5. Implement retry logic for transient failures

## Migration

### Enabling Elasticsearch on Existing System

1. **Start Elasticsearch:**
   ```bash
   docker-compose --profile elasticsearch up -d elasticsearch
   ```

2. **Enable in configuration:**
   ```env
   ELASTICSEARCH_ENABLED=true
   ```

3. **Restart application:**
   ```bash
   docker-compose restart app
   ```

4. **Sync existing products:**
   ```bash
   curl -X POST http://localhost:3000/api/products/sync-elasticsearch \
     -H "Authorization: Bearer ADMIN_TOKEN"
   ```

5. **Verify:**
   ```bash
   curl "http://localhost:3000/api/products?search=test" | jq '.data.searchEngine'
   # Should return "elasticsearch"
   ```

### Disabling Elasticsearch

1. **Disable in configuration:**
   ```env
   ELASTICSEARCH_ENABLED=false
   ```

2. **Restart application:**
   ```bash
   docker-compose restart app
   ```

Application will automatically fall back to MongoDB search.

## Security Considerations

### Authentication

For production, enable Elasticsearch security:

```env
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD=your-secure-password
```

Update docker-compose.yml:
```yaml
environment:
  - xpack.security.enabled=true
  - ELASTIC_PASSWORD=your-secure-password
```

### Network Security

- Run Elasticsearch on private network
- Don't expose port 9200 externally
- Use firewall rules to restrict access
- Enable TLS/SSL for production

## Future Enhancements

Planned improvements:

- [ ] Search analytics and tracking
- [ ] Multi-language search support
- [ ] Synonym support
- [ ] Search result highlighting
- [ ] Aggregations for faceted search
- [ ] Cluster setup for high availability
- [ ] Automated reindexing strategies
- [ ] Search A/B testing support

## Support

For issues or questions:
- Check application logs: `docker-compose logs app`
- Check ES logs: `docker-compose logs elasticsearch`
- Review [Elasticsearch documentation](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- Open an issue on GitHub

## References

- [Elasticsearch Documentation](https://www.elastic.co/guide/en/elasticsearch/reference/current/index.html)
- [Elasticsearch Node.js Client](https://www.elastic.co/guide/en/elasticsearch/client/javascript-api/current/index.html)
- [Usage Examples](../examples/elasticsearch-usage.md)
- [API Documentation](./API_ENDPOINTS.md)
