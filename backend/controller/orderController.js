import mongoose from "mongoose";
import Order from "../model/orderModel.js";
import User from "../model/userModel.js";
import Product from "../model/productModel.js";

const DELIVERY_FEE = 40;
const AMOUNT_TOLERANCE = 0.01;

const validateOrderItems = (items) => {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Order must contain at least one item");
  }

  for (const item of items) {
    if (!item.productId || !item.size || !item.quantity) {
      throw new Error("Invalid item structure: missing required fields");
    }

    if (item.quantity <= 0 || !Number.isInteger(item.quantity)) {
      throw new Error(`Invalid quantity for item ${item.productId}`);
    }
  }
};

const calculateOrderAmount = async (items) => {
  const uniqueProductIds = [...new Set(items.map(item => item.productId))];
  const products = await Product.find({ _id: { $in: uniqueProductIds } });

  if (products.length !== uniqueProductIds.length) {
    throw new Error("One or more products not found");
  }

  const productMap = new Map(products.map(p => [p._id.toString(), p]));
  const validatedItems = [];
  let subtotal = 0;

  for (const item of items) {
    const product = productMap.get(item.productId);

    if (!product) {
      throw new Error(`Product ${item.productId} not found`);
    }

    if (!product.sizes.includes(item.size)) {
      throw new Error(`Size ${item.size} not available for product ${product.name}`);
    }

    if (product.stock && product.stock.has(item.size)) {
      const availableStock = product.stock.get(item.size);
      if (availableStock < item.quantity) {
        throw new Error(`Insufficient stock for ${product.name} (Size: ${item.size}). Available: ${availableStock}, Requested: ${item.quantity}`);
      }
    }

    const itemSubtotal = product.price * item.quantity;
    subtotal += itemSubtotal;

    validatedItems.push({
      productId: product._id,
      name: product.name,
      size: item.size,
      quantity: item.quantity,
      price: product.price,
      subtotal: itemSubtotal
    });
  }

  const totalAmount = subtotal + DELIVERY_FEE;

  return {
    validatedItems,
    subtotal,
    deliveryFee: DELIVERY_FEE,
    totalAmount
  };
};

export const placeOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { items, amount: clientAmount, address } = req.body;
    const userId = req.userId;

    if (!address || !address.firstname || !address.email || !address.street || !address.city) {
      throw new Error("Incomplete address information");
    }

    validateOrderItems(items);

    const { validatedItems, subtotal, deliveryFee, totalAmount } = await calculateOrderAmount(items);

    if (Math.abs(totalAmount - clientAmount) > AMOUNT_TOLERANCE) {
      return res.status(400).json({
        success: false,
        message: "Order amount mismatch",
        expectedAmount: totalAmount,
        receivedAmount: clientAmount,
        difference: Math.abs(totalAmount - clientAmount)
      });
    }

    const orderData = {
      userId,
      items: validatedItems,
      subtotal,
      deliveryFee,
      amount: totalAmount,
      address,
      paymentMethod: 'COD',
      payment: false,
      status: 'Placed',
      date: Date.now()
    };

    const newOrder = new Order(orderData);
    await newOrder.save({ session });

    await User.findByIdAndUpdate(
      userId,
      { cartData: {} },
      { session }
    );

    await session.commitTransaction();

    return res.status(201).json({
      success: true,
      message: "Order placed successfully",
      orderId: newOrder._id,
      amount: totalAmount
    });

  } catch (error) {
    await session.abortTransaction();
    console.error("Place order error:", error);

    const statusCode = error.message.includes("not found") || 
                       error.message.includes("Invalid") || 
                       error.message.includes("Incomplete") ? 400 : 500;

    return res.status(statusCode).json({
      success: false,
      message: error.message || "Failed to place order"
    });
  } finally {
    session.endSession();
  }
};

export const userOrders = async (req, res) => {
  try {
    const userId = req.userId;
    const orders = await Order.find({ userId }).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      orders
    });
  } catch (error) {
    console.error("User orders error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch orders"
    });
  }
};

export const allOrders = async (req, res) => {
  try {
    const orders = await Order.find({}).sort({ createdAt: -1 });
    return res.status(200).json({
      success: true,
      orders
    });
  } catch (error) {
    console.error("All orders error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch orders"
    });
  }
};

export const updateStatus = async (req, res) => {
  try {
    const { orderId, status } = req.body;

    if (!orderId || !status) {
      return res.status(400).json({
        success: false,
        message: "Order ID and status are required"
      });
    }

    const validStatuses = ['Placed', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status value"
      });
    }

    const order = await Order.findByIdAndUpdate(
      orderId,
      { status },
      { new: true, runValidators: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Status updated successfully",
      order
    });
  } catch (error) {
    console.error("Update status error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to update status"
    });
  }
};
