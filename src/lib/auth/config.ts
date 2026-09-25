import type { NextAuthConfig } from 'next-auth';
import { env } from '@/lib/env';
import { handlePostLoginUserSync } from '@/lib/auth/callbacks';

export const authConfig: NextAuthConfig = {
  providers: [
    {
      id: 'microsoft-entra-id',
      name: 'Microsoft Entra External ID',
      type: 'oidc',
      issuer: `https://${env.ENTRA_TENANT_ID}.ciamlogin.com/${env.ENTRA_TENANT_ID}/v2.0`,
      clientId: env.ENTRA_CLIENT_ID,
      clientSecret: env.ENTRA_CLIENT_SECRET,
      authorization: {
        params: {
          scope: 'openid profile email offline_access',
        },
      },
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name || profile.preferred_username,
          email: profile.email,
        };
      },
    },
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  secret: env.NEXTAUTH_SECRET,
  callbacks: {
    async signIn({ user, account, profile }) {
      if (!user.email || !account?.providerAccountId) {
        return false;
      }
      try {
        await handlePostLoginUserSync({
          sub: account.providerAccountId,
          email: user.email,
          name: user.name,
        });
        return true;
      } catch (err) {
        console.error('[Auth] signIn callback error:', err);
        return false;
      }
    },
    async jwt({ token, user, account }) {
      if (account && user) {
        token.sub = account.providerAccountId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }
      return session;
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
};
