/**
 * Notification service stub.
 * Will support: browser push, in-app toasts, WebSocket real-time.
 */

export type NotificationChannel = 'in_app' | 'push' | 'email' | 'sms';
export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface NotificationPayload {
  title: string;
  body: string;
  priority: NotificationPriority;
  channels?: NotificationChannel[];
  data?: Record<string, unknown>;
}

export const notificationService = {
  /** Send a notification (stub) */
  async send(_payload: NotificationPayload): Promise<void> {
    // TODO: implement when notification module is built
  },

  /** Request browser push permission (stub) */
  async requestPermission(): Promise<NotificationPermission> {
    if ('Notification' in window) {
      return Notification.requestPermission();
    }
    return 'denied';
  },

  /** Subscribe to real-time notifications via WebSocket (stub) */
  subscribe(_userId: string, _onNotification: (n: NotificationPayload) => void): () => void {
    // TODO: implement WebSocket subscription
    return () => {}; // unsubscribe fn
  },
};
