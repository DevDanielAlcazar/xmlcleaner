import React, { useEffect, useState, useRef } from 'react';
import { MessageSquareText } from 'lucide-react';
import { cn } from '../utils/cn';

export default function SupportChat() {
  const [isIdle, setIsIdle] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Resets the inactivity timer to smoothly fade the button
  const resetIdleTimer = (delay = 5000) => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    setIsIdle(false);
    idleTimerRef.current = setTimeout(() => {
      setIsIdle(true);
    }, delay);
  };

  useEffect(() => {
    // Initial 5-second countdown to become semi-transparent if untouched
    resetIdleTimer(5000);

    const initZammad = () => {
      if (typeof (window as any).ZammadChat === 'function') {
        if (!(window as any).zammadChatInstance) {
          try {
            (window as any).zammadChatInstance = new (window as any).ZammadChat({
              title: '¿Necesitas ayuda?',
              background: 'rgb(37,99,235)',
              fontSize: '12px',
              chatId: 2,
              show: false
            });
          } catch (err) {
            console.warn('[ZammadChat init]', err);
          }
        }
      }
    };

    // Load Zammad chat script if not already present
    const existingScript = document.querySelector('script[src*="chat-no-jquery.min.js"]');
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://soporte.ebillia.dpdns.org/assets/chat/chat-no-jquery.min.js';
      script.async = true;
      script.onload = () => {
        initZammad();
      };
      document.body.appendChild(script);
    } else {
      initZammad();
    }

    const interval = setInterval(() => {
      if (typeof (window as any).ZammadChat === 'function') {
        initZammad();
        clearInterval(interval);
      }
    }, 400);

    return () => {
      if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
      clearInterval(interval);
    };
  }, []);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    setIsIdle(false);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    // Smooth 4-second transition back to semi-transparent
    resetIdleTimer(4000);
  };

  const handleClick = (e: React.MouseEvent) => {
    resetIdleTimer(10000);
    const instance = (window as any).zammadChatInstance;
    if (instance && typeof instance.open === 'function') {
      try {
        instance.open();
      } catch (err) {
        console.warn('Error opening Zammad chat', err);
      }
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 pointer-events-none">
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        title="¿Necesitas ayuda? Clic para abrir soporte"
        className={cn(
          "open-zammad-chat pointer-events-auto group relative !inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full text-white font-semibold text-xs tracking-tight",
          "bg-blue-600/95 dark:bg-blue-600/90 hover:bg-blue-600 border border-white/30 dark:border-white/20 backdrop-blur-md",
          "shadow-xl shadow-blue-600/25 hover:shadow-2xl hover:shadow-blue-500/40",
          "transition-all duration-700 ease-out select-none cursor-pointer",
          isIdle && !isHovered
            ? "opacity-25 hover:opacity-100 scale-95 hover:scale-100 border-white/10"
            : "opacity-100 scale-100"
        )}
      >
        <span className="relative flex items-center justify-center">
          <MessageSquareText size={16} className="text-white group-hover:scale-110 transition-transform duration-300" />
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-blue-600 animate-pulse" />
        </span>
        <span className="font-semibold tracking-tight text-white drop-shadow-sm">¿Necesitas ayuda?</span>
      </button>
    </div>
  );
}
