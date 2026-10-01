import React, { useEffect, useState, useRef, useCallback } from 'react';
import { MessageSquareText, Clock, X, CalendarCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../utils/cn';
import { getSupportScheduleStatus, SupportScheduleStatus } from '../utils/supportSchedule';

export default function SupportChat() {
  const [isIdle, setIsIdle] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [scheduleStatus, setScheduleStatus] = useState<SupportScheduleStatus>(() => getSupportScheduleStatus());
  const [showScheduleNotice, setShowScheduleNotice] = useState(false);
  
  const idleTimerRef = useRef<NodeJS.Timeout | null>(null);
  const noticeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Resets the inactivity timer to smoothly fade the button
  const resetIdleTimer = useCallback((delay = 5000) => {
    if (idleTimerRef.current) {
      clearTimeout(idleTimerRef.current);
    }
    setIsIdle(false);
    idleTimerRef.current = setTimeout(() => {
      // Only become idle if the schedule notice is not open
      setIsIdle(true);
    }, delay);
  }, []);

  // Update schedule status every 30 seconds
  useEffect(() => {
    const updateSchedule = () => {
      setScheduleStatus(getSupportScheduleStatus());
    };

    updateSchedule();
    const scheduleInterval = setInterval(updateSchedule, 30000);

    return () => clearInterval(scheduleInterval);
  }, []);

  // Initialize Zammad script
  useEffect(() => {
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
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      clearInterval(interval);
    };
  }, [resetIdleTimer]);

  // Handle click outside to close notice
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showScheduleNotice && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowScheduleNotice(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showScheduleNotice) {
        setShowScheduleNotice(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showScheduleNotice]);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (idleTimerRef.current) clearTimeout(idleTimerRef.current);
    setIsIdle(false);
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    // Smooth transition back to semi-transparent if notice is not visible
    if (!showScheduleNotice) {
      resetIdleTimer(4000);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    resetIdleTimer(15000);

    // Re-check schedule status in real time
    const currentSchedule = getSupportScheduleStatus();
    setScheduleStatus(currentSchedule);

    // If outside operating hours: block chat opening and show friendly notice
    if (!currentSchedule.isOpen) {
      setShowScheduleNotice(true);

      // Auto-dismiss after 12 seconds of inactivity
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
      noticeTimerRef.current = setTimeout(() => {
        setShowScheduleNotice(false);
      }, 12000);
      return;
    }

    // Within operating hours: close any previous notice and open Zammad chat
    setShowScheduleNotice(false);
    const instance = (window as any).zammadChatInstance;
    if (instance && typeof instance.open === 'function') {
      try {
        instance.open();
      } catch (err) {
        console.warn('Error opening Zammad chat', err);
      }
    }
  };

  const closeNotice = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current);
    setShowScheduleNotice(false);
    resetIdleTimer(4000);
  };

  const isButtonDimmed = isIdle && !isHovered && !showScheduleNotice;

  return (
    <div ref={containerRef} className="fixed bottom-6 right-6 z-50 pointer-events-none">
      {/* Friendly Notice when clicked outside operating hours */}
      <AnimatePresence>
        {showScheduleNotice && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="pointer-events-auto absolute bottom-14 right-0 w-[320px] sm:w-[360px] p-4 sm:p-5 rounded-2xl bg-[var(--card)] text-[var(--text)] border border-[var(--border)] shadow-2xl backdrop-blur-xl z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
                  <Clock size={18} />
                </div>
                <div>
                  <h4 className="font-semibold text-sm tracking-tight text-[var(--text)]">Horario de Atención</h4>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                    Fuera de horario laboral
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={closeNotice}
                className="p-1 rounded-lg hover:bg-[var(--border)]/50 text-[var(--muted)] hover:text-[var(--text)] transition-colors cursor-pointer"
                title="Cerrar aviso"
              >
                <X size={16} />
              </button>
            </div>

            {/* Message Body */}
            <div className="space-y-3 text-xs leading-relaxed text-[var(--muted)]">
              <p>
                El horario de atención en vivo de soporte es de{' '}
                <strong className="text-[var(--text)] font-semibold">lunes a viernes de 9:00 AM a 5:00 PM</strong>{' '}
                (hora CDMX / GDL).
              </p>

              {/* Time Details Pill */}
              <div className="p-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] space-y-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="opacity-70">Hora actual (CDMX/GDL):</span>
                  <span className="font-semibold text-[var(--text)]">{scheduleStatus.currentTimeStr}</span>
                </div>
                <div className="flex items-center justify-between text-[11px]">
                  <span className="opacity-70">Reanudamos:</span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">{scheduleStatus.nextOpenStr}</span>
                </div>
              </div>

              <p className="text-[11px] opacity-80">
                Por favor regresa en nuestro horario de atención para contactarnos y recibir soporte personalizado en tiempo real.
              </p>
            </div>

            {/* Footer Action */}
            <div className="mt-4 pt-3 border-t border-[var(--border)] flex justify-end">
              <button
                type="button"
                onClick={closeNotice}
                className="px-4 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-colors shadow-sm cursor-pointer"
              >
                Entendido
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Support Trigger Button */}
      <button
        type="button"
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        title={
          scheduleStatus.isOpen
            ? "¿Necesitas ayuda? Clic para abrir chat de soporte"
            : "Soporte (Horario de atención: Lun - Vie de 9:00 AM a 5:00 PM hora CDMX/GDL)"
        }
        className={cn(
          "pointer-events-auto group relative !inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full text-white font-semibold text-xs tracking-tight",
          "bg-blue-600/95 dark:bg-blue-600/90 hover:bg-blue-600 border border-white/30 dark:border-white/20 backdrop-blur-md",
          "shadow-xl shadow-blue-600/25 hover:shadow-2xl hover:shadow-blue-500/40",
          "transition-all duration-500 ease-out select-none cursor-pointer",
          isButtonDimmed
            ? "opacity-25 hover:opacity-100 scale-95 hover:scale-100 border-white/10"
            : "opacity-100 scale-100"
        )}
      >
        <span className="relative flex items-center justify-center">
          <MessageSquareText size={16} className="text-white group-hover:scale-110 transition-transform duration-300" />
          {scheduleStatus.isOpen ? (
            <span
              className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 ring-2 ring-blue-600 animate-pulse"
              title="Soporte en línea"
            />
          ) : (
            <span
              className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-blue-600"
              title="Fuera de horario de atención"
            />
          )}
        </span>
        <span className="font-semibold tracking-tight text-white drop-shadow-sm">¿Necesitas ayuda?</span>
      </button>
    </div>
  );
}
