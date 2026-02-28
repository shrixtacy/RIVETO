import dotenv from 'dotenv';
dotenv.config();

import mongoose from 'mongoose';
import Product from '../model/productModel.js';
import connectdb from '../config/db.js';

/**
 * Migration script to add stock maps to legacy products
 * Run this script to ensure all products have proper stock tracking
 */

const migrateLegacyProducts = async () => {
  try {
    console.log('🔄 Starting legacy product migration...');
    
    await connectdb();

    // Find products without stock map or with empty stock
    const products = await Product.find({});
    
    let migratedCount = 0;
    let skippedCount = 0;

    for (const product of products) {
      // Check if product has no stock map or empty stock map
      if (!product.stock || product.stock.size === 0) {
        console.log(`\n📦 Migrating product: ${product.name} (${product._id})`);
        
        // Create a default stock map with 0 stock for each size
        const stockMap = new Map();
        
        if (product.sizes && Array.isArray(product.sizes)) {
          product.sizes.forEach(size => {
            stockMap.set(size, 0); // Default to 0 stock - admin should update
          });
          
          product.stock = stockMap;
          await product.save();
          
          console.log(`✅ Added stock map for sizes: ${product.sizes.join(', ')}`);
          migratedCount++;
        } else {
          console.log(`⚠️  Product has no sizes defined, skipping`);
          skippedCount++;
        }
      } else {
        skippedCount++;
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Migration completed!');
    console.log(`📊 Total products: ${products.length}`);
    console.log(`✅ Migrated: ${migratedCount}`);
    console.log(`⏭️  Skipped (already have stock): ${skippedCount}`);
    console.log('='.repeat(50));
    console.log('\n⚠️  NOTE: All migrated products have 0 stock by default.');
    console.log('   Please update stock quantities via admin panel.\n');

    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
};

// Run migration
migrateLegacyProducts();
