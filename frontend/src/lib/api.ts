import { startLoading, stopLoading } from '../hooks/useApiLoading';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const REQUEST_TIMEOUT_MS = 30000; // 30 seconds

interface ApiError extends Error {
  status?: number;
  code?: string;
  detail?: string;
}

class NetworkError extends Error {
  constructor(message: string, public originalError?: unknown) {
    super(message);
    this.name = 'NetworkError';
  }
}

class TimeoutError extends Error {
  constructor() {
    super('Request timeout - the server took too long to respond');
    this.name = 'TimeoutError';
  }
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError();
    }
    throw error;
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorDetail: string;
    let errorCode: string | undefined;
    
    try {
      const errorData = await response.json() as { error?: string; detail?: string; code?: string };
      errorDetail = errorData.detail || errorData.error || response.statusText;
      errorCode = errorData.code || errorData.error;
    } catch {
      // If response is not JSON, try to get text
      try {
        errorDetail = await response.text() || response.statusText;
      } catch {
        errorDetail = response.statusText || 'Unknown error';
      }
    }

    const apiError: ApiError = new Error(`API Error: ${errorDetail}`);
    apiError.status = response.status;
    apiError.code = errorCode;
    apiError.detail = errorDetail;
    throw apiError;
  }

  try {
    return await response.json();
  } catch (error) {
    throw new Error('Invalid JSON response from server');
  }
}

export const api = {
  async get<T>(path: string): Promise<T> {
    startLoading();
    try {
      const response = await fetchWithTimeout(
        `${API_URL}${path}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
        REQUEST_TIMEOUT_MS
      );
      return handleResponse<T>(response);
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'NetworkError') {
        throw new NetworkError('Network error - please check your connection', error);
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError('Failed to connect to server - please check if the server is running', error);
      }
      throw error;
    } finally {
      stopLoading();
    }
  },

  async post<T>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
    startLoading();
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (idempotencyKey) {
        headers['idempotency-key'] = idempotencyKey;
      }

      const response = await fetchWithTimeout(
        `${API_URL}${path}`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
        },
        REQUEST_TIMEOUT_MS
      );
      
      return handleResponse<T>(response);
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'NetworkError') {
        throw new NetworkError('Network error - please check your connection', error);
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError('Failed to connect to server - please check if the server is running', error);
      }
      throw error;
    } finally {
      stopLoading();
    }
  },

  async delete(path: string): Promise<void> {
    startLoading();
    try {
      const response = await fetchWithTimeout(
        `${API_URL}${path}`,
        {
          method: 'DELETE',
        },
        REQUEST_TIMEOUT_MS
      );
      
      if (!response.ok) {
        await handleResponse<never>(response);
      }
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'NetworkError') {
        throw new NetworkError('Network error - please check your connection', error);
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError('Failed to connect to server - please check if the server is running', error);
      }
      throw error;
    } finally {
      stopLoading();
    }
  },

  async patch<T>(path: string, body: unknown, idempotencyKey?: string): Promise<T> {
    startLoading();
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };
      
      if (idempotencyKey) {
        headers['idempotency-key'] = idempotencyKey;
      }

      const response = await fetchWithTimeout(
        `${API_URL}${path}`,
        {
          method: 'PATCH',
          headers,
          body: JSON.stringify(body),
        },
        REQUEST_TIMEOUT_MS
      );
      
      return handleResponse<T>(response);
    } catch (error) {
      if (error instanceof TimeoutError) {
        throw error;
      }
      if (error instanceof Error && error.name === 'NetworkError') {
        throw new NetworkError('Network error - please check your connection', error);
      }
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new NetworkError('Failed to connect to server - please check if the server is running', error);
      }
      throw error;
    } finally {
      stopLoading();
    }
  },
};

// API endpoints
export const availabilityApi = {
  get: (restaurantId: string, sectorId: string, date: string, partySize: number) =>
    api.get<import('../types').AvailabilityResponse>(
      `/availability?restaurantId=${restaurantId}&sectorId=${sectorId}&date=${date}&partySize=${partySize}`
    ),
};

export const reservationsApi = {
  create: (data: {
    restaurantId: string;
    sectorId: string;
    partySize: number;
    startDateTimeISO: string;
    customer: {
      name: string;
      phone: string;
      email: string;
    };
    notes?: string;
  }, idempotencyKey?: string) =>
    api.post<import('../types').Reservation>('/reservations', data, idempotencyKey),

  update: (id: string, data: {
    sectorId?: string;
    partySize?: number;
    startDateTimeISO?: string;
    customer?: {
      name?: string;
      phone?: string;
      email?: string;
    };
    notes?: string;
  }, idempotencyKey?: string) =>
    api.patch<import('../types').Reservation>(`/reservations/${id}`, data, idempotencyKey),

  cancel: (id: string) => api.delete(`/reservations/${id}`),

  approve: (id: string) => api.post(`/reservations/${id}/approve`, {}),

  reject: (id: string) => api.post(`/reservations/${id}/reject`, {}),

  getByDay: (restaurantId: string, date: string, sectorId?: string) =>
    api.get<{
      date: string;
      items: import('../types').Reservation[];
    }>(`/reservations/day?restaurantId=${restaurantId}&date=${date}${sectorId ? `&sectorId=${sectorId}` : ''}`),
};
