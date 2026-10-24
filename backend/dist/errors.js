import { ZodError } from 'zod';
export class HttpError extends Error {
    status;
    code;
    constructor(status, message, code = 'REQUEST_FAILED') {
        super(message);
        this.status = status;
        this.code = code;
        this.name = 'HttpError';
    }
}
export function sendError(response, error) {
    if (error instanceof HttpError) {
        response.status(error.status).json({ error: { code: error.code, message: error.message } });
        return;
    }
    if (error instanceof ZodError) {
        response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.issues.map((issue) => issue.message).join('; ') } });
        return;
    }
    console.error('Unhandled API error', error);
    response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred.' } });
}
export const errorHandler = (error, _request, response, _next) => sendError(response, error);
export function asyncRoute(handler) {
    return (request, response, next) => {
        handler(request, response).catch(next);
    };
}
