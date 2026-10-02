'use client';

import { useState, useCallback } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';

interface AlertOptions {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

interface ConfirmOptions {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
}

export function useAlert() {
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertConfig, setAlertConfig] = useState<AlertOptions>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmConfig, setConfirmConfig] = useState<ConfirmOptions>({});
  const [confirmResolve, setConfirmResolve] = useState<((value: boolean) => void) | null>(null);

  const showAlert = useCallback((message: string, options: AlertOptions = {}) => {
    setAlertConfig({
      title: options.title || 'Alert',
      description: message,
      confirmText: options.confirmText || 'OK',
      variant: options.variant || 'default',
    });
    setAlertOpen(true);
  }, []);

  const showConfirm = useCallback((message: string, options: ConfirmOptions = {}): Promise<boolean> => {
    return new Promise((resolve) => {
      setConfirmConfig({
        title: options.title || 'Confirm',
        description: message,
        confirmText: options.confirmText || 'Confirm',
        cancelText: options.cancelText || 'Cancel',
        variant: options.variant || 'default',
      });
      setConfirmResolve(() => resolve);
      setConfirmOpen(true);
    });
  }, []);

  const showError = useCallback((message: string) => {
    toast.error(message, {
      duration: 5000,
      style: {
        background: '#dc2626',
        color: 'white',
        border: '1px solid #b91c1c',
      },
    });
  }, []);

  const showSuccess = useCallback((message: string) => {
    toast.success(message, {
      duration: 3000,
      style: {
        background: '#16a34a',
        color: 'white',
        border: '1px solid #15803d',
      },
    });
  }, []);

  const showWarning = useCallback((message: string) => {
    toast.warning(message, {
      duration: 4000,
      style: {
        background: '#d97706',
        color: 'white',
        border: '1px solid #b45309',
      },
    });
  }, []);

  const showInfo = useCallback((message: string) => {
    toast.info(message, {
      duration: 3000,
      style: {
        background: '#2563eb',
        color: 'white',
        border: '1px solid #1d4ed8',
      },
    });
  }, []);

  const handleAlertClose = useCallback(() => {
    setAlertOpen(false);
  }, []);

  const handleConfirmClose = useCallback((confirmed: boolean) => {
    setConfirmOpen(false);
    if (confirmResolve) {
      confirmResolve(confirmed);
      setConfirmResolve(null);
    }
  }, [confirmResolve]);

  const AlertComponent = () => (
    <AlertDialog open={alertOpen} onOpenChange={setAlertOpen}>
      <AlertDialogContent className="bg-gray-900 border-gray-700 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">
            {alertConfig.title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-gray-300">
            {alertConfig.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction
            onClick={handleAlertClose}
            className={`${
              alertConfig.variant === 'destructive'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {alertConfig.confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const ConfirmComponent = () => (
    <AlertDialog open={confirmOpen} onOpenChange={(open) => !open && handleConfirmClose(false)}>
      <AlertDialogContent className="bg-gray-900 border-gray-700 text-white">
        <AlertDialogHeader>
          <AlertDialogTitle className="text-white">
            {confirmConfig.title}
          </AlertDialogTitle>
          <AlertDialogDescription className="text-gray-300">
            {confirmConfig.description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={() => handleConfirmClose(false)}
            className="bg-gray-700 hover:bg-gray-600 text-white border-gray-600"
          >
            {confirmConfig.cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => handleConfirmClose(true)}
            className={`${
              confirmConfig.variant === 'destructive'
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-blue-600 hover:bg-blue-700 text-white'
            }`}
          >
            {confirmConfig.confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return {
    showAlert,
    showConfirm,
    showError,
    showSuccess,
    showWarning,
    showInfo,
    AlertComponent,
    ConfirmComponent,
  };
}
