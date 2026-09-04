/**
 * Limitador de tasa (Rate Limiter) en memoria para Next.js App Router.
 * Protege endpoints críticos como la verificación de PIN frente a ataques de fuerza bruta.
 */

interface RateLimitEntry {
  attempts: number;
  blockedUntil: number | null;
  firstAttemptAt: number;
  lastAttemptAt: number;
}

// Mapa en memoria para almacenar intentos por clave (IP)
const store = new Map<string, RateLimitEntry>();

// Limpieza periódica de entradas antiguas cada 10 minutos para evitar fugas de memoria
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      // Eliminar entradas inactivas tras 30 minutos
      if (now - entry.lastAttemptAt > 30 * 60 * 1000 && (!entry.blockedUntil || now > entry.blockedUntil)) {
        store.delete(key);
      }
    }
  }, 10 * 60 * 1000);
}

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  blockedSeconds: number;
  error?: string;
}

/**
 * Obtiene la dirección IP del cliente a partir de las cabeceras estándar de la petición.
 */
export function getClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }
  const cfConnectingIp = req.headers.get('cf-connecting-ip');
  if (cfConnectingIp) {
    return cfConnectingIp.trim();
  }
  return 'unknown_ip';
}

/**
 * Comprueba si una clave (normalmente IP) tiene permitido realizar un intento.
 * 
 * @param key Identificador único (IP del cliente)
 * @param maxAttempts Número máximo de intentos antes de bloquear (por defecto: 5)
 * @param blockDurationMs Duración del bloqueo en ms si se alcanza el máximo (por defecto: 15 minutos)
 * @param windowMs Ventana de tiempo en la que se cuentan los intentos (por defecto: 15 minutos)
 */
export function checkRateLimit(
  key: string,
  maxAttempts = 5,
  blockDurationMs = 15 * 60 * 1000,
  windowMs = 15 * 60 * 1000
): RateLimitResult {
  const now = Date.now();
  const entry = store.get(key);

  if (!entry) {
    return {
      allowed: true,
      remainingAttempts: maxAttempts,
      blockedSeconds: 0,
    };
  }

  // Comprobar si actualmente está bloqueado
  if (entry.blockedUntil && now < entry.blockedUntil) {
    const blockedSeconds = Math.ceil((entry.blockedUntil - now) / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      blockedSeconds,
      error: `Demasiados intentos fallidos. Acceso bloqueado temporalmente por seguridad. Inténtalo de nuevo en ${Math.ceil(blockedSeconds / 60)} minutos.`,
    };
  }

  // Si la ventana de tiempo ha expirado, reiniciar
  if (now - entry.firstAttemptAt > windowMs) {
    store.delete(key);
    return {
      allowed: true,
      remainingAttempts: maxAttempts,
      blockedSeconds: 0,
    };
  }

  const remaining = Math.max(0, maxAttempts - entry.attempts);
  if (remaining === 0) {
    // Si ya agotó los intentos pero no tenía blockedUntil explícito
    entry.blockedUntil = now + blockDurationMs;
    const blockedSeconds = Math.ceil(blockDurationMs / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      blockedSeconds,
      error: `Has superado el límite de ${maxAttempts} intentos. Acceso bloqueado durante ${Math.ceil(blockedSeconds / 60)} minutos.`,
    };
  }

  return {
    allowed: true,
    remainingAttempts: remaining,
    blockedSeconds: 0,
  };
}

/**
 * Registra un intento fallido para la clave especificada.
 */
export function recordFailedAttempt(
  key: string,
  maxAttempts = 5,
  blockDurationMs = 15 * 60 * 1000,
  windowMs = 15 * 60 * 1000
): RateLimitResult {
  const now = Date.now();
  let entry = store.get(key);

  if (!entry || now - entry.firstAttemptAt > windowMs) {
    entry = {
      attempts: 1,
      blockedUntil: null,
      firstAttemptAt: now,
      lastAttemptAt: now,
    };
  } else {
    entry.attempts += 1;
    entry.lastAttemptAt = now;
  }

  if (entry.attempts >= maxAttempts) {
    entry.blockedUntil = now + blockDurationMs;
    store.set(key, entry);
    const blockedSeconds = Math.ceil(blockDurationMs / 1000);
    return {
      allowed: false,
      remainingAttempts: 0,
      blockedSeconds,
      error: `Has superado el límite de ${maxAttempts} intentos fallidos. Acceso bloqueado durante ${Math.ceil(blockedSeconds / 60)} minutos para prevenir accesos no autorizados.`,
    };
  }

  store.set(key, entry);
  const remaining = maxAttempts - entry.attempts;

  return {
    allowed: true,
    remainingAttempts: remaining,
    blockedSeconds: 0,
    error: `PIN incorrecto. Te quedan ${remaining} ${remaining === 1 ? 'intento' : 'intentos'}.`,
  };
}

/**
 * Restablece los intentos tras una autenticación exitosa.
 */
export function resetRateLimit(key: string): void {
  store.delete(key);
}
