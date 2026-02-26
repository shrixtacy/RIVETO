import mongoose from 'mongoose';
import Product from '../model/productModel.js';
import dotenv from 'dotenv';

dotenv.config();

const addStockToExistingProducts = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    const products = await Product.find({});
    console.log(`Found ${products.length} products`);

    let updatedCount = 0;

    for (const product of products) {
      if (!product.stock || product.stock.size === 0) {
        const stockMap = new Map();
        product.sizes.forEach(size => {
          stockMap.set(size, 100);
        });
        product.stock = stockMap;
        await product.save();
        updatedCount++;
        console.log(`Updated stock for product: ${product.name}`);
      }
    }

    console.log(`Migration complete. Updated ${updatedCount} products.`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

addStockToExistingProducts();
