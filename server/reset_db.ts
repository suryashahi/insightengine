import fs from "fs";
import path from "path";
import crypto from "crypto";
import nodemailer from "nodemailer";

interface ResetTokenRecord {
  email: string;
  token: string;
  expires_at: number;
}

const dbPath = path.join(process.cwd(), "password_resets.json");

/**
 * Helper to read token records from the JSON db.
 */
function loadTokens(): ResetTokenRecord[] {
  try {
    if (fs.existsSync(dbPath)) {
      const data = fs.readFileSync(dbPath, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("[TOKENS DB LOAD ERROR] Failed to load reset tokens:", err);
  }
  return [];
}

/**
 * Helper to write token records safely back to the JSON db file.
 */
function saveTokens(tokens: ResetTokenRecord[]) {
  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(dbPath, JSON.stringify(tokens, null, 2), "utf-8");
  } catch (err) {
    console.error("[TOKENS DB SAVE ERROR] Failed to save reset tokens:", err);
  }
}

/**
 * Creates, stores, and returns a secure token for password reset.
 * Cleans up older tokens associated with the user's email first.
 */
export async function createResetToken(email: string): Promise<string> {
  const normalizedEmail = email.toLowerCase().trim();
  let tokens = loadTokens();

  // Clean up any existing tokens for this specific email
  tokens = tokens.filter(t => t.email !== normalizedEmail);

  // Generate a cryptographically secure reset token
  const token = crypto.randomBytes(32).toString("hex");
  const ONE_HOUR = 3600000;
  const expiresAtMs = Date.now() + ONE_HOUR;

  tokens.push({
    email: normalizedEmail,
    token,
    expires_at: expiresAtMs,
  });

  saveTokens(tokens);
  console.log(`[PASS RESET DB] Dispatching reset token of length ${token.length} for ${normalizedEmail}`);
  return token;
}

/**
 * Validates a reset token. Returns the associated user email if valid, or null if expired/nonexistent.
 */
export async function verifyResetToken(token: string): Promise<string | null> {
  const tokens = loadTokens();
  const found = tokens.find(t => t.token === token);
  
  if (!found) {
    return null;
  }

  const now = Date.now();
  if (now > found.expires_at) {
    // Clean up expired token
    const remaining = tokens.filter(t => t.token !== token);
    saveTokens(remaining);
    return null;
  }

  return found.email;
}

/**
 * Invalidate token manually after successful reset to enforce single-use tokens.
 */
export async function invalidateResetToken(token: string): Promise<void> {
  const tokens = loadTokens();
  const remaining = tokens.filter(t => t.token !== token);
  saveTokens(remaining);
}

/**
 * Sends a password reset email using Nodemailer.
 * Falls back to Ethereal Mail if SMTP credentials are not present.
 */
export async function sendResetEmail(email: string, token: string, originUrl: string) {
  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // Clean-up originUrl trailing slash
  const cleanOrigin = originUrl.endsWith("/") ? originUrl.slice(0, -1) : originUrl;
  const resetUrl = `${cleanOrigin}/?resetToken=${token}`;

  console.log(`[SMTP SYSTEM] Dispatching password reset sequence for '${email}' -> Link: ${resetUrl}`);

  let transporter;
  let isTestAccount = false;

  if (host && user && pass) {
    console.log(`[SMTP SYSTEM] Using custom SMTP server: ${host}:${port}`);
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465, // True for port 465, false for 587 or other
      auth: {
        user,
        pass,
      },
      tls: {
        rejectUnauthorized: false
      }
    });
  } else {
    console.warn("[SMTP SYSTEM WARNING] Missing custom SMTP credentials. Falling back to an auto-generated Ethereal SMTP account.");
    isTestAccount = true;
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  const mailOptions = {
    from: `"InsightEngine AI Support" <${user || "support@insightengineai.com"}>`,
    to: email,
    subject: "Reset Your Account Password - InsightEngine AI",
    text: `You requested a password reset for your InsightEngine AI account. Please visit this URL to change your password: ${resetUrl} (Valid for 1 hour).`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 32px 24px; border: 1px solid rgba(226, 232, 240, 0.8); border-radius: 16px; background-color: #ffffff; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
        <div style="text-align: center; margin-bottom: 24px;">
          <span style="font-size: 28px; font-weight: 800; background: linear-gradient(to right, #8b5cf6, #6366f1); -webkit-background-clip: text; color: #4f46e5; letter-spacing: -0.025em;">InsightEngine AI</span>
        </div>
        <h3 style="color: #0f172a; font-size: 18px; font-weight: 700; margin-top: 0; margin-bottom: 12px;">Reset your password</h3>
        <p style="color: #475569; font-size: 14px; line-height: 1.6; margin-top: 0; margin-bottom: 24px;">
          We received a request to reset the password for your account associated with <strong>${email}</strong>. 
          Click the link below to select a secure new password. This link will expire in <strong>1 hour</strong>.
        </p>
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${resetUrl}" style="background-color: #6366f1; color: #ffffff !important; padding: 12px 28px; border-radius: 10px; text-decoration: none; font-weight: 600; font-size: 14px; display: inline-block; box-shadow: 0 10px 15px -3px rgba(99, 102, 241, 0.3);">Reset Secure Password</a>
        </div>
        <p style="color: #64748b; font-size: 12px; line-height: 1.5; margin-bottom: 8px;">If the button above does not load, copy and paste this link into your web browser:</p>
        <p style="color: #6366f1; font-size: 12px; line-height: 1.5; word-break: break-all; margin-top: 0; margin-bottom: 24px;">${resetUrl}</p>
        <hr style="border: 0; border-top: 1px solid #f1f5f9; margin-top: 24px; margin-bottom: 20px;" />
        <p style="color: #94a3b8; font-size: 11px; text-align: center; margin-top: 0; margin-bottom: 0;">If you did not initiate this request, your password will remain unchanged and you can safely ignore this communication.</p>
      </div>
    `,
  };

  const info = await transporter.sendMail(mailOptions);
  
  if (isTestAccount) {
    const previewUrl = nodemailer.getTestMessageUrl(info);
    console.log(`[SMTP SYSTEM] Ethereal mailbox created! Check message here: ${previewUrl}`);
    return {
      success: true,
      previewUrl,
    };
  }

  return { success: true };
}
