const API_BASE = 'http://localhost:5000/api';

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiRequest(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    credentials: options.credentials ?? 'include'
  });

  const contentType = response.headers.get('content-type') || '';
  const result = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const detail = typeof result?.detail === 'string'
      ? result.detail
      : Array.isArray(result?.detail)
        ? result.detail.map((item) => item.msg).join(' ')
        : `Request failed (HTTP ${response.status}).`;
    throw new ApiError(detail, response.status);
  }

  return result;
}

export function asList(value) {
  if (Array.isArray(value)) return value;
  const containers = [value, value?.data];
  for (const container of containers) {
    for (const key of ['items', 'results', 'data', 'users', 'students', 'quizzes', 'questions', 'sessions', 'institutes', 'groups', 'attempts']) {
      if (Array.isArray(container?.[key])) return container[key];
    }
  }
  return [];
}

export function unwrap(value, key) {
  return value?.[key] ?? value?.data?.[key] ?? value?.data ?? value;
}

export function displayError(error, fallback) {
  return error instanceof Error ? error.message : fallback;
}
