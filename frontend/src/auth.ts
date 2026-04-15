// src/auth.ts
import { env } from '$env/dynamic/private';
import { SvelteKitAuth } from '@auth/sveltekit';
import type { Provider } from '@auth/sveltekit/providers';

export const { handle, signIn, signOut } = SvelteKitAuth({
    secret: env.AUTHENTIK_AUTH_SECRET,
    trustHost: true,
    providers: [
        {
            id: 'authentik',
            name: 'Authentik',
            type: 'oidc',
            issuer: env.AUTHENTIK_ISSUER,
            clientId: env.AUTHENTIK_CLIENT_ID,
            clientSecret: env.AUTHENTIK_CLIENT_SECRET,
        } satisfies Provider,
    ],
    callbacks: {
        async jwt({ token, account }) {
            // Access Token im JWT speichern
            if (account) {
                token.accessToken = account.access_token;
            }
            return token;
        },
        async session({ session, token }) {
            // Access Token der Session hinzufügen
            session.accessToken = token.accessToken as string;
            return session;
        },
    },
});