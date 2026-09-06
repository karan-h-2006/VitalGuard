import { jwtVerify, SignJWT } from 'jose';
import { env } from '../env.js';

export type AuthRole = 'patient' | 'caregiver' | 'doctor' | 'administrator';
export type AuthUser = { userId: string; role: AuthRole; patientId?: string };

const signingKey = new TextEncoder().encode(env.JWT_SECRET);

export async function signToken(user: Pick<AuthUser, 'userId' | 'role'>): Promise<string> {
  return new SignJWT(user.role === 'patient' ? { role: user.role, patientId: user.userId } : { role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.userId)
    .setIssuedAt()
    .setExpirationTime(env.JWT_EXPIRES_IN)
    .sign(signingKey);
}

export async function verifyToken(token: string): Promise<AuthUser> {
  const { payload } = await jwtVerify(token, signingKey, { algorithms: ['HS256'] });
  const userId = payload.sub;
  const role = payload.role;
  if (
    typeof userId !== 'string' ||
    !['patient', 'caregiver', 'doctor', 'administrator'].includes(String(role))
  ) {
    throw new Error('invalid token claims');
  }
  return {
    userId,
    role: role as AuthRole,
    ...(role === 'patient' ? { patientId: userId } : {}),
  };
}
