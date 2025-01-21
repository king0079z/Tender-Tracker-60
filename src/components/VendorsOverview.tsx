import React from 'react';
import { useTimeline } from '../context/TimelineContext';
import { formatDate } from '../utils/dateUtils';
import { companies } from '../data/companies';
import { CheckCircle, XCircle, Clock, AlertTriangle, Trash2 } from 'lucide-react';
import DeleteVendorModal from './DeleteVendorModal';

interface VendorsOverviewProps {
  isAdmin: boolean;
}

export default function VendorsOverview({ isAdmin }: VendorsOverviewProps) {
  const { timelines } = useTimeline();
  const [vendorToDelete, setVendorToDelete] = React.useState<any>(null);

  return (
    <div className="bg-white shadow rounded-lg overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Company
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Scope
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                NDA Received
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                NDA Signed
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                RFI Sent
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                RFI Due
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Offer Received
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              {isAdmin && (
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {timelines.map((timeline) => {
              const company = companies.find(c => c.id === timeline.companyId);
              const isOverdue = timeline.rfiDue.date && new Date(timeline.rfiDue.date) < new Date() && !timeline.rfiDue.isCompleted;
              
              return (
                <tr key={timeline.companyId} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{timeline.companyName}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex gap-1">
                      {company?.scope.media && (
                        <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                          Media
                        </span>
                      )}
                      {company?.scope.ai && (
                        <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
                          AI
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusCell
                      date={timeline.ndaReceived.date}
                      isCompleted={timeline.ndaReceived.isCompleted}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusCell
                      date={timeline.ndaSigned.date}
                      isCompleted={timeline.ndaSigned.isCompleted}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusCell
                      date={timeline.rfiSent.date}
                      isCompleted={timeline.rfiSent.isCompleted}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusCell
                      date={timeline.rfiDue.date}
                      isCompleted={timeline.rfiDue.isCompleted}
                      isOverdue={isOverdue}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusCell
                      date={timeline.offerReceived.date}
                      isCompleted={timeline.offerReceived.isCompleted}
                    />
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <StatusBadge timeline={timeline} />
                  </td>
                  {isAdmin && (
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => setVendorToDelete(timeline)}
                        className="text-red-400 hover:text-red-600 p-1 rounded-full hover:bg-red-50"
                        title="Delete vendor"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {vendorToDelete && isAdmin && (
        <DeleteVendorModal
          vendor={vendorToDelete}
          onClose={() => setVendorToDelete(null)}
        />
      )}
    </div>
  );
}

function StatusCell({ 
  date, 
  isCompleted, 
  isOverdue 
}: { 
  date: Date | null; 
  isCompleted: boolean;
  isOverdue?: boolean;
}) {
  if (!date) {
    return (
      <div className="flex items-center">
        <Clock className="h-5 w-5 text-gray-400" />
        <span className="ml-1.5 text-sm text-gray-500">Pending</span>
      </div>
    );
  }

  if (isCompleted) {
    return (
      <div className="flex items-center">
        <CheckCircle className="h-5 w-5 text-green-500" />
        <span className="ml-1.5 text-sm text-gray-900">{formatDate(date)}</span>
      </div>
    );
  }

  if (isOverdue) {
    return (
      <div className="flex items-center">
        <AlertTriangle className="h-5 w-5 text-red-500" />
        <span className="ml-1.5 text-sm text-red-600">{formatDate(date)}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center">
      <Clock className="h-5 w-5 text-yellow-500" />
      <span className="ml-1.5 text-sm text-gray-900">{formatDate(date)}</span>
    </div>
  );
}

function StatusBadge({ timeline }: { timeline: any }) {
  if (timeline.offerReceived.isCompleted) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        Completed
      </span>
    );
  }

  if (timeline.rfiDue.isCompleted) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
        RFI Received
      </span>
    );
  }

  if (timeline.rfiSent.isCompleted) {
    const isOverdue = timeline.rfiDue.date && new Date(timeline.rfiDue.date) < new Date();
    if (isOverdue) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          Overdue
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
        Awaiting Response
      </span>
    );
  }

  if (timeline.ndaSigned.isCompleted) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800">
        NDA Signed
      </span>
    );
  }

  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
      In Progress
    </span>
  );
}