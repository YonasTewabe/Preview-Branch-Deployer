import express from "express";
import bcrypt from "bcrypt";
import { User } from "../models/index.js";
import rateLimit from "express-rate-limit";
import { body, validationResult } from "express-validator";
import crypto from "crypto";
import emailService from "../services/emailService.js";

const router = express.Router();

// Rate limiting for forgot password endpoint
const forgotPasswordLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per windowMs
  message: {
    error: "Too many password reset requests from this IP, please try again after 15 minutes"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/auth/login - User login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    // Find user by email only
    const user = await User.findOne({ 
      where: { email: email.toLowerCase() },
      attributes: ['id', 'email', 'name', 'role', 'status', 'password', 'last_login']
    });

    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Check if user is active (case-insensitive)
    if (user.status && user.status.toLowerCase() !== 'active') {
      return res.status(401).json({ error: "Account is inactive. Please contact administrator." });
    }

    // Verify password using bcrypt
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    // Update last login
    await user.update({ last_login: new Date() });

    // Create response without password
    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      status: user.status,
      last_login: user.last_login,
    };

    // In a real application, you would generate a JWT token here
    const token = `token_${user.id}_${Date.now()}`;

    res.json({
      message: "Login successful",
      user: userResponse,
      token: token,
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/logout - User logout
router.post("/logout", async (req, res) => {
  try {
    // In a real application with JWT, you would blacklist the token here
    res.json({ message: "Logout successful" });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/auth/me - Get current user info
router.get("/me", async (req, res) => {
  try {
    // In a real application, you would verify the JWT token here
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "No token provided" });
    }

    // Simple token validation (in production, use JWT verification)
    const token = authHeader.replace('Bearer ', '');
    const tokenParts = token.split('_');
    
    if (tokenParts.length !== 3 || tokenParts[0] !== 'token') {
      return res.status(401).json({ error: "Invalid token" });
    }

    const userId = String(tokenParts[1] ?? "").trim();
    if (!userId) {
      return res.status(401).json({ error: "Invalid token" });
    }
    const user = await User.findByPk(userId, {
      attributes: ['id', 'email', 'name', 'role', 'status', 'last_login']
    });

    if (!user || user.status !== 'active') {
      return res.status(401).json({ error: "User not found or inactive" });
    }

    res.json({ user });

  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/auth/forgot-password - Request password reset
router.post("/forgot-password", 
  forgotPasswordLimiter,
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address')
  ],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: "Invalid email format",
          details: errors.array()
        });
      }

      const { email } = req.body;

      // Always return success message to prevent email enumeration
      // Check if user exists (but don't reveal this information)
      const user = await User.findOne({ 
        where: { email: email.toLowerCase() },
        attributes: ['id', 'email', 'name', 'status']
      });

      // Only proceed if user exists and is active
      if (user && user.status === 'active') {
        // Generate reset token (SHA256 hash)
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
        
        // Set expiry to 1 hour from now
        const resetExpiry = new Date(Date.now() + 60 * 60 * 1000);

        // Update user with reset token and expiry
        await user.update({
          reset_password_token: hashedToken,
          reset_password_expires: resetExpiry
        });

        // Send password reset email
        await emailService.sendPasswordResetEmail(user, resetToken);
      }

      // Always return the same success message regardless of whether user exists
      res.json({ 
        message: "If an account with that email exists, a password reset link has been sent to your email address. Please check your inbox and spam folder."
      });

    } catch (error) {
      console.error("Forgot password error:", error);
      // Still return generic message even on error to prevent information leakage
      res.json({ 
        message: "If an account with that email exists, a password reset link has been sent to your email address. Please check your inbox and spam folder."
      });
    }
  }
);

// POST /api/auth/reset-password - Reset password with token
router.post("/reset-password", 
  [
    body('email')
      .isEmail()
      .normalizeEmail()
      .withMessage('Please provide a valid email address'),
    body('token')
      .isLength({ min: 1 })
      .withMessage('Reset token is required'),
    body('password')
      .isLength({ min: 8 })
      .withMessage('Password must be at least 8 characters long')
      .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
      .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number'),
    body('passwordConfirmation')
      .custom((value, { req }) => {
        if (value !== req.body.password) {
          throw new Error('Password confirmation does not match password');
        }
        return true;
      })
      .withMessage('Password confirmation does not match password')
  ],
  async (req, res) => {
    try {
      // Check validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ 
          error: "Validation failed",
          details: errors.array()
        });
      }

      const { email, token, password } = req.body;

      // Hash the provided token to compare with stored hash
      const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

      // Find user with valid reset token
      const user = await User.findOne({
        where: {
          email: email.toLowerCase(),
          reset_password_token: hashedToken,
          reset_password_expires: {
            [Op.gt]: new Date() // Token not expired
          }
        }
      });

      if (!user) {
        return res.status(400).json({ 
          error: "Invalid or expired reset token. Please request a new password reset." 
        });
      }

      // Update password and clear reset token
      await user.update({
        password: password,
        reset_password_token: null,
        reset_password_expires: null
      });

      // In a real application, you might want to invalidate other sessions here
      // For now, we'll just return success

      res.json({ 
        message: "Password has been reset successfully. You can now log in with your new password." 
      });

    } catch (error) {
      console.error("Reset password error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

export default router;