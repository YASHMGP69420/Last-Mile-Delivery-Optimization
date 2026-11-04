import React, { useEffect, useState } from 'react';

/**
 * Simple toast notification that auto‑dismisses after a short timeout.
 * Props:
 *   - message: text to display
 *   - onClose: callback fired when the toast disappears
 */
export const Toast: React.FC<{ message: string; onClose: () => void }> = ({ message, onClose }) => {
  const [visible, setVisible] = useState(true);

  // Auto‑close after 3 seconds
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onClose();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-emerald-600 text-white px-4 py-2 rounded shadow-lg animate-fade-in">
      {message}
    </div>
  );
};
