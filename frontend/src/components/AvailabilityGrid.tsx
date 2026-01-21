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
        <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-200">{title}</h3>
        <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-6 xl:grid-cols-8 gap-2">
          {groupSlots.map((slot) => (
            <button
              key={slot.start}
              onClick={() => onSlotClick(slot)}
              disabled={!slot.available}
              className={`
                px-3 py-2 rounded-lg text-sm font-medium transition-all text-center min-w-[70px]
                ${
                  slot.available
                    ? 'bg-green-100 dark:bg-green-900/30 hover:bg-green-200 dark:hover:bg-green-900/50 text-green-800 dark:text-green-200 border-2 border-green-300 dark:border-green-700 hover:border-green-400 dark:hover:border-green-600 cursor-pointer'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 border-2 border-gray-200 dark:border-gray-600 cursor-not-allowed'
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
              title={
                slot.available
                  ? `Available - ${slot.tables?.length || 0} table(s)`
                  : slot.reason === 'no_capacity'
                  ? 'No capacity'
                  : 'Unavailable'
              }
            >
              {formatSlotTime(slot.start)}
            </button>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          Availability for {format(selectedDate, 'EEEE, MMMM d, yyyy')}
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Click on an available time slot to make a reservation
        </p>
      </div>

      {slots.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <p>No availability slots found for this date.</p>
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
