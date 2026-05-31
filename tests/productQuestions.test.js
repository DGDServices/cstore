const request = require('supertest');
const app = require('../src/app');
const ProductQuestion = require('../src/models/ProductQuestion');
const Product = require('../src/models/Product');
const User = require('../src/models/User');

describe('Product Questions API', () => {
  let userToken;
  let adminToken;
  let productId;
  let questionId;
  let userId;
  let adminId;

  beforeEach(async () => {
    // Create regular user
    const userRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Regular User',
        email: 'user@example.com',
        password: 'user123'
      });

    userToken = userRes.body.data.token;
    userId = userRes.body.data.user.id;

    // Create admin user
    const adminRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Admin User',
        email: 'admin@example.com',
        password: 'admin123'
      });

    adminId = adminRes.body.data.user.id;

    // Set admin role
    await User.findByIdAndUpdate(adminId, { role: 'admin' });

    // Login as admin to get fresh token with admin role
    const adminLoginRes = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@example.com',
        password: 'admin123'
      });

    adminToken = adminLoginRes.body.data.token;

    // Create a product
    const product = await Product.create({
      name: 'Test Product',
      description: 'Test product description',
      price: 0.001,
      priceUSD: 50,
      currency: 'BTC',
      stock: 10
    });

    productId = product._id.toString();
  });

  describe('POST /api/questions', () => {
    it('should create a new question when authenticated', async () => {
      const res = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          productId,
          question: 'What is the warranty period for this product?'
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.question).toBe('What is the warranty period for this product?');
      expect(res.body.data.product.toString()).toBe(productId);
      expect(res.body.data.user._id).toBe(userId);

      questionId = res.body.data._id;
    });

    it('should return 401 when not authenticated', async () => {
      const res = await request(app)
        .post('/api/questions')
        .send({
          productId,
          question: 'Is this product available?'
        });

      expect(res.status).toBe(401);
    });

    it('should return 404 when product does not exist', async () => {
      const res = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          productId: '507f1f77bcf86cd799439011',
          question: 'Is this available?'
        });

      expect(res.status).toBe(404);
      expect(res.body.message).toBe('Product not found');
    });

    it('should return 400 when question is too short', async () => {
      const res = await request(app)
        .post('/api/questions')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          productId,
          question: 'Short'
        });

      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/questions/product/:productId', () => {
    beforeEach(async () => {
      // Create some questions
      await ProductQuestion.create([
        {
          product: productId,
          user: userId,
          question: 'Question 1?',
          isApproved: true
        },
        {
          product: productId,
          user: userId,
          question: 'Question 2?',
          isApproved: true
        },
        {
          product: productId,
          user: userId,
          question: 'Pending Question?',
          isApproved: false
        }
      ]);
    });

    it('should return approved questions for a product', async () => {
      const res = await request(app)
        .get(`/api/questions/product/${productId}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
      expect(res.body.count).toBe(2);
    });

    it('should return all questions for admin', async () => {
      const res = await request(app)
        .get(`/api/questions/product/${productId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(3);
    });

    it('should support pagination', async () => {
      const res = await request(app)
        .get(`/api/questions/product/${productId}?page=1&limit=1`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.pagination.total).toBe(2);
      expect(res.body.pagination.pages).toBe(2);
    });
  });

  describe('POST /api/questions/:id/answers', () => {
    beforeEach(async () => {
      const question = await ProductQuestion.create({
        product: productId,
        user: userId,
        question: 'What is the shipping time?'
      });
      questionId = question._id.toString();
    });

    it('should add an answer to a question', async () => {
      const res = await request(app)
        .post(`/api/questions/${questionId}/answers`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          text: 'Shipping typically takes 3-5 business days.'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.answers.length).toBe(1);
      expect(res.body.data.answers[0].text).toBe('Shipping typically takes 3-5 business days.');
    });

    it('should mark admin answers appropriately', async () => {
      const res = await request(app)
        .post(`/api/questions/${questionId}/answers`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          text: 'This is an official answer.'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.answers[0].isSellerOrAdmin).toBe(true);
    });

    it('should return 401 when not authenticated', async () => {
      const res = await request(app)
        .post(`/api/questions/${questionId}/answers`)
        .send({
          text: 'Trying to answer without auth'
        });

      expect(res.status).toBe(401);
    });

    it('should return 404 when question does not exist', async () => {
      const res = await request(app)
        .post('/api/questions/507f1f77bcf86cd799439011/answers')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          text: 'Answer to non-existent question'
        });

      expect(res.status).toBe(404);
    });
  });

  describe('GET /api/questions/user/my-questions', () => {
    beforeEach(async () => {
      await ProductQuestion.create([
        {
          product: productId,
          user: userId,
          question: 'My question 1?'
        },
        {
          product: productId,
          user: userId,
          question: 'My question 2?'
        }
      ]);
    });

    it('should return questions created by the current user', async () => {
      const res = await request(app)
        .get('/api/questions/user/my-questions')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(2);
    });

    it('should return 401 when not authenticated', async () => {
      const res = await request(app)
        .get('/api/questions/user/my-questions');

      expect(res.status).toBe(401);
    });
  });

  describe('PUT /api/questions/:id', () => {
    beforeEach(async () => {
      const question = await ProductQuestion.create({
        product: productId,
        user: userId,
        question: 'Original question?'
      });
      questionId = question._id.toString();
    });

    it('should allow owner to update their question', async () => {
      const res = await request(app)
        .put(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          question: 'Updated question text?'
        });

      expect(res.status).toBe(200);
      expect(res.body.data.question).toBe('Updated question text?');
    });

    it('should not allow other users to update question', async () => {
      // Create another user
      const otherUserRes = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Other User',
          email: 'other@example.com',
          password: 'other123'
        });

      const res = await request(app)
        .put(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${otherUserRes.body.data.token}`)
        .send({
          question: 'Trying to update someone elses question'
        });

      expect(res.status).toBe(403);
    });

    it('should allow admin to update any question', async () => {
      const res = await request(app)
        .put(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          question: 'Admin updated question'
        });

      expect(res.status).toBe(200);
    });
  });

  describe('DELETE /api/questions/:id', () => {
    beforeEach(async () => {
      const question = await ProductQuestion.create({
        product: productId,
        user: userId,
        question: 'Question to delete?'
      });
      questionId = question._id.toString();
    });

    it('should allow owner to delete their question', async () => {
      const res = await request(app)
        .delete(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const deletedQuestion = await ProductQuestion.findById(questionId);
      expect(deletedQuestion).toBeNull();
    });

    it('should allow admin to delete any question', async () => {
      const res = await request(app)
        .delete(`/api/questions/${questionId}`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });
  });

  describe('POST /api/questions/:id/helpful', () => {
    beforeEach(async () => {
      const question = await ProductQuestion.create({
        product: productId,
        user: userId,
        question: 'Helpful question?'
      });
      questionId = question._id.toString();
    });

    it('should increment helpful count', async () => {
      const res = await request(app)
        .post(`/api/questions/${questionId}/helpful`)
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.helpfulCount).toBe(1);
    });
  });

  describe('Admin endpoints', () => {
    describe('GET /api/questions/admin/pending', () => {
      beforeEach(async () => {
        await ProductQuestion.create([
          {
            product: productId,
            user: userId,
            question: 'Pending question 1?',
            isApproved: false
          },
          {
            product: productId,
            user: userId,
            question: 'Pending question 2?',
            isApproved: false
          },
          {
            product: productId,
            user: userId,
            question: 'Approved question?',
            isApproved: true
          }
        ]);
      });

      it('should return pending questions for admin', async () => {
        const res = await request(app)
          .get('/api/questions/admin/pending')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.length).toBe(2);
      });

      it('should return 403 for non-admin users', async () => {
        const res = await request(app)
          .get('/api/questions/admin/pending')
          .set('Authorization', `Bearer ${userToken}`);

        expect(res.status).toBe(403);
      });
    });

    describe('PUT /api/questions/:id/approve', () => {
      beforeEach(async () => {
        const question = await ProductQuestion.create({
          product: productId,
          user: userId,
          question: 'Question to approve?',
          isApproved: false,
          status: 'pending'
        });
        questionId = question._id.toString();
      });

      it('should approve a question', async () => {
        const res = await request(app)
          .put(`/api/questions/${questionId}/approve`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.isApproved).toBe(true);
        expect(res.body.data.status).toBe('approved');
      });

      it('should return 403 for non-admin users', async () => {
        const res = await request(app)
          .put(`/api/questions/${questionId}/approve`)
          .set('Authorization', `Bearer ${userToken}`);

        expect(res.status).toBe(403);
      });
    });

    describe('PUT /api/questions/:id/reject', () => {
      beforeEach(async () => {
        const question = await ProductQuestion.create({
          product: productId,
          user: userId,
          question: 'Question to reject?',
          isApproved: true
        });
        questionId = question._id.toString();
      });

      it('should reject a question', async () => {
        const res = await request(app)
          .put(`/api/questions/${questionId}/reject`)
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.isApproved).toBe(false);
        expect(res.body.data.status).toBe('rejected');
      });
    });

    describe('GET /api/questions/admin/stats', () => {
      beforeEach(async () => {
        await ProductQuestion.create([
          {
            product: productId,
            user: userId,
            question: 'Question 1?',
            isApproved: true,
            answers: [{
              user: adminId,
              text: 'Answer to question 1'
            }]
          },
          {
            product: productId,
            user: userId,
            question: 'Question 2?',
            isApproved: false
          },
          {
            product: productId,
            user: userId,
            question: 'Question 3?',
            isApproved: true
          }
        ]);
      });

      it('should return question statistics', async () => {
        const res = await request(app)
          .get('/api/questions/admin/stats')
          .set('Authorization', `Bearer ${adminToken}`);

        expect(res.status).toBe(200);
        expect(res.body.data.totalQuestions).toBe(3);
        expect(res.body.data.pendingQuestions).toBe(1);
        expect(res.body.data.approvedQuestions).toBe(2);
        expect(res.body.data.questionsWithAnswers).toBe(1);
        expect(res.body.data.unansweredQuestions).toBe(2);
      });
    });
  });
});
