import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async (event) => {
    // getSession ist deprecated → event.locals.auth() verwenden
    const session = await event.locals.auth();

    const response = await fetch(`${env.BACKEND_URL}/api/data`, {
        headers: {
            'Authorization': `Bearer ${session?.accessToken}`,
        }
    });

    return new Response(await response.text(), { status: response.status });
};