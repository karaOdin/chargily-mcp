/**
 * Approval notification system
 */

import type { ApprovalRequest } from './types';

export interface NotificationChannel {
  send(notification: ApprovalNotification): Promise<void>;
}

export interface ApprovalNotification {
  type: 'approval_requested' | 'approval_decided' | 'approval_expired';
  request: ApprovalRequest;
  recipients: string[];
  metadata?: Record<string, any>;
}

/**
 * Email notification channel (stub)
 */
export class EmailNotifier implements NotificationChannel {
  async send(notification: ApprovalNotification): Promise<void> {
    // In production, integrate with email service (SendGrid, SES, etc.)
    console.log('[Email] Sending approval notification:', {
      type: notification.type,
      requestId: notification.request.id,
      recipients: notification.recipients,
    });
  }
}

/**
 * Webhook notification channel
 */
export class WebhookNotifier implements NotificationChannel {
  constructor(private webhookUrl: string) {}

  async send(notification: ApprovalNotification): Promise<void> {
    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(notification),
      });
    } catch (error) {
      console.error('[Webhook] Failed to send notification:', error);
    }
  }
}

/**
 * Slack notification channel (stub)
 */
export class SlackNotifier implements NotificationChannel {
  constructor(private webhookUrl: string) {}

  async send(notification: ApprovalNotification): Promise<void> {
    const message = this.formatSlackMessage(notification);

    try {
      await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });
    } catch (error) {
      console.error('[Slack] Failed to send notification:', error);
    }
  }

  private formatSlackMessage(notification: ApprovalNotification): any {
    const { request } = notification;

    return {
      text: `Approval ${notification.type}`,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*Approval Request: ${request.action}*\nTier: ${request.tier}\nStatus: ${request.status}`,
          },
        },
        {
          type: 'section',
          fields: [
            {
              type: 'mrkdwn',
              text: `*Requested by:*\n${request.requestedBy.userId}`,
            },
            {
              type: 'mrkdwn',
              text: `*Required Approvers:*\n${request.requiredApprovers}`,
            },
          ],
        },
      ],
    };
  }
}

/**
 * Multi-channel notifier
 */
export class ApprovalNotifier {
  private channels: NotificationChannel[] = [];

  addChannel(channel: NotificationChannel): void {
    this.channels.push(channel);
  }

  async notify(notification: ApprovalNotification): Promise<void> {
    await Promise.all(
      this.channels.map((channel) => channel.send(notification))
    );
  }

  async notifyApprovalRequested(
    request: ApprovalRequest,
    recipients: string[]
  ): Promise<void> {
    await this.notify({
      type: 'approval_requested',
      request,
      recipients,
    });
  }

  async notifyApprovalDecided(
    request: ApprovalRequest,
    recipients: string[]
  ): Promise<void> {
    await this.notify({
      type: 'approval_decided',
      request,
      recipients,
    });
  }

  async notifyApprovalExpired(
    request: ApprovalRequest,
    recipients: string[]
  ): Promise<void> {
    await this.notify({
      type: 'approval_expired',
      request,
      recipients,
    });
  }
}
