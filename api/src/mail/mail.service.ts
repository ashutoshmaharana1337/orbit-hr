import { Injectable, Logger, type OnModuleInit } from '@nestjs/common';

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
};

// Set RESEND_API_KEY to send for real. Without it, invites and password
// resets still work end to end in development — the link lands in the
// server log (DEBUG level, since it is a live credential) instead of an
// inbox. In production that fallback is refused outright: an invite or
// reset link in a log aggregator is an account takeover waiting to happen.
@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);

  onModuleInit() {
    if (process.env.NODE_ENV === 'production' && !process.env.RESEND_API_KEY) {
      throw new Error(
        'MailService: RESEND_API_KEY is required in production — refusing to fall back to logging invite/reset links',
      );
    }
  }

  async send(input: SendMailInput): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      this.logger.debug(
        `DEV EMAIL (no RESEND_API_KEY set, not actually sent)\nTo: ${input.to}\nSubject: ${input.subject}\n\n${input.text}`,
      );
      return;
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM ?? 'Orbit HR <onboarding@resend.dev>',
        to: input.to,
        subject: input.subject,
        text: input.text,
      }),
    });

    if (!res.ok) {
      this.logger.error(`Failed to send email to ${input.to}: ${res.status} ${await res.text()}`);
    }
  }
}
