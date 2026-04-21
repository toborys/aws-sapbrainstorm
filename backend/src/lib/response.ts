const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Authorization,Content-Type',
};

function jsonResponse(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      ...CORS_HEADERS,
    },
    body: JSON.stringify(body),
  };
}

export function ok(body: unknown) {
  return jsonResponse(200, body);
}

export function created(body: unknown) {
  return jsonResponse(201, body);
}

export function badRequest(message: string) {
  return jsonResponse(400, { error: message });
}

export function unauthorized(message = 'Unauthorized') {
  return jsonResponse(401, { error: message });
}

export function forbidden(message = 'Forbidden') {
  return jsonResponse(403, { error: message });
}

export function notFound(message = 'Not found') {
  return jsonResponse(404, { error: message });
}

export function conflict(body: unknown) {
  return jsonResponse(409, body);
}

export function serverError(message = 'Internal server error') {
  return jsonResponse(500, { error: message });
}
