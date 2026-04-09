import { useState, useCallback, useRef } from 'react';

export function useToast() {
  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(1800);

  const showToast = useCallback((msg: string) => {
    clearTimeout(timer.current);
    setMessage(msg);
    setVisible(true);
    timer.current = setTimeout(() => setVisible(false), 1800);
  }, []);

  return { message, visible, showToast };
}
