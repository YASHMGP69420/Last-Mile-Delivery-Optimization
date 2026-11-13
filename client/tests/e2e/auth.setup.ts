import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { request } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const AUTH_DIR = join(__dirname, '.auth');

// Ensure auth directory exists
if (!existsSync(AUTH_DIR)) {
  mkdirSync(AUTH_DIR, { recursive: true });
}

// Test user credentials for each role
export const testUsers = {
  admin: {
    email: 'admin@smartroute.test',
    password: 'TestPass123!',
    role: 'ADMIN',
    storageState: join(AUTH_DIR, 'admin.json'),
  },
  manager: {
    email: 'manager@smartroute.test',
    password: 'TestPass123!',
    role: 'FLEET_MANAGER',
    storageState: join(AUTH_DIR, 'manager.json'),
  },
  driver: {
    email: 'driver@smartroute.test',
    password: 'TestPass123!',
    role: 'DRIVER',
    storageState: join(AUTH_DIR, 'driver.json'),
  },
};

async function loginAndSaveStorageState(requestContext: any, user: typeof testUsers.admin) {
  // Login via API
  const loginResponse = await requestContext.post('/api/v1/auth/login', {
    data: {
      email: user.email,
      password: user.password,
    },
  });

  if (!loginResponse.ok()) {
    throw new Error(`Login failed for ${user.email}: ${loginResponse.status()}`);
  }

  const loginData = await loginResponse.json();
  // API returns 'token' not 'accessToken'
  const { token, refreshToken, user: userData } = loginData.data;

  // Debug logging
  console.log(`[AuthSetup] ${user.email} login data:`, {
    hasToken: !!token,
    hasRefreshToken: !!refreshToken,
    hasUserData: !!userData,
    userDataKeys: userData ? Object.keys(userData) : null,
  });

  // Verify role matches
  if (userData.role !== user.role) {
    throw new Error(`Role mismatch for ${user.email}: expected ${user.role}, got ${userData.role}`);
  }

  // Ensure all values are strings
  const tokenStr = String(token);
  const refreshTokenStr = String(refreshToken);
  const userDataStr = JSON.stringify(userData);

  // Create storage state with tokens
  const storageState = {
    cookies: [],
    origins: [
      {
        origin: 'http://localhost:5173',
        localStorage: [
          { name: 'accessToken', value: tokenStr },
          { name: 'refreshToken', value: refreshTokenStr },
          { name: 'user', value: userDataStr },
        ],
      },
    ],
  };

  // Save storage state
  writeFileSync(user.storageState, JSON.stringify(storageState, null, 2));
  console.log(`Saved ${user.role} storage state to ${user.storageState}`);

  return { token, refreshToken, user: userData };
}

export default async function globalSetup(config: any) {
  // Create API request context for global setup
  const requestContext = await request.newContext({
    baseURL: 'http://localhost:5004',
  });

  await loginAndSaveStorageState(requestContext, testUsers.admin);
  await loginAndSaveStorageState(requestContext, testUsers.manager);
  await loginAndSaveStorageState(requestContext, testUsers.driver);

  await requestContext.dispose();
}