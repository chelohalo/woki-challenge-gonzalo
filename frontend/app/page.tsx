'use client';

import { useState, useEffect } from 'react';
import { format, addDays, subDays } from 'date-fns';
import { AvailabilityGrid } from '../src/components/AvailabilityGrid';
import { ReservationForm } from '../src/components/ReservationForm';
import { EditReservationForm } from '../src/components/EditReservationForm';
import { ReservationsList } from '../src/components/ReservationsList';
import { ThemeToggle } from '../src/components/ThemeToggle';
import { Login } from '../src/components/Login';
import { Spinner } from '../src/components/Spinner';
import { Toast, useToast } from '../src/components/Toast';
import { ConfirmDialog } from '../src/components/ConfirmDialog';
import { useApiLoading } from '../src/hooks/useApiLoading';
import { availabilityApi, reservationsApi } from '../src/lib/api';
import type { AvailabilitySlot, Reservation } from '../src/types';

const AUTH_TOKEN_KEY = 'woki_auth_token';

// Hardcoded for demo - in production these would come from context/config
const RESTAURANT_ID = 'R1';
const SECTORS = [
  { id: 'S1', name: 'Main Hall' },
  { id: 'S2', name: 'Terrace' },
];

export default function Home() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSector, setSelectedSector] = useState(SECTORS[0].id);
  const [partySize, setPartySize] = useState(2);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [durationMinutes, setDurationMinutes] = useState<number>(90);
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: 'danger' | 'warning';
  } | null>(null);
  const isApiLoading = useApiLoading();
  const { toast, showToast, hideToast } = useToast();

  // Check authentication on mount
  useEffect(() => {
    const token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (token) {
      setIsAuthenticated(true);
    }
  }, []);

  const dateString = format(selectedDate, 'yyyy-MM-dd');

  const loadAvailability = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await availabilityApi.get(RESTAURANT_ID, selectedSector, dateString, partySize);
      // Sort slots by start time to ensure consistent ordering
      const sortedSlots = [...data.slots].sort((a, b) => {
        const timeA = new Date(a.start).getTime();
        const timeB = new Date(b.start).getTime();
        return timeA - timeB;
      });
      setAvailability(sortedSlots);
      setDurationMinutes(data.durationMinutes);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to load availability';
      // Extract more specific error message if available
      let displayMessage = errorMessage;
      if (errorMessage.includes('Sector not found') || errorMessage.includes('not_found')) {
        displayMessage = `Sector "${SECTORS.find(s => s.id === selectedSector)?.name || selectedSector}" not found. Please try a different sector.`;
      } else if (errorMessage.includes('Restaurant not found')) {
        displayMessage = 'Restaurant not found. Please refresh the page.';
      }
      setError(displayMessage);
      setAvailability([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadReservations = async () => {
    try {
      const data = await reservationsApi.getByDay(RESTAURANT_ID, dateString, selectedSector);
      // Sort reservations by start time to ensure consistent ordering
      const sortedReservations = [...data.items].sort((a, b) => {
        const timeA = new Date(a.start).getTime();
        const timeB = new Date(b.start).getTime();
        return timeA - timeB;
      });
      setReservations(sortedReservations);
    } catch (err: any) {
      console.error('Failed to load reservations:', err);
      setReservations([]);
    }
  };

  // Execute useEffect always, but only load data if authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadAvailability();
      loadReservations();
    }
  }, [selectedDate, selectedSector, partySize, isAuthenticated]);

  const handleLogin = (token: string) => {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    setIsAuthenticated(true);
    showToast('Successfully logged in', 'success');
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_TOKEN_KEY);
    setIsAuthenticated(false);
    showToast('Logged out successfully', 'info');
  };

  const handleSlotClick = (slot: AvailabilitySlot) => {
    if (slot.available) {
      setSelectedSlot(slot);
    }
  };

  const handleReservationSuccess = () => {
    setSelectedSlot(null);
    showToast('Reservation created successfully!', 'success');
    loadAvailability();
    loadReservations();
  };

  const handleCancelReservation = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Cancel Reservation',
      message: 'Are you sure you want to cancel this reservation? This action cannot be undone.',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await reservationsApi.cancel(id);
          showToast('Reservation cancelled successfully', 'success');
          loadAvailability();
          loadReservations();
        } catch (err: any) {
          showToast(err.message || 'Failed to cancel reservation', 'error');
        }
      },
      variant: 'danger',
    });
  };

  const handleEditReservation = (reservation: Reservation) => {
    setEditingReservation(reservation);
  };

  const handleEditSuccess = () => {
    setEditingReservation(null);
    showToast('Reservation updated successfully!', 'success');
    loadAvailability();
    loadReservations();
  };

  const handleApproveReservation = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Approve Reservation',
      message: 'Are you sure you want to approve this large group reservation?',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await reservationsApi.approve(id);
          showToast('Reservation approved successfully', 'success');
          loadAvailability();
          loadReservations();
        } catch (err: any) {
          showToast(err.message || 'Failed to approve reservation', 'error');
        }
      },
      variant: 'warning',
    });
  };

  const handleRejectReservation = async (id: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Reject Reservation',
      message: 'Are you sure you want to reject this reservation? This action cannot be undone.',
      onConfirm: async () => {
        setConfirmDialog(null);
        try {
          await reservationsApi.reject(id);
          showToast('Reservation rejected successfully', 'info');
          loadAvailability();
          loadReservations();
        } catch (err: any) {
          showToast(err.message || 'Failed to reject reservation', 'error');
        }
      },
      variant: 'danger',
    });
  };

  const changeDate = (days: number) => {
    setSelectedDate((prev) => (days > 0 ? addDays(prev, days) : subDays(prev, Math.abs(days))));
  };

  // Show login if not authenticated - moved to end after all hooks
  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors">
      {isApiLoading && <Spinner />}
      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
      {confirmDialog && (
        <ConfirmDialog
          isOpen={confirmDialog.isOpen}
          title={confirmDialog.title}
          message={confirmDialog.message}
          onConfirm={confirmDialog.onConfirm}
          onCancel={() => setConfirmDialog(null)}
          variant={confirmDialog.variant}
        />
      )}
      <ThemeToggle />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8 flex justify-between items-start">
          <div>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              WokiLite
            </h1>
            <p className="text-lg text-gray-600 dark:text-gray-400">Bistro Central - Restaurant Reservations</p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-all shadow-sm hover:shadow-md flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            Logout
          </button>
        </div>

        {/* Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 transition-colors border border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Date Selector */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Date
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changeDate(-1)}
                  className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all hover:scale-105 active:scale-95"
                  aria-label="Previous day"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <input
                  type="date"
                  value={dateString}
                  onChange={(e) => setSelectedDate(new Date(e.target.value))}
                  className="flex-1 px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-all"
                />
                <button
                  onClick={() => changeDate(1)}
                  className="p-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-all hover:scale-105 active:scale-95"
                  aria-label="Next day"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Sector Selector */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                Sector
              </label>
              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-all"
              >
                {SECTORS.map((sector) => (
                  <option key={sector.id} value={sector.id}>
                    {sector.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Party Size */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                Party Size
              </label>
              <input
                type="number"
                min="1"
                max="20"
                value={partySize}
                onChange={(e) => setPartySize(parseInt(e.target.value) || 1)}
                className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-all"
              />
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 rounded-lg transition-colors">
            <div className="flex items-center gap-2">
              <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-red-800 dark:text-red-200 font-medium">{error}</p>
            </div>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Availability */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 transition-colors border border-gray-200 dark:border-gray-700">
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 dark:border-gray-100 mb-4"></div>
                <p>Loading availability...</p>
              </div>
            ) : (
              <AvailabilityGrid
                slots={availability}
                onSlotClick={handleSlotClick}
                selectedDate={selectedDate}
                durationMinutes={durationMinutes}
              />
            )}
          </div>

          {/* Reservations */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 transition-colors border border-gray-200 dark:border-gray-700">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
              Reservations for {format(selectedDate, 'EEEE, MMMM d')}
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Manage and view all reservations for this date
            </p>
            <ReservationsList
              reservations={reservations}
              onCancel={handleCancelReservation}
              onEdit={handleEditReservation}
              onApprove={handleApproveReservation}
              onReject={handleRejectReservation}
              isLoading={false}
            />
          </div>
        </div>

        {/* Reservation Form Modal */}
        {selectedSlot && (
          <ReservationForm
            slot={selectedSlot}
            restaurantId={RESTAURANT_ID}
            sectorId={selectedSector}
            onSuccess={handleReservationSuccess}
            onCancel={() => setSelectedSlot(null)}
          />
        )}

        {/* Edit Reservation Form Modal */}
        {editingReservation && (
          <EditReservationForm
            reservation={editingReservation}
            availableSlots={availability}
            sectors={SECTORS}
            onSuccess={handleEditSuccess}
            onCancel={() => setEditingReservation(null)}
          />
        )}
      </div>
    </div>
  );
}
