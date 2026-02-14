// Base event interface
export interface BaseEvent {
  eventType: string;
  userId: string;
  userEmail?: string;
  userPhone?: string;
  timestamp: Date;
  data: any;
}

// Event types enum
export enum EventTypes {
  // User events
  USER_CREATED = 'user.user.created',
  USER_UPDATED = 'user.user.updated',
  USER_DELETED = 'user.user.deleted',
  USER_EMAIL_VERIFIED = 'user.email.verified',
  USER_PASSWORD_CHANGED = 'user.password.changed',

  // Auth events
  AUTH_USER_REGISTERED = 'auth.user.registered',
  AUTH_EMAIL_VERIFICATION_REQUESTED = 'auth.email.verification.requested',
  AUTH_PASSWORD_RESET_REQUESTED = 'auth.password.reset.requested',
  AUTH_PASSWORD_RESET_COMPLETED = 'auth.password.reset.completed',

  // Order events
  ORDER_CREATED = 'order.created',
  ORDER_CANCELLED = 'order.cancelled',
  ORDER_DELIVERED = 'order.delivered',
  PAYMENT_RECEIVED = 'payment.received',
  PAYMENT_FAILED = 'payment.failed',

  // User profile events
  USER_PROFILE_PASSWORD_CHANGED = 'profile.password_changed',
  USER_PROFILE_NOTIFICATION_PREFERENCES_UPDATED = 'profile.notification_preferences_updated',
  USER_PROFILE_BANK_DETAILS_UPDATED = 'profile.bank_details_updated',

  // Notification outcome events (published by notification-service for audit)
  NOTIFICATION_SENT = 'notification.sent',
  NOTIFICATION_FAILED = 'notification.failed',
}

// Specific event interfaces
export interface UserEvent extends BaseEvent {
  eventType:
    | EventTypes.USER_CREATED
    | EventTypes.USER_UPDATED
    | EventTypes.USER_DELETED
    | EventTypes.USER_EMAIL_VERIFIED
    | EventTypes.USER_PASSWORD_CHANGED;
  data: {
    userId: string;
    email: string;
    name?: string;
    isEmailVerified?: boolean;
    role?: string;
    createdAt?: string;
    updatedAt?: string;
  };
}

export interface AuthEvent extends BaseEvent {
  eventType:
    | EventTypes.AUTH_USER_REGISTERED
    | EventTypes.AUTH_EMAIL_VERIFICATION_REQUESTED
    | EventTypes.AUTH_PASSWORD_RESET_REQUESTED
    | EventTypes.AUTH_PASSWORD_RESET_COMPLETED;
  data: {
    username?: string;
    email?: string;
    verificationToken?: string;
    resetToken?: string;
  };
}

export interface OrderEvent extends BaseEvent {
  eventType: EventTypes.ORDER_CREATED | EventTypes.ORDER_CANCELLED | EventTypes.ORDER_DELIVERED;
  data: {
    orderId: string;
    orderNumber: string;
    amount?: number;
    items?: any[];
  };
}

export interface PaymentEvent extends BaseEvent {
  eventType: EventTypes.PAYMENT_RECEIVED | EventTypes.PAYMENT_FAILED;
  data: {
    orderId: string;
    paymentId: string;
    amount: number;
    reason?: string; // For failed payments
  };
}

export interface UserProfileEvent extends BaseEvent {
  eventType:
    | EventTypes.USER_PROFILE_PASSWORD_CHANGED
    | EventTypes.USER_PROFILE_NOTIFICATION_PREFERENCES_UPDATED
    | EventTypes.USER_PROFILE_BANK_DETAILS_UPDATED;
  data: {
    field: string;
    oldValue?: any;
    newValue?: any;
  };
}

export interface NotificationOutcomeEvent extends BaseEvent {
  eventType: EventTypes.NOTIFICATION_SENT | EventTypes.NOTIFICATION_FAILED;
  data: {
    notificationId: string;
    originalEventType: string; // The original event that triggered this notification
    channel: 'email' | 'sms' | 'push' | 'webhook';
    recipientEmail?: string;
    recipientPhone?: string;
    subject?: string;
    errorMessage?: string; // For failed notifications
    attemptNumber: number;
  };
}

// Union type for all events
export type NotificationEvent = UserEvent | AuthEvent | OrderEvent | PaymentEvent | UserProfileEvent;
