import { randomBytes } from 'node:crypto';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'framenine';
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24시간

// 유효한 토큰: Map<token, expiresAt>
const tokens = new Map();

/**
 * 비밀번호 검증 후 토큰 발급
 */
export function login(password) {
  if (password !== ADMIN_PASSWORD) return null;

  const token = randomBytes(32).toString('hex');
  tokens.set(token, Date.now() + TOKEN_TTL_MS);
  return token;
}

/**
 * 토큰 유효성 검사
 */
export function verifyToken(token) {
  if (!token) return false;
  const expiresAt = tokens.get(token);
  if (!expiresAt) return false;
  if (Date.now() > expiresAt) {
    tokens.delete(token);
    return false;
  }
  return true;
}

/**
 * Fastify 훅: Authorization: Bearer <token> 검사
 */
export async function requireAuth(request, reply) {
  const auth = request.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!verifyToken(token)) {
    return reply.code(401).send({ error: 'Unauthorized' });
  }
}
