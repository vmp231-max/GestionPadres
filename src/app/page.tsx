'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Calendar, 
  Pill, 
  Bell, 
  Check, 
  Volume2, 
  ArrowLeft, 
  User, 
  Clock, 
  MapPin, 
  AlertTriangle,
  Info,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Lock,
  Delete,
  Activity
} from 'lucide-react';
import { 
  isScheduledForToday, 
  isPrnMedication, 
  getScheduleDescription 
} from '@/lib/medication-schedule';

interface Parent {
  id: string;
  name: string;
  avatar_url?: string;
}

interface Appointment {
  id: string;
  title: string;
  description?: string;
  start_time: string;
  end_time: string;
  location?: string;
}

interface Medication {
  id: string;
  name: string;
  dose: string;
  frequency: string;
  period?: string;
  schedule_type?: string;
  schedule_days?: string;
  comments?: string;
  active: boolean;
  created_at?: string;
}

interface Notice {
  id: string;
  parent_id: string | null;
  message: string;
  type: 'info' | 'warning' | 'alert';
  created_at: string;
  is_read: boolean;
}

export default function TabletDashboard() {
  const [selectedParent, setSelectedParent] = useState<Parent | null>(null);
  const [parents, setParents] = useState<Parent[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [takenMeds, setTakenMeds] = useState<string[]>([]);
  const [showTakenMeds, setShowTakenMeds] = useState<boolean>(false);
  const [timeString, setTimeString] = useState<string>('');
  const [dateString, setDateString] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authChecking, setAuthChecking] = useState<boolean>(true);
  const [inputPin, setInputPin] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');
  const [isVerifyingPin, setIsVerifyingPin] = useState<boolean>(false);
  const [linkedAccountId, setLinkedAccountId] = useState<string | null>(null);
  const [linkedAccountName, setLinkedAccountName] = useState<string>('');
  const [availableAccounts, setAvailableAccounts] = useState<{ id: string; name: string }[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');

  // 0. Comprobar sesión de acceso persistente de la tablet
  useEffect(() => {
    try {
      const token = localStorage.getItem('tablet_session_token');
      const accId = localStorage.getItem('tablet_account_id');
      const accName = localStorage.getItem('tablet_account_name') || 'Mi Familia';

      if (token) {
        const parts = token.split('.');
        const expiresAt = parseInt(parts[0], 10);
        if (!isNaN(expiresAt) && Date.now() < expiresAt) {
          setIsAuthenticated(true);
          setLinkedAccountId(accId || (parts.length > 2 ? parts[1] : null));
          setLinkedAccountName(accName);
        } else {
          localStorage.removeItem('tablet_session_token');
          localStorage.removeItem('tablet_account_id');
          localStorage.removeItem('tablet_account_name');
          setIsAuthenticated(false);
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (e) {
      setIsAuthenticated(false);
    } finally {
      setAuthChecking(false);
    }
  }, []);

  // Cargar lista de cuentas familiares para el selector si no está autenticado
  useEffect(() => {
    if (!isAuthenticated) {
      fetch('/api/auth/accounts')
        .then(res => res.json())
        .then(data => {
          const accs = data.accounts || [];
          setAvailableAccounts(accs);
          if (accs.length > 0) {
            const prevAccId = localStorage.getItem('tablet_account_id');
            if (prevAccId && accs.some((a: any) => a.id === prevAccId)) {
              setSelectedAccountId(prevAccId);
            } else {
              setSelectedAccountId(accs[0].id);
            }
          }
        })
        .catch(err => console.error('Error al cargar cuentas familiares:', err));
    }
  }, [isAuthenticated]);

  const handleVerifyPin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputPin.trim() || isVerifyingPin) return;

    setIsVerifyingPin(true);
    setPinError('');

    try {
      const res = await fetch('/api/auth/verify-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          pin: inputPin.trim(),
          accountId: selectedAccountId || undefined
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Clave o PIN incorrecto');
      }

      localStorage.setItem('tablet_session_token', data.token);
      if (data.account) {
        localStorage.setItem('tablet_account_id', data.account.id);
        localStorage.setItem('tablet_account_name', data.account.name);
        setLinkedAccountId(data.account.id);
        setLinkedAccountName(data.account.name);
      }
      setIsAuthenticated(true);
      setInputPin('');
    } catch (err: any) {
      setPinError(err.message || 'Clave o PIN incorrecto. Inténtalo de nuevo.');
      setInputPin('');
    } finally {
      setIsVerifyingPin(false);
    }
  };

  const handleLockSession = () => {
    setSelectedParent(null);
  };

  const handleUnlinkAccount = () => {
    if (!confirm('¿Deseas desvincular esta tablet de la familia actual? Tendrás que volver a introducir el PIN para acceder.')) return;
    localStorage.removeItem('tablet_session_token');
    localStorage.removeItem('tablet_account_id');
    localStorage.removeItem('tablet_account_name');
    setIsAuthenticated(false);
    setSelectedParent(null);
    setLinkedAccountId(null);
    setLinkedAccountName('');
    setInputPin('');
  };

  // 1. Cargar familiares pertenecientes exclusivamente a esta cuenta
  const loadParents = useCallback(async () => {
    if (!linkedAccountId) {
      setParents([]);
      return;
    }
    try {
      setLoading(true);
      let query = supabase.from('parents').select('*').order('name', { ascending: true });
      if (linkedAccountId !== 'default') {
        query = query.eq('account_id', linkedAccountId);
      }
      const { data, error } = await query;

      if (error) throw error;
      setParents(data || []);
    } catch (err) {
      console.error('Error al cargar familiares:', err);
    } finally {
      setLoading(false);
    }
  }, [linkedAccountId]);

  useEffect(() => {
    if (isAuthenticated) {
      loadParents();
    }
  }, [isAuthenticated, loadParents]);

  // 2. Reloj en tiempo real (grande y legible)
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }));
      setDateString(now.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }));
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // 3. Control de tomas de medicamentos (Reset diario con localStorage)
  useEffect(() => {
    if (!selectedParent) return;
    
    const today = new Date().toDateString();
    const storageKey = `taken_meds_${selectedParent.id}_${today}`;
    const stored = localStorage.getItem(storageKey);
    
    if (stored) {
      setTakenMeds(JSON.parse(stored));
    } else {
      // Limpiar localStorages viejos del mismo padre para no llenar memoria
      Object.keys(localStorage).forEach(key => {
        if (key.startsWith(`taken_meds_${selectedParent.id}_`)) {
          localStorage.removeItem(key);
        }
      });
      setTakenMeds([]);
    }
  }, [selectedParent]);

  const toggleMedTaken = (medId: string) => {
    if (!selectedParent) return;
    
    const today = new Date().toDateString();
    const storageKey = `taken_meds_${selectedParent.id}_${today}`;
    
    let newTaken: string[];
    if (takenMeds.includes(medId)) {
      newTaken = takenMeds.filter(id => id !== medId);
    } else {
      newTaken = [...takenMeds, medId];
      // Pequeño sonido de confirmación al marcar
      try {
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(600, audioCtx.currentTime); // Frecuencia
        gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
      } catch (e) {
        console.log('AudioContext no soportado o bloqueado');
      }
    }
    
    setTakenMeds(newTaken);
    localStorage.setItem(storageKey, JSON.stringify(newTaken));
  };

  // 4. Lector de voz para los Avisos (Text-To-Speech)
  const speakMessage = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      // Detener cualquier locución previa
      window.speechSynthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      utterance.rate = 0.9; // Hablar un poco más lento para mejor comprensión
      
      // Buscar una voz en español masculina/femenina clara
      const voices = window.speechSynthesis.getVoices();
      const spanishVoice = voices.find(voice => voice.lang.startsWith('es'));
      if (spanishVoice) {
        utterance.voice = spanishVoice;
      }
      
      window.speechSynthesis.speak(utterance);
    }
  }, []);

  // 5. Cargar datos específicos de un padre (Citas, Medicamentos, Avisos)
  const loadParentData = useCallback(async (parentId: string) => {
    try {
      // Mostrar citas desde el inicio del día actual (00:00) para que no desaparezcan las de hoy
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Citas médicas (de hoy en adelante)
      const { data: appts, error: apptsError } = await supabase
        .from('appointments')
        .select('*')
        .eq('parent_id', parentId)
        .gte('end_time', todayStart.toISOString())
        .order('start_time', { ascending: true });

      if (apptsError) throw apptsError;
      setAppointments(appts || []);

      // Medicación activa
      const { data: meds, error: medsError } = await supabase
        .from('medications')
        .select('*')
        .eq('parent_id', parentId)
        .eq('active', true);

      if (medsError) throw medsError;
      setMedications(meds || []);

      // Avisos no leídos (específicos de este padre o de ambos 'parent_id IS NULL')
      const { data: ntc, error: ntcError } = await supabase
        .from('notices')
        .select('*')
        .or(`parent_id.eq.${parentId},parent_id.is.null`)
        .eq('is_read', false)
        .order('created_at', { ascending: false });

      if (ntcError) throw ntcError;
      setNotices(ntc || []);

    } catch (err) {
      console.error('Error al cargar datos del dashboard:', err);
    }
  }, []);

  useEffect(() => {
    if (!selectedParent) return;

    loadParentData(selectedParent.id);

    // 6. Suscripción en Tiempo Real con Supabase para Avisos, Medicamentos y Citas
    const channelName = `tablet-realtime-${selectedParent.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notices' },
        (payload) => {
          console.log('[Realtime] Cambio detectado en avisos:', payload);
          if (payload.eventType === 'INSERT') {
            const newNotice = payload.new as Notice;
            if (!newNotice.is_read && (newNotice.parent_id === selectedParent.id || newNotice.parent_id === null)) {
              speakMessage(`Nuevo aviso importante: ${newNotice.message}`);
            }
          }
          loadParentData(selectedParent.id);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'medications' },
        () => {
          console.log('[Realtime] Cambio detectado en medicamentos');
          loadParentData(selectedParent.id);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => {
          console.log('[Realtime] Cambio detectado en citas');
          loadParentData(selectedParent.id);
        }
      )
      .subscribe((status) => {
        console.log('[Realtime] Estado de suscripción:', status);
      });

    // 7. Refresco automático de datos cada hora (y sondeo rápido de avisos cada 20s)
    const HOURLY_REFRESH_MS = 60 * 60 * 1000; // 1 hora
    const hourlyTimer = setInterval(() => {
      console.log('[Tablet] Ejecutando refresco automático programado cada hora...');
      loadParentData(selectedParent.id);
    }, HOURLY_REFRESH_MS);

    // Sondeo de respaldo para avisos cada 20 segundos
    const NOTICE_POLL_MS = 20 * 1000;
    const noticePollTimer = setInterval(async () => {
      try {
        const { data: ntc, error: ntcError } = await supabase
          .from('notices')
          .select('*')
          .or(`parent_id.eq.${selectedParent.id},parent_id.is.null`)
          .eq('is_read', false)
          .order('created_at', { ascending: false });

        if (!ntcError && ntc) {
          setNotices((current) => {
            const currentIds = new Set(current.map(n => n.id));
            const newOnes = ntc.filter(n => !currentIds.has(n.id));
            if (newOnes.length > 0) {
              console.log('[Avisos Poll] Nuevo aviso detectado:', newOnes[0]);
              speakMessage(`Nuevo aviso: ${newOnes[0].message}`);
            }
            return ntc;
          });
        }
      } catch (err) {
        console.error('[Avisos Poll] Error en sondeo de respaldo:', err);
      }
    }, NOTICE_POLL_MS);

    // Refrescar inmediatamente cuando la tablet se active o vuelva a estar visible
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[Tablet] Pantalla activa: refrescando datos del dashboard...');
        loadParentData(selectedParent.id);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(hourlyTimer);
      clearInterval(noticePollTimer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [selectedParent, loadParentData, speakMessage]);

  // 7. Sincronización automática de Google Calendar cada 5 horas (desde la tablet)
  useEffect(() => {
    const SYNC_INTERVAL_MS = 5 * 60 * 60 * 1000;
    const STORAGE_KEY = 'tablet_last_calendar_sync_time';

    const runAutoSync = async () => {
      try {
        const lastSyncStr = localStorage.getItem(STORAGE_KEY);
        const lastSync = lastSyncStr ? parseInt(lastSyncStr, 10) : 0;
        const now = Date.now();

        if (!lastSync || now - lastSync >= SYNC_INTERVAL_MS) {
          console.log('[Tablet] Ejecutando sincronización periódica de citas (cada 5 horas)...');
          const res = await fetch('/api/calendar/sync');
          if (res.ok) {
            localStorage.setItem(STORAGE_KEY, now.toString());
            if (selectedParent) {
              loadParentData(selectedParent.id);
            }
          }
        }
      } catch (err) {
        console.error('[Tablet] Error en la sincronización periódica de calendario:', err);
      }
    };

    runAutoSync();

    // Comprobar cada 10 minutos si ya transcurrieron las 5 horas
    const intervalId = setInterval(runAutoSync, 10 * 60 * 1000);

    // Comprobar al reactivarse la pantalla o pestaña
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        runAutoSync();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [selectedParent, loadParentData]);

  // 8. Confirmar lectura de aviso
  const acknowledgeNotice = async (noticeId: string) => {
    try {
      const { error } = await supabase
        .from('notices')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', noticeId);

      if (error) throw error;
      
      // Remover localmente
      setNotices(prev => prev.filter(n => n.id !== noticeId));
      
      // Detener lectura de voz si el usuario pulsa confirmar
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    } catch (err) {
      console.error('Error al confirmar aviso:', err);
    }
  };

  // Clasificar medicamentos por momento del día (Mañana, Mediodia, Tarde, Noche) programados para HOY
  const getMedicationByPeriod = (period: 'mañana' | 'mediodia' | 'tarde' | 'noche', includeTaken: boolean = false) => {
    return medications.filter(med => {
      // 1. Excluir medicamentos SOS / Si precisa (esos van en su sección especial)
      if (isPrnMedication(med)) {
        return false;
      }

      // 2. Comprobar si corresponde tomarlo HOY según su pauta/periodicidad
      if (!isScheduledForToday(med)) {
        return false;
      }

      // 3. Si no se pide incluir las tomadas, excluir los medicamentos ya tomados hoy
      if (!includeTaken && takenMeds.includes(med.id)) {
        return false;
      }

      // 4. Si el medicamento tiene configurado explícitamente el campo 'period', respetarlo
      if (med.period) {
        const norm = med.period.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const target = period.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        if (norm.includes(target)) return true;
        return false;
      }

      // 5. Heurística de retrocompatibilidad para registros antiguos sin campo 'period'
      const freq = (med.frequency + ' ' + (med.comments || '')).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
      
      if (period === 'mañana') {
        return freq.includes('manana') || freq.includes('desayuno') || freq.includes('8h') || freq.includes('8 horas') || freq.includes('despertar') || (!freq.includes('tarde') && !freq.includes('noche') && !freq.includes('cena') && !freq.includes('almuerzo') && !freq.includes('comida') && !freq.includes('mediodia'));
      }
      if (period === 'mediodia') {
        return freq.includes('mediodia') || freq.includes('comida') || freq.includes('almuerzo') || freq.includes('13h') || freq.includes('14h') || freq.includes('15h');
      }
      if (period === 'tarde') {
        return freq.includes('tarde') || freq.includes('merienda') || freq.includes('17h') || freq.includes('18h') || freq.includes('19h');
      }
      if (period === 'noche') {
        return freq.includes('noche') || freq.includes('cena') || freq.includes('acostar') || freq.includes('dormir') || freq.includes('20h') || freq.includes('21h') || freq.includes('22h');
      }
      return false;
    });
  };

  const getNoticeStyle = (type: string) => {
    switch (type) {
      case 'alert':
        return { border: '3px solid var(--color-error)', background: 'var(--color-error-bg)' };
      case 'warning':
        return { border: '3px solid var(--color-warning)', background: 'var(--color-warning-bg)' };
      default:
        return { border: '3px solid var(--color-info)', background: 'var(--color-info-bg)' };
    }
  };

  if (authChecking || (isAuthenticated && loading)) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '20px' }}>
        <div style={{ width: '50px', height: '50px', border: '5px solid var(--glass-border)', borderTopColor: 'var(--color-info)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
        <p style={{ fontSize: '1.5rem', color: 'var(--color-text-secondary)' }}>Cargando portal médico...</p>
        <style jsx global>{`
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  // PANTALLA 0: Bloqueo de Seguridad (Clave PIN con sesión de 30 días)
  if (!isAuthenticated) {
    const handleKeypadPress = (val: string) => {
      if (val === 'clear') {
        setInputPin('');
      } else if (val === 'backspace') {
        setInputPin(prev => prev.slice(0, -1));
      } else {
        if (inputPin.length < 12) {
          setInputPin(prev => prev + val);
        }
      }
    };

    return (
      <main style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', justifyContent: 'center', alignItems: 'center', padding: '24px' }}>
        <div className="bg-blobs">
          <div className="blob blob-1"></div>
          <div className="blob blob-2"></div>
        </div>

        <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px', padding: '36px 28px', textAlign: 'center' }}>
          <div style={{ width: '68px', height: '68px', borderRadius: '50%', background: 'rgba(6, 182, 212, 0.15)', border: '1px solid rgba(6, 182, 212, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-info)' }}>
            <Lock size={32} />
          </div>

          <div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 800 }}>Acceso Protegido</h1>
            <p style={{ fontSize: '1rem', color: 'var(--color-text-secondary)', marginTop: '4px' }}>
              Introduce el PIN para acceder al Portal Médico
            </p>
          </div>

          {pinError && (
            <div style={{ width: '100%', padding: '10px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--color-error-bg)', color: 'var(--color-error)', fontSize: '0.9rem', border: '1px solid rgba(239, 68, 68, 0.3)' }}>
              {pinError}
            </div>
          )}

          <form onSubmit={handleVerifyPin} style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {availableAccounts.length > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', textAlign: 'left' }}>
                <label style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Familia a vincular:</label>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {availableAccounts.map(acc => {
                    const isAccSelected = selectedAccountId === acc.id;
                    return (
                      <button
                        key={acc.id}
                        type="button"
                        onClick={() => setSelectedAccountId(acc.id)}
                        style={{
                          flex: 1,
                          minWidth: '120px',
                          padding: '8px 12px',
                          borderRadius: 'var(--radius-sm)',
                          background: isAccSelected ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255, 255, 255, 0.03)',
                          border: isAccSelected ? '2px solid #3b82f6' : '1px solid var(--glass-border)',
                          color: isAccSelected ? '#60a5fa' : 'var(--color-text-muted)',
                          fontWeight: isAccSelected ? 700 : 500,
                          cursor: 'pointer',
                          fontSize: '0.9rem',
                          textAlign: 'center',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        {acc.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div style={{ position: 'relative', width: '100%' }}>
              <input
                type="password"
                inputMode="numeric"
                value={inputPin}
                onChange={(e) => setInputPin(e.target.value)}
                placeholder="PIN de acceso"
                autoFocus
                style={{
                  width: '100%',
                  padding: '14px 20px',
                  fontSize: '1.6rem',
                  letterSpacing: '6px',
                  textAlign: 'center',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '2px solid var(--glass-border)',
                  borderRadius: 'var(--radius-md)',
                  color: '#ffffff',
                  outline: 'none'
                }}
              />
            </div>

            {/* Teclado numérico táctil optimizado para tablet */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '4px' }}>
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => handleKeypadPress(num)}
                  className="btn btn-secondary"
                  style={{ height: '56px', fontSize: '1.5rem', fontWeight: 700, borderRadius: 'var(--radius-md)' }}
                >
                  {num}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handleKeypadPress('clear')}
                className="btn btn-secondary"
                style={{ height: '56px', fontSize: '0.9rem', fontWeight: 600, borderRadius: 'var(--radius-md)', color: 'var(--color-text-muted)' }}
              >
                Borrar
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('0')}
                className="btn btn-secondary"
                style={{ height: '56px', fontSize: '1.5rem', fontWeight: 700, borderRadius: 'var(--radius-md)' }}
              >
                0
              </button>
              <button
                type="button"
                onClick={() => handleKeypadPress('backspace')}
                className="btn btn-secondary"
                style={{ height: '56px', fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 'var(--radius-md)' }}
              >
                <Delete size={20} />
              </button>
            </div>

            <button
              type="submit"
              disabled={isVerifyingPin || !inputPin.trim()}
              className="btn btn-primary"
              style={{ width: '100%', height: '56px', fontSize: '1.15rem', fontWeight: 700, marginTop: '8px', borderRadius: 'var(--radius-md)' }}
            >
              {isVerifyingPin ? 'Verificando...' : 'Desbloquear'}
            </button>
          </form>

          <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: 1.4 }}>
            🔒 Este dispositivo recordará el acceso durante 30 días sin volver a solicitar el PIN.
          </p>
        </div>
      </main>
    );
  }

const AVATAR_GRADIENTS = [
  'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)', // Rosa
  'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)', // Azul
  'linear-gradient(135deg, #10b981 0%, #059669 100%)', // Verde
  'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', // Violeta
  'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)', // Ámbar
  'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)', // Cian
];

function getAvatarGradient(name: string, index: number) {
  const lower = name.toLowerCase();
  if (lower.includes('mamá') || lower.includes('mama')) return AVATAR_GRADIENTS[0];
  if (lower.includes('papá') || lower.includes('papa')) return AVATAR_GRADIENTS[1];
  return AVATAR_GRADIENTS[index % AVATAR_GRADIENTS.length];
}

  // PANTALLA 1: Selección de Perfil Familiar
  if (!selectedParent) {
    return (
      <main style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        <div className="bg-blobs">
          <div className="blob blob-1"></div>
          <div className="blob blob-2"></div>
        </div>

        <div style={{ textAlign: 'center', marginBottom: '40px' }}>
          <span style={{ fontSize: '1.1rem', color: 'var(--color-info)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {linkedAccountName ? `Cuenta: ${linkedAccountName}` : 'Portal Médico Familiar'}
          </span>
          <h1 style={{ fontSize: '2.8rem', fontWeight: 800, marginTop: '6px' }}>¿Quién eres?</h1>
          <p style={{ fontSize: '1.3rem', color: 'var(--color-text-secondary)', marginTop: '8px' }}>
            Selecciona tu perfil para ver tu medicación y citas de hoy
          </p>
        </div>

        {parents.length === 0 ? (
          <div className="glass-panel" style={{ padding: '36px', textAlign: 'center', maxWidth: '500px' }}>
            <AlertTriangle size={40} color="var(--color-warning)" style={{ margin: '0 auto 16px' }} />
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700 }}>Sin familiares registrados</h2>
            <p style={{ color: 'var(--color-text-secondary)', marginTop: '8px', fontSize: '1rem' }}>
              No hay familiares dados de alta para esta cuenta. Accede al Panel de Administración (<strong>/admin</strong>) para añadir familiares.
            </p>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: '32px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '1000px', width: '100%' }}>
            {parents.map((parent, index) => (
              <button
                key={parent.id}
                onClick={() => setSelectedParent(parent)}
                className="glass-panel"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '20px',
                  width: '280px',
                  padding: '36px 24px',
                  cursor: 'pointer',
                  borderRadius: 'var(--radius-xl)',
                  border: '2px solid var(--glass-border)',
                  outline: 'none',
                  textDecoration: 'none',
                  transition: 'transform 0.15s ease, border-color 0.15s ease'
                }}
              >
                <div style={{
                  width: '130px',
                  height: '130px',
                  borderRadius: '50%',
                  background: getAvatarGradient(parent.name, index),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                  color: 'white',
                  fontSize: '3.8rem',
                  fontWeight: 700
                }}>
                  {parent.name.charAt(0)}
                </div>
                <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{parent.name}</span>
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '24px', marginTop: '40px', alignItems: 'center' }}>
          <button
            onClick={handleUnlinkAccount}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--color-text-muted)',
              fontSize: '0.9rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            <Lock size={15} />
            <span>Desvincular / Cambiar de Familia</span>
          </button>
        </div>
      </main>
    );
  }

  // PANTALLA 2: Dashboard de la Tablet (Mamá, Papá o Familiar)
  return (
    <main style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '24px', gap: '24px' }}>
      <div className="bg-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
        <div className="blob blob-3"></div>
      </div>

      {/* Cabecera del Dashboard */}
      <header className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => setSelectedParent(null)}
            style={{ borderRadius: '50%', width: '60px', height: '60px', padding: 0 }}
          >
            <ArrowLeft size={30} />
          </button>
          <div>
            <span style={{ fontSize: '1.25rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>Hola, bienvenido</span>
            <h1 style={{ fontSize: '2.5rem', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '12px' }}>
              <User size={36} color={selectedParent.name === 'Mamá' ? '#ec4899' : '#3b82f6'} />
              Dashboard de {selectedParent.name}
            </h1>
          </div>
        </div>

        {/* Reloj y Fecha gigante para accesibilidad */}
        {/* Reloj, Fecha gigante y botón de refresco manual */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', textAlign: 'right' }}>
          <button
            onClick={() => loadParentData(selectedParent.id)}
            className="btn btn-secondary"
            title="Refrescar datos ahora"
            style={{ borderRadius: '50%', width: '56px', height: '56px', padding: 0 }}
          >
            <RefreshCw size={24} />
          </button>
          <div>
            <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1 }}>{timeString}</div>
            <div style={{ fontSize: '1.25rem', color: 'var(--color-text-secondary)', textTransform: 'capitalize', marginTop: '6px' }}>{dateString}</div>
          </div>
        </div>
      </header>

      {/* Contenido Principal en 3 Columnas Responsivas que aprovechan todo el alto */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', 
        gap: '24px', 
        flex: 1,
        alignItems: 'stretch',
        minHeight: 0
      }}>
        
        {/* COLUMNA 1: CITAS MÉDICAS */}
        <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 0, height: '100%' }}>
          <h2 style={{ fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', flexShrink: 0 }}>
            <Calendar size={28} color="var(--color-info)" />
            Citas Médicas
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto', minHeight: 0, paddingRight: '4px' }}>
            {appointments.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '12px', padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <Calendar size={48} strokeWidth={1} />
                <p style={{ fontSize: '1.25rem' }}>No tienes citas programadas en los próximos días</p>
              </div>
            ) : (
              appointments.map((appt) => {
                const apptDate = new Date(appt.start_time);
                const isToday = apptDate.toDateString() === new Date().toDateString();
                
                return (
                  <div 
                    key={appt.id} 
                    className="glass-card" 
                    style={{ 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: '12px',
                      borderLeft: isToday ? '6px solid var(--color-info)' : '2px solid var(--glass-border)',
                      background: isToday ? 'rgba(6, 182, 212, 0.05)' : 'rgba(255, 255, 255, 0.02)'
                    }}
                  >
                    {isToday && <span className="badge badge-info" style={{ alignSelf: 'flex-start' }}>Hoy</span>}
                    <h3 style={{ fontSize: '1.4rem', fontWeight: 700 }}>{appt.title}</h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', color: 'var(--color-text-secondary)', fontSize: '1.1rem' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Clock size={18} />
                        <span>
                          {apptDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} a las{' '}
                          {apptDate.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} hs
                        </span>
                      </div>
                      
                      {appt.location && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <MapPin size={18} />
                          <span>{appt.location}</span>
                        </div>
                      )}
                    </div>
                    
                    {appt.description && (
                      <p style={{ color: 'var(--color-text-muted)', fontSize: '1rem', marginTop: '4px', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '8px' }}>
                        {appt.description}
                      </p>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* COLUMNA 2: MEDICAMENTOS */}
        <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px', minHeight: 0, height: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', flexShrink: 0 }}>
            <h2 style={{ fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <Pill size={28} color="var(--color-success)" />
              Medicamentos del Día
            </h2>
            {medications.filter(m => !isPrnMedication(m) && isScheduledForToday(m)).length > 0 && (
              <span style={{ fontSize: '0.95rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                {medications.filter(m => !isPrnMedication(m) && isScheduledForToday(m) && !takenMeds.includes(m.id)).length} pendientes hoy
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', flex: 1, overflowY: 'auto', minHeight: 0, paddingRight: '6px' }}>
            {medications.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '12px', padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <Pill size={48} strokeWidth={1} />
                <p style={{ fontSize: '1.25rem' }}>No hay medicamentos activos cargados</p>
              </div>
            ) : medications.filter(m => !isPrnMedication(m) && isScheduledForToday(m)).length === 0 && medications.filter(m => isPrnMedication(m)).length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '12px', padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <Calendar size={48} strokeWidth={1} />
                <p style={{ fontSize: '1.25rem', color: 'var(--color-text-primary)', fontWeight: 700 }}>Hoy no tienes medicamentos programados</p>
                <p style={{ fontSize: '1rem', color: 'var(--color-text-secondary)' }}>Tus pautas de medicación no tienen tomas programadas para el día de hoy.</p>
              </div>
            ) : medications.filter(m => !isPrnMedication(m) && isScheduledForToday(m) && !takenMeds.includes(m.id)).length === 0 && medications.filter(m => !isPrnMedication(m) && isScheduledForToday(m)).length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '16px', padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'var(--color-success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-success)' }}>
                  <Check size={44} strokeWidth={3} />
                </div>
                <h3 style={{ fontSize: '1.6rem', fontWeight: 800, color: 'var(--color-text-primary)' }}>¡Todo completado por hoy!</h3>
                <p style={{ fontSize: '1.15rem', color: 'var(--color-text-secondary)', maxWidth: '340px' }}>
                  Has tomado todos los medicamentos programados para el día de hoy.
                </p>
              </div>
            ) : (
              (['mañana', 'mediodia', 'tarde', 'noche'] as const).map(period => {
                const list = getMedicationByPeriod(period, false);
                if (list.length === 0) return null;

                const iconMap = { mañana: '☀️', mediodia: '🍽️', tarde: '⛅', noche: '🌙' };
                const titleMap = { mañana: 'Mañana (Desayuno)', mediodia: 'Mediodía (Comida)', tarde: 'Tarde (Merienda)', noche: 'Noche (Cena / Acostar)' };

                return (
                  <div key={period} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)' }}>
                      <span style={{ fontSize: '1.6rem' }}>{iconMap[period]}</span>
                      {titleMap[period]}
                    </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {list.map(med => (
                        <div 
                          key={med.id} 
                          className="glass-card"
                          style={{ 
                            display: 'flex', 
                            justifyContent: 'space-between', 
                            alignItems: 'center', 
                            gap: '16px',
                            padding: '16px',
                            borderLeft: '4px solid var(--color-info)'
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <h4 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{med.name}</h4>
                              <span style={{ 
                                fontSize: '0.75rem', 
                                fontWeight: 700, 
                                padding: '2px 8px', 
                                borderRadius: '10px', 
                                background: 'rgba(6, 182, 212, 0.12)', 
                                color: 'var(--color-info)',
                                border: '1px solid rgba(6, 182, 212, 0.25)'
                              }}>
                                {getScheduleDescription(med)}
                              </span>
                            </div>
                            <p style={{ fontSize: '1.05rem', color: 'var(--color-text-secondary)', fontWeight: 500, marginTop: '2px' }}>
                              Dosis: {med.dose} | {med.frequency}
                            </p>
                            {med.comments && (
                              <p style={{ fontSize: '0.95rem', color: 'var(--color-warning)', marginTop: '4px', fontStyle: 'italic' }}>
                                💡 {med.comments}
                              </p>
                            )}
                          </div>
                          
                          <button
                            onClick={() => toggleMedTaken(med.id)}
                            className="btn btn-primary"
                            style={{ 
                              minWidth: '120px', 
                              height: '56px', 
                              fontSize: '1.1rem',
                              fontWeight: 700,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              gap: '8px'
                            }}
                          >
                            <Check size={20} />
                            <span>Tomar</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            )}

            {/* SECCIÓN ESPECIAL: MEDICAMENTOS SEGÚN NECESIDAD / SI PRECISA (SOS) */}
            {medications.filter(m => isPrnMedication(m)).length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '10px', paddingTop: '16px', borderTop: '1px dashed var(--glass-border)' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-warning)' }}>
                  <span>🆘</span>
                  <span>Si Precisa / Según Necesidad (Opcional)</span>
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {medications.filter(m => isPrnMedication(m)).map(med => {
                    const isTaken = takenMeds.includes(med.id);
                    return (
                      <div
                        key={med.id}
                        className="glass-card"
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          gap: '16px',
                          padding: '16px',
                          borderLeft: isTaken ? '4px solid var(--color-success)' : '4px solid var(--color-warning)',
                          background: isTaken ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.02)'
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h4 style={{ fontSize: '1.2rem', fontWeight: 700, color: isTaken ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}>{med.name}</h4>
                            <span className="badge badge-warning" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>Si precisa</span>
                          </div>
                          <p style={{ fontSize: '1.05rem', color: 'var(--color-text-secondary)', fontWeight: 500, marginTop: '2px' }}>
                            Dosis: {med.dose} {med.frequency ? `| ${med.frequency}` : ''}
                          </p>
                          {med.comments && (
                            <p style={{ fontSize: '0.95rem', color: 'var(--color-warning)', marginTop: '4px', fontStyle: 'italic' }}>
                              💡 {med.comments}
                            </p>
                          )}
                        </div>

                        <button
                          onClick={() => toggleMedTaken(med.id)}
                          className={`btn ${isTaken ? 'btn-success' : 'btn-secondary'}`}
                          style={{
                            minWidth: '120px',
                            height: '56px',
                            fontSize: '1rem',
                            fontWeight: 700,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '8px'
                          }}
                        >
                          {isTaken ? (
                            <>
                              <Check size={18} />
                              <span>Tomada</span>
                            </>
                          ) : (
                            <span>Tomar</span>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

          </div>

          {/* Cajón colapsable para consultar o desmarcar medicamentos ya tomados */}
          {takenMeds.length > 0 && (
            <div style={{ marginTop: 'auto', paddingTop: '12px', borderTop: '1px solid var(--glass-border)', flexShrink: 0 }}>
              <button
                onClick={() => setShowTakenMeds(!showTakenMeds)}
                style={{ 
                  width: '100%', 
                  padding: '8px 12px', 
                  fontSize: '0.95rem', 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid var(--glass-border)',
                  borderRadius: 'var(--radius-sm)',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer'
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Check size={16} color="var(--color-success)" />
                  Ya tomados hoy ({takenMeds.length})
                </span>
                {showTakenMeds ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </button>

              {showTakenMeds && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '10px', maxHeight: '160px', overflowY: 'auto' }}>
                  {medications
                    .filter(m => takenMeds.includes(m.id))
                    .map(med => (
                      <div 
                        key={med.id} 
                        style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          padding: '8px 12px', 
                          borderRadius: 'var(--radius-sm)', 
                          background: 'rgba(16, 185, 129, 0.05)',
                          border: '1px solid rgba(16, 185, 129, 0.2)',
                          fontSize: '0.9rem'
                        }}
                      >
                        <div>
                          <strong style={{ textDecoration: 'line-through', color: 'var(--color-text-muted)' }}>{med.name}</strong>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)', marginLeft: '8px' }}>({med.dose})</span>
                        </div>
                        <button
                          onClick={() => toggleMedTaken(med.id)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--color-info)',
                            fontSize: '0.85rem',
                            cursor: 'pointer',
                            textDecoration: 'underline'
                          }}
                        >
                          Desmarcar
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </section>

        {/* COLUMNA 3: AVISOS IMPORTANTES */}
        <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px', minHeight: 0, height: '100%' }}>
          <h2 style={{ fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', flexShrink: 0 }}>
            <Bell size={28} color="var(--color-warning)" />
            Avisos de la Familia
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto', minHeight: 0, paddingRight: '4px' }}>
            {notices.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '12px', padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <Bell size={48} strokeWidth={1} />
                <p style={{ fontSize: '1.25rem' }}>No tienes avisos nuevos hoy</p>
              </div>
            ) : (
              notices.map((notice) => (
                <div 
                  key={notice.id} 
                  style={{
                    ...getNoticeStyle(notice.type),
                    padding: '24px',
                    borderRadius: 'var(--radius-md)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    boxShadow: '0 4px 15px rgba(0,0,0,0.15)',
                    animation: 'pulse-notice 2s infinite ease-in-out'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                    {notice.type === 'alert' || notice.type === 'warning' ? (
                      <AlertTriangle size={32} color="var(--color-warning)" style={{ flexShrink: 0 }} />
                    ) : (
                      <Info size={32} color="var(--color-info)" style={{ flexShrink: 0 }} />
                    )}
                    <p style={{ fontSize: '1.35rem', fontWeight: 600, color: '#ffffff', lineHeight: 1.5 }}>
                      {notice.message}
                    </p>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
                    <button 
                      className="btn btn-secondary"
                      onClick={() => speakMessage(notice.message)}
                      style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '8px' }}
                    >
                      <Volume2 size={20} />
                      <span>Escuchar</span>
                    </button>

                    <button 
                      className="btn btn-success"
                      onClick={() => acknowledgeNotice(notice.id)}
                      style={{ 
                        padding: '16px 28px', 
                        fontSize: '1.2rem', 
                        fontWeight: 700,
                        boxShadow: '0 4px 10px rgba(16, 185, 129, 0.4)'
                      }}
                    >
                      <span>Entendido, hijo</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

      </div>

      <style jsx global>{`
        @keyframes pulse-notice {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.01); }
        }
      `}</style>
    </main>
  );
}
