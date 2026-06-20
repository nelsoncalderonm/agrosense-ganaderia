'use client';

import { useState, useRef, useCallback } from 'react';

// Nordic UART Service — standard BLE serial used by most RFID readers
const NUS_SERVICE = '6e400001-b5ba-f393-e0a9-e50e24dcca9e';
// TX characteristic: device → phone (notifications)
const NUS_TX_CHAR = '6e400003-b5ba-f393-e0a9-e50e24dcca9e';

export type BtStatus = 'disconnected' | 'connecting' | 'connected' | 'unsupported';

export interface UseBluetooth {
  status: BtStatus;
  deviceName: string | null;
  error: string | null;
  connect: () => Promise<void>;
  disconnect: () => void;
}

export function useBluetooth(onTag: (rawTag: string) => void): UseBluetooth {
  const [status, setStatus] = useState<BtStatus>(() =>
    typeof navigator !== 'undefined' && 'bluetooth' in navigator
      ? 'disconnected'
      : 'unsupported'
  );
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const deviceRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const charRef = useRef<any>(null);
  const bufRef = useRef('');

  const handleNotification = useCallback((event: Event) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const value = (event.target as any).value as DataView;
    const chunk = new TextDecoder().decode(value);
    bufRef.current += chunk;

    // Most readers terminate tag with \r\n or \n
    const lines = bufRef.current.split(/\r?\n/);
    bufRef.current = lines.pop() ?? '';
    for (const line of lines) {
      const tag = line.trim();
      if (tag) onTag(tag);
    }
  }, [onTag]);

  const disconnect = useCallback(() => {
    if (charRef.current) {
      try { charRef.current.removeEventListener('characteristicvaluechanged', handleNotification); } catch { /* ignore */ }
      charRef.current = null;
    }
    if (deviceRef.current?.gatt?.connected) {
      try { deviceRef.current.gatt.disconnect(); } catch { /* ignore */ }
    }
    deviceRef.current = null;
    bufRef.current = '';
    setDeviceName(null);
    setStatus('disconnected');
    setError(null);
  }, [handleNotification]);

  const connect = useCallback(async () => {
    if (!('bluetooth' in navigator)) {
      setStatus('unsupported');
      return;
    }
    setError(null);
    setStatus('connecting');

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const device = await (navigator as any).bluetooth.requestDevice({
        filters: [{ services: [NUS_SERVICE] }],
        // fallback: accept any BLE device that advertises the NUS service
        optionalServices: [NUS_SERVICE],
      });

      deviceRef.current = device;
      setDeviceName(device.name ?? 'Lector RFID');

      device.addEventListener('gattserverdisconnected', () => {
        setStatus('disconnected');
        setDeviceName(null);
        setError('Lector desconectado');
      });

      const server = await device.gatt.connect();
      const service = await server.getPrimaryService(NUS_SERVICE);
      const char = await service.getCharacteristic(NUS_TX_CHAR);

      charRef.current = char;
      char.addEventListener('characteristicvaluechanged', handleNotification);
      await char.startNotifications();

      setStatus('connected');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('cancelled') || msg.includes('User cancelled')) {
        setStatus('disconnected');
      } else {
        setError(msg);
        setStatus('disconnected');
      }
    }
  }, [handleNotification]);

  return { status, deviceName, error, connect, disconnect };
}
