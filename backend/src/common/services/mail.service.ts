import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private readonly configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('email.host'),
      port: this.configService.get<number>('email.port'),
      secure: this.configService.get<number>('email.port') === 465,
      auth: {
        user: this.configService.get<string>('email.user'),
        pass: this.configService.get<string>('email.password'),
      },
    });
  }

  private get appName(): string {
    return this.configService.get<string>('appName', 'Livora OS');
  }

  private getFromAddress(companyName?: string): string {
    const displayName = companyName || this.appName;
    const from = this.configService.get<string>('email.from', 'noreply@livora-os.com');
    return `"${displayName}" <${from}>`;
  }

  private baseTemplate(content: string): string {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        ${content}
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">${this.appName}</p>
      </div>
    `;
  }

  private button(text: string, url: string): string {
    return `
      <div style="text-align: center; margin: 30px 0;">
        <a href="${url}"
           style="background-color: #0f172a; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; display: inline-block;">
          ${text}
        </a>
      </div>
    `;
  }

  private async send(
    to: string,
    subject: string,
    html: string,
    attachments?: Array<{ filename: string; href: string }>,
    companyName?: string,
  ): Promise<void> {
    const displayName = companyName || this.appName;
    try {
      await this.transporter.sendMail({
        from: this.getFromAddress(companyName),
        to,
        subject: `${displayName} - ${subject}`,
        html,
        ...(attachments && attachments.length > 0 ? { attachments } : {}),
      });
      this.logger.log(`Email "${subject}" sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send "${subject}" to ${to}: ${error.message}`);
      throw error;
    }
  }

  private brandedLetterheadTemplate(
    content: string,
    unsubscribeUrl: string,
    branding?: { logoUrl?: string; companyName?: string; primaryColor?: string; address?: string },
    attachmentLinks?: string,
  ): string {
    const company = branding?.companyName || this.appName;
    const color = branding?.primaryColor || '#1e40af';
    const logo = branding?.logoUrl
      ? `<img src="${branding.logoUrl}" alt="${escapeHtml(company)}" style="height:50px;max-width:200px;object-fit:contain;display:block;margin:0 auto 12px;" />`
      : '';
    const address = branding?.address
      ? `<p style="color:#9ca3af;font-size:12px;margin:0 0 6px;">${escapeHtml(branding.address)}</p>`
      : '';
    const attachmentsSection = attachmentLinks
      ? `<tr><td style="padding:0 32px 16px;border-top:1px solid #e5e7eb;">
          <p style="font-size:13px;color:#374151;font-weight:600;margin:16px 0 8px;">Attachments:</p>
          ${attachmentLinks}
         </td></tr>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f3f4f6;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.08);max-width:600px;width:100%;">
          <tr>
            <td style="background-color:${color};padding:28px 32px;text-align:center;">
              ${logo}
              <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;letter-spacing:0.5px;">${escapeHtml(company)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:#1f2937;font-size:15px;line-height:1.7;">
              ${content}
            </td>
          </tr>
          ${attachmentsSection}
          <tr>
            <td style="background-color:#f9fafb;padding:20px 32px;text-align:center;border-top:1px solid #e5e7eb;">
              ${address}
              <p style="color:#d1d5db;font-size:11px;margin:0;">
                You received this email because you are subscribed to our communications.<br/>
                <a href="${unsubscribeUrl}" style="color:#9ca3af;text-decoration:underline;">Unsubscribe</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  // ============ Authentication Emails ============

  async sendPasswordResetEmail(to: string, resetUrl: string, companyName?: string): Promise<void> {
    const name = companyName || this.appName;
    const html = this.baseTemplate(`
      <h2 style="color: #333;">Password Reset Request</h2>
      <p>You requested a password reset for your ${escapeHtml(name)} account.</p>
      <p>Click the button below to reset your password. This link expires in 1 hour.</p>
      ${this.button('Reset Password', resetUrl)}
      <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
      <p style="color: #666; font-size: 14px;">Or copy and paste this link: <br/>${resetUrl}</p>
    `);
    await this.send(to, 'Password Reset Request', html, undefined, companyName);
  }

  async sendWelcomeEmail(to: string, data: {
    firstName: string;
    role: string;
    loginUrl: string;
  }, companyName?: string): Promise<void> {
    const name = companyName || this.appName;
    const html = this.baseTemplate(`
      <h2 style="color: #333;">Welcome to ${escapeHtml(name)}!</h2>
      <p>Hi ${escapeHtml(data.firstName)},</p>
      <p>Your account has been created successfully as a <strong>${escapeHtml(data.role)}</strong>.</p>
      <p>You can now log in and start using the platform.</p>
      ${this.button('Log In to Your Account', data.loginUrl)}
      <p style="color: #666; font-size: 14px;">If you have any questions, feel free to reach out to your administrator.</p>
    `);
    await this.send(to, 'Welcome!', html, undefined, companyName);
  }

  async sendEmailVerificationEmail(
    to: string,
    otp: string,
    branding?: { firstName?: string; companyName?: string; logoUrl?: string; primaryColor?: string },
  ): Promise<void> {
    const appUrl = this.configService.get<string>('appUrl', 'http://localhost:3000');
    const greeting = branding?.firstName ? `Hi ${escapeHtml(branding.firstName)},` : 'Hello,';
    const digits = otp.split('').map((d) =>
      `<span style="display:inline-block;width:44px;height:56px;line-height:56px;text-align:center;font-size:28px;font-weight:700;color:#1f2937;background:#f3f4f6;border-radius:8px;margin:0 4px;">${d}</span>`
    ).join('');

    const html = this.brandedLetterheadTemplate(
      `<p style="margin:0 0 8px;font-size:15px;">${greeting}</p>
       <p style="margin:0 0 20px;font-size:15px;color:#374151;">
         Use the verification code below to confirm your email address.
         This code expires in <strong>15 minutes</strong>.
       </p>
       <div style="text-align:center;margin:28px 0;">
         ${digits}
       </div>
       <p style="margin:24px 0 0;font-size:13px;color:#9ca3af;text-align:center;">
         Enter this code on the verification page to activate your account.
       </p>
       <p style="margin:16px 0 0;font-size:13px;color:#9ca3af;text-align:center;">
         If you didn't create an account, you can safely ignore this email.
       </p>`,
      `${appUrl}/auth/login`,
      {
        companyName: branding?.companyName,
        logoUrl: branding?.logoUrl,
        primaryColor: branding?.primaryColor,
      },
    );
    await this.send(to, 'Your verification code', html, undefined, branding?.companyName);
  }

  // ============ Sale Emails ============

  async sendSaleConfirmationToRealtor(to: string, data: {
    propertyTitle: string;
    salePrice: number;
    commissionAmount: number;
    clientName: string;
  }, companyName?: string): Promise<void> {
    const html = this.baseTemplate(`
      <h2 style="color: #333;">Sale Confirmed!</h2>
      <p>Congratulations! Your sale has been approved.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px 0; color: #666;">Property</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right;">${escapeHtml(data.propertyTitle)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Client</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right;">${escapeHtml(data.clientName)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Sale Price</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right;">$${data.salePrice.toLocaleString()}</td>
        </tr>
        <tr style="border-top: 1px solid #eee;">
          <td style="padding: 8px 0; color: #666;">Your Commission</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #16a34a;">$${data.commissionAmount.toLocaleString()}</td>
        </tr>
      </table>
      <p style="color: #666; font-size: 14px;">Check your dashboard for full details.</p>
    `);
    await this.send(to, 'Sale Confirmed', html, undefined, companyName);
  }

  async sendSaleConfirmationToClient(to: string, data: {
    propertyTitle: string;
    salePrice: number;
    realtorName: string;
  }, companyName?: string): Promise<void> {
    const html = this.baseTemplate(`
      <h2 style="color: #333;">Purchase Confirmed!</h2>
      <p>Your property purchase has been approved.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px 0; color: #666;">Property</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right;">${escapeHtml(data.propertyTitle)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Price</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right;">$${data.salePrice.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Realtor</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right;">${escapeHtml(data.realtorName)}</td>
        </tr>
      </table>
      <p style="color: #666; font-size: 14px;">Log in to your dashboard to view documents and details.</p>
    `);
    await this.send(to, 'Purchase Confirmed', html, undefined, companyName);
  }

  // ============ Commission Emails ============

  async sendCommissionPaidEmail(to: string, data: {
    amount: number;
    propertyTitle: string;
    paidDate: Date;
  }, companyName?: string): Promise<void> {
    const dateStr = new Date(data.paidDate).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    const html = this.baseTemplate(`
      <h2 style="color: #333;">Commission Paid!</h2>
      <p>Your commission has been processed.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px 0; color: #666;">Property</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right;">${escapeHtml(data.propertyTitle)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Amount</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right; color: #16a34a;">$${data.amount.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Paid On</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right;">${dateStr}</td>
        </tr>
      </table>
    `);
    await this.send(to, 'Commission Paid', html, undefined, companyName);
  }

  // ============ Payment Emails ============

  async sendPaymentReminderEmail(to: string, data: {
    propertyTitle: string;
    dueAmount: number;
    dueDate: Date;
    overdueBy?: number;
  }, companyName?: string): Promise<void> {
    const dateStr = new Date(data.dueDate).toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    const overdueText = data.overdueBy
      ? `<p style="color: #dc2626; font-weight: bold;">This payment is ${data.overdueBy} day${data.overdueBy > 1 ? 's' : ''} overdue.</p>`
      : '';
    const html = this.baseTemplate(`
      <h2 style="color: #333;">Payment Reminder</h2>
      <p>You have an upcoming payment due.</p>
      ${overdueText}
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px 0; color: #666;">Property</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right;">${escapeHtml(data.propertyTitle)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Amount Due</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right;">$${data.dueAmount.toLocaleString()}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Due Date</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right;">${dateStr}</td>
        </tr>
      </table>
      <p style="color: #666; font-size: 14px;">Please log in to your dashboard to make the payment.</p>
    `);
    await this.send(to, 'Payment Reminder', html, undefined, companyName);
  }

  // ============ HR Emails ============

  async sendLeaveApprovedEmail(to: string, data: {
    type: string;
    startDate: Date;
    endDate: Date;
    totalDays: number;
  }, companyName?: string): Promise<void> {
    const start = new Date(data.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const end = new Date(data.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const html = this.baseTemplate(`
      <h2 style="color: #16a34a;">Leave Request Approved</h2>
      <p>Your leave request has been approved.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px 0; color: #666;">Type</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right;">${escapeHtml(data.type)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Period</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right;">${start} - ${end}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Total Days</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right;">${data.totalDays}</td>
        </tr>
      </table>
    `);
    await this.send(to, 'Leave Approved', html, undefined, companyName);
  }

  async sendLeaveRejectedEmail(to: string, data: {
    type: string;
    startDate: Date;
    endDate: Date;
    reason: string;
  }, companyName?: string): Promise<void> {
    const start = new Date(data.startDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const end = new Date(data.endDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const html = this.baseTemplate(`
      <h2 style="color: #dc2626;">Leave Request Rejected</h2>
      <p>Your leave request has been declined.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px 0; color: #666;">Type</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right;">${escapeHtml(data.type)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Period</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right;">${start} - ${end}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Reason</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right;">${escapeHtml(data.reason)}</td>
        </tr>
      </table>
      <p style="color: #666; font-size: 14px;">Please contact your manager for more details.</p>
    `);
    await this.send(to, 'Leave Rejected', html, undefined, companyName);
  }

  async sendTaskAssignedEmail(to: string, data: {
    title: string;
    description: string;
    dueDate?: Date;
    assignedBy: string;
  }, companyName?: string): Promise<void> {
    const dueDateRow = data.dueDate
      ? `<tr>
          <td style="padding: 8px 0; color: #666;">Due Date</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right;">${new Date(data.dueDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</td>
        </tr>`
      : '';
    const html = this.baseTemplate(`
      <h2 style="color: #333;">New Task Assigned</h2>
      <p>You have been assigned a new task.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px 0; color: #666;">Task</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right;">${escapeHtml(data.title)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Assigned By</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right;">${escapeHtml(data.assignedBy)}</td>
        </tr>
        ${dueDateRow}
      </table>
      <p style="color: #666; font-size: 14px;">${escapeHtml(data.description)}</p>
    `);
    await this.send(to, 'New Task Assigned', html, undefined, companyName);
  }

  async sendPerformanceReviewEmail(to: string, data: {
    cycle: string;
    reviewerName: string;
    periodStart: Date;
    periodEnd: Date;
  }, companyName?: string): Promise<void> {
    const start = new Date(data.periodStart).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const end = new Date(data.periodEnd).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const html = this.baseTemplate(`
      <h2 style="color: #333;">Performance Review Scheduled</h2>
      <p>A performance review has been scheduled for you.</p>
      <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
        <tr>
          <td style="padding: 8px 0; color: #666;">Review Cycle</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right;">${escapeHtml(data.cycle)}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Period</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right;">${start} - ${end}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;">Reviewer</td>
          <td style="padding: 8px 0; font-weight: bold; text-align: right;">${escapeHtml(data.reviewerName)}</td>
        </tr>
      </table>
      <p style="color: #666; font-size: 14px;">Please prepare any relevant materials before your review.</p>
    `);
    await this.send(to, 'Performance Review Scheduled', html, undefined, companyName);
  }

  // ============ Purchase Enquiry Emails ============

  async sendPurchasePaymentNotification(
    to: string,
    data: {
      clientName: string;
      propertyTitle: string;
      numPlots: number;
      phone: string;
      email: string;
    },
    companyName?: string,
  ): Promise<void> {
    const html = this.baseTemplate(`
      <h2 style="color:#333;">Payment Notification</h2>
      <p><strong>${escapeHtml(data.clientName)}</strong> has submitted payment for <strong>${escapeHtml(data.propertyTitle)}</strong> and is awaiting confirmation.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0">
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Plots</td><td style="padding:8px;border:1px solid #ddd">${data.numPlots}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Phone</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(data.phone)}</td></tr>
        <tr><td style="padding:8px;border:1px solid #ddd;font-weight:bold">Email</td><td style="padding:8px;border:1px solid #ddd">${escapeHtml(data.email)}</td></tr>
      </table>
      <p>Please log in to the admin dashboard to review and confirm this purchase.</p>
    `);
    await this.send(to, 'Payment Submitted — Action Required', html, undefined, companyName);
  }

  // ============ Contact Form Emails ============

  async sendContactFormEmail(
    to: string,
    data: { name: string; email: string; phone?: string; message: string },
  ): Promise<void> {
    const phoneRow = data.phone
      ? `<tr><td style="padding:8px 0;color:#666;">Phone</td><td style="padding:8px 0;font-weight:bold;text-align:right;">${escapeHtml(data.phone)}</td></tr>`
      : '';
    const html = this.baseTemplate(`
      <h2 style="color:#333;">New Contact Form Submission</h2>
      <p>A new enquiry has been received from your platform contact form.</p>
      <table style="width:100%;border-collapse:collapse;margin:20px 0;">
        <tr><td style="padding:8px 0;color:#666;">Name</td><td style="padding:8px 0;font-weight:bold;text-align:right;">${escapeHtml(data.name)}</td></tr>
        <tr><td style="padding:8px 0;color:#666;">Email</td><td style="padding:8px 0;font-weight:bold;text-align:right;">${escapeHtml(data.email)}</td></tr>
        ${phoneRow}
      </table>
      <h3 style="color:#333;margin-bottom:8px;">Message</h3>
      <div style="background:#f9fafb;border-left:4px solid #3b82f6;padding:16px;border-radius:4px;">
        <p style="margin:0;color:#374151;line-height:1.6;">${escapeHtml(data.message)}</p>
      </div>
      <p style="color:#666;font-size:13px;margin-top:20px;">Reply directly to this email or contact the sender at ${escapeHtml(data.email)}.</p>
    `);
    await this.send(to, 'New Contact Form Submission', html);
  }

  async sendContactAutoReply(to: string, name: string): Promise<void> {
    const html = this.baseTemplate(`
      <h2 style="color:#333;">Thank you for reaching out, ${escapeHtml(name)}!</h2>
      <p>We have received your message and will get back to you as soon as possible, usually within 1-2 business days.</p>
      <p style="color:#666;font-size:14px;">If you have an urgent enquiry, please call us directly.</p>
    `);
    await this.send(to, 'We received your message', html);
  }

  // ============ Event Registration Emails ============

  async sendEventRegistrationEmail(
    to: string,
    data: {
      eventTitle: string;
      eventDate: Date;
      locationType: string;
      locationDetails?: string;
      registrationCode: string;
      qrCodeDataUrl: string;
      status: string;
      userData: Record<string, unknown>;
    },
    companyName?: string,
  ): Promise<void> {
    const dateStr = new Date(data.eventDate).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const base64Data = data.qrCodeDataUrl.replace(/^data:image\/\w+;base64,/, '');
    const statusColor = data.status === 'approved' ? '#16a34a' : data.status === 'rejected' ? '#dc2626' : '#d97706';
    const locationRow = data.locationDetails
      ? `<tr><td style="padding:6px 0;color:#666;font-size:13px;">Location</td><td style="padding:6px 0;font-weight:600;text-align:right;font-size:13px;">${escapeHtml(data.locationDetails)}</td></tr>`
      : '';
    const userDataRows = Object.entries(data.userData)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `<tr><td style="padding:6px 0;color:#666;font-size:13px;">${escapeHtml(k)}</td><td style="padding:6px 0;font-weight:600;text-align:right;font-size:13px;">${escapeHtml(String(v))}</td></tr>`)
      .join('');

    const html = this.baseTemplate(`
      <h2 style="color:#1f2937;margin-bottom:4px;">You're registered!</h2>
      <p style="color:#6b7280;margin-bottom:24px;">Here are your registration details for <strong>${escapeHtml(data.eventTitle)}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 24px;">
        <tr><td style="padding:6px 0;color:#666;font-size:13px;">Event</td><td style="padding:6px 0;font-weight:600;text-align:right;font-size:13px;">${escapeHtml(data.eventTitle)}</td></tr>
        <tr><td style="padding:6px 0;color:#666;font-size:13px;">Date</td><td style="padding:6px 0;font-weight:600;text-align:right;font-size:13px;">${dateStr}</td></tr>
        <tr><td style="padding:6px 0;color:#666;font-size:13px;">Format</td><td style="padding:6px 0;font-weight:600;text-align:right;font-size:13px;text-transform:capitalize;">${escapeHtml(data.locationType)}</td></tr>
        ${locationRow}
        <tr><td style="padding:6px 0;color:#666;font-size:13px;">Registration Code</td><td style="padding:6px 0;font-weight:700;text-align:right;font-family:monospace;font-size:13px;color:#1f2937;">${escapeHtml(data.registrationCode)}</td></tr>
        <tr><td style="padding:6px 0;color:#666;font-size:13px;">Status</td><td style="padding:6px 0;font-weight:600;text-align:right;font-size:13px;color:${statusColor};text-transform:capitalize;">${escapeHtml(data.status)}</td></tr>
        ${userDataRows}
      </table>
      <div style="text-align:center;margin:24px 0;">
        <p style="color:#374151;font-size:14px;margin-bottom:12px;">Show this QR code at the event entrance</p>
        <img src="cid:qrcode" alt="QR Code" width="200" height="200" style="border:1px solid #e5e7eb;border-radius:8px;padding:8px;" />
        <p style="color:#9ca3af;font-size:12px;margin-top:8px;">Code: <strong style="color:#1f2937;">${escapeHtml(data.registrationCode)}</strong></p>
      </div>
      <p style="color:#9ca3af;font-size:12px;margin-top:16px;">Keep this email — you'll need the QR code to check in at the event.</p>
    `);

    const displayName = companyName || this.appName;
    try {
      await this.transporter.sendMail({
        from: this.getFromAddress(companyName),
        to,
        subject: `${displayName} - Registration Confirmed: ${escapeHtml(data.eventTitle)}`,
        html,
        attachments: [{ filename: 'qrcode.png', content: base64Data, encoding: 'base64', cid: 'qrcode' }],
      });
      this.logger.log(`Event registration email sent to ${to}`);
    } catch (error) {
      this.logger.error(`Failed to send event registration email to ${to}: ${error.message}`);
      throw error;
    }
  }

  // ============ Newsletter Emails ============

  async sendNewsletterEmail(
    to: string,
    subject: string,
    content: string,
    unsubscribeUrl: string,
    options?: {
      branding?: { logoUrl?: string; companyName?: string; primaryColor?: string; address?: string };
      attachments?: Array<{ filename: string; url: string }>;
    },
  ): Promise<void> {
    const attachmentLinks = options?.attachments
      ?.map(
        (a) =>
          `<p style="margin:4px 0;"><a href="${a.url}" style="color:#2563eb;text-decoration:none;font-size:13px;">📎 ${escapeHtml(a.filename)}</a></p>`,
      )
      .join('');

    const html = this.brandedLetterheadTemplate(
      content,
      unsubscribeUrl,
      options?.branding,
      attachmentLinks || undefined,
    );

    const nodemailerAttachments = options?.attachments?.map((a) => ({
      filename: a.filename,
      href: a.url,
    }));

    await this.send(to, subject, html, nodemailerAttachments, options?.branding?.companyName);
  }

  async sendRaffleCodeEmail(to: string, raffleName: string, html: string): Promise<void> {
    await this.send(to, `Your Raffle Code — ${raffleName}`, html);
  }

  async sendLeadAssignmentEmail(to: string, data: {
    recipientName: string;
    leadName: string;
    leadPhone?: string;
    leadEmail?: string;
    source?: string;
    campaign?: string;
    leadId: string;
  }): Promise<void> {
    const appUrl = this.configService.get<string>('appUrl', 'https://app.livora-os.com');
    const html = this.baseTemplate(`
      <h2 style="color:#1e293b;">New Lead Assigned to You 🎯</h2>
      <p>Hi ${escapeHtml(data.recipientName)},</p>
      <p>A new lead has been assigned to you on ${this.appName}:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;background:#f8fafc;font-weight:600;width:140px;">Name</td><td style="padding:8px;">${escapeHtml(data.leadName)}</td></tr>
        ${data.leadPhone ? `<tr><td style="padding:8px;background:#f1f5f9;font-weight:600;">Phone</td><td style="padding:8px;">${escapeHtml(data.leadPhone)}</td></tr>` : ''}
        ${data.leadEmail ? `<tr><td style="padding:8px;background:#f8fafc;font-weight:600;">Email</td><td style="padding:8px;">${escapeHtml(data.leadEmail)}</td></tr>` : ''}
        ${data.source ? `<tr><td style="padding:8px;background:#f1f5f9;font-weight:600;">Source</td><td style="padding:8px;">${escapeHtml(data.source)}</td></tr>` : ''}
        ${data.campaign ? `<tr><td style="padding:8px;background:#f8fafc;font-weight:600;">Campaign</td><td style="padding:8px;">${escapeHtml(data.campaign)}</td></tr>` : ''}
      </table>
      <a href="${appUrl}/dashboard/admin/crm/leads/${data.leadId}"
         style="display:inline-block;background:#2563eb;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:600;">
        View Lead →
      </a>
      <p style="margin-top:16px;color:#64748b;font-size:13px;">Respond within 5 minutes for best conversion rates.</p>
    `);
    await this.send(to, `New Lead: ${data.leadName} (via ${data.source || 'RMS'})`, html);
  }
}
