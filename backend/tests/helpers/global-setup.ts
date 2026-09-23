import path from 'node:path';
import { compileStrapi } from '@strapi/strapi';

export default async function globalSetup(): Promise<void> {
  await compileStrapi({ appDir: path.resolve(__dirname, '..', '..') });
}
