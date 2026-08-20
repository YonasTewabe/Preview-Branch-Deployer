import nodemailer from 'nodemailer';

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializingPromise = null;
    this.lastError = null;
    this.verificationFailed = false;
    // fire-and-forget initial init; individual send calls will also ensure init
    this.initialize();
  }

  async initialize() {
    if (this.initializingPromise) {
      return this.initializingPromise;
    }

    this.initializingPromise = (async () => {
      try {
        // Prefer explicit SMTP config in any environment if provided
        const smtpHost = process.env.SMTP_HOST || 'smtp.gmail.com';
        const smtpPort = Number(process.env.SMTP_PORT || 587);
        const smtpUser = process.env.SMTP_USER || process.env.SMTP_USERNAME;
        const smtpPass = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;

        if (smtpUser && smtpPass) {
          this.transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465, // true for 465, false otherwise
            auth: {
              user: smtpUser,
              pass: smtpPass,
            },
          });
        } else if (process.env.NODE_ENV !== 'production') {
          // Development fallback: Ethereal test account
          const testAccount = await nodemailer.createTestAccount();
          this.transporter = nodemailer.createTransport({
            host: 'smtp.ethereal.email',
            port: 587,
            secure: false,
            auth: {
              user: testAccount.user,
              pass: testAccount.pass,
            },
          });
        } else {
          // No SMTP credentials in production
          this.transporter = null;
        }

        if (this.transporter) {
          // Try to verify connection, but don't fail if verification doesn't work
          // Some SMTP servers don't support verify() but can still send emails
          try {
            await this.transporter.verify();
            this.verificationFailed = false;
            this.lastError = null;
            console.warn('✓ Email service initialized and verified successfully');
          } catch (verifyError) {
            this.verificationFailed = true;
            this.lastError = verifyError;
            
            // Provide helpful error messages for common issues
            if (verifyError.code === 'EAUTH') {
              const isGmail = smtpHost.includes('gmail.com');
              console.error('⚠️  Email service authentication failed:');
              console.error(`   Error: ${verifyError.message}`);
              if (isGmail) {
                console.error('   📧 For Gmail, you need to use an App Password, not your regular password.');
                console.error('   📖 See: https://support.google.com/accounts/answer/185833');
                console.error('   💡 Steps:');
                console.error('      1. Enable 2-Step Verification on your Google account');
                console.error('      2. Go to https://myaccount.google.com/apppasswords');
                console.error('      3. Generate an App Password for "Mail"');
                console.error('      4. Use that App Password as SMTP_PASSWORD');
              } else {
                console.error('   Please check your SMTP_USER and SMTP_PASSWORD credentials.');
              }
              console.warn('   ⚠️  Email service will still attempt to send emails, but may fail.');
            } else {
              console.warn(`⚠️  Email service verification failed: ${verifyError.message}`);
              console.warn('   Email service will still attempt to send emails.');
            }
          }
        } else {
          console.warn('Email service unavailable: Missing SMTP credentials');
        }
      } catch (error) {
        console.error('Error initializing email service:', error);
        this.transporter = null;
        this.lastError = error;
      } finally {
        this.initializingPromise = null;
      }
    })();

    return this.initializingPromise;
  }

  async ensureInitialized() {
    if (this.transporter) return true;
    await this.initialize();
    if (!this.transporter) {
      if (this.lastError) {
        console.error('Email service initialization failed:', this.lastError.message);
      }
      return false;
    }
    return true;
  }

  async sendWelcomeEmail(user) {
    if (!(await this.ensureInitialized())) {
      const errorMsg = this.lastError 
        ? `Email service not available: ${this.lastError.message}`
        : 'Email service not available: Missing SMTP credentials';
      console.warn('Email service not initialized. Skipping email send.');
      return { success: false, error: errorMsg };
    }

    try {
      const mailOptions = {
        from: process.env.FROM_EMAIL,
        to: user.email,
        subject: 'Welcome to Preview Builder!',
        html: this.generateWelcomeEmailTemplate(user),
        text: this.generateWelcomeEmailText(user),
      };

      const info = await this.transporter.sendMail(mailOptions);

      return { 
        success: true, 
        messageId: info.messageId,
        previewUrl: process.env.NODE_ENV !== 'production' ? nodemailer.getTestMessageUrl(info) : null
      };
    } catch (error) {
      console.error('Error sending welcome email:', error);
      // Provide more helpful error messages
      let errorMessage = error.message;
      if (error.code === 'EAUTH') {
        errorMessage = 'SMTP authentication failed. Please check your email credentials.';
        if (process.env.SMTP_HOST?.includes('gmail.com')) {
          errorMessage += ' For Gmail, ensure you are using an App Password.';
        }
      }
      return { success: false, error: errorMessage };
    }
  }

  generateWelcomeEmailTemplate(user) {
    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Welcome to Preview Builder</title>
        <style>
          body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f9fafb;
          }
          .email-container {
            background: white;
            border-radius: 12px;
            padding: 40px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
          }
          .logo {
            display: inline-block;
            width: 48px;
            height: 48px;
            background: #7c3aed;
            border-radius: 8px;
            margin-bottom: 16px;
            position: relative;
          }
          .logo::after {
            content: '';
            position: absolute;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            width: 24px;
            height: 24px;
            background: white;
            border-radius: 4px;
          }
          .title {
            color: #1f2937;
            font-size: 28px;
            font-weight: bold;
            margin: 0;
          }
          .subtitle {
            color: #6b7280;
            font-size: 16px;
            margin: 8px 0 0 0;
          }
          .content {
            margin: 30px 0;
          }
          .welcome-text {
            font-size: 18px;
            color: #374151;
            margin-bottom: 20px;
          }
          .user-info {
            background: #f3f4f6;
            border-radius: 8px;
            padding: 20px;
            margin: 20px 0;
          }
          .user-info h3 {
            color: #1f2937;
            margin: 0 0 12px 0;
            font-size: 16px;
          }
          .info-item {
            margin: 8px 0;
            color: #4b5563;
          }
          .info-label {
            font-weight: 600;
            display: inline-block;
            width: 100px;
          }
          .role-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 16px;
            font-size: 12px;
            font-weight: 600;
            text-transform: uppercase;
          }
          .role-admin { background: #fee2e2; color: #dc2626; }
          .role-developer { background: #fef3c7; color: #d97706; }
          .role-viewer { background: #d1fae5; color: #059669; }
          .next-steps {
            background: #eff6ff;
            border-left: 4px solid #3b82f6;
            padding: 20px;
            margin: 30px 0;
          }
          .next-steps h3 {
            color: #1e40af;
            margin: 0 0 12px 0;
          }
          .next-steps ul {
            margin: 0;
            padding-left: 20px;
            color: #1e40af;
          }
          .footer {
            text-align: center;
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            color: #6b7280;
            font-size: 14px;
          }
        </style>
      </head>
      <body>
        <div class="email-container">
          <div class="header">
            <div class="logo"></div>
            <h1 class="title">Preview Builder</h1>
            <p class="subtitle">Welcome to our platform!</p>
          </div>
          
          <div class="content">
            <p class="welcome-text">
              Hi <strong>${user.name}</strong>,
            </p>
            
            <p>
              Welcome to Preview Builder! Your account has been successfully created and you now have access to our platform.
            </p>
            
                          <div class="user-info">
                <h3>Your Account Details</h3>
                <div class="info-item">
                  <span class="info-label">Name:</span>
                  ${user.name}
                </div>
                <div class="info-item">
                  <span class="info-label">Email:</span>
                  ${user.email}
                </div>
                <div class="info-item">
                  <span class="info-label">Username:</span>
                  ${user.username || 'Not set'}
                </div>
                <div class="info-item">
                  <span class="info-label">Role:</span>
                  <span class="role-badge role-${user.role.toLowerCase()}">${user.role}</span>
                </div>
              </div>

              ${user.password ? `
              <div class="password-info" style="background: #fef3c7; border: 2px solid #f59e0b; border-radius: 8px; padding: 20px; margin: 20px 0;">
                <h3 style="color: #92400e; margin: 0 0 12px 0; display: flex; align-items: center;">
                  🔐 Your Login Credentials
                </h3>
                <div class="info-item" style="margin: 12px 0;">
                  <span class="info-label" style="font-weight: 600; color: #92400e;">Email:</span>
                  <span style="font-family: monospace; background: #fffbeb; padding: 4px 8px; border-radius: 4px; color: #92400e;">${user.email}</span>
                </div>
                <div class="info-item" style="margin: 12px 0;">
                  <span class="info-label" style="font-weight: 600; color: #92400e;">Password:</span>
                  <span style="font-family: monospace; background: #fffbeb; padding: 4px 8px; border-radius: 4px; color: #92400e; font-weight: bold;">${user.password}</span>
                </div>
                <p style="margin: 12px 0 0 0; font-size: 14px; color: #92400e;">
                  <strong>⚠️ Important:</strong> Please save these credentials securely and change your password after your first login.
                </p>
              </div>
              ` : ''}
            
            <div class="next-steps">
              <h3>Next Steps</h3>
              <ul>
                ${user.password ? 
                  `<li><strong>Log in</strong> to your account using the email and password provided above</li>
                   <li><strong>Change your password</strong> after your first successful login for security</li>` :
                  `<li>Log in to your account using your email and the credentials provided by your administrator</li>`
                }
                <li>Complete your profile setup</li>
                <li>Explore the platform features based on your assigned role</li>
                <li>Contact support if you need any assistance</li>
              </ul>
            </div>
            
            <p>
              If you have any questions or need help getting started, don't hesitate to reach out to our support team.
            </p>
            
            <p>
              Best regards,<br>
              <strong>The Preview Builder Team</strong>
            </p>
          </div>
          
          <div class="footer">
            <p>
              This email was sent to ${user.email} because an account was created for you on Preview Builder.
            </p>
            <p>
              © ${new Date().getFullYear()} Preview Builder. All rights reserved.
            </p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  generateWelcomeEmailText(user) {
    return `
Welcome to Preview Builder!

Hi ${user.name || 'there'},

Welcome to Preview Builder! Your account has been successfully created and you now have access to our platform.

Your Account Details:
- Name: ${user.name}
- Email: ${user.email}
- Username: ${user.username || 'Not set'}
- Role: ${user.role}

${user.password ? `
🔐 YOUR LOGIN CREDENTIALS:
- Email: ${user.email}
- Password: ${user.password}

⚠️ IMPORTANT: Please save these credentials securely and change your password after your first login.
` : ''}

Next Steps:
${user.password ? 
  `1. Log in to your account using the email and password provided above
2. Change your password after your first successful login for security` :
  `1. Log in to your account using your email and the credentials provided by your administrator`
}
3. Complete your profile setup
4. Explore the platform features based on your assigned role
5. Contact support if you need any assistance

If you have any questions or need help getting started, don't hesitate to reach out to our support team.

Best regards,
The Preview Builder Team

---
This email was sent to ${user.email} because an account was created for you on Preview Builder.
© ${new Date().getFullYear()} Preview Builder. All rights reserved.
    `.trim();
  }

  async sendPasswordResetEmail(user, resetToken) {
    if (!(await this.ensureInitialized())) {
      const errorMsg = this.lastError 
        ? `Email service not available: ${this.lastError.message}`
        : 'Email service not available: Missing SMTP credentials';
      console.warn('Email service not initialized. Skipping email send.');
      return { success: false, error: errorMsg };
    }

    try {
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;
      
      const mailOptions = {
        from: process.env.FROM_EMAIL || '"Preview Builder" <noreply@thecubefactory.com>',
        to: user.email,
        subject: 'Password Reset Request - Preview Builder',
        html: this.generatePasswordResetTemplate(user, resetUrl),
        text: `Password Reset Request\n\nHi ${user.name || 'there'},\n\nYou requested a password reset. Click the link below to reset your password:\n${resetUrl}\n\nIf you didn't request this, please ignore this email.\n\nBest regards,\nThe Preview Builder Team`,
      };

      const info = await this.transporter.sendMail(mailOptions);
      
      return { 
        success: true, 
        messageId: info.messageId,
        previewUrl: process.env.NODE_ENV !== 'production' ? nodemailer.getTestMessageUrl(info) : null
      };
    } catch (error) {
      console.error('Error sending password reset email:', error);
      // Provide more helpful error messages
      let errorMessage = error.message;
      if (error.code === 'EAUTH') {
        errorMessage = 'SMTP authentication failed. Please check your email credentials.';
        if (process.env.SMTP_HOST?.includes('gmail.com')) {
          errorMessage += ' For Gmail, ensure you are using an App Password.';
        }
      }
      return { success: false, error: errorMessage };
    }
  }

  generatePasswordResetTemplate(user, resetUrl) {
    // Similar HTML template for password reset
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Password Reset - Preview Builder</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
          .container { background: white; border-radius: 8px; padding: 30px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
          .header { text-align: center; margin-bottom: 30px; }
          .button { display: inline-block; padding: 12px 24px; background: #7c3aed; color: white; text-decoration: none; border-radius: 6px; font-weight: bold; }
          .footer { margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; color: #666; font-size: 14px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <p>Hi ${user.name || 'there'},</p>
          <p>You requested a password reset for your Preview Builder account.</p>
          <p style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" class="button">Reset Password</a>
          </p>
          <p>If the button doesn't work, copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #7c3aed;">${resetUrl}</p>
          <p>If you didn't request this password reset, please ignore this email.</p>
          <div class="footer">
            <p>Best regards,<br>The Preview Builder Team</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

// Create singleton instance
const emailService = new EmailService();

export default emailService;