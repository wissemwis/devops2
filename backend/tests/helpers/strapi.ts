import fs from 'node:fs';
import path from 'node:path';
import { createStrapi } from '@strapi/strapi';
import type { Core } from '@strapi/strapi';

const appDir = path.resolve(__dirname, '..', '..');
const TEST_DATABASE_FILE = path.join(appDir, '.tmp', 'test.db');

const TEST_ENV = {
  NODE_ENV: 'test',
  DATABASE_CLIENT: 'sqlite',
  DATABASE_FILENAME: '.tmp/test.db',
  APP_KEYS: 'testKeyA,testKeyB',
  ADMIN_JWT_SECRET: 'test-admin-jwt-secret',
  API_TOKEN_SALT: 'test-api-token-salt',
  TRANSFER_TOKEN_SALT: 'test-transfer-token-salt',
  ENCRYPTION_KEY: 'test-encryption-key',
  JWT_SECRET: 'test-jwt-secret',
  LOG_LEVEL: 'error',
};

let instance: Core.Strapi | undefined;

export async function setupStrapi(): Promise<Core.Strapi> {
  if (instance) return instance;
  Object.assign(process.env, TEST_ENV);
  fs.rmSync(TEST_DATABASE_FILE, { force: true });
  instance = await createStrapi({
    appDir,
    distDir: path.join(appDir, 'dist'),
    serveAdminPanel: false,
  }).load();
  await instance.server.mount();
  return instance;
}

export async function teardownStrapi(): Promise<void> {
  if (!instance) return;
  await instance.destroy();
  instance = undefined;
  fs.rmSync(TEST_DATABASE_FILE, { force: true });
}
