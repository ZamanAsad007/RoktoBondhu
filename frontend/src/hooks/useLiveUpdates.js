import { useEffect, useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { tokenStorage } from '../api/client';
import { useToast } from '../context/ToastContext';

/**
 * Custom React hook that connects to the SSE live updates stream (/api/stream),
 * automatically invalidates TanStack Query caches on real-time events,
 * displays user-friendly toast alerts, and falls back to polling when disconnected.
 *
 * @param {object} [options]
 * @param {string} [options.requestId] - Specific blood request ID to monitor
 * @param {boolean} [options.enabled=true] - Whether the live stream is enabled
 * @param {number} [options.fallbackInterval=10000] - Polling interval (ms) when SSE is disconnected
 * @param {function} [options.onEvent] - Optional callback (eventName, payload)
 * @returns {{ isConnected: boolean, lastEvent: object|null, pollingInterval: number|false }}
 */
export function useLiveUpdates({
  requestId = null,
  enabled = true,
  fallbackInterval = 10000,
  onEvent = null,
} = {}) {
  const [isConnected, setIsConnected] = useState(false);
  const [lastEvent, setLastEvent] = useState(null);
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) {
      setIsConnected(false);
      return;
    }

    const token = tokenStorage.getAccessToken();
    if (!token) {
      setIsConnected(false);
      return;
    }

    if (typeof window === 'undefined' || typeof window.EventSource === 'undefined') {
      setIsConnected(false);
      return;
    }

    const queryParams = new URLSearchParams();
    queryParams.set('token', token);
    if (requestId) {
      queryParams.set('requestId', requestId);
    }

    const streamUrl = `/api/stream?${queryParams.toString()}`;
    let eventSource;

    try {
      eventSource = new window.EventSource(streamUrl);
    } catch (err) {
      console.warn('[useLiveUpdates] Could not initialize EventSource:', err.message);
      setIsConnected(false);
      return;
    }

    eventSource.onopen = () => {
      setIsConnected(true);
    };

    eventSource.onerror = (err) => {
      setIsConnected(false);
    };

    function handleIncomingEvent(eventName, rawEvent) {
      let data = {};
      try {
        data = JSON.parse(rawEvent.data);
      } catch (e) {
        data = rawEvent.data;
      }

      setLastEvent({ event: eventName, data, timestamp: new Date().toISOString() });

      // Invalidate relevant query keys
      if (eventName === 'match.new') {
        queryClient.invalidateQueries({ queryKey: ['myMatches'] });
        queryClient.invalidateQueries({ queryKey: ['nearbyRequests'] });
        addToast({
          type: 'info',
          message: `New compatible blood request nearby (${data.bloodGroup || 'urgent'})!`,
        });
      } else if (eventName === 'match.accepted') {
        queryClient.invalidateQueries({ queryKey: ['bloodRequest', data.requestId] });
        queryClient.invalidateQueries({ queryKey: ['myRequests'] });
        queryClient.invalidateQueries({ queryKey: ['myMatches'] });
        const donorName = data.donorName || 'A donor';
        const progress = data.unitsNeeded ? ` (${data.acceptedCount}/${data.unitsNeeded} units)` : '';
        addToast({
          type: 'success',
          message: `${donorName} accepted your request${progress}!`,
        });
      } else if (eventName === 'request.fulfilled') {
        queryClient.invalidateQueries({ queryKey: ['bloodRequest', data.requestId] });
        queryClient.invalidateQueries({ queryKey: ['myRequests'] });
        queryClient.invalidateQueries({ queryKey: ['myMatches'] });
        addToast({
          type: 'success',
          message: 'Blood request fulfilled! All required donors have accepted.',
        });
      } else if (eventName === 'request.escalated') {
        queryClient.invalidateQueries({ queryKey: ['bloodRequest', data.requestId] });
        queryClient.invalidateQueries({ queryKey: ['myRequests'] });
        addToast({
          type: 'warning',
          message: 'Blood request escalated to CRITICAL SOS! Matching radius expanded.',
        });
      } else if (eventName === 'request.expired') {
        queryClient.invalidateQueries({ queryKey: ['bloodRequest', data.requestId] });
        queryClient.invalidateQueries({ queryKey: ['myRequests'] });
        addToast({
          type: 'info',
          message: 'Blood request has reached its expiration time.',
        });
      } else if (eventName === 'request.cancelled') {
        queryClient.invalidateQueries({ queryKey: ['bloodRequest', data.requestId] });
        queryClient.invalidateQueries({ queryKey: ['myRequests'] });
        addToast({
          type: 'info',
          message: 'Blood request has been cancelled.',
        });
      }

      if (typeof onEventRef.current === 'function') {
        onEventRef.current(eventName, data);
      }
    }

    eventSource.addEventListener('connected', () => {
      setIsConnected(true);
    });

    eventSource.addEventListener('match.new', (e) => handleIncomingEvent('match.new', e));
    eventSource.addEventListener('match.accepted', (e) => handleIncomingEvent('match.accepted', e));
    eventSource.addEventListener('request.fulfilled', (e) => handleIncomingEvent('request.fulfilled', e));
    eventSource.addEventListener('request.escalated', (e) => handleIncomingEvent('request.escalated', e));
    eventSource.addEventListener('request.expired', (e) => handleIncomingEvent('request.expired', e));
    eventSource.addEventListener('request.cancelled', (e) => handleIncomingEvent('request.cancelled', e));

    return () => {
      eventSource.close();
      setIsConnected(false);
    };
  }, [requestId, enabled, queryClient, addToast]);

  return {
    isConnected,
    lastEvent,
    // When SSE is connected, polling is disabled (false). On disconnect, fallback to pollingInterval.
    pollingInterval: isConnected ? false : fallbackInterval,
  };
}
