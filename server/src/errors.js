// A small error type for problems we want to explain to the user
// (bad input, duplicate complaint, wrong password, ...).
// Anything that is NOT an AppError is treated as an unexpected server bug.

export class AppError extends Error {
  /**
   * @param {number} status  HTTP status code, e.g. 400
   * @param {string} code    short machine-readable code, e.g. 'VALIDATION_ERROR'
   * @param {string} message plain-language message that is safe to show to users
   * @param {object} [extra] optional extra fields (for example `fields`)
   */
  constructor(status, code, message, extra = {}) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export const badRequest = (message, extra) => new AppError(400, 'VALIDATION_ERROR', message, extra);
export const unauthorized = (message = 'Admin login required.') => new AppError(401, 'UNAUTHORIZED', message);
export const notFound = (message = 'Not found.') => new AppError(404, 'NOT_FOUND', message);

/**
 * Turns any error into the `{ status, body }` we send back to the browser.
 * Unexpected errors never leak details (stack traces, SQL, connection strings).
 */
export function errorToResponse(err) {
  if (err instanceof AppError) {
    return {
      status: err.status,
      body: { error: { code: err.code, message: err.message, ...err.extra } }
    };
  }

  // Body parser problems from Express (bad JSON, body too large)
  if (err && err.type === 'entity.parse.failed') {
    return {
      status: 400,
      body: { error: { code: 'BAD_JSON', message: 'The request body is not valid JSON.' } }
    };
  }
  if (err && err.type === 'entity.too.large') {
    return {
      status: 413,
      body: { error: { code: 'TOO_LARGE', message: 'The request is too large.' } }
    };
  }

  // PostgreSQL error codes we can explain safely
  if (err && err.code === '23505') {
    return {
      status: 409,
      body: { error: { code: 'CONFLICT', message: 'That record already exists.' } }
    };
  }

  return {
    status: 500,
    body: {
      error: {
        code: 'SERVER_ERROR',
        message: 'Something went wrong on the server. Please try again in a moment.'
      }
    }
  };
}
