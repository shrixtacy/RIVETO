import request from 'supertest';
import mongoose from 'mongoose';
import app from '../index.js';
import Product from '../model/productModel.js';
import User from '../model/userModel.js';
import Order from '../model/orderModel.js';

describe('Order Security Tests', () => {
  let authToken;
  let testProduct;
  let testUser;

  beforeAll(async () => {
    await mongoose.connect(process.env.MONGODB_URI_TEST);
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

    authToken = 'mock-jwt-token';
  });

  test('Should reject order with manipulated amount', async () => {
    const response = await request(app)
      .post('/api/order/placeorder')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        items: [
          { productId: testProduct._id, size: 'M', quantity: 1 }
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
    expect(order.amount).toBe(140);
  });

  test('Should reject order with non-existent product', async () => {
    const fakeId = new mongoose.Types.ObjectId();
    
    const response = await request(app)
      .post('/api/order/placeorder')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        items: [
          { productId: fakeId, size: 'M', quantity: 1 }
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
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        items: [
          { productId: testProduct._id, size: 'XL', quantity: 1 }
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
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        items: [
          { productId: testProduct._id, size: 'L', quantity: 10 }
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
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        items: [
          { productId: testProduct._id, size: 'M', quantity: 1 }
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
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        items: [
          { productId: testProduct._id, size: 'M', quantity: 2 }
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
    expect(order.amount).toBe(240);
    expect(order.items[0].price).toBe(100);
    expect(order.items[0].quantity).toBe(2);
  });

  test('Should handle duplicate product IDs with different sizes', async () => {
    const response = await request(app)
      .post('/api/order/placeorder')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        items: [
          { productId: testProduct._id, size: 'M', quantity: 1 },
          { productId: testProduct._id, size: 'L', quantity: 1 }
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
    expect(order.amount).toBe(240);
    expect(order.items.length).toBe(2);
  });
});
