'use client';

import { useState, useEffect } from 'react';
import { format, addDays, subDays } from 'date-fns';
import { AvailabilityGrid } from '../src/components/AvailabilityGrid';
import { ReservationForm } from '../src/components/ReservationForm';
import { ReservationsList } from '../src/components/ReservationsList';
import { ThemeToggle } from '../src/components/ThemeToggle';
import { availabilityApi, reservationsApi } from '../src/lib/api';
import type { AvailabilitySlot, Reservation } from '../src/types';

// Hardcoded for demo - in production these would come from context/config
const RESTAURANT_ID = 'R1';
const SECTORS = [
  { id: 'S1', name: 'Main Hall' },
  { id: 'S2', name: 'Terrace' },
];

export default function Home() {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [selectedSector, setSelectedSector] = useState(SECTORS[0].id);
  const [partySize, setPartySize] = useState(2);
  const [availability, setAvailability] = useState<AvailabilitySlot[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<AvailabilitySlot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dateString = format(selectedDate, 'yyyy-MM-dd');

  const loadAvailability = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await availabilityApi.get(RESTAURANT_ID, selectedSector, dateString, partySize);
      setAvailability(data.slots);
    } catch (err: any) {
      setError(err.message || 'Failed to load availability');
      setAvailability([]);
    } finally {
      setIsLoading(false);
    }
  };

  const loadReservations = async () => {
    try {
      const data = await reservationsApi.getByDay(RESTAURANT_ID, dateString, selectedSector);
      setReservations(data.items);
    } catch (err: any) {
      console.error('Failed to load reservations:', err);
      setReservations([]);
    }
  };

  useEffect(() => {
    loadAvailability();
    loadReservations();
  }, [selectedDate, selectedSector, partySize]);

  const handleSlotClick = (slot: AvailabilitySlot) => {
    if (slot.available) {
      setSelectedSlot(slot);
    }
  };

  const handleReservationSuccess = () => {
    setSelectedSlot(null);
    loadAvailability();
    loadReservations();
  };

  const handleCancelReservation = async (id: string) => {
    if (!confirm('Are you sure you want to cancel this reservation?')) {
      return;
    }

    try {
      await reservationsApi.cancel(id);
      loadAvailability();
      loadReservations();
    } catch (err: any) {
      alert(err.message || 'Failed to cancel reservation');
    }
  };

  const changeDate = (days: number) => {
    setSelectedDate((prev) => (days > 0 ? addDays(prev, days) : subDays(prev, Math.abs(days))));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors">
      <ThemeToggle />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">WokiLite - Restaurant Reservations</h1>
          <p className="text-gray-600 dark:text-gray-400">Bistro Central - Make a reservation</p>
        </div>

        {/* Controls */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6 transition-colors">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Date Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date</label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => changeDate(-1)}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                >
                  ←
                </button>
                <input
                  type="date"
                  value={dateString}
                  onChange={(e) => setSelectedDate(new Date(e.target.value))}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors"
                />
                <button
                  onClick={() => changeDate(1)}
                  className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 transition-colors"
                >
                  →
                </button>
              </div>
            </div>

            {/* Sector Selector */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Sector</label>
              <select
                value={selectedSector}
                onChange={(e) => setSelectedSector(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors"
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
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Party Size</label>
              <input
                type="number"
                min="1"
                max="10"
                value={partySize}
                onChange={(e) => setPartySize(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg transition-colors">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Availability */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors">
            {isLoading ? (
              <div className="text-center py-12 text-gray-500">
                <p>Loading availability...</p>
              </div>
            ) : (
              <AvailabilityGrid
                slots={availability}
                onSlotClick={handleSlotClick}
                selectedDate={selectedDate}
              />
            )}
          </div>

          {/* Reservations */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 transition-colors">
            <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Reservations for {format(selectedDate, 'EEEE, MMMM d')}
            </h2>
            <ReservationsList
              reservations={reservations}
              onCancel={handleCancelReservation}
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
      </div>
    </div>
  );
}
