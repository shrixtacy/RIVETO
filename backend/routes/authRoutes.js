import express from "express";
import { login, registration, logOut, googleLogin, adminLogin } from "../controller/authController.js";

// Import our new validation tools
import validateRequest from "../middleware/validateRequest.js";
import { registerSchema, loginSchema } from "../validators/authSchemas.js";

const authRoutes = express.Router();

/**
 * @swagger
 * ... (Your existing Swagger comments are safe here) ...
 */
 
// INJECTED MIDDLEWARE HERE:
authRoutes.post("/registration", validateRequest(registerSchema), registration);
authRoutes.post("/login", validateRequest(loginSchema), login);

authRoutes.get("/logout", logOut);
authRoutes.post("/googlelogin", googleLogin);
authRoutes.post("/adminlogin", adminLogin);

export default authRoutes;