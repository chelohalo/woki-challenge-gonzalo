import { startLoading, stopLoading } from '../hooks/useApiLoading';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const api = {
  async get<T>(path: string): Promise<T> {
    startLoading();
    try {
      const response = await fetch(`${API_URL}${path}`);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.statusText} - ${errorText}`);
      }
      return response.json();
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

      const response = await fetch(`${API_URL}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.statusText} - ${errorText}`);
      }
      return response.json();
    } finally {
      stopLoading();
    }
  },

  async delete(path: string): Promise<void> {
    startLoading();
    try {
      const response = await fetch(`${API_URL}${path}`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error: ${response.statusText} - ${errorText}`);
      }
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

  cancel: (id: string) => api.delete(`/reservations/${id}`),

  getByDay: (restaurantId: string, date: string, sectorId?: string) =>
    api.get<{
      date: string;
      items: import('../types').Reservation[];
    }>(`/reservations/day?restaurantId=${restaurantId}&date=${date}${sectorId ? `&sectorId=${sectorId}` : ''}`),
};
