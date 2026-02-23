import express from 'express';
import isAuth from '../middleware/isAuth.js';
import { allOrders, placeOrder, updateStatus, userOrders } from '../controller/orderController.js';
import adminAuth from '../middleware/adminAuth.js';
import validateRequest from '../middleware/validateRequest.js';
import { placeOrderSchema, updateStatusSchema } from '../validators/orderSchemas.js';

const orderRoutes = express.Router();

orderRoutes.post("/placeorder", isAuth, validateRequest(placeOrderSchema), placeOrder);
orderRoutes.post("/userorder", isAuth, userOrders);

orderRoutes.post("/list", adminAuth, allOrders);
orderRoutes.post("/status", adminAuth, validateRequest(updateStatusSchema), updateStatus);

export default orderRoutes;