import request from 'supertest';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../index.js';
import Product from '../model/productModel.js';
import User from '../model/userModel.js';
import Order from '../model/orderModel.js';

describe('Order Security Tests', () => {
  let authToken;
  let testProduct;
  let testUser;

  beforeAll(async () => {
    const testDbUri = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/riveto-test';
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(testDbUri);
    }
  });

  afterAll(async () => {
    await mongoose.connection.close();
  });

  beforeEach(async () => {
    await Product.deleteMany({});
    await User.deleteMany({});
    await Order.deleteMany({});

    testUser = await User.create({
      name: 'Test User',
      email: 'test@example.com',
      password: 'hashedpassword',
      cartData: {}
    });

    const stockMap = new Map();
    stockMap.set('M', 10);
    stockMap.set('L', 5);

    testProduct = await Product.create({
      name: 'Test Product',
      image1: 'img1.jpg',
      image2: 'img2.jpg',
      image3: 'img3.jpg',
      image4: 'img4.jpg',
      description: 'Test description',
      price: 100,
      category: 'Test',
      subCategory: 'Test',
      sizes: ['M', 'L'],
      stock: stockMap
    });

    // Generate a valid JWT token for testing
    authToken = jwt.sign(
      { userId: testUser._id },
      process.env.JWT_SECRET || 'test-secret',
      { expiresIn: '1h' }
    );
  });

  test('Should reject order with manipulated amount', async () => {
    const response = await request(app)
      .post('/api/order/placeorder')
      .set('Cookie', `token=${authToken}`)
      .send({
        items: [
          { productId: testProduct._id.toString(), size: 'M', quantity: 1 }
        ],
        amount: 0.01,
        address: {
          firstname: 'John',
          lastname: 'Doe',
          street: '123 Main St',
          city: 'Test City',
          phone: '1234567890'
        }
      });

    expect(response.status).toBe(201);
    const order = await Order.findOne({ userId: testUser._id });
    expect(order.amount).toBe(140); // 100 + 40 delivery fee
  });

  test('Should reject order with non-existent product', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    
    const response = await request(app)
      .post('/api/order/placeorder')
      .set('Cookie', `token=${authToken}`)
      .send({
        items: [
          { productId: fakeId.toString(), size: 'M', quantity: 1 }
        ],
        address: {
          firstname: 'John',
          lastname: 'Doe',
          street: '123 Main St',
          city: 'Test City',
          phone: '1234567890'
        }
      });

    expect(response.status).toBe(404);
    expect(response.body.message).toContain('not found');
  });

  test('Should reject order with invalid size', async () => {
    const response = await request(app)
      .post('/api/order/placeorder')
      .set('Cookie', `token=${authToken}`)
      .send({
        items: [
          { productId: testProduct._id.toString(), size: 'XL', quantity: 1 }
        ],
        address: {
          firstname: 'John',
          lastname: 'Doe',
          street: '123 Main St',
          city: 'Test City',
          phone: '1234567890'
        }
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Invalid size');
  });

  test('Should reject order with insufficient stock', async () => {
    const response = await request(app)
      .post('/api/order/placeorder')
      .set('Cookie', `token=${authToken}`)
      .send({
        items: [
          { productId: testProduct._id.toString(), size: 'L', quantity: 10 }
        ],
        address: {
          firstname: 'John',
          lastname: 'Doe',
          street: '123 Main St',
          city: 'Test City',
          phone: '1234567890'
        }
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Insufficient stock');
  });

  test('Should reject order with missing address fields', async () => {
    const response = await request(app)
      .post('/api/order/placeorder')
      .set('Cookie', `token=${authToken}`)
      .send({
        items: [
          { productId: testProduct._id.toString(), size: 'M', quantity: 1 }
        ],
        address: {
          firstname: 'John'
        }
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Incomplete delivery address');
  });

  test('Should accept valid order and calculate correct amount', async () => {
    const response = await request(app)
      .post('/api/order/placeorder')
      .set('Cookie', `token=${authToken}`)
      .send({
        items: [
          { productId: testProduct._id.toString(), size: 'M', quantity: 2 }
        ],
        address: {
          firstname: 'John',
          lastname: 'Doe',
          street: '123 Main St',
          city: 'Test City',
          phone: '1234567890'
        }
      });

    expect(response.status).toBe(201);
    expect(response.body.message).toBe('Order Placed');
    
    const order = await Order.findOne({ userId: testUser._id });
    expect(order.amount).toBe(240); // (100 * 2) + 40 delivery fee
    expect(order.items[0].price).toBe(100);
    expect(order.items[0].quantity).toBe(2);
  });

  test('Should handle duplicate product IDs with different sizes', async () => {
    const response = await request(app)
      .post('/api/order/placeorder')
      .set('Cookie', `token=${authToken}`)
      .send({
        items: [
          { productId: testProduct._id.toString(), size: 'M', quantity: 1 },
          { productId: testProduct._id.toString(), size: 'L', quantity: 1 }
        ],
        address: {
          firstname: 'John',
          lastname: 'Doe',
          street: '123 Main St',
          city: 'Test City',
          phone: '1234567890'
        }
      });

    expect(response.status).toBe(201);
    const order = await Order.findOne({ userId: testUser._id });
    expect(order.amount).toBe(240); // (100 * 2) + 40 delivery fee
    expect(order.items.length).toBe(2);
  });

  test('Should handle legacy products without stock map gracefully', async () => {
    // Create a legacy product without stock map
    const legacyProduct = await Product.create({
      name: 'Legacy Product',
      image1: 'img1.jpg',
      image2: 'img2.jpg',
      image3: 'img3.jpg',
      image4: 'img4.jpg',
      description: 'Legacy product without stock',
      price: 50,
      category: 'Test',
      subCategory: 'Test',
      sizes: ['S', 'M']
    });

    const response = await request(app)
      .post('/api/order/placeorder')
      .set('Cookie', `token=${authToken}`)
      .send({
        items: [
          { productId: legacyProduct._id.toString(), size: 'M', quantity: 1 }
        ],
        address: {
          firstname: 'John',
          lastname: 'Doe',
          street: '123 Main St',
          city: 'Test City',
          phone: '1234567890'
        }
      });

    expect(response.status).toBe(400);
    expect(response.body.message).toContain('Insufficient stock');
  });

  test('Should ensure atomicity - cart cleared only if order succeeds', async () => {
    // Add items to cart
    testUser.cartData = { [testProduct._id]: { M: 2 } };
    await testUser.save();

    const response = await request(app)
      .post('/api/order/placeorder')
      .set('Cookie', `token=${authToken}`)
      .send({
        items: [
          { productId: testProduct._id.toString(), size: 'M', quantity: 2 }
        ],
        address: {
          firstname: 'John',
          lastname: 'Doe',
          street: '123 Main St',
          city: 'Test City',
          phone: '1234567890'
        }
      });

    expect(response.status).toBe(201);
    
    // Verify cart was cleared
    const updatedUser = await User.findById(testUser._id);
    expect(Object.keys(updatedUser.cartData).length).toBe(0);
    
    // Verify order was created
    const order = await Order.findOne({ userId: testUser._id });
    expect(order).toBeTruthy();
  });

  test('Should decrement stock when order is placed', async () => {
    const initialStock = testProduct.stock.get('M');
    expect(initialStock).toBe(10);

    const response = await request(app)
      .post('/api/order/placeorder')
      .set('Cookie', `token=${authToken}`)
      .send({
        items: [
          { productId: testProduct._id.toString(), size: 'M', quantity: 3 }
        ],
        address: {
          firstname: 'John',
          lastname: 'Doe',
          street: '123 Main St',
          city: 'Test City',
          phone: '1234567890'
        }
      });

    expect(response.status).toBe(201);

    // Verify stock was decremented
    const updatedProduct = await Product.findById(testProduct._id);
    const newStock = updatedProduct.stock.get('M');
    expect(newStock).toBe(7); // 10 - 3 = 7
  });

  test('Should not decrement stock if order fails', async () => {
    const initialStock = testProduct.stock.get('M');
    expect(initialStock).toBe(10);

    // Try to order with invalid address (should fail)
    const response = await request(app)
      .post('/api/order/placeorder')
      .set('Cookie', `token=${authToken}`)
      .send({
        items: [
          { productId: testProduct._id.toString(), size: 'M', quantity: 2 }
        ],
        address: {
          firstname: 'John'
          // Missing required fields
        }
      });

    expect(response.status).toBe(400);

    // Verify stock was NOT decremented
    const updatedProduct = await Product.findById(testProduct._id);
    const currentStock = updatedProduct.stock.get('M');
    expect(currentStock).toBe(10); // Should remain unchanged
  });

  test('Should handle stock decrement for multiple items', async () => {
    const initialStockM = testProduct.stock.get('M');
    const initialStockL = testProduct.stock.get('L');
    expect(initialStockM).toBe(10);
    expect(initialStockL).toBe(5);

    const response = await request(app)
      .post('/api/order/placeorder')
      .set('Cookie', `token=${authToken}`)
      .send({
        items: [
          { productId: testProduct._id.toString(), size: 'M', quantity: 2 },
          { productId: testProduct._id.toString(), size: 'L', quantity: 1 }
        ],
        address: {
          firstname: 'John',
          lastname: 'Doe',
          street: '123 Main St',
          city: 'Test City',
          phone: '1234567890'
        }
      });

    expect(response.status).toBe(201);

    // Verify both stocks were decremented
    const updatedProduct = await Product.findById(testProduct._id);
    expect(updatedProduct.stock.get('M')).toBe(8); // 10 - 2 = 8
    expect(updatedProduct.stock.get('L')).toBe(4); // 5 - 1 = 4
  });
});
