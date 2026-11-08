import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { app } from '../../src/app.js';
import { User } from '../../src/models/User.js';
import { setupTestDb, teardownTestDb } from '../helpers/testDb.js';
import { seed } from '../../src/seed/index.js';
import { env } from '../../src/config/env.js';

describe('Auth Module Integration Tests', () => {
  beforeAll(async () => {
    await setupTestDb();
    await seed(env.MONGODB_TEST_URI);
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  describe('POST /api/v1/auth/login', () => {
    it('authenticates valid credentials, returns profile, and sets httpOnly cookie', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@school.demo', password: 'Demo@12345' });

      expect(res.status).toBe(200);
      expect(res.body.user).toMatchObject({
        email: 'admin@school.demo',
        role: 'ADMIN',
        fullName: 'Administrator',
      });

      // Verify cookie
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/auth_token=/);
      expect(cookies[0]).toMatch(/HttpOnly/i);
      expect(cookies[0]).toMatch(/SameSite=Lax/i);
    });

    it('returns generic error on wrong password without leaking account existence', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'admin@school.demo', password: 'WrongPassword' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.detail).toBe('Invalid email or password');
    });

    it('returns identical generic error on non-existent email', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'nonexistent@school.demo', password: 'WrongPassword' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_CREDENTIALS');
      expect(res.body.detail).toBe('Invalid email or password');
    });

    it('locks account after max failed login attempts', async () => {
      const targetEmail = 'teacher5@school.demo';

      // 5 consecutive wrong passwords
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v1/auth/login')
          .send({ email: targetEmail, password: 'BadPassword' });
      }

      // Next attempt should report account locked
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: targetEmail, password: 'Demo@12345' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('ACCOUNT_LOCKED');
      expect(res.body.detail).toMatch(/Account is locked/i);

      // Clean up lockout for subsequent test stability
      await User.updateOne(
        { email: targetEmail },
        { $set: { failed_logins: 0, locked_until: null } }
      );
    });

    it('rejects deactivated user accounts', async () => {
      const deactEmail = 'teacher6@school.demo';
      await User.updateOne({ email: deactEmail }, { $set: { is_active: false } });

      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: deactEmail, password: 'Demo@12345' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('ACCOUNT_DEACTIVATED');
      expect(res.body.detail).toMatch(/deactivated/i);

      // Restore active status
      await User.updateOne({ email: deactEmail }, { $set: { is_active: true } });
    });
  });

  describe('GET /api/v1/auth/me', () => {
    it('returns current user profile when valid auth token is provided', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'teacher1@school.demo', password: 'Demo@12345' });

      const cookie = loginRes.headers['set-cookie'];

      const meRes = await request(app).get('/api/v1/auth/me').set('Cookie', cookie);

      expect(meRes.status).toBe(200);
      expect(meRes.body.user).toMatchObject({
        email: 'teacher1@school.demo',
        role: 'TEACHER',
        fullName: 'John Doe',
      });
      expect(meRes.body.user.teacherId).toBeDefined();
    });

    it('rejects unauthenticated request without cookie or header', async () => {
      const res = await request(app).get('/api/v1/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('TOKEN_REQUIRED');
    });

    it('rejects tampered JWT token', async () => {
      const tamperedToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered.signature';
      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', tamperedToken);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('TOKEN_INVALID');
    });

    it('rejects expired JWT token', async () => {
      // Craft expired token
      const expiredToken = jwt.sign(
        { sub: 'user-id', email: 'test@school.demo', role: 'ADMIN', fullName: 'Tester' },
        env.JWT_SECRET,
        { expiresIn: '-1s' }
      );

      const res = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('TOKEN_EXPIRED');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('clears auth_token cookie on logout', async () => {
      const res = await request(app).post('/api/v1/auth/logout');

      expect(res.status).toBe(200);
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toMatch(/auth_token=;/);
    });
  });

  describe('POST /api/v1/auth/change-password', () => {
    it('successfully changes password with valid current credentials', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'teacher3@school.demo', password: 'Demo@12345' });

      const cookie = loginRes.headers['set-cookie'];

      const changeRes = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Cookie', cookie)
        .send({
          currentPassword: 'Demo@12345',
          newPassword: 'NewSecurePassword@123',
        });

      expect(changeRes.status).toBe(200);

      // Verify login with new password succeeds
      const newLoginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'teacher3@school.demo', password: 'NewSecurePassword@123' });
      expect(newLoginRes.status).toBe(200);

      // Restore password
      await request(app)
        .post('/api/v1/auth/change-password')
        .set('Cookie', newLoginRes.headers['set-cookie'])
        .send({
          currentPassword: 'NewSecurePassword@123',
          newPassword: 'Demo@12345',
        });
    });

    it('rejects password change if current password is wrong', async () => {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'teacher4@school.demo', password: 'Demo@12345' });

      const cookie = loginRes.headers['set-cookie'];

      const changeRes = await request(app)
        .post('/api/v1/auth/change-password')
        .set('Cookie', cookie)
        .send({
          currentPassword: 'IncorrectPassword',
          newPassword: 'NewSecurePassword@123',
        });

      expect(changeRes.status).toBe(401);
      expect(changeRes.body.code).toBe('INVALID_CURRENT_PASSWORD');
    });
  });
});

