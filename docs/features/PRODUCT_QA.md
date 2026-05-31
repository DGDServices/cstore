# Product Questions & Answers

## Overview

The Product Questions & Answers feature allows customers to ask questions about products and receive answers from sellers, admins, or other customers. This interactive feature helps potential buyers make informed purchase decisions.

## Features

### Core Functionality
✅ Ask questions about products  
✅ Answer questions (any authenticated user)  
✅ Mark seller/admin answers  
✅ Vote questions and answers as helpful  
✅ Edit and delete own questions/answers  
✅ View question history  
✅ Email notifications  

### Moderation Features (Admin)
✅ Approve/reject questions  
✅ View pending questions  
✅ Question statistics  
✅ Moderate inappropriate content  

## API Endpoints

### Public Endpoints

#### Get Product Questions
```
GET /api/questions/product/:productId
```

**Query Parameters:**
- `page` (optional): Page number for pagination (default: 1)
- `limit` (optional): Results per page (default: 10)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "question_id",
      "product": "product_id",
      "user": {
        "_id": "user_id",
        "name": "John Doe"
      },
      "question": "What is the warranty period?",
      "answers": [
        {
          "_id": "answer_id",
          "user": {
            "_id": "admin_id",
            "name": "Admin"
          },
          "text": "This product comes with a 1-year warranty.",
          "isSellerOrAdmin": true,
          "helpfulCount": 5,
          "createdAt": "2024-01-01T00:00:00.000Z"
        }
      ],
      "status": "approved",
      "isApproved": true,
      "helpfulCount": 10,
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "count": 10,
  "pagination": {
    "page": 1,
    "limit": 10,
    "total": 25,
    "pages": 3
  }
}
```

#### Get Single Question
```
GET /api/questions/:id
```

### Protected Endpoints (Authentication Required)

#### Create Question
```
POST /api/questions
```

**Request Body:**
```json
{
  "productId": "product_id",
  "question": "Does this product come with batteries?"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "question_id",
    "product": "product_id",
    "user": {
      "_id": "user_id",
      "name": "John Doe",
      "email": "john@example.com"
    },
    "question": "Does this product come with batteries?",
    "answers": [],
    "status": "approved",
    "isApproved": true,
    "helpfulCount": 0,
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2024-01-01T00:00:00.000Z"
  }
}
```

#### Get My Questions
```
GET /api/questions/user/my-questions
```

**Query Parameters:**
- `page` (optional): Page number for pagination
- `limit` (optional): Results per page

#### Update Question
```
PUT /api/questions/:id
```

**Request Body:**
```json
{
  "question": "Updated question text"
}
```

**Authorization:** Question owner or admin only

#### Delete Question
```
DELETE /api/questions/:id
```

**Authorization:** Question owner or admin only

#### Add Answer
```
POST /api/questions/:id/answers
```

**Request Body:**
```json
{
  "text": "Yes, batteries are included in the package."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "question_id",
    "answers": [
      {
        "_id": "answer_id",
        "user": {
          "_id": "user_id",
          "name": "Jane Smith"
        },
        "text": "Yes, batteries are included in the package.",
        "isSellerOrAdmin": false,
        "helpfulCount": 0,
        "createdAt": "2024-01-01T00:00:00.000Z"
      }
    ]
  }
}
```

#### Update Answer
```
PUT /api/questions/:questionId/answers/:answerId
```

**Request Body:**
```json
{
  "text": "Updated answer text"
}
```

**Authorization:** Answer owner or admin only

#### Delete Answer
```
DELETE /api/questions/:questionId/answers/:answerId
```

**Authorization:** Answer owner or admin only

#### Mark Question as Helpful
```
POST /api/questions/:id/helpful
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "question_id",
    "helpfulCount": 11
  }
}
```

#### Mark Answer as Helpful
```
POST /api/questions/:questionId/answers/:answerId/helpful
```

### Admin Endpoints (Admin Authorization Required)

#### Get Pending Questions
```
GET /api/questions/admin/pending
```

**Query Parameters:**
- `page` (optional): Page number
- `limit` (optional): Results per page (default: 20)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "_id": "question_id",
      "product": {
        "_id": "product_id",
        "name": "Product Name"
      },
      "user": {
        "_id": "user_id",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "question": "Is this authentic?",
      "isApproved": false,
      "status": "pending",
      "createdAt": "2024-01-01T00:00:00.000Z"
    }
  ],
  "count": 5,
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 5,
    "pages": 1
  }
}
```

#### Approve Question
```
PUT /api/questions/:id/approve
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "question_id",
    "isApproved": true,
    "status": "approved"
  },
  "message": "Question approved successfully"
}
```

#### Reject Question
```
PUT /api/questions/:id/reject
```

**Response:**
```json
{
  "success": true,
  "data": {
    "_id": "question_id",
    "isApproved": false,
    "status": "rejected"
  },
  "message": "Question rejected successfully"
}
```

#### Get Question Statistics
```
GET /api/questions/admin/stats
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalQuestions": 150,
    "pendingQuestions": 5,
    "approvedQuestions": 140,
    "questionsWithAnswers": 120,
    "unansweredQuestions": 30
  }
}
```

## Email Notifications

The system sends email notifications in the following scenarios:

### Question Created
- **To:** All admin users
- **Trigger:** When a customer asks a new question
- **Content:** Product name, question text, customer name

### Answer Added
- **To:** Question author (if not the answerer)
- **Trigger:** When someone answers their question
- **Content:** Original question, answer text, product name

## Database Schema

### ProductQuestion Model

```javascript
{
  product: ObjectId (ref: 'Product'),
  user: ObjectId (ref: 'User'),
  question: String (max 500 chars),
  answers: [{
    user: ObjectId (ref: 'User'),
    text: String (max 1000 chars),
    isSellerOrAdmin: Boolean,
    helpfulCount: Number,
    createdAt: Date
  }],
  status: String (enum: ['pending', 'approved', 'rejected']),
  isApproved: Boolean,
  helpfulCount: Number,
  createdAt: Date,
  updatedAt: Date
}
```

### Indexes

```javascript
// Efficient query indexes
{ product: 1, createdAt: -1 }
{ user: 1, createdAt: -1 }
{ status: 1 }
```

## Implementation Details

### Files Created

1. **Model**: `src/models/ProductQuestion.js`
   - Defines the question and answer schema
   - Includes nested answer schema
   - Proper indexes for efficient queries

2. **Controller**: `src/controllers/productQuestionController.js`
   - 18 endpoint handlers
   - Full CRUD operations
   - Admin moderation functions
   - Email notification integration

3. **Routes**: `src/routes/productQuestionRoutes.js`
   - Public routes (get questions)
   - Protected routes (create, update, delete)
   - Admin routes (moderation, stats)

4. **Validation**: Updated `src/middleware/validation.js`
   - Question validation (10-500 chars)
   - Answer validation (10-1000 chars)

5. **Tests**: `tests/productQuestions.test.js`
   - 25 comprehensive test cases
   - Public, protected, and admin endpoints
   - Edge cases and error handling

### Integration

The feature integrates with existing systems:

- **Authentication**: Uses existing JWT middleware
- **Authorization**: Role-based access control (admin)
- **Email Service**: Leverages existing email infrastructure
- **Product System**: Links questions to products
- **User System**: Tracks question authors and answerers

## Usage Examples

### Customer Flow

1. Customer views product page
2. Customer asks a question about the product
3. Admin receives email notification
4. Admin or seller answers the question
5. Customer receives email notification of answer
6. Other customers see the Q&A on product page
7. Customers vote helpful questions/answers

### Admin Flow

1. Admin receives notification of new question
2. Admin reviews question in moderation queue
3. Admin approves or rejects question
4. Admin can monitor statistics dashboard
5. Admin can moderate inappropriate content

## Best Practices

### For Customers
- Be specific and clear in your questions
- Check existing Q&A before asking
- Vote helpful answers to help others
- Update or delete outdated questions

### For Sellers/Admins
- Respond promptly to questions
- Provide detailed, accurate answers
- Use professional language
- Moderate inappropriate content

### For Developers
- Questions are auto-approved by default
- Change `isApproved: false` in model for manual moderation
- Implement rate limiting for question creation
- Consider implementing duplicate question detection
- Add webhook support for external integrations

## Future Enhancements

Potential improvements for the Q&A system:

- [ ] Image attachments in answers
- [ ] Email digests for unanswered questions
- [ ] Question templates/categories
- [ ] AI-powered answer suggestions
- [ ] Question search functionality
- [ ] Export Q&A data
- [ ] Multi-language support for Q&A
- [ ] Spam detection and filtering
- [ ] User reputation system
- [ ] Verified buyer badges

## Troubleshooting

### Questions Not Appearing

**Issue:** Questions don't show on product page

**Solutions:**
1. Check if question is approved (`isApproved: true`)
2. Verify user is authenticated for pending questions
3. Check product ID is correct
4. Ensure API endpoint is called correctly

### Email Notifications Not Sending

**Issue:** Users not receiving email notifications

**Solutions:**
1. Verify SMTP configuration in `.env`
2. Check email service is initialized
3. Review logs for email errors
3. Test email service with `verifyEmailConfig()`

### Permission Errors

**Issue:** Users getting 403 Forbidden errors

**Solutions:**
1. Verify JWT token is valid
2. Check user role for admin endpoints
3. Verify ownership for update/delete operations
4. Ensure middleware order is correct

## Testing

Run the test suite:

```bash
npm test tests/productQuestions.test.js
```

**Test Coverage:**
- Create, read, update, delete questions
- Add, update, delete answers
- Helpful voting
- User authorization
- Admin moderation
- Pagination
- Error handling

## Support

For questions or issues with the Q&A system:
- Review the API documentation
- Check the implementation files
- Review inline code comments
- Test with provided examples

---

**Implementation Date:** January 2025  
**Version:** 2.1.1  
**Status:** ✅ COMPLETE
