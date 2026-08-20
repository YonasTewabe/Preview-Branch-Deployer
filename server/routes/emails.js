import express from "express";
import { User } from "../models/index.js";
import emailService from "../services/emailService.js";

const router = express.Router();

// POST /api/emails/test - Test email functionality
router.post("/test", async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ error: "Email address is required" });
    }

    // Create a test user object
    const testUser = {
      id: 999,
      email: email,
      name: "Test User",
      username: "testuser",
      role: "Viewer"
    };

    const result = await emailService.sendWelcomeEmail(testUser);
    
    if (result.success) {
      res.json({
        success: true,
        message: "Test email sent successfully",
        messageId: result.messageId,
        previewUrl: result.previewUrl,
        instructions: process.env.NODE_ENV !== 'production' ? 
          "In development mode, check the console for preview URL or visit the previewUrl to see the email content" :
          "Email sent to production SMTP server"
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error("Error sending test email:", error);
    res.status(500).json({ error: "Failed to send test email" });
  }
});

// POST /api/emails/resend-welcome/:userId - Resend welcome email to a user
router.post("/resend-welcome/:userId", async (req, res) => {
  try {
    const user = await User.findByPk(req.params.userId, {
      attributes: { exclude: ['password'] },
    });
    
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const result = await emailService.sendWelcomeEmail(user.toJSON());
    
    if (result.success) {
      res.json({
        success: true,
        message: `Welcome email resent to ${user.email}`,
        messageId: result.messageId,
        previewUrl: result.previewUrl
      });
    } else {
      res.status(500).json({
        success: false,
        error: result.error
      });
    }
  } catch (error) {
    console.error("Error resending welcome email:", error);
    res.status(500).json({ error: "Failed to resend welcome email" });
  }
});

// GET /api/emails/status - Get email service status
router.get("/status", async (req, res) => {
  try {
    const isInitialized = emailService.transporter !== null;
    
    res.json({
      initialized: isInitialized,
      environment: process.env.NODE_ENV || 'development',
      smtpHost: process.env.SMTP_HOST || 'ethereal (test)',
      fromEmail: process.env.FROM_EMAIL || 'Default sender'
    });
  } catch (error) {
    console.error("Error checking email status:", error);
    res.status(500).json({ error: "Failed to check email status" });
  }
});

export default router;