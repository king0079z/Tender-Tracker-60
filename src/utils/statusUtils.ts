import { CompanyTimeline } from '../types/milestones';
import { hasAnyCompletedMilestone } from './timelineUtils';
import { companies } from '../data/companies';

export interface StatusCounts {
  totalBidders: number;
  activeVendors: number;
  pendingResponses: number;
}

export const calculateStatusCounts = (timelines: CompanyTimeline[]): StatusCounts => {
  // Count total number of timelines as total bidders
  const totalBidders = timelines.length;

  // Count active vendors (those with any completed milestone)
  const activeVendors = timelines.filter(timeline => 
    hasAnyCompletedMilestone(timeline)
  ).length;

  return {
    totalBidders,
    activeVendors,
    pendingResponses: totalBidders - activeVendors
  };
};