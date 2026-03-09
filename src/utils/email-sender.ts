import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendLicenseEmail(email: string, key: string): Promise<void> {
  await resend.emails.send({
    from: 'StackForge <noreply@stackforge.app>',
    to: email,
    subject: 'Your StackForge Pro License Key',
    html: `
      <!DOCTYPE html>
      <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f0f0f; color: #e0e0e0; padding: 40px;">
        <div style="max-width: 480px; margin: 0 auto; background: #1a1a1a; border-radius: 12px; padding: 32px; border: 1px solid #2a2a2a;">
          <h1 style="font-size: 24px; margin: 0 0 8px 0; color: #fff;">Welcome to StackForge Pro! 🚀</h1>
          <p style="color: #999; margin: 0 0 24px 0;">Thank you for your purchase.</p>
          
          <div style="background: #111; border: 1px solid #333; border-radius: 8px; padding: 16px; text-align: center; margin-bottom: 24px;">
            <p style="color: #999; font-size: 12px; margin: 0 0 8px 0; text-transform: uppercase; letter-spacing: 1px;">Your License Key</p>
            <p style="font-size: 22px; font-weight: bold; font-family: monospace; color: #f97316; margin: 0; letter-spacing: 2px;">${key}</p>
          </div>
          
          <h3 style="font-size: 14px; color: #fff; margin: 0 0 12px 0;">How to activate:</h3>
          <ol style="color: #999; font-size: 14px; line-height: 1.8; padding-left: 20px; margin: 0 0 24px 0;">
            <li>Open StackForge</li>
            <li>Go to <strong style="color: #fff;">License → Activate</strong></li>
            <li>Enter your email and license key</li>
          </ol>
          
          <p style="color: #666; font-size: 12px; margin: 0; border-top: 1px solid #2a2a2a; padding-top: 16px;">
            If you have questions, reply to this email or visit <a href="https://stackforge.app" style="color: #f97316;">stackforge.app</a>.
          </p>
        </div>
      </body>
      </html>
    `,
  });
}
