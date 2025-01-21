import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { db } from '../lib/database';
import { CompanyTimeline } from '../types/milestones';
import { companies } from '../data/companies';

interface DeleteVendorModalProps {
  vendor: CompanyTimeline;
  onClose: () => void;
}

export default function DeleteVendorModal({ vendor, onClose }: DeleteVendorModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    setIsDeleting(true);
    setError(null);

    try {
      // Delete the vendor from the database
      await db.query(
        'DELETE FROM timelines WHERE company_id = $1',
        [vendor.companyId]
      );

      // Remove the company from the companies array
      const index = companies.findIndex(c => c.id === vendor.companyId);
      if (index !== -1) {
        companies.splice(index, 1);
      }

      // Close the modal and refresh the page
      onClose();
      window.location.reload();
    } catch (err) {
      console.error('Error deleting vendor:', err);
      setError('Failed to delete vendor. Please try again.');
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-medium text-gray-900">Delete Vendor</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4">
          <div className="flex items-center space-x-3 text-yellow-600 bg-yellow-50 p-3 rounded-lg mb-4">
            <AlertTriangle className="h-5 w-5 flex-shrink-0" />
            <p className="text-sm">
              This action cannot be undone. All data associated with this vendor will be permanently deleted.
            </p>
          </div>

          <p className="mb-4 text-gray-600">
            Are you sure you want to delete <span className="font-medium text-gray-900">{vendor.companyName}</span>?
          </p>

          {error && (
            <div className="mb-4 p-2 bg-red-50 text-red-600 text-sm rounded">
              {error}
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded-md text-gray-600 hover:bg-gray-50"
              disabled={isDeleting}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDelete}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete Vendor'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}