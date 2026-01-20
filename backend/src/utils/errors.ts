export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public detail?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  NOT_FOUND: (entity: string) =>
    new AppError(404, 'not_found', `${entity} not found`),
  
  NO_CAPACITY: (detail?: string) =>
    new AppError(409, 'no_capacity', 'No available table fits party size at requested time', detail),
  
  OUTSIDE_SERVICE_WINDOW: () =>
    new AppError(422, 'outside_service_window', 'Requested time is outside shifts'),
  
  INVALID_FORMAT: (detail?: string) =>
    new AppError(400, 'invalid_format', 'Invalid request format', detail),
  
  CONFLICT: (message: string, detail?: string) =>
    new AppError(409, 'conflict', message, detail),
};
