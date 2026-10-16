import argon2 from 'argon2';

export const MINIMUM_PASSWORD_LENGTH = 8;
export const PASSWORD_REQUIREMENTS_MESSAGE =
  'Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, and one number';

export function isStrongPassword(password: string): boolean {
  return (
    password.length >= MINIMUM_PASSWORD_LENGTH &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /\d/.test(password)
  );
}

export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, { type: argon2.argon2id });
}

export async function verifyPassword(
  passwordHash: string,
  password: string,
): Promise<boolean> {
  return argon2.verify(passwordHash, password);
}
