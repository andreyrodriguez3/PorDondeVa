import { INestApplication } from '@nestjs/common';
import request from 'supertest';

export const ADMIN_HOST = 'admin.tubus.example';

export async function loginAs(
  app: INestApplication,
  email: string,
  password: string,
): Promise<string> {
  const res = await request(app.getHttpServer())
    .post('/auth/login')
    .set('X-Tenant-Host', ADMIN_HOST)
    .send({ email, password });
  return res.body.tokens.accessToken;
}
