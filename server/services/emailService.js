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
      };

      const info = await this.transporter.sendMail(mailOptions);

      return { 
        success: true, 
        messageId: info.messageId,
        previewUrl: process.env.NODE_ENV !== 'production' ? nodemailer.getTestMessageUrl(info) : null
      };
    } catch (error) {
      console.error('Error sending welcome email:', error);
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
      </head>
      <body style="margin:0;padding:0;background-color:#f3f4f6;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:40px 0;">
          <tr>
            <td align="center">
              <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">

                <!-- Banner -->
                <tr>
                  <td style="background:#7c3aed;padding:32px 40px;text-align:center;">
                    <h1 style="margin:0;color:#ffffff;font-size:26px;font-weight:700;letter-spacing:-0.5px;">Preview Builder</h1>
                    <p style="margin:6px 0 0;color:#ddd6fe;font-size:15px;">Welcome, ${user.name}</p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding:36px 40px;">

                    <p style="margin:0 0 20px;color:#4b5563;font-size:15px;">
                      Your preview account has been created. Use the credentials below to access your account.
                    </p>

                    <!-- Credentials -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin-bottom:28px;">
                      <tr>
                        <td style="padding:20px 24px;">
                          <p style="margin:0 0 14px;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Your account</p>
                          <table width="100%" cellpadding="0" cellspacing="0">
                            <tr>
                              <td style="padding:6px 0;color:#6b7280;font-size:14px;width:90px;">Email</td>
                              <td style="padding:6px 0;color:#111827;font-size:14px;font-weight:600;">${user.email}</td>
                            </tr>
                            ${user.password ? `
                            <tr>
                              <td style="padding:6px 0;color:#6b7280;font-size:14px;">Password</td>
                              <td style="padding:6px 0;font-size:14px;font-weight:700;font-family:monospace;color:#7c3aed;">${user.password}</td>
                            </tr>` : ''}
                          </table>
                        </td>
                      </tr>
                    </table>

                    <!-- CTA -->
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td align="center">
                          <a href="${process.env.FRONTEND_URL}"
                             style="display:inline-block;padding:13px 32px;background:#7c3aed;color:#ffffff;text-decoration:none;border-radius:7px;font-size:15px;font-weight:600;">
                            Go to Preview Builder
                          </a>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </body>
      </html>
    `;
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
      const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;
      
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