import React, { useState, useEffect } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

interface ErrorNotificationProps {
  error: string | null;
  onClose: () => void;
}

export function ErrorNotification({ error, onClose }: ErrorNotificationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (error) {
      setIsVisible(true);
    }
  }, [error]);

  if (!error) return null;

  return (
    <>
      {/* Ícone de exclamação fixo no canto inferior direito */}
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={() => setIsVisible(!isVisible)}
          size="sm"
          variant="destructive"
          className="rounded-full w-12 h-12 shadow-lg animate-pulse hover:animate-none"
        >
          <AlertTriangle className="h-6 w-6" />
        </Button>
      </div>

      {/* Modal com detalhes do erro */}
      {isVisible && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <AlertTriangle className="h-5 w-5 text-red-500" />
                  <h3 className="font-semibold text-gray-900 dark:text-white">
                    Erro Detectado
                  </h3>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsVisible(false);
                    onClose();
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {error}
              </p>
              <div className="flex justify-end">
                <Button
                  onClick={() => {
                    setIsVisible(false);
                    onClose();
                  }}
                  size="sm"
                >
                  Entendi
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}