import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { useCallStore } from '../store/callStore';
import { useAgentStore } from '../store/agentStore';

let socket = null;

export function useSocket() {
  const initialized = useRef(false);
  const addInboundCall = useCallStore(s => s.addInboundCall);
  const removeCall = useCallStore(s => s.removeCall);
  const fetchTodayStats = useCallStore(s => s.fetchTodayStats);
  const updateStatus = useAgentStore(s => s.updateStatus);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    socket = io('http://localhost:3001');

    socket.on('inbound_call', (data) => {
      addInboundCall(data);
    });

    socket.on('call_hangup', (data) => {
      removeCall(data.unique_id);
      fetchTodayStats();
    });

    socket.on('call_answered', (data) => {
      fetchTodayStats();
    });

    socket.on('santral_event', (data) => {
      if (data.scenario === 'Hangup') {
        removeCall(data.unique_id);
        fetchTodayStats();
      }
    });

    return () => {
      socket?.disconnect();
      initialized.current = false;
    };
  }, []);

  return socket;
}
