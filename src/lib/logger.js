import { supabase } from '@/lib/customSupabaseClient';

/**
 * Niveles de log
 */
export const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
};

/**
 * Tipos de eventos para auditoría
 */
export const EventType = {
  // Auth events
  LOGIN_SUCCESS: 'auth.login_success',
  LOGIN_FAILED: 'auth.login_failed',
  LOGOUT: 'auth.logout',
  PIN_REGISTERED: 'auth.pin_registered',

  // Gift events
  GIFT_VIEWED: 'gift.viewed',
  GIFT_CLAIMED: 'gift.claimed',
  GIFT_CLAIM_FAILED: 'gift.claim_failed',

  // Referral events
  REFERRAL_APPLIED: 'referral.applied',
  REFERRAL_FAILED: 'referral.failed',

  // Sync events
  SYNC_QUEUED: 'sync.queued',
  SYNC_COMPLETED: 'sync.completed',
  SYNC_FAILED: 'sync.failed',

  // Redemption events
  REDEMPTION_SUCCESS: 'redemption.success',
  REDEMPTION_FAILED: 'redemption.failed',
};

/**
 * Logger estructurado para operaciones críticas
 * Envía logs a consola y opcionalmente a Supabase audit_log
 */
class Logger {
  constructor() {
    this.isProduction = import.meta.env.PROD;
  }

  /**
   * Log a consola con formato estructurado
   */
  _consoleLog(level, message, data = {}) {
    const timestamp = new Date().toISOString();
    const logData = {
      timestamp,
      level,
      message,
      ...data,
    };

    switch (level) {
      case LogLevel.ERROR:
        console.error(`[${timestamp}] ERROR:`, message, data);
        break;
      case LogLevel.WARN:
        console.warn(`[${timestamp}] WARN:`, message, data);
        break;
      case LogLevel.INFO:
        console.info(`[${timestamp}] INFO:`, message, data);
        break;
      case LogLevel.DEBUG:
        if (!this.isProduction) {
          console.debug(`[${timestamp}] DEBUG:`, message, data);
        }
        break;
      default:
        console.log(`[${timestamp}]:`, message, data);
    }

    return logData;
  }

  /**
   * Envía evento a audit_log en Supabase (fire and forget)
   */
  async _sendToAuditLog(eventType, entityType, entityId, action, details, clienteId, success, errorMessage) {
    try {
      await supabase.rpc('log_audit_event', {
        p_event_type: eventType,
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_action: action,
        p_details: details,
        p_cliente_id: clienteId,
        p_success: success,
        p_error_message: errorMessage,
      });
    } catch (err) {
      // Don't throw - logging should never break the app
      console.warn('Failed to send audit log:', err.message);
    }
  }

  // Public methods

  debug(message, data = {}) {
    return this._consoleLog(LogLevel.DEBUG, message, data);
  }

  info(message, data = {}) {
    return this._consoleLog(LogLevel.INFO, message, data);
  }

  warn(message, data = {}) {
    return this._consoleLog(LogLevel.WARN, message, data);
  }

  error(message, data = {}) {
    return this._consoleLog(LogLevel.ERROR, message, data);
  }

  /**
   * Log de evento de auditoría (se guarda en Supabase)
   */
  audit({
    eventType,
    entityType,
    entityId = null,
    action,
    details = {},
    clienteId = null,
    success = true,
    errorMessage = null,
  }) {
    // Log to console
    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    this._consoleLog(level, `[AUDIT] ${eventType}: ${action}`, {
      entityType,
      entityId,
      details,
      success,
      errorMessage,
    });

    // Send to Supabase (fire and forget)
    this._sendToAuditLog(
      eventType,
      entityType,
      entityId,
      action,
      details,
      clienteId,
      success,
      errorMessage
    );
  }

  /**
   * Helpers para eventos comunes
   */
  giftClaimed(giftId, clienteId, details = {}) {
    this.audit({
      eventType: EventType.GIFT_CLAIMED,
      entityType: 'gift',
      entityId: giftId,
      action: 'Gift claimed successfully',
      details,
      clienteId,
      success: true,
    });
  }

  giftClaimFailed(giftId, clienteId, error, details = {}) {
    this.audit({
      eventType: EventType.GIFT_CLAIM_FAILED,
      entityType: 'gift',
      entityId: giftId,
      action: 'Gift claim failed',
      details,
      clienteId,
      success: false,
      errorMessage: error,
    });
  }

  referralApplied(referralId, clienteId, details = {}) {
    this.audit({
      eventType: EventType.REFERRAL_APPLIED,
      entityType: 'referral',
      entityId: referralId,
      action: 'Referral code applied',
      details,
      clienteId,
      success: true,
    });
  }

  syncQueued(resourceId, operationType, details = {}) {
    this.audit({
      eventType: EventType.SYNC_QUEUED,
      entityType: 'sync',
      entityId: resourceId,
      action: `Sync queued: ${operationType}`,
      details,
      success: true,
    });
  }

  syncFailed(resourceId, operationType, error, details = {}) {
    this.audit({
      eventType: EventType.SYNC_FAILED,
      entityType: 'sync',
      entityId: resourceId,
      action: `Sync failed: ${operationType}`,
      details,
      success: false,
      errorMessage: error,
    });
  }
}

// Export singleton instance
export const logger = new Logger();
export default logger;
