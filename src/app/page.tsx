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
  Info
} from 'lucide-react';

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
  comments?: string;
  active: boolean;
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
  const [timeString, setTimeString] = useState<string>('');
  const [dateString, setDateString] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // 1. Cargar perfiles de padres al inicio
  useEffect(() => {
    async function loadParents() {
      try {
        const { data, error } = await supabase
          .from('parents')
          .select('*')
          .order('name', { ascending: true });

        if (error) throw error;
        setParents(data || []);
      } catch (err) {
        console.error('Error al cargar padres:', err);
      } finally {
        setLoading(false);
      }
    }
    loadParents();
  }, []);

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
      const now = new Date().toISOString();

      // Citas médicas (de hoy en adelante)
      const { data: appts, error: apptsError } = await supabase
        .from('appointments')
        .select('*')
        .eq('parent_id', parentId)
        .gte('end_time', now)
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

    // 6. Suscripción en Tiempo Real con Supabase para Avisos y Medicamentos
    const channel = supabase
      .channel('table-db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notices' },
        (payload) => {
          console.log('Cambio en avisos:', payload);
          // Si hay una inserción de un aviso no leído para este padre o ambos
          if (payload.eventType === 'INSERT') {
            const newNotice = payload.new as Notice;
            if (!newNotice.is_read && (newNotice.parent_id === selectedParent.id || newNotice.parent_id === null)) {
              setNotices(prev => [newNotice, ...prev]);
              // Leer en voz alta el nuevo aviso recibido
              speakMessage(`Nuevo aviso importante: ${newNotice.message}`);
            }
          } else if (payload.eventType === 'UPDATE' || payload.eventType === 'DELETE') {
            // Recargar datos
            loadParentData(selectedParent.id);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'medications' },
        () => {
          loadParentData(selectedParent.id);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => {
          loadParentData(selectedParent.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedParent, loadParentData, speakMessage]);

  // 7. Confirmar lectura de aviso
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

  // Clasificar medicamentos por franja horaria según comentarios/frecuencias comunes
  const getMedicationByPeriod = (period: 'mañana' | 'tarde' | 'noche') => {
    return medications.filter(med => {
      const freq = (med.frequency + ' ' + (med.comments || '')).toLowerCase();
      
      if (period === 'mañana') {
        return freq.includes('mañana') || freq.includes('desayuno') || freq.includes('8h') || freq.includes('8 horas') || freq.includes('despertar') || (!freq.includes('tarde') && !freq.includes('noche') && !freq.includes('cena') && !freq.includes('almuerzo'));
      }
      if (period === 'tarde') {
        return freq.includes('tarde') || freq.includes('comida') || freq.includes('almuerzo') || freq.includes('mediodía') || freq.includes('12h') || freq.includes('14h') || freq.includes('16h');
      }
      if (period === 'noche') {
        return freq.includes('noche') || freq.includes('cena') || freq.includes('acostar') || freq.includes('dormir') || freq.includes('20h') || freq.includes('22h');
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

  if (loading) {
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

  // PANTALLA 1: Selección de Perfil (Padre o Madre)
  if (!selectedParent) {
    return (
      <main style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        <div className="bg-blobs">
          <div className="blob blob-1"></div>
          <div className="blob blob-2"></div>
        </div>

        <h1 style={{ fontSize: '3rem', fontWeight: 800, marginBottom: '10px', textAlign: 'center' }}>Portal Médico Familiar</h1>
        <p style={{ fontSize: '1.5rem', color: 'var(--color-text-secondary)', marginBottom: '50px', textAlign: 'center' }}>Selecciona tu perfil para ver tu información del día</p>

        <div style={{ display: 'flex', gap: '40px', flexWrap: 'wrap', justifyContent: 'center', maxWidth: '900px', width: '100%' }}>
          {parents.map((parent) => (
            <button
              key={parent.id}
              onClick={() => setSelectedParent(parent)}
              className="glass-panel"
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '24px',
                width: '320px',
                padding: '40px',
                cursor: 'pointer',
                borderRadius: 'var(--radius-xl)',
                border: '2px solid var(--glass-border)',
                outline: 'none',
                textDecoration: 'none'
              }}
            >
              <div style={{
                width: '150px',
                height: '150px',
                borderRadius: '50%',
                background: parent.name === 'Mamá' ? 'linear-gradient(135deg, #ec4899 0%, #f43f5e 100%)' : 'linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 10px 25px rgba(0,0,0,0.3)',
                color: 'white',
                fontSize: '4.5rem',
                fontWeight: 700
              }}>
                {parent.name.charAt(0)}
              </div>
              <span style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>{parent.name}</span>
            </button>
          ))}
        </div>
      </main>
    );
  }

  // PANTALLA 2: Dashboard de la Tablet (Mamá o Papá)
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
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--color-text-primary)', lineHeight: 1 }}>{timeString}</div>
          <div style={{ fontSize: '1.25rem', color: 'var(--color-text-secondary)', textTransform: 'capitalize', marginTop: '6px' }}>{dateString}</div>
        </div>
      </header>

      {/* Contenido Principal en 3 Columnas Responsivas */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', 
        gap: '24px', 
        flex: 1 
      }}>
        
        {/* COLUMNA 1: CITAS MÉDICAS */}
        <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h2 style={{ fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
            <Calendar size={28} color="var(--color-info)" />
            Citas Médicas
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto', maxHeight: '55vh' }}>
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
        <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h2 style={{ fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
            <Pill size={28} color="var(--color-success)" />
            Medicamentos del Día
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', flex: 1, overflowY: 'auto', maxHeight: '55vh', paddingRight: '4px' }}>
            {medications.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '12px', padding: '40px 20px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                <Pill size={48} strokeWidth={1} />
                <p style={{ fontSize: '1.25rem' }}>No hay medicamentos activos cargados</p>
              </div>
            ) : (
              (['mañana', 'tarde', 'noche'] as const).map(period => {
                const list = getMedicationByPeriod(period);
                if (list.length === 0) return null;

                const iconMap = { mañana: '☀️', tarde: '⛅', noche: '🌙' };
                const titleMap = { mañana: 'Mañana', tarde: 'Tarde', noche: 'Noche' };

                return (
                  <div key={period} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-text-secondary)' }}>
                      <span style={{ fontSize: '1.6rem' }}>{iconMap[period]}</span>
                      {titleMap[period]}
                    </h3>
                    
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {list.map(med => {
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
                              background: isTaken ? 'rgba(16, 185, 129, 0.05)' : 'rgba(255, 255, 255, 0.02)',
                              borderLeft: isTaken ? '6px solid var(--color-success)' : '2px solid var(--glass-border)'
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <h4 style={{ fontSize: '1.25rem', fontWeight: 700, textDecoration: isTaken ? 'line-through' : 'none', color: isTaken ? 'var(--color-text-muted)' : 'var(--color-text-primary)' }}>{med.name}</h4>
                              <p style={{ fontSize: '1.05rem', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
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
                              className={`btn ${isTaken ? 'btn-success' : 'btn-secondary'}`}
                              style={{ 
                                minWidth: '120px', 
                                height: '60px', 
                                fontSize: '1.1rem',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '8px'
                              }}
                            >
                              {isTaken ? (
                                <>
                                  <Check size={20} />
                                  <span>¡Tomada!</span>
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
                );
              })
            )}
          </div>
        </section>

        {/* COLUMNA 3: AVISOS IMPORTANTES */}
        <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <h2 style={{ fontSize: '1.75rem', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
            <Bell size={28} color="var(--color-warning)" />
            Avisos de la Familia
          </h2>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, overflowY: 'auto', maxHeight: '55vh' }}>
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
