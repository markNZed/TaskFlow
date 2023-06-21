import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';

const EventSourceContext = createContext();

export const useEventSource = () => {
  const context = useContext(EventSourceContext);
  if (!context) {
    throw new Error('useEventSource must be used within an EventSourceProvider');
  }
  return context;
};

export const EventSourceProvider = ({ children }) => {
  const [eventSource, setEventSource] = useState(null);
  const isMounted = useRef(false);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    isMounted.current = true;

    return () => {
      isMounted.current = false;
    };
  }, []);

  const subscribe = useCallback((eventType, callback) => {
    if (!initialized) {
      return;
    }
    if (!eventSource) {
      console.error('Event source not initialized');
      return;
    }
    eventSource?.addEventListener(eventType, callback);
  }, [eventSource]);

  const unsubscribe = useCallback((eventType, callback) => {
    if (!initialized) {
      return;
    }
    if (!eventSource) {
      console.error('Event source not initialized');
      return;
    }
    eventSource?.removeEventListener(eventType, callback);
  }, [eventSource]);

  const publish = useCallback((eventType, data) => {
    if (!initialized) {
      return;
    }
    if (!eventSource) {
      console.error('Event source not initialized');
      return;
    }
    const event = new CustomEvent(eventType, { detail: data });
    eventSource?.dispatchEvent(event);
  }, [eventSource]);

  const initializeEventSource = useCallback(() => {
    if (!eventSource) {
      setEventSource(new EventTarget());
      setInitialized(true);
    }
  }, [eventSource]);

  useEffect(() => {
    initializeEventSource();
  }, []); // Empty dependency array makes this effect run once on mount  

  return (
    <EventSourceContext.Provider
      value={{ subscribe, unsubscribe, publish, initialized }}
    >
      {children}
    </EventSourceContext.Provider>
  );
};
