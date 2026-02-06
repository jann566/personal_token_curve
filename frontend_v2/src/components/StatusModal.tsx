import { useEffect } from 'react';
import Button from './Button';

interface StatusModalProps {
  isOpen: boolean;
  status: 'approved' | 'denied' | null;
  onClose: () => void;
  onClaimClick?: () => void;
}

export function StatusModal({ isOpen, status, onClose, onClaimClick }: StatusModalProps) {
  // Auto-close after 8 seconds if approved, 10 if denied
  useEffect(() => {
    if (isOpen && status) {
      const timeout = setTimeout(onClose, status === 'approved' ? 8000 : 10000);
      return () => clearTimeout(timeout);
    }
  }, [isOpen, status, onClose]);

  if (!isOpen || !status) return null;

  const isApproved = status === 'approved';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-2xl max-w-md w-full mx-4 p-8 text-center">
        <div className={`text-5xl mb-4 ${isApproved ? 'text-green-500' : 'text-red-500'}`}>
          {isApproved ? '✅' : '❌'}
        </div>

        <h2 className="text-2xl font-bold mb-2">
          {isApproved ? 'Admin Decision Received' : 'Registration Denied'}
        </h2>

        <p className={`text-lg mb-6 ${isApproved ? 'text-green-700' : 'text-red-700'}`}>
          {isApproved
            ? 'Admin has approved your registration! You can now claim your tokens.'
            : 'Unfortunately, your registration was denied. Please contact support.'}
        </p>

        {isApproved && (
          <Button
            onClick={() => {
              onClaimClick?.();
              onClose();
            }}
            size="lg"
            className="w-full mb-3"
          >
            Claim Tokens Now
          </Button>
        )}

        <Button
          variant="secondary"
          onClick={onClose}
          size="lg"
          className="w-full"
        >
          Close
        </Button>
      </div>
    </div>
  );
}

export default StatusModal;
