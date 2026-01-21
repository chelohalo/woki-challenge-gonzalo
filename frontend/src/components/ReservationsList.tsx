'use client';

import { format, parseISO } from 'date-fns';
import type { Reservation } from '../types';

interface ReservationsListProps {
  reservations: Reservation[];
  onCancel: (id: string) => Promise<void>;
  onEdit?: (reservation: Reservation) => void;
  onApprove?: (id: string) => Promise<void>;
  onReject?: (id: string) => Promise<void>;
  isLoading?: boolean;
}

export function ReservationsList({
  reservations,
  onCancel,
  onEdit,
  onApprove,
  onReject,
  isLoading,
}: ReservationsListProps) {
  const formatDateTime = (isoString: string) => {
    try {
      const date = parseISO(isoString);
      return format(date, 'HH:mm');
    } catch {
      const match = isoString.match(/T(\d{2}):(\d{2})/);
      return match ? `${match[1]}:${match[2]}` : isoString;
    }
  };

  if (isLoading) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>Loading reservations...</p>
      </div>
    );
  }

  if (reservations.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
        <p>No reservations for this date.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reservations.map((reservation) => (
        <div
          key={reservation.id}
          className="p-4 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg shadow-sm hover:shadow-md transition-all"
        >
          <div className="flex justify-between items-start">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {formatDateTime(reservation.start)} - {formatDateTime(reservation.end)}
                </span>
                <span
                  className={`px-2 py-1 text-xs font-medium rounded ${
                    reservation.status === 'CONFIRMED'
                      ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-200'
                      : reservation.status === 'CANCELLED'
                      ? 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                      : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-200'
                  }`}
                >
                  {reservation.status}
                </span>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <strong>Customer:</strong> {reservation.customer.name}
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <strong>Party Size:</strong> {reservation.partySize} people
              </p>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                <strong>Tables:</strong>{' '}
                {reservation.tableIds.length > 1 ? (
                  <span className="font-medium">
                    {reservation.tableIds.join(' + ')} ({reservation.tableIds.length} tables)
                  </span>
                ) : (
                  reservation.tableIds.join(', ')
                )}
              </p>
              {reservation.expiresAt && reservation.status === 'PENDING' && (
                <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                  ⏰ Expires: {formatDateTime(reservation.expiresAt)}
                </p>
              )}
              {reservation.customer.phone && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  📞 {reservation.customer.phone}
                </p>
              )}
              {reservation.customer.email && (
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  ✉️ {reservation.customer.email}
                </p>
              )}
              {reservation.notes && (
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 italic">
                  📝 {reservation.notes}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 ml-4">
              {reservation.status === 'PENDING' && onApprove && onReject && (
                <>
                  <button
                    onClick={() => onApprove(reservation.id)}
                    className="px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-md hover:bg-green-700 dark:hover:bg-green-600 transition-colors text-sm"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => onReject(reservation.id)}
                    className="px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-md hover:bg-red-700 dark:hover:bg-red-600 transition-colors text-sm"
                  >
                    Reject
                  </button>
                </>
              )}
              {reservation.status === 'CONFIRMED' && onEdit && (
                <button
                  onClick={() => onEdit(reservation)}
                  className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm mb-2"
                >
                  Edit
                </button>
              )}
              <button
                onClick={() => onCancel(reservation.id)}
                className="px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-md hover:bg-red-700 dark:hover:bg-red-600 transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
