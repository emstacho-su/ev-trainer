export function verificationEmailHtml(verifyUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #1a1a1a; font-size: 24px;">Welcome to EV Trainer!</h1>
  <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
    Thanks for signing up. Click the button below to verify your email address:
  </p>
  <a href="${verifyUrl}"
     style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 500;">
    Verify Email
  </a>
  <p style="color: #6a6a6a; font-size: 14px;">
    Or copy this link: <br>
    <a href="${verifyUrl}" style="color: #2563eb;">${verifyUrl}</a>
  </p>
  <p style="color: #9a9a9a; font-size: 12px; margin-top: 30px;">
    This link expires in 24 hours. If you didn't create an account, you can safely ignore this email.
  </p>
</body>
</html>
  `.trim();
}

export function passwordResetEmailHtml(resetUrl: string): string {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px; max-width: 600px; margin: 0 auto;">
  <h1 style="color: #1a1a1a; font-size: 24px;">Reset Your Password</h1>
  <p style="color: #4a4a4a; font-size: 16px; line-height: 1.5;">
    We received a request to reset your password. Click the button below to set a new password:
  </p>
  <a href="${resetUrl}"
     style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; font-weight: 500;">
    Reset Password
  </a>
  <p style="color: #6a6a6a; font-size: 14px;">
    Or copy this link: <br>
    <a href="${resetUrl}" style="color: #2563eb;">${resetUrl}</a>
  </p>
  <p style="color: #9a9a9a; font-size: 12px; margin-top: 30px;">
    This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
  </p>
</body>
</html>
  `.trim();
}
