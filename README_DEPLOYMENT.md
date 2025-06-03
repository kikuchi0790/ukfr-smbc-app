# Deployment Guide for UKFR Learning App

## Prerequisites

1. Vercel account
2. Clerk account for authentication

## Environment Variables

You need to set the following environment variables in Vercel:

### Required Variables

```
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=<your-clerk-publishable-key>
CLERK_SECRET_KEY=<your-clerk-secret-key>
NEXT_PUBLIC_CLERK_SIGN_IN_URL=/sign-in
NEXT_PUBLIC_CLERK_SIGN_UP_URL=/sign-up
NEXT_PUBLIC_CLERK_AFTER_SIGN_IN_URL=/dashboard
NEXT_PUBLIC_CLERK_AFTER_SIGN_UP_URL=/onboarding
```

## Getting Clerk Keys

1. Sign up at [clerk.com](https://clerk.com)
2. Create a new application
3. Add your domains:
   - `localhost:3000` for development
   - `your-app.vercel.app` for production
   - Any custom domains
4. Copy the API keys from the dashboard

## Vercel Deployment

1. Connect your GitHub repository to Vercel
2. Go to Project Settings → Environment Variables
3. Add all the required environment variables
4. Deploy the application

## Troubleshooting

### "Invalid host" error
- Ensure your domain is added in Clerk dashboard
- Check that the publishable key matches your application
- Verify environment variables are set correctly in Vercel

### Build errors
- Check that all TypeScript errors are resolved
- Ensure all dependencies are listed in package.json
- Verify environment variables are available during build