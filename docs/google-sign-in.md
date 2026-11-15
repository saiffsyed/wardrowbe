# Sign in with Google

Wardrowbe signs in through any OpenID Connect provider, and Google is one. These steps take about ten minutes and need the public address the app will run at (for example `https://wardrobe.example.com`).

## 1. Create the Google OAuth client

1. Open [Google Cloud Console](https://console.cloud.google.com/) and create a project (for example "Wardrobe"). The same project will later hold the Google Calendar access.
2. Go to **Google Auth Platform** (APIs & Services → OAuth consent screen in older layouts):
   - **Branding:** app name, your support email.
   - **Audience:** choose **External**. While the app is in *Testing*, only the people you add under **Test users** can sign in, so add both of your Google addresses.
3. Go to **Clients → Create client**:
   - Application type: **Web application**.
   - Authorised redirect URI: `https://<your-address>/api/auth/callback/oidc`
   - Save, then copy the **Client ID** and **Client secret**.

## 2. Configure Wardrowbe

In `.env`:

```env
NEXTAUTH_URL=https://<your-address>
OIDC_ISSUER_URL=https://accounts.google.com
OIDC_CLIENT_ID=<client id>.apps.googleusercontent.com
OIDC_CLIENT_SECRET=<client secret>
# Only these verified Google accounts may sign in. Without it, anyone with a Google
# account could create an account and spend your AI credits.
OIDC_ALLOWED_EMAILS=you@gmail.com,partner@gmail.com
```

Then leave `DEBUG` unset (or `false`) and set a real `SECRET_KEY` and `NEXTAUTH_SECRET` (`openssl rand -hex 32` for each). Restart the stack.

## How it behaves

- The login page shows a single **Sign in** button that goes to Google.
- An address that is not in `OIDC_ALLOWED_EMAILS`, or whose email Google has not verified, is refused with HTTP 403 and no account is created.
- Each person gets their own account and closet. To share outfits with each other, one of you creates a family in **Family** and invites the other.
