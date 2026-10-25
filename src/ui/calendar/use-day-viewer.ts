import { useMemo } from 'react';
import { createDayViewer, type DayViewer } from '../../domain/calendar/day-view.ts';
import { useApp } from '../app-store.tsx';

/** The day viewer bound to the shipped dictionary (tests pass a fixture dictionary through the provider). */
export function useDayViewer(): DayViewer {
  const { services } = useApp();
  return useMemo(() => createDayViewer(services.dictionary), [services.dictionary]);
}
