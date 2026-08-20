import express from "express";
import bcrypt from "bcrypt";
import { User } from "../models/index.js";
import emailService from "../services/emailService.js";
import { authenticateToken, isAdmin } from "../middleware/auth.js";

const router = express.Router();

// GET /api/users - Get all users
router.get("/", authenticateToken, isAdmin, async (req, res) => {
  try {
    const users = await User.findAll({
      attributes: { exclude: ['password'] }, // Don't return password hash
      order: [['created_at', 'DESC']],
    });
    res.json(users);
  } catch (error) {
    console.error("Error fetching users:", error);
    res.status(500).json({ error: "Failed to fetch users" });
  }
});

// GET /api/users/:id - Get a specific user
router.get("/:id", authenticateToken, async (req, res) => {
  try {
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: "Access denied" });
    }
    const user = await User.findByPk(req.params.id, {
      attributes: { exclude: ['password'] },
    });
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    
    res.json(user);
  } catch (error) {
    console.error("Error fetching user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// POST /api/users - Create a new user
router.post("/", authenticateToken, isAdmin, async (req, res) => {
  try {
    const { email, name, role } = req.body;
    if (role && role !== 'admin' && role !== 'user') {
      return res.status(400).json({ error: "Invalid role. Must be 'admin' or 'user'" });
    }
    const username = email.split('@')[0];
    if (!username || !email) {
      return res.status(400).json({ error: "Username and email are required" });
    }
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }
    const password = Math.random().toString(36).substring(2, 8);
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      username,
      email,
      name,
      role: role || "user",
      status: 'active', // Default status for new users
      password: hashedPassword,
    });

    // Return user without password hash
    const userResponse = user.toJSON();
    delete userResponse.password;
    
    // Send welcome email asynchronously with password
    emailService.sendWelcomeEmail({...userResponse, password})
      .then((emailResult) => {
        if (!emailResult.success) {
          console.error(`Failed to send welcome email to ${userResponse.email}:`, emailResult.error);
        }
      })
      .catch((error) => {
        console.error(`Error sending welcome email to ${userResponse.email}:`, error);
      });
    
    res.status(201).json({
      ...userResponse,
      emailSent: true // Indicate that email sending was attempted
    });
  } catch (error) {
    console.error("Error creating user:", error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: "Username or email already exists" });
    }
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: "Failed to create user" });
  }
});

// PUT /api/users/:id - Update a user
router.put("/:id", authenticateToken, async (req, res) => {
  try {
    const { username, email, name, role, status } = req.body;
    
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: "Access denied" });
    }

    const updateData = {
      username,
      email,
      name,
    };

    if (req.user.role === 'admin') {
      if (role) {
        if (role !== 'admin' && role !== 'user') {
          return res.status(400).json({ error: "Invalid role. Must be 'admin' or 'user'" });
        }
        updateData.role = role;
      }
      if (status) {
        updateData.status = status;
      }
    }

    await user.update(updateData);

    // Return user without password hash
    const userResponse = user.toJSON();
    delete userResponse.password;
    
    res.json(userResponse);
  } catch (error) {
    console.error("Error updating user:", error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(400).json({ error: "Username or email already exists" });
    }
    if (error.name === 'SequelizeValidationError') {
      return res.status(400).json({ error: error.errors[0].message });
    }
    res.status(500).json({ error: "Failed to update user" });
  }
});

// DELETE /api/users/:id - Delete a user
router.delete("/:id", authenticateToken, isAdmin, async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    await user.destroy();
    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ error: "Failed to delete user" });
  }
});

// PUT /api/users/:id/change-password - Change user password
router.put("/:id/change-password", authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    if (req.user.role !== 'admin' && req.user.id !== req.params.id) {
      return res.status(403).json({ error: "Access denied" });
    }
    
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current password and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: "New password must be at least 6 characters long" });
    }

    const user = await User.findByPk(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({ error: "Current password is incorrect" });
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await user.update({
      password: hashedNewPassword,
    });

    res.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Error changing password:", error);
    res.status(500).json({ error: "Failed to change password" });
  }
});

export default router;