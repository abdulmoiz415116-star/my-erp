/**
 * Firebase Admin SDK Architecture Stub
 *
 * IMPORTANT SECURITY NOTE:
 * Firebase Admin credentials MUST NEVER be bundled into client-side code.
 * This module is strictly designed for Server Actions, API routes, or Firebase Cloud Functions.
 */

export interface FirebaseAdminConfig {
  projectId: string;
  clientEmail: string;
  privateKey: string;
}

export function getAdminConfig(): FirebaseAdminConfig | null {
  if (typeof window !== 'undefined') {
    throw new Error('Firebase Admin SDK cannot be accessed on the client side.');
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!projectId || !clientEmail || !privateKey) {
    return null;
  }

  return { projectId, clientEmail, privateKey };
}
