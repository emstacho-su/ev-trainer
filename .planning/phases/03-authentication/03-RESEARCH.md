# Phase 3: Authentication - Research

**Researched:** 2026-02-09
**Domain:** Express.js JWT Authentication, OAuth 2.0, Email Verification
**Confidence:** HIGH

## Summary

This phase implements a complete authentication system for the EV Trainer application, enabling user registration, login, OAuth social logins (Google/GitHub), email verification, password reset, and session persistence across devices. The existing infrastructure includes Express 5.x, Prisma 7.x with PostgreSQL, and an existing User model with email, passwordHash, oauthProvider fields.

The recommended approach uses stateless JWT access tokens (short-lived, 15 minutes) paired with stateful refresh tokens stored in the database. This hybrid approach provides the performance benefits of JWTs while enabling token revocation. For password hashing, Argon2id is the gold standard for new applications. OAuth flows use the standard authorization code grant with PKCE and state parameter for CSRF protection. Email verification and password reset use time-limited tokens sent via a transactional email service.

**Primary recommendation:** Use `jose` for JWT operations (modern, zero-deps, TypeScript-native), `argon2` for password hashing, `resend` for transactional emails, and manual OAuth implementation (avoid Passport.js overhead since only 2 providers needed).

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| jose | 6.1.3 | JWT signing/verification | Modern ESM, zero deps, TypeScript, secure defaults, active maintenance |
| argon2 | 0.44.0 | Password hashing | Winner of Password Hashing Competition, memory-hard, configurable |
| resend | latest | Transactional email | Modern API, developer-friendly, simple setup, good deliverability |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| crypto (built-in) | Node.js | Secure random token generation | Email verification tokens, OAuth state |
| zod | 4.x | Request validation | Already in stack, validate auth payloads |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| jose | jsonwebtoken | jsonwebtoken is battle-tested but development slowed, lacks ESM |
| argon2 | bcrypt | bcrypt has 72-byte limit, argon2 is more resistant to GPU attacks |
| resend | nodemailer | nodemailer requires SMTP setup, more boilerplate |
| Manual OAuth | Passport.js | Passport adds complexity for only 2 OAuth providers |

**Installation:**
```bash
npm install jose argon2 resend
```

## Architecture Patterns

### Recommended Project Structure
```
src/server/
├── auth/
│   ├── auth.routes.ts       # POST /register, /login, /logout, /refresh
│   ├── auth.controller.ts   # Route handlers
│   ├── auth.service.ts      # Business logic (hash, verify, tokens)
│   ├── auth.middleware.ts   # requireAuth, optionalAuth middleware
│   └── auth.types.ts        # TokenPayload, AuthRequest interfaces
├── oauth/
│   ├── oauth.routes.ts      # GET /oauth/google, /oauth/github, callbacks
│   ├── oauth.controller.ts  # Initiate and callback handlers
│   ├── oauth.service.ts     # Exchange code for tokens, get user info
│   └── oauth.config.ts      # Client IDs, secrets, redirect URIs
├── email/
│   ├── email.service.ts     # Send verification, reset emails
│   └── email.templates.ts   # Email HTML templates
└── middleware/
    └── auth.middleware.ts   # Export requireAuth for other routes
```

### Pattern 1: Dual Token Strategy (Access + Refresh)
**What:** Short-lived access tokens (15 min) in memory/Authorization header, long-lived refresh tokens (7 days) in HttpOnly cookies stored in database.
**When to use:** All authenticated API requests.
**Example:**
```typescript
// Access token in Authorization header
const accessPayload = { sub: userId, email, type: 'access' };
const accessToken = await new SignJWT(accessPayload)
  .setProtectedHeader({ alg: 'HS256' })
  .setExpirationTime('15m')
  .setIssuedAt()
  .sign(secret);

// Refresh token in HttpOnly cookie, stored in DB
const refreshToken = crypto.randomBytes(32).toString('hex');
const refreshTokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
await prisma.refreshToken.create({
  data: { userId, tokenHash: refreshTokenHash, expiresAt: addDays(new Date(), 7) }
});

res.cookie('refreshToken', refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path: '/api/auth/refresh',
  maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
});
```

### Pattern 2: Auth Middleware with Request Extension
**What:** Middleware that verifies JWT and attaches user to request.
**When to use:** Any protected route.
**Example:**
```typescript
// Source: Express.js JWT middleware pattern
import { jwtVerify } from 'jose';

interface AuthRequest extends Request {
  user?: { userId: string; email: string };
}

export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: { code: 'UNAUTHORIZED', message: 'Missing token' } });
  }

  const token = authHeader.slice(7);
  try {
    const { payload } = await jwtVerify(token, secret, { algorithms: ['HS256'] });
    req.user = { userId: payload.sub as string, email: payload.email as string };
    next();
  } catch (err) {
    return res.status(401).json({ error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' } });
  }
}
```

### Pattern 3: OAuth Authorization Code Flow with State
**What:** Redirect to provider, receive code on callback, exchange for access token, get user info.
**When to use:** Google and GitHub OAuth logins.
**Example:**
```typescript
// Initiate OAuth - store state in cookie for CSRF protection
export function initiateGoogleAuth(req: Request, res: Response) {
  const state = crypto.randomBytes(16).toString('hex');
  res.cookie('oauth_state', state, { httpOnly: true, maxAge: 600000, sameSite: 'lax' });

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'openid email profile',
    state,
  });

  res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}

// Callback - validate state, exchange code
export async function googleCallback(req: Request, res: Response) {
  const { code, state } = req.query;
  const storedState = req.cookies.oauth_state;

  if (!state || state !== storedState) {
    return res.status(403).json({ error: { code: 'CSRF_FAILED', message: 'State mismatch' } });
  }

  res.clearCookie('oauth_state');
  // Exchange code for tokens...
}
```

### Pattern 4: Secure Token Generation for Email Flows
**What:** Cryptographically secure tokens with expiration for verification/reset.
**When to use:** Email verification, password reset.
**Example:**
```typescript
// Generate verification token
const token = crypto.randomBytes(32).toString('hex');
const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

await prisma.verificationToken.create({
  data: {
    identifier: email,
    token: tokenHash,
    expires: addHours(new Date(), 24), // 24 hour expiry
  },
});

// Send email with unhashed token
const verifyUrl = `${APP_URL}/verify-email?token=${token}`;
await sendVerificationEmail(email, verifyUrl);

// Verification - hash incoming token and compare
const tokenHash = crypto.createHash('sha256').update(incomingToken).digest('hex');
const record = await prisma.verificationToken.findUnique({
  where: { identifier_token: { identifier: email, token: tokenHash } },
});

if (!record || record.expires < new Date()) {
  throw new AppError(400, 'INVALID_TOKEN', 'Token expired or invalid');
}
```

### Anti-Patterns to Avoid
- **Storing JWTs in localStorage:** XSS vulnerable. Store access token in memory, refresh token in HttpOnly cookie.
- **Long-lived access tokens:** Use short expiry (15 min) + refresh tokens instead.
- **Raw refresh tokens in database:** Always hash before storing (SHA-256).
- **Skipping state parameter in OAuth:** CSRF vulnerability. Always validate state.
- **Email enumeration in error messages:** Always return same response whether email exists or not for forgot password.
- **Blocking secrets in code:** Use environment variables for JWT_SECRET, OAuth client secrets.

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | SHA256/MD5 | argon2 | Timing attacks, rainbow tables, no salt handling |
| JWT signing | Manual HMAC | jose library | Algorithm confusion attacks, timing vulnerabilities |
| Random tokens | Math.random() | crypto.randomBytes() | Math.random is not cryptographically secure |
| Email templates | String concatenation | Template literals with escaping | XSS in emails, maintainability |
| Rate limiting | Manual counters | express-rate-limit (already installed) | Edge cases, distributed state |

**Key insight:** Authentication is security-critical. Every hand-rolled component is a potential vulnerability. Use battle-tested libraries even for "simple" operations.

## Common Pitfalls

### Pitfall 1: JWT Algorithm Confusion
**What goes wrong:** Attacker changes alg header to "none" or switches RS256 to HS256.
**Why it happens:** Libraries accepting unsigned tokens or using public key as HMAC secret.
**How to avoid:** Always specify allowed algorithms explicitly in verification: `{ algorithms: ['HS256'] }`
**Warning signs:** Accepting tokens without specifying algorithm list.

### Pitfall 2: Refresh Token Reuse Detection Failure
**What goes wrong:** Stolen refresh token used indefinitely.
**Why it happens:** Not rotating tokens or detecting reuse.
**How to avoid:** Rotate refresh tokens on each use. If old token is used after rotation, revoke all user sessions (theft detected).
**Warning signs:** No token rotation, no reuse detection logic.

### Pitfall 3: Email Enumeration
**What goes wrong:** Attackers discover valid email addresses via different responses.
**Why it happens:** "Email not found" vs "Check your email" different responses.
**How to avoid:** Always return same response: "If this email exists, you'll receive a reset link."
**Warning signs:** Different HTTP status codes or messages for found vs not found emails.

### Pitfall 4: OAuth State Parameter Missing/Weak
**What goes wrong:** CSRF attacks on OAuth callback, login to attacker's account.
**Why it happens:** Skipping state parameter or using predictable values.
**How to avoid:** Use crypto.randomBytes(16), store in HttpOnly cookie, validate on callback with timing-safe comparison.
**Warning signs:** No state parameter, using session ID as state, not validating on callback.

### Pitfall 5: Password Reset Token Reuse
**What goes wrong:** Old password reset links still work after password is changed.
**Why it happens:** Not invalidating tokens after use.
**How to avoid:** Delete token record immediately after successful password reset. Set short expiry (1-4 hours).
**Warning signs:** Tokens not deleted on use, very long expiry times.

### Pitfall 6: Timing Attacks on Password Comparison
**What goes wrong:** Attackers infer password characters from response time differences.
**Why it happens:** Early return on first mismatched character in string comparison.
**How to avoid:** Use argon2.verify() which is timing-safe. Never compare passwords with === directly.
**Warning signs:** Manual password comparison, early returns in comparison logic.

## Code Examples

Verified patterns from official sources:

### Password Hashing with Argon2
```typescript
// Source: https://github.com/ranisalt/node-argon2
import argon2 from 'argon2';

// Hash password during registration
export async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id, // Recommended variant
    memoryCost: 65536,     // 64 MB
    timeCost: 3,           // 3 iterations
    parallelism: 4,        // 4 threads
  });
}

// Verify password during login
export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false; // Invalid hash format
  }
}
```

### JWT Creation and Verification with jose
```typescript
// Source: https://github.com/panva/jose
import { SignJWT, jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

export async function createAccessToken(userId: string, email: string): Promise<string> {
  return new SignJWT({ sub: userId, email, type: 'access' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .sign(secret);
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, secret, {
    algorithms: ['HS256'],
  });
  return payload;
}
```

### Sending Email with Resend
```typescript
// Source: https://resend.com/docs/send-with-nodejs
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendVerificationEmail(to: string, verifyUrl: string) {
  await resend.emails.send({
    from: 'EV Trainer <noreply@evtrainer.app>',
    to: [to],
    subject: 'Verify your email address',
    html: `
      <h1>Welcome to EV Trainer!</h1>
      <p>Click the link below to verify your email address:</p>
      <a href="${verifyUrl}">Verify Email</a>
      <p>This link expires in 24 hours.</p>
    `,
  });
}

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  await resend.emails.send({
    from: 'EV Trainer <noreply@evtrainer.app>',
    to: [to],
    subject: 'Reset your password',
    html: `
      <h1>Password Reset Request</h1>
      <p>Click the link below to reset your password:</p>
      <a href="${resetUrl}">Reset Password</a>
      <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
    `,
  });
}
```

### Google OAuth Token Exchange
```typescript
// Source: https://developers.google.com/identity/protocols/oauth2/web-server
export async function exchangeGoogleCode(code: string): Promise<GoogleTokens> {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  if (!response.ok) throw new AppError(400, 'OAUTH_FAILED', 'Failed to exchange code');
  return response.json();
}

export async function getGoogleUserInfo(accessToken: string): Promise<GoogleUser> {
  const response = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new AppError(400, 'OAUTH_FAILED', 'Failed to get user info');
  return response.json();
}
```

### GitHub OAuth Token Exchange
```typescript
// Source: https://docs.github.com/en/developers/apps/building-oauth-apps
export async function exchangeGitHubCode(code: string): Promise<string> {
  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      client_id: GITHUB_CLIENT_ID,
      client_secret: GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const data = await response.json();
  if (data.error) throw new AppError(400, 'OAUTH_FAILED', data.error_description);
  return data.access_token;
}

export async function getGitHubUser(accessToken: string): Promise<GitHubUser> {
  const response = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) throw new AppError(400, 'OAUTH_FAILED', 'Failed to get user info');
  return response.json();
}

export async function getGitHubEmail(accessToken: string): Promise<string> {
  const response = await fetch('https://api.github.com/user/emails', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const emails = await response.json();
  const primary = emails.find((e: any) => e.primary && e.verified);
  if (!primary) throw new AppError(400, 'OAUTH_FAILED', 'No verified email on GitHub');
  return primary.email;
}
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| bcrypt | Argon2id | 2015 (PHC winner) | Better resistance to GPU/ASIC attacks |
| jsonwebtoken | jose | 2020+ | Modern ESM, TypeScript, multi-runtime |
| express-session + connect-pg-simple | JWT + DB refresh tokens | 2018+ | Stateless scaling, explicit control |
| Nodemailer + Gmail SMTP | Resend/SendGrid API | 2022+ | Better deliverability, simpler setup |
| Passport.js for everything | Manual OAuth for simple cases | 2020+ | Less abstraction overhead for few providers |

**Deprecated/outdated:**
- **passport-local:** Adds unnecessary abstraction for simple email/password
- **express-jwt versions < 8:** Older versions had security issues, use 8.x+ or jose directly
- **bcrypt work factor < 12:** Modern hardware requires higher work factors (12-14)
- **Storing raw tokens in DB:** Always hash tokens before storage

## Open Questions

Things that couldn't be fully resolved:

1. **Resend domain verification for production**
   - What we know: Resend requires domain verification for custom sender addresses
   - What's unclear: Exact DNS records needed, verification time
   - Recommendation: Use `onboarding@resend.dev` for development, document production setup

2. **OAuth consent screen requirements**
   - What we know: Google requires OAuth consent screen configuration, verification for production
   - What's unclear: Exact verification timeline, required privacy policy content
   - Recommendation: Start with "testing" mode, document promotion to production

3. **Rate limiting strategy for auth endpoints**
   - What we know: Auth endpoints need stricter limits than general API
   - What's unclear: Optimal thresholds for this application's expected usage
   - Recommendation: Start with 5 login attempts/minute per IP, adjust based on monitoring

## Prisma Schema Updates

The existing User model needs updates, and new models are required:

```prisma
// Update User model
model User {
  id              String   @id @default(cuid())
  email           String   @unique
  emailVerified   DateTime?
  passwordHash    String?  // Nullable for OAuth users
  oauthProvider   String?
  oauthProviderId String?
  subscriptionTier String  @default("FREE")
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  // Relations
  sessions       Session[]
  refreshTokens  RefreshToken[]
  dailyStats     DailyStat[]
  spotStats      SpotStat[]

  @@unique([oauthProvider, oauthProviderId])
  @@index([email])
}

// New model for refresh tokens
model RefreshToken {
  id        String   @id @default(cuid())
  userId    String
  tokenHash String   @unique  // SHA-256 hash of token
  expiresAt DateTime
  createdAt DateTime @default(now())

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([tokenHash])
}

// New model for email verification and password reset tokens
model VerificationToken {
  identifier String   // email address
  token      String   // SHA-256 hash
  expires    DateTime
  type       String   // 'email_verification' | 'password_reset'

  @@unique([identifier, token])
  @@index([identifier])
}
```

## Sources

### Primary (HIGH confidence)
- [jose v6.1.3 GitHub](https://github.com/panva/jose) - JWT operations, API reference
- [argon2 v0.44.0 GitHub](https://github.com/ranisalt/node-argon2) - Password hashing API
- [Resend API Reference](https://resend.com/docs/api-reference/emails/send-email) - Email sending
- [Google OAuth 2.0 Docs](https://developers.google.com/identity/protocols/oauth2/web-server) - OAuth flow
- [OWASP Node.js Security Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html) - Security practices

### Secondary (MEDIUM confidence)
- [express-jwt GitHub](https://github.com/auth0/express-jwt) - Middleware patterns
- [Auth.js Prisma Adapter](https://authjs.dev/getting-started/adapters/prisma) - Schema patterns
- [LogRocket Password Reset Guide](https://blog.logrocket.com/implementing-secure-password-reset-node-js/) - Email flow patterns

### Tertiary (LOW confidence)
- Various Medium/DEV.to articles on JWT patterns - Community consensus but not official

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - Official documentation, widely adopted libraries
- Architecture: HIGH - Established patterns from OWASP, official guides
- Pitfalls: HIGH - OWASP documented, security advisories
- OAuth flows: HIGH - Official Google/GitHub documentation
- Email service: MEDIUM - Resend is newer but well-documented

**Research date:** 2026-02-09
**Valid until:** 2026-03-09 (30 days - authentication standards are stable)
