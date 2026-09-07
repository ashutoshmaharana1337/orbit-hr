import { Injectable, Logger } from '@nestjs/common';

export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
};

// No transactional email provider is configured for this project yet.
// Set RESEND_API_KEY to send for real; until then, invites and password
// resets still work end to end — the link just lands in the server log
// instead of an inbox.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);

  async send(input: SendMailInput): Promise<void> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      this.logger.warn(
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
