import { useState } from 'react';

export interface Toast {
  msg: string;
  error?: boolean;
}

export function useToast() {
  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = (msg: string, error = false) => {
    setToast({ msg, error });
    setTimeout(() => {
      setToast(null);
    }, 5000);
  };

  return {
    toast,
    showToast,
  };
}