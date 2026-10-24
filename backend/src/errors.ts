import type { ErrorRequestHandler, Request, Response } from 'express'
import { ZodError } from 'zod'

export class HttpError extends Error {
  constructor(public readonly status: number, message: string, public readonly code = 'REQUEST_FAILED') {
    super(message)
    this.name = 'HttpError'
  }
}

export function sendError(response: Response, error: unknown) {
  if (error instanceof HttpError) {
    response.status(error.status).json({ error: { code: error.code, message: error.message } })
    return
  }
  if (error instanceof ZodError) {
    response.status(400).json({ error: { code: 'VALIDATION_ERROR', message: error.issues.map((issue) => issue.message).join('; ') } })
    return
  }
  console.error('Unhandled API error', error)
  response.status(500).json({ error: { code: 'INTERNAL_ERROR', message: 'An unexpected server error occurred.' } })
}

export const errorHandler: ErrorRequestHandler = (error, _request, response, _next) => sendError(response, error)

export function asyncRoute(handler: (request: Request, response: Response) => Promise<void>) {
  return (request: Request, response: Response, next: (error?: unknown) => void) => {
    handler(request, response).catch(next)
  }
}
