// Global toast notification utility
// Uses a callback pattern - App.tsx registers the handler, pages call toast()

let _handler: ((msg: string) => void) | null = null;

export const setToastHandler = (fn: (msg: string) => void) => {
  _handler = fn;
};

export const toast = (msg: string) => {
  _handler?.(msg);
};
