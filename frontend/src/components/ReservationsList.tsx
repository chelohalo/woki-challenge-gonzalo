'use client';

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import type { Reservation } from '../types';

type ReservationStatus = 'ALL' | 'CONFIRMED' | 'PENDING' | 'CANCELLED';

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
  const [statusFilter, setStatusFilter] = useState<ReservationStatus>('ALL');

  const formatDateTime = (isoString: string) => {
    try {
      const date = parseISO(isoString);
      return format(date, 'HH:mm');
    } catch {
      const match = isoString.match(/T(\d{2}):(\d{2})/);
      return match ? `${match[1]}:${match[2]}` : isoString;
    }
  };

  // Sort reservations by start time, then filter by status
  const sortedReservations = [...reservations].sort((a, b) => {
    const timeA = new Date(a.start).getTime();
    const timeB = new Date(b.start).getTime();
    return timeA - timeB;
  });

  const filteredReservations =
    statusFilter === 'ALL'
      ? sortedReservations
      : sortedReservations.filter((r) => r.status === statusFilter);

  if (isLoading) {
    return (
      <div className="text-center py-12 text-gray-500 dark:text-gray-400">
        <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100 mb-4"></div>
        <p>Loading reservations...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Status Filter */}
      <div className="mb-6 flex gap-2 flex-wrap">
        {(['ALL', 'CONFIRMED', 'PENDING', 'CANCELLED'] as ReservationStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${
              statusFilter === status
                ? 'bg-blue-600 dark:bg-blue-500 text-white shadow-md scale-105'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
            }`}
          >
            {status}
            {statusFilter === status && status !== 'ALL' && (
              <span className="ml-2 px-1.5 py-0.5 bg-white/20 rounded text-xs">
                {reservations.filter((r) => r.status === status).length}
              </span>
            )}
          </button>
        ))}
      </div>

      {filteredReservations.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <svg className="w-20 h-20 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-lg font-medium mb-2">
            {reservations.length === 0
              ? 'No reservations for this date'
              : `No ${statusFilter === 'ALL' ? '' : statusFilter.toLowerCase()} reservations`}
          </p>
          <p className="text-sm">
            {reservations.length === 0
              ? 'Reservations will appear here once created.'
              : 'Try selecting a different filter or date.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
      {filteredReservations.map((reservation) => (
        <div
          key={reservation.id}
          className="group p-5 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 hover:border-blue-300 dark:hover:border-blue-600"
        >
          <div className="flex justify-between items-start gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xl font-bold text-gray-900 dark:text-gray-100">
                    {formatDateTime(reservation.start)} - {formatDateTime(reservation.end)}
                  </span>
                </div>
                <span
                  className={`px-3 py-1 text-xs font-semibold rounded-full ${
                    reservation.status === 'CONFIRMED'
                      ? 'bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300'
                      : reservation.status === 'CANCELLED'
                      ? 'bg-gray-100 dark:bg-gray-600 text-gray-600 dark:text-gray-400'
                      : 'bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-300 animate-pulse'
                  }`}
                >
                  {reservation.status}
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    <strong>{reservation.customer.name}</strong>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    <strong>{reservation.partySize}</strong> {reservation.partySize === 1 ? 'guest' : 'guests'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    {reservation.tableIds.length > 1 ? (
                      <span className="font-medium">
                        {reservation.tableIds.join(' + ')} <span className="text-gray-500">({reservation.tableIds.length} tables)</span>
                      </span>
                    ) : (
                      reservation.tableIds.join(', ')
                    )}
                  </span>
                </div>
              </div>

              {reservation.expiresAt && reservation.status === 'PENDING' && (
                <div className="mb-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                  <div className="flex items-center gap-2 text-xs text-yellow-700 dark:text-yellow-300">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>Expires: {formatDateTime(reservation.expiresAt)}</span>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-3 mt-3 text-sm text-gray-600 dark:text-gray-400">
                {reservation.customer.phone && (
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    <span>{reservation.customer.phone}</span>
                  </div>
                )}
                {reservation.customer.email && (
                  <div className="flex items-center gap-1">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span>{reservation.customer.email}</span>
                  </div>
                )}
              </div>

              {reservation.notes && (
                <div className="mt-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <p className="text-sm text-gray-600 dark:text-gray-400 italic">
                    <svg className="w-4 h-4 inline mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                    </svg>
                    {reservation.notes}
                  </p>
                </div>
              )}
            </div>
            <div className="flex flex-col gap-2 shrink-0">
              {reservation.status === 'PENDING' && onApprove && onReject && (
                <>
                  <button
                    onClick={() => onApprove(reservation.id)}
                    className="px-4 py-2 bg-green-600 dark:bg-green-500 text-white rounded-lg hover:bg-green-700 dark:hover:bg-green-600 transition-colors text-sm font-medium shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Approve
                  </button>
                  <button
                    onClick={() => onReject(reservation.id)}
                    className="px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors text-sm font-medium shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Reject
                  </button>
                </>
              )}
              {reservation.status === 'CONFIRMED' && onEdit && (
                <button
                  onClick={() => onEdit(reservation)}
                  className="px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors text-sm font-medium shadow-sm hover:shadow-md mb-2 flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                  Edit
                </button>
              )}
              <button
                onClick={() => onCancel(reservation.id)}
                className="px-4 py-2 bg-red-600 dark:bg-red-500 text-white rounded-lg hover:bg-red-700 dark:hover:bg-red-600 transition-colors text-sm font-medium shadow-sm hover:shadow-md flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ))}
        </div>
      )}
    </div>
  );
}
