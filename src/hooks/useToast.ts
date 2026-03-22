import { useCallback } from 'react';
import { toast } from 'sonner';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastPayload {
  type?: ToastType;
  message: string;
  description?: string;
  duration?: number;
}

export type ShowToastInput = string | ToastPayload;

export function useToast() {
  const showToast = useCallback((input: ShowToastInput, error = false) => {
    const payload: ToastPayload = typeof input === 'string'
      ? { type: error ? 'error' : 'success', message: input }
      : { type: input.type ?? 'info', ...input };

    try {
      const method = payload.type ?? 'info';
      toast[method](payload.message, {
        description: payload.description,
        duration: payload.duration ?? 4000,
      });
    } catch (toastError) {
      // Notifications are intentionally non-blocking.
      console.warn('Toast unavailable:', toastError);
    }
  }, []);

  return {
    showToast,
  };
}
