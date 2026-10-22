export const userRoles = ['user', 'admin'] as const;

export type UserRole = (typeof userRoles)[number];

export const defaultUserRole: UserRole = 'user';

export function isAdmin(user: { role?: string | null | undefined } | null | undefined): boolean {
  return user?.role === 'admin';
}
