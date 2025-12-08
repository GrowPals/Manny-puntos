import { supabase } from '@/lib/customSupabaseClient';

/**
 * Niveles de log (uso interno)
 */
const LogLevel = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
};

/**
 * Tipos de eventos para auditoría (solo los que se usan realmente)
 */
export const EventType = {
  // Sync events - actively used
  SYNC_QUEUED: 'sync.queued',

  // Gift events - used
  GIFT_CLAIMED: 'gift.claimed',
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
   * Helper para eventos de gift (usado)
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

  /**
   * Helper para sync queued (usado)
   */
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
}

// Export singleton instance
export const logger = new Logger();
export default logger;
