import { handle as authHandle } from './auth';
import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';
import { sequence } from '@sveltejs/kit/hooks';

const authGuard: Handle = async ({ event, resolve }) => {
    const session = await event.locals.auth();
    if (!session && !event.url.pathname.startsWith('/auth')) {
        redirect(302, '/auth/signin');
    }
    return resolve(event);
};

export const handle = sequence(authHandle, authGuard);