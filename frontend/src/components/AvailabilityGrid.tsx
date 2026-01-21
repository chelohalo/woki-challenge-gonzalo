'use client';

import { format, parseISO } from 'date-fns';
import type { AvailabilitySlot } from '../types';

interface AvailabilityGridProps {
  slots: AvailabilitySlot[];
  onSlotClick: (slot: AvailabilitySlot) => void;
  selectedDate: Date;
  durationMinutes?: number;
}

export function AvailabilityGrid({ slots, onSlotClick, selectedDate, durationMinutes = 90 }: AvailabilityGridProps) {
  // Group slots by shift (morning/evening)
  const morningSlots = slots.filter((slot) => {
    const hour = new Date(slot.start).getUTCHours();
    return hour >= 12 && hour < 16;
  });

  const eveningSlots = slots.filter((slot) => {
    const hour = new Date(slot.start).getUTCHours();
    return hour >= 20 || hour < 4;
  });

  const formatSlotTime = (isoString: string) => {
    try {
      // Parse the ISO string and format it
      const date = parseISO(isoString);
      return format(date, 'HH:mm');
    } catch {
      // Fallback: extract time from ISO string
      const match = isoString.match(/T(\d{2}):(\d{2})/);
      if (match) {
        return `${match[1]}:${match[2]}`;
      }
      return isoString;
    }
  };

  const renderSlotGroup = (groupSlots: AvailabilitySlot[], title: string) => {
    if (groupSlots.length === 0) return null;

    return (
      <div className="mb-8">
        <div className="flex items-center gap-2 mb-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent"></div>
          <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 px-3">{title}</h3>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-gray-300 dark:via-gray-600 to-transparent"></div>
        </div>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-3">
          {groupSlots.map((slot) => (
            <button
              key={slot.start}
              onClick={() => onSlotClick(slot)}
              disabled={!slot.available}
              className={`
                relative px-3 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200 text-center w-full
                transform hover:scale-105 active:scale-95
                ${
                  slot.available
                    ? 'bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/40 dark:to-green-800/40 hover:from-green-100 hover:to-green-200 dark:hover:from-green-900/60 dark:hover:to-green-800/60 text-green-700 dark:text-green-300 border-2 border-green-300 dark:border-green-600 hover:border-green-400 dark:hover:border-green-500 shadow-sm hover:shadow-md cursor-pointer'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-600 border-2 border-gray-200 dark:border-gray-700 cursor-not-allowed opacity-60'
                }
                disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100
              `}
              title={
                slot.available
                  ? `Available - ${slot.tables?.length || 0} table(s) - Click to reserve`
                  : slot.reason === 'no_capacity'
                  ? 'No capacity available'
                  : 'Unavailable'
              }
            >
              <div className="flex flex-col items-center gap-1">
                <span className="text-base font-bold">{formatSlotTime(slot.start)}</span>
                {slot.available && slot.tables && (
                  <span className="text-xs opacity-75">
                    {slot.tables.length} {slot.tables.length === 1 ? 'table' : 'tables'}
                  </span>
                )}
              </div>
              {slot.available && (
                <div className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              )}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Availability for {format(selectedDate, 'EEEE, MMMM d, yyyy')}
        </h2>
        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>Click on an available time slot to make a reservation</span>
          <span className="text-gray-400 dark:text-gray-600">•</span>
          <span>Duration: {durationMinutes} minutes</span>
        </div>
      </div>

      {slots.length === 0 ? (
        <div className="text-center py-16 text-gray-500 dark:text-gray-400">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <p className="text-lg font-medium">No availability slots found for this date.</p>
          <p className="text-sm mt-2">Try selecting a different date or sector.</p>
        </div>
      ) : (
        <>
          {renderSlotGroup(morningSlots, 'Lunch (12:00 - 16:00)')}
          {renderSlotGroup(eveningSlots, 'Dinner (20:00 - 23:45)')}
        </>
      )}
    </div>
  );
}
