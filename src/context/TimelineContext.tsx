import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { CompanyTimeline } from '../types/milestones';
import { db } from '../lib/database';
import { sortTimelines } from '../utils/timelineUtils';
import { generateNotifications } from '../utils/notificationUtils';
import { Notification } from '../types/notifications';
import { formatTimelineData } from '../utils/formatters';
import { companies } from '../data/companies';

interface TimelineContextType {
  timelines: CompanyTimeline[];
  updateTimeline: (updatedTimeline: CompanyTimeline) => Promise<void>;
  loading: boolean;
  error: string | null;
  retry: () => Promise<void>;
  notifications: Notification[];
  isConnected: boolean;
}

const TimelineContext = createContext<TimelineContextType | undefined>(undefined);

export function TimelineProvider({ children }: { children: React.ReactNode }) {
  const [timelines, setTimelines] = useState<CompanyTimeline[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(true);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const unsubscribe = db.onConnectionChange((connected) => {
      setIsConnected(connected);
      if (connected && error) {
        setError(null);
        fetchTimelines();
      }
    });

    return () => {
      unsubscribe();
      db.cleanup();
    };
  }, [error]);

  const fetchTimelines = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const result = await db.query('SELECT * FROM timelines ORDER BY updated_at DESC');
      
      if (result.rows) {
        // Sync companies array with database
        const dbCompanyIds = result.rows.map(row => row.company_id);
        const companiesArray = companies.filter(company => dbCompanyIds.includes(company.id));
        
        // Clear and update companies array
        companies.length = 0;
        companies.push(...companiesArray);

        const formattedTimelines = result.rows.map(formatTimelineData);
        const sortedTimelines = sortTimelines(formattedTimelines);
        setTimelines(sortedTimelines);
        
        const newNotifications = await generateNotifications(sortedTimelines);
        setNotifications(newNotifications);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch timelines';
      setError(message);
      setTimelines([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTimelines();
  }, [fetchTimelines]);

  const updateTimeline = async (timeline: CompanyTimeline) => {
    try {
      await db.query(
        `UPDATE timelines 
         SET nda_received_date = $1,
             nda_received_completed = $2,
             nda_signed_date = $3,
             nda_signed_completed = $4,
             rfi_sent_date = $5,
             rfi_sent_completed = $6,
             rfi_due_date = $7,
             rfi_due_completed = $8,
             offer_received_date = $9,
             offer_received_completed = $10,
             updated_at = NOW()
         WHERE company_id = $11`,
        [
          timeline.ndaReceived.date,
          timeline.ndaReceived.isCompleted,
          timeline.ndaSigned.date,
          timeline.ndaSigned.isCompleted,
          timeline.rfiSent.date,
          timeline.rfiSent.isCompleted,
          timeline.rfiDue.date,
          timeline.rfiDue.isCompleted,
          timeline.offerReceived.date,
          timeline.offerReceived.isCompleted,
          timeline.companyId
        ]
      );

      await fetchTimelines();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to update timeline';
      throw new Error(message);
    }
  };

  return (
    <TimelineContext.Provider value={{ 
      timelines, 
      updateTimeline,
      loading,
      error,
      retry: fetchTimelines,
      notifications,
      isConnected
    }}>
      {children}
    </TimelineContext.Provider>
  );
}

export function useTimeline() {
  const context = useContext(TimelineContext);
  if (context === undefined) {
    throw new Error('useTimeline must be used within a TimelineProvider');
  }
  return context;
}