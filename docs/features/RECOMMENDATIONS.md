# Product Recommendations System

## Overview

The product recommendations system provides personalized product suggestions to users based on their purchase history. It uses collaborative filtering techniques to identify patterns in user behavior and recommend products that similar users have purchased.

## Features

### 1. Personalized Recommendations
- **Endpoint**: `GET /api/products/recommendations`
- **Authentication**: Required
- **Description**: Returns personalized product recommendations for authenticated users

### 2. Related Products
- **Endpoint**: `GET /api/products/:id/related`
- **Authentication**: Not required
- **Description**: Returns products related to a specific product (same category)

## How It Works

### Collaborative Filtering Algorithm

The recommendation system uses a collaborative filtering approach:

1. **Purchase History Analysis**
   - Retrieves all confirmed orders (paid, processing, shipped, or delivered) for the user
   - Extracts the list of products the user has purchased
   - Identifies the categories of purchased products

2. **Finding Similar Users**
   - Identifies other users who purchased the same products
   - Aggregates products purchased by these similar users
   - Sorts by purchase frequency

3. **Category-Based Recommendations**
   - Finds products from the same categories as user's purchases
   - Filters out already-purchased products
   - Sorts by average rating and number of reviews

4. **Combining Results**
   - Merges collaborative filtering results with category-based recommendations
   - Removes duplicates
   - Limits to requested number of recommendations (default: 10)

### Fallback for New Users

For users with no purchase history, the system returns popular products:
- Aggregates products with the highest total sales
- Sorts by number of units sold
- Returns top products across all categories

### Related Products

For a specific product, the system:
- Finds products in the same category
- Excludes the original product
- Sorts by rating and number of reviews
- Limits results (default: 6)

## Implementation

### Service Layer
The recommendation logic is implemented in `src/services/recommendationService.js`:

```javascript
class RecommendationService {
  async getRecommendationsForUser(userId, limit)
  async getPopularProducts(limit)
  async getRelatedProducts(productId, limit)
}
```

### Controller Layer
The API endpoints are handled in `src/controllers/productController.js`:

```javascript
const getRecommendations = asyncHandler(async (req, res, next) => { ... })
const getRelatedProducts = asyncHandler(async (req, res, next) => { ... })
```

### Routes
Routes are defined in `src/routes/productRoutes.js`:

```javascript
router.get('/recommendations', protect, getRecommendations);
router.get('/:id/related', getRelatedProducts);
```

## Usage Examples

### Get Personalized Recommendations

```bash
curl -X GET http://localhost:3000/api/products/recommendations?limit=10 \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "recommendations": [
      {
        "_id": "product_id",
        "name": "Product Name",
        "description": "Product description",
        "price": 0.001,
        "priceUSD": 50,
        "image": "/images/product.jpg",
        "averageRating": 4.5,
        "numReviews": 10,
        "stock": 20,
        "category": {
          "_id": "category_id",
          "name": "Category Name",
          "slug": "category-slug"
        }
      }
    ],
    "count": 10
  }
}
```

### Get Related Products

```bash
curl -X GET http://localhost:3000/api/products/PRODUCT_ID/related?limit=6
```

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "_id": "related_product_id",
        "name": "Related Product",
        "description": "Product description",
        "price": 0.002,
        "priceUSD": 100,
        "image": "/images/product.jpg",
        "averageRating": 4.8,
        "numReviews": 15,
        "stock": 10,
        "category": {
          "_id": "category_id",
          "name": "Category Name",
          "slug": "category-slug"
        }
      }
    ],
    "count": 6
  }
}
```

## Benefits

### For Users
- **Personalized Shopping Experience**: Discover products relevant to their interests
- **Time Savings**: Quickly find products they might like without extensive searching
- **Discovery**: Find new products they might not have found otherwise

### For Business
- **Increased Sales**: Drive additional purchases through relevant recommendations
- **Higher Engagement**: Keep users browsing and interacting with the platform
- **Better Customer Retention**: Improve user satisfaction with personalized experiences
- **Data-Driven Insights**: Understand user behavior patterns and preferences

## Future Enhancements

Potential improvements to the recommendation system:

1. **Machine Learning Models**
   - Implement more sophisticated ML algorithms (e.g., matrix factorization, neural networks)
   - Train models on historical purchase data

2. **Real-Time Behavior Tracking**
   - Track product views, cart additions, and wishlist items
   - Use browsing behavior in addition to purchase history

3. **A/B Testing**
   - Implement A/B testing framework to optimize recommendation algorithms
   - Measure conversion rates and user engagement

4. **Contextual Recommendations**
   - Consider time of day, season, and user demographics
   - Implement location-based recommendations

5. **Hybrid Approaches**
   - Combine collaborative filtering with content-based filtering
   - Use ensemble methods to improve accuracy

6. **Performance Optimization**
   - Implement caching layer (Redis) for frequently accessed recommendations
   - Pre-compute recommendations for active users
   - Use background jobs for recommendation generation

## Performance Considerations

### Database Queries
- Uses MongoDB aggregation pipeline for efficient data processing
- Indexes on `user`, `status`, and `createdAt` fields improve query performance
- Limits result sets to prevent memory issues

### Caching Strategy (Future)
Consider implementing caching for:
- Popular products (cache for 1 hour)
- User recommendations (cache for 24 hours, invalidate on new purchase)
- Related products (cache for 24 hours)

## Testing

Tests are located in `tests/recommendations.test.js`:

- ✅ Returns popular products for new users
- ✅ Returns personalized recommendations based on purchase history
- ✅ Respects limit parameter
- ✅ Requires authentication for personalized recommendations
- ✅ Returns related products from same category
- ✅ Does not require authentication for related products

Run tests:
```bash
npm test tests/recommendations.test.js
```

## Monitoring

Track these metrics to evaluate recommendation system performance:

- **Click-Through Rate (CTR)**: Percentage of recommended products clicked
- **Conversion Rate**: Percentage of recommended products purchased
- **Average Order Value (AOV)**: Impact on order value when recommendations are used
- **Engagement**: Time spent browsing recommended products
- **Coverage**: Percentage of products that appear in recommendations
