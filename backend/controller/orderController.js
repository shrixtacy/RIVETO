
import Order from "../model/orderModel.js";
import User from "../model/userModel.js";
import Product from "../model/productModel.js";
import mongoose from "mongoose";

export const placeOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, address } = req.body;
    const userId = req.userId;

    if (!items || !Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Invalid order items" });
    }

    if (!address || !address.firstname || !address.street || !address.city || !address.phone) {
      await session.abortTransaction();
      return res.status(400).json({ message: "Incomplete delivery address" });
    }

    const uniqueProductIds = [...new Set(items.map(item => item.productId))];
    const products = await Product.find({ _id: { $in: uniqueProductIds } }).session(session);

    if (products.length !== uniqueProductIds.length) {
      await session.abortTransaction();
      return res.status(404).json({ message: "One or more products not found" });
    }

    const productMap = new Map(products.map(p => [p._id.toString(), p]));
    let calculatedAmount = 0;
    const validatedItems = [];
    const stockUpdates = []; // Track stock updates for atomic operation

    for (const item of items) {
      const product = productMap.get(item.productId);

      if (!product) {
        await session.abortTransaction();
        return res.status(404).json({ message: `Product ${item.productId} not found` });
      }

      if (!product.sizes.includes(item.size)) {
        await session.abortTransaction();
        return res.status(400).json({ message: `Invalid size ${item.size} for product ${product.name}` });
      }

      if (!item.quantity || item.quantity < 1) {
        await session.abortTransaction();
        return res.status(400).json({ message: "Invalid quantity" });
      }

      // Handle legacy products without stock map
      const availableStock = product.stock && product.stock.get ? product.stock.get(item.size) : undefined;
      if (availableStock === undefined || availableStock < item.quantity) {
        await session.abortTransaction();
        return res.status(400).json({ 
          message: `Insufficient stock for ${product.name} (${item.size}). Available: ${availableStock || 0}` 
        });
      }

      calculatedAmount += product.price * item.quantity;

      validatedItems.push({
        productId: product._id,
        name: product.name,
        price: product.price,
        size: item.size,
        quantity: item.quantity,
        image: product.image1
      });

      // Prepare stock update
      stockUpdates.push({
        productId: product._id,
        size: item.size,
        quantity: item.quantity,
        currentStock: availableStock
      });
    }

    const deliveryFee = 40;
    const totalAmount = calculatedAmount + deliveryFee;

    const orderData = {
      items: validatedItems,
      amount: totalAmount,
      userId,
      address,
      paymentMethod: 'COD',
      payment: false,
      status: 'Placed',
      date: Date.now()
    };

    const newOrder = new Order(orderData);
    await newOrder.save({ session });

    // Decrement stock for all items atomically
    for (const update of stockUpdates) {
      const product = await Product.findById(update.productId).session(session);
      if (product && product.stock) {
        const newStock = update.currentStock - update.quantity;
        product.stock.set(update.size, newStock);
        await product.save({ session });
      }
    }

    await User.findByIdAndUpdate(userId, { cartData: {} }, { session });

    await session.commitTransaction();

    return res.status(201).json({ message: "Order Placed", orderId: newOrder._id });
  } catch (error) {
    await session.abortTransaction();
    console.log(error);
    return res.status(500).json({ message: "Order placement failed" });
  } finally {
    session.endSession();
  }
};

export const userOrders = async (req, res) => {
  try {
    const userId = req.userId;
    const orders = await Order.find({ userId });
    return res.status(200).json(orders);
  } catch (error) {
    console.log(error);
    return res.status(500).json({ message: "userOrders error" }); // ❗ Fixed 200 → 500
  }
};


//for admin//
 

export const allOrders =async (req,res)=>{
  try {
    const orders =await Order.find({})
    res.status(200).json(orders)
  } catch (error) {
    console.log(error);
    return res.status(500).json({message:"adminAllOrders error"})
    
  }
}


export const updateStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;
    await Order.findByIdAndUpdate(orderId, { status });
    return res.status(201).json({ message: "Status Updated" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
