import { useState, useEffect } from 'react';

let loadingCount = 0;
let listeners: Array<() => void> = [];

const notifyListeners = () => {
  listeners.forEach((listener) => listener());
};

export const useApiLoading = () => {
  const [, forceUpdate] = useState({});

  useEffect(() => {
    const update = () => {
      forceUpdate({});
    };
    
    listeners.push(update);
    
    return () => {
      listeners = listeners.filter((l) => l !== update);
    };
  }, []);

  return loadingCount > 0;
};

export const startLoading = () => {
  loadingCount++;
  notifyListeners();
};

export const stopLoading = () => {
  loadingCount = Math.max(0, loadingCount - 1);
  notifyListeners();
};
