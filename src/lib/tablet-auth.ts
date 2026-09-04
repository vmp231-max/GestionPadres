import crypto from 'crypto';

/**
 * Obtiene la clave secreta del servidor para firmar tokens HMAC de la tablet.
 * En producción debe configurarse TABLET_SESSION_SECRET en .env.local.
 */
function getSessionSecret(): string {
  const secret = process.env.TABLET_SESSION_SECRET 
    || process.env.SUPABASE_SERVICE_ROLE_KEY 
    || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY 
    || 'fallback_tablet_secret_salt_9931827419';
  return secret;
}

export interface VerifiedTabletSession {
  valid: boolean;
  accountId?: string;
  expiresAt?: number;
  error?: string;
}

/**
 * Genera un token firmado con HMAC-SHA256 para la sesión de la tablet.
 * Formato: <expiresAt>.<accountId>.<signatureHex>
 */
export function generateTabletToken(accountId: string, expiresAt: number): string {
  const secret = getSessionSecret();
  const payload = `${expiresAt}:${accountId}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${expiresAt}.${accountId}.${signature}`;
}

/**
 * Verifica estrictamente un token de sesión de la tablet en el servidor.
 * Comprueba:
 * 1. Formato correcto (3 partes)
 * 2. Fecha de expiración válida y no vencida
 * 3. Firma HMAC idéntica mediante comparación de tiempo constante (timingSafeEqual)
 */
export function verifyTabletToken(token: string | null | undefined): VerifiedTabletSession {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token no proporcionado.' };
  }

  const parts = token.split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Formato de token no válido.' };
  }

  const [expiresAtStr, accountId, providedSignature] = parts;
  const expiresAt = parseInt(expiresAtStr, 10);

  if (isNaN(expiresAt)) {
    return { valid: false, error: 'Fecha de expiración inválida en el token.' };
  }

  if (Date.now() >= expiresAt) {
    return { valid: false, error: 'La sesión de la tablet ha expirado.' };
  }

  if (!accountId || !providedSignature) {
    return { valid: false, error: 'Campos requeridos ausentes en el token.' };
  }

  // Recalcular la firma esperada con el secreto del servidor
  const secret = getSessionSecret();
  const payload = `${expiresAt}:${accountId}`;
  const expectedSignature = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  // Comparación segura contra ataques de temporización (timing attack resistance)
  try {
    const provBuffer = Buffer.from(providedSignature, 'hex');
    const expBuffer = Buffer.from(expectedSignature, 'hex');

    if (provBuffer.length !== expBuffer.length || !crypto.timingSafeEqual(provBuffer, expBuffer)) {
      return { valid: false, error: 'Firma de seguridad inválida. El token ha sido manipulado.' };
    }
  } catch (err) {
    return { valid: false, error: 'Error al verificar la firma criptográfica.' };
  }

  return {
    valid: true,
    accountId,
    expiresAt,
  };
}
