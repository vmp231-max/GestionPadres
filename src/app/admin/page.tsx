'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Calendar, 
  Pill, 
  Bell, 
  Upload, 
  Trash2, 
  RefreshCw, 
  Plus, 
  Save, 
  LogOut, 
  Lock, 
  Mail, 
  Clock,
  Check,
  AlertTriangle,
  Pencil,
  X
} from 'lucide-react';

interface Parent {
  id: string;
  name: string;
}

interface Medication {
  id?: string;
  name: string;
  dose: string;
  frequency: string;
  period?: string;
  comments?: string;
}

interface Notice {
  id: string;
  parent_id: string | null;
  message: string;
  type: 'info' | 'warning' | 'alert';
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  parents?: { name: string } | null;
}

interface Appointment {
  id: string;
  parent_id: string;
  title: string;
  start_time: string;
  parents?: { name: string };
}

export default function AdminPortal() {
  // Autenticación
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Estados de datos
  const [parents, setParents] = useState<Parent[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  
  // Medicamentos
  const [activeMeds, setActiveMeds] = useState<any[]>([]);
  const [parsedMeds, setParsedMeds] = useState<Medication[]>([]);
  const [isParsing, setIsParsing] = useState(false);
  const [pdfFile, setPdfFile] = useState<File | null>(null);

  // Edición y alta manual de medicamentos activos
  const [editingMedId, setEditingMedId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{
    name: string;
    dose: string;
    frequency: string;
    period: string;
    comments: string;
  }>({ name: '', dose: '', frequency: '', period: 'Mañana', comments: '' });

  const [isAddingManualMed, setIsAddingManualMed] = useState<boolean>(false);
  const [manualMedForm, setManualMedForm] = useState<{
    name: string;
    dose: string;
    frequency: string;
    period: string;
    comments: string;
  }>({ name: '', dose: '', frequency: '', period: 'Mañana', comments: '' });

  const [isSavingMed, setIsSavingMed] = useState<boolean>(false);

  // Avisos
  const [notices, setNotices] = useState<Notice[]>([]);
  const [newNoticeText, setNewNoticeText] = useState('');
  const [noticeParentId, setNoticeParentId] = useState<string>('both'); // ID o 'both'
  const [noticeType, setNoticeType] = useState<'info' | 'warning' | 'alert'>('info');

  // Citas
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string>('');

  // 1. Escuchar el estado de autenticación de Supabase
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Cargar datos si el usuario está autenticado
  const loadAdminData = useCallback(async () => {
    try {
      // Cargar padres
      const { data: parentsData } = await supabase.from('parents').select('*').order('name');
      setParents(parentsData || []);
      if (parentsData && parentsData.length > 0 && !selectedParentId) {
        setSelectedParentId(parentsData[0].id);
      }

      // Cargar medicamentos activos
      if (selectedParentId || (parentsData && parentsData.length > 0)) {
        const pId = selectedParentId || parentsData?.[0]?.id;
        const { data: medsData } = await supabase
          .from('medications')
          .select('*')
          .eq('parent_id', pId)
          .eq('active', true);
        setActiveMeds(medsData || []);
      }

      // Cargar avisos (con el nombre del padre)
      const { data: noticesData } = await supabase
        .from('notices')
        .select('*, parents(name)')
        .order('created_at', { ascending: false });
      setNotices((noticesData as any) || []);

      // Cargar citas próximas
      const { data: appointmentsData } = await supabase
        .from('appointments')
        .select('*, parents(name)')
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true })
        .limit(10);
      setAppointments((appointmentsData as any) || []);

    } catch (err) {
      console.error('Error al cargar datos de administración:', err);
    }
  }, [selectedParentId]);

  useEffect(() => {
    if (session) {
      loadAdminData();
    }
  }, [session, loadAdminData]);

  // Recargar medicamentos cuando cambie el padre seleccionado
  useEffect(() => {
    if (session && selectedParentId) {
      supabase
        .from('medications')
        .select('*')
        .eq('parent_id', selectedParentId)
        .eq('active', true)
        .then(({ data }) => {
          setActiveMeds(data || []);
        });
    }
  }, [selectedParentId, session]);

  // 3. Acciones de Auth
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    } catch (err: any) {
      setAuthError(err.message || 'Error de inicio de sesión');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
  };

  // 4. Sincronizar Google Calendar
  const handleCalendarSync = async () => {
    setIsSyncing(true);
    setSyncStatus('Sincronizando...');
    try {
      const res = await fetch('/api/calendar/sync');
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Error desconocido');
      
      const successResults = data.results
        .map((r: any) => `${r.name}: ${r.status === 'success' ? `Sincronizada (${r.syncedCount} citas)` : `Fallo (${r.detail})`}`)
        .join(', ');
        
      setSyncStatus(`Completado: ${successResults}`);
      loadAdminData(); // Recargar citas en el admin
    } catch (err: any) {
      setSyncStatus(`Error: ${err.message || err}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // 5. Cargar y Procesar PDF de recetas
  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPdfFile(file);
    }
  };

  const processPdf = async () => {
    if (!pdfFile || !selectedParentId) return;

    setIsParsing(true);
    setParsedMeds([]);
    
    try {
      const formData = new FormData();
      formData.append('file', pdfFile);

      const res = await fetch('/api/medication/parse', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al procesar PDF');

      setParsedMeds(data.medications || []);
    } catch (err: any) {
      alert(`Error al analizar PDF: ${err.message || err}`);
    } finally {
      setIsParsing(false);
    }
  };

  // Editar medicamentos parseados antes de guardar
  const handleParsedMedChange = (index: number, field: keyof Medication, value: string) => {
    const updated = [...parsedMeds];
    updated[index] = { ...updated[index], [field]: value };
    setParsedMeds(updated);
  };

  const addEmptyParsedMed = () => {
    setParsedMeds([...parsedMeds, { name: '', dose: '', frequency: '', period: 'Mañana', comments: '' }]);
  };

  const removeParsedMed = (index: number) => {
    setParsedMeds(parsedMeds.filter((_, i) => i !== index));
  };

  // Guardar medicamentos confirmados en la BD
  const saveMedications = async () => {
    if (parsedMeds.length === 0 || !selectedParentId) return;

    try {
      // 1. Desactivar los medicamentos anteriores para este padre
      const { error: deactivateError } = await supabase
        .from('medications')
        .update({ active: false })
        .eq('parent_id', selectedParentId);

      if (deactivateError) throw deactivateError;

      // 2. Insertar los nuevos medicamentos activos
      const medsToInsert = parsedMeds.map(med => ({
        parent_id: selectedParentId,
        name: med.name,
        dose: med.dose,
        frequency: med.frequency,
        period: med.period || 'Mañana',
        comments: med.comments || '',
        active: true
      }));

      const { error: insertError } = await supabase
        .from('medications')
        .insert(medsToInsert);

      if (insertError) throw insertError;

      alert('¡Medicamentos guardados y activados correctamente!');
      setParsedMeds([]);
      setPdfFile(null);
      
      // Recargar lista
      const { data } = await supabase
        .from('medications')
        .select('*')
        .eq('parent_id', selectedParentId)
        .eq('active', true);
      setActiveMeds(data || []);

    } catch (err: any) {
      alert(`Error al guardar medicamentos: ${err.message || err}`);
    }
  };

  const deactivateSingleMed = async (medId: string) => {
    if (!confirm('¿Seguro que deseas desactivar esta medicina?')) return;
    
    try {
      const { error } = await supabase
        .from('medications')
        .update({ active: false })
        .eq('id', medId);

      if (error) throw error;

      setActiveMeds(prev => prev.filter(m => m.id !== medId));
    } catch (err: any) {
      alert(`Error al desactivar: ${err.message || err}`);
    }
  };

  // Comenzar edición de un medicamento activo
  const startEditMed = (med: any) => {
    setEditingMedId(med.id);
    setEditForm({
      name: med.name || '',
      dose: med.dose || '',
      frequency: med.frequency || '',
      period: med.period || 'Mañana',
      comments: med.comments || ''
    });
  };

  const cancelEditMed = () => {
    setEditingMedId(null);
  };

  // Guardar cambios del medicamento editado
  const saveEditedMed = async (medId: string) => {
    if (!editForm.name.trim()) {
      alert('El nombre del medicamento no puede estar vacío.');
      return;
    }

    setIsSavingMed(true);
    try {
      const { error } = await supabase
        .from('medications')
        .update({
          name: editForm.name.trim(),
          dose: editForm.dose.trim(),
          frequency: editForm.frequency.trim(),
          period: editForm.period || 'Mañana',
          comments: editForm.comments.trim()
        })
        .eq('id', medId);

      if (error) throw error;

      setActiveMeds(prev => prev.map(m => m.id === medId ? {
        ...m,
        name: editForm.name.trim(),
        dose: editForm.dose.trim(),
        frequency: editForm.frequency.trim(),
        period: editForm.period || 'Mañana',
        comments: editForm.comments.trim()
      } : m));

      setEditingMedId(null);
    } catch (err: any) {
      alert(`Error al actualizar medicamento: ${err.message || err}`);
    } finally {
      setIsSavingMed(false);
    }
  };

  // Guardar medicamento añadido manualmente
  const saveManualMed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualMedForm.name.trim() || !selectedParentId) {
      alert('Por favor indica al menos el nombre del medicamento y selecciona el perfil (Mamá o Papá).');
      return;
    }

    setIsSavingMed(true);
    try {
      const { data, error } = await supabase
        .from('medications')
        .insert([{
          parent_id: selectedParentId,
          name: manualMedForm.name.trim(),
          dose: manualMedForm.dose.trim(),
          frequency: manualMedForm.frequency.trim(),
          period: manualMedForm.period || 'Mañana',
          comments: manualMedForm.comments.trim(),
          active: true
        }])
        .select();

      if (error) throw error;

      if (data && data[0]) {
        setActiveMeds(prev => [...prev, data[0]]);
      }

      setIsAddingManualMed(false);
      setManualMedForm({ name: '', dose: '', frequency: '', period: 'Mañana', comments: '' });
      alert('¡Medicamento añadido y activado correctamente!');
    } catch (err: any) {
      alert(`Error al añadir medicamento: ${err.message || err}`);
    } finally {
      setIsSavingMed(false);
    }
  };

  // 6. Enviar Aviso
  const sendNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoticeText.trim()) return;

    try {
      const parentId = noticeParentId === 'both' ? null : noticeParentId;
      
      const { error } = await supabase
        .from('notices')
        .insert({
          parent_id: parentId,
          message: newNoticeText,
          type: noticeType,
          is_read: false
        });

      if (error) throw error;

      setNewNoticeText('');
      alert('Aviso enviado correctamente en tiempo real.');
      loadAdminData();
    } catch (err: any) {
      alert(`Error al enviar el aviso: ${err.message || err}`);
    }
  };

  const deleteNotice = async (noticeId: string) => {
    if (!confirm('¿Deseas eliminar este aviso del historial?')) return;
    try {
      const { error } = await supabase.from('notices').delete().eq('id', noticeId);
      if (error) throw error;
      setNotices(prev => prev.filter(n => n.id !== noticeId));
    } catch (err: any) {
      alert(`Error al borrar aviso: ${err.message || err}`);
    }
  };


  // --- VISTA DE LOGIN ---
  if (!session) {
    return (
      <main style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        <div className="bg-blobs">
          <div className="blob blob-1"></div>
          <div className="blob blob-2"></div>
        </div>

        <form onSubmit={handleLogin} className="glass-panel" style={{ width: '100%', maxWidth: '420px', display: 'flex', flexDirection: 'column', gap: '24px', padding: '40px' }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '8px' }}>Panel de Control</h1>
            <p style={{ color: 'var(--color-text-secondary)' }}>Introduce tus credenciales de Supabase para administrar la tablet</p>
          </div>

          {authError && (
            <div style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)', border: '1px solid var(--color-error)', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} />
              <span>{authError}</span>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Correo Electrónico</label>
              <div style={{ position: 'relative' }}>
                <Mail size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                <input 
                  type="email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ejemplo@correo.com" 
                  required
                  style={{ width: '100%', padding: '14px 14px 14px 44px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', color: '#ffffff', outline: 'none', fontSize: '1rem' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Contraseña</label>
              <div style={{ position: 'relative' }}>
                <Lock size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••" 
                  required
                  style={{ width: '100%', padding: '14px 14px 14px 44px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', color: '#ffffff', outline: 'none', fontSize: '1rem' }}
                />
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={authLoading}
            className="btn btn-primary" 
            style={{ width: '100%', padding: '14px', fontSize: '1.05rem', fontWeight: 700 }}
          >
            {authLoading ? 'Iniciando sesión...' : 'Iniciar Sesión'}
          </button>
        </form>

        <p style={{ marginTop: '20px', color: 'var(--color-text-muted)', fontSize: '0.9rem', textAlign: 'center', maxWidth: '380px' }}>
          💡 Nota: Si aún no has creado un usuario administrador, ve a tu panel de Supabase Auth en la web y añade un usuario con correo y contraseña.
        </p>
      </main>
    );
  }

  // --- VISTA PANEL ADMINISTRACIÓN ---
  return (
    <main style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '24px', gap: '24px' }}>
      <div className="bg-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>

      {/* Cabecera Admin */}
      <header className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px' }}>
        <div>
          <span style={{ fontSize: '0.95rem', color: 'var(--color-info)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Panel de Control</span>
          <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Gestión Médica de tus Padres</h1>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.95rem', color: 'var(--color-text-secondary)' }}>Sesión: {session.user.email}</span>
          <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '10px 16px', fontSize: '0.95rem' }}>
            <LogOut size={16} />
            <span>Salir</span>
          </button>
        </div>
      </header>

      {/* Grid de Secciones */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(450px, 1fr))', 
        gap: '24px',
        alignItems: 'start'
      }}>
        
        {/* SECCIÓN 1: CALENDARIO */}
        <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px' }}>
            <div>
              <h2 style={{ fontSize: '1.4rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Calendar size={22} color="var(--color-info)" />
                Sincronización de Citas
              </h2>
              <span style={{ fontSize: '0.8rem', color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '4px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-success)', display: 'inline-block' }}></span>
                Automática cada 5 horas (Tablet y Servidor)
              </span>
            </div>
            <button 
              onClick={handleCalendarSync} 
              disabled={isSyncing}
              className="btn btn-primary"
              style={{ padding: '8px 14px', fontSize: '0.9rem' }}
            >
              <RefreshCw size={14} className={isSyncing ? 'spin' : ''} />
              <span>Sincronizar</span>
            </button>
          </div>

          {syncStatus && (
            <p style={{ fontSize: '0.95rem', color: syncStatus.includes('Error') ? 'var(--color-error)' : 'var(--color-success)', background: syncStatus.includes('Error') ? 'var(--color-error-bg)' : 'var(--color-success-bg)', padding: '10px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid transparent' }}>
              {syncStatus}
            </p>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--color-text-secondary)' }}>Citas sincronizadas próximas:</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
              {appointments.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', fontStyle: 'italic' }}>No hay citas sincronizadas próximamente.</p>
              ) : (
                appointments.map(appt => {
                  const date = new Date(appt.start_time);
                  return (
                    <div key={appt.id} className="glass-card" style={{ padding: '10px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.95rem' }}>
                      <div>
                        <strong style={{ fontSize: '1rem' }}>{appt.title}</strong>
                        <div style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                          Para {appt.parents?.name} | {date.toLocaleDateString('es-ES')} a las {date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} hs
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

        {/* SECCIÓN 2: AVISOS */}
        <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <h2 style={{ fontSize: '1.4rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Bell size={22} color="var(--color-warning)" />
            Enviar Aviso a la Tablet
          </h2>

          <form onSubmit={sendNotice} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Destinatario</label>
                <select 
                  value={noticeParentId} 
                  onChange={(e) => setNoticeParentId(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', color: '#ffffff', outline: 'none' }}
                >
                  <option value="both" style={{ background: '#0a0f1d' }}>Ambos (Mamá y Papá)</option>
                  {parents.map(p => (
                    <option key={p.id} value={p.id} style={{ background: '#0a0f1d' }}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Prioridad</label>
                <select 
                  value={noticeType} 
                  onChange={(e) => setNoticeType(e.target.value as any)}
                  style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', color: '#ffffff', outline: 'none' }}
                >
                  <option value="info" style={{ background: '#0a0f1d' }}>Información (Azul)</option>
                  <option value="warning" style={{ background: '#0a0f1d' }}>Advertencia (Naranja)</option>
                  <option value="alert" style={{ background: '#0a0f1d' }}>Alerta Importante (Rojo)</option>
                </select>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Mensaje (La tablet podrá leerlo por voz)</label>
              <textarea 
                value={newNoticeText}
                onChange={(e) => setNewNoticeText(e.target.value)}
                placeholder="Escribe aquí el mensaje... ej: 'Hola mamá, te llamo a las 18:00'"
                required
                rows={3}
                style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', color: '#ffffff', outline: 'none', fontSize: '0.95rem', resize: 'vertical' }}
              />
            </div>

            <button type="submit" className="btn btn-success" style={{ width: '100%', padding: '12px', fontWeight: 700 }}>
              <Plus size={16} />
              <span>Enviar Aviso en tiempo real</span>
            </button>
          </form>

          {/* Historial de avisos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '10px' }}>
            <h3 style={{ fontSize: '1.05rem', color: 'var(--color-text-secondary)' }}>Historial de Avisos:</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '180px', overflowY: 'auto' }}>
              {notices.length === 0 ? (
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', fontStyle: 'italic' }}>No hay avisos anteriores.</p>
              ) : (
                notices.map(ntc => {
                  const date = new Date(ntc.created_at);
                  const readTime = ntc.read_at ? new Date(ntc.read_at) : null;
                  return (
                    <div key={ntc.id} className="glass-card" style={{ padding: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '12px', fontSize: '0.9rem' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                          <span className={`badge ${ntc.type === 'alert' ? 'badge-error' : ntc.type === 'warning' ? 'badge-warning' : 'badge-info'}`}>
                            {ntc.type.toUpperCase()}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                            Para: <strong>{ntc.parents?.name || 'Ambos'}</strong> | {date.toLocaleDateString('es-ES')} {date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p style={{ color: 'var(--color-text-primary)', fontSize: '0.95rem' }}>{ntc.message}</p>
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '6px', fontSize: '0.8rem', color: ntc.is_read ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
                          <Clock size={12} />
                          <span>
                            {ntc.is_read && readTime
                              ? `Leído el ${readTime.toLocaleDateString('es-ES')} a las ${readTime.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} hs`
                              : 'No leído todavía'
                            }
                          </span>
                        </div>
                      </div>
                      <button onClick={() => deleteNotice(ntc.id)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-error)' }}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>

      </div>

      {/* SECCIÓN MEDICAMENTOS Y PDF (ANCHO COMPLETO) */}
      <section className="glass-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h2 style={{ fontSize: '1.5rem', borderBottom: '1px solid var(--glass-border)', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Pill size={24} color="var(--color-success)" />
          Gestión e Importación de Medicamentos por PDF (Gemini IA)
        </h2>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '24px' }}>
          
          {/* LADO IZQUIERDO: CARGA DE PDF */}
          <div style={{ flex: '1 1 360px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', color: 'var(--color-text-secondary)' }}>1. Importar Receta Médica en PDF</h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Seleccionar Padre a Actualizar</label>
                <select 
                  value={selectedParentId} 
                  onChange={(e) => setSelectedParentId(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', color: '#ffffff', outline: 'none' }}
                >
                  {parents.map(p => (
                    <option key={p.id} value={p.id} style={{ background: '#0a0f1d' }}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Zona Drag & Drop / Input File */}
              <div style={{ 
                border: '2px dashed var(--glass-border)', 
                borderRadius: 'var(--radius-md)', 
                padding: '30px 20px', 
                textAlign: 'center',
                background: 'rgba(255,255,255,0.01)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '12px',
                cursor: 'pointer'
              }}>
                <Upload size={36} color="var(--color-info)" />
                <div>
                  <p style={{ fontSize: '0.95rem', fontWeight: 600 }}>{pdfFile ? pdfFile.name : 'Haz clic para seleccionar el PDF'}</p>
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>PDF de receta médica de tu padre o madre</p>
                </div>
                <input 
                  type="file" 
                  accept="application/pdf"
                  onChange={handlePdfUpload}
                  style={{ display: 'block', margin: '0 auto', fontSize: '0.85rem' }} 
                />
              </div>

              <button 
                onClick={processPdf}
                disabled={!pdfFile || isParsing}
                className="btn btn-primary" 
                style={{ width: '100%', padding: '12px', fontSize: '1rem', fontWeight: 700 }}
              >
                {isParsing ? (
                  <>
                    <RefreshCw className="spin" size={16} />
                    <span>Gemini analizando el PDF...</span>
                  </>
                ) : (
                  <span>Analizar PDF con Gemini IA</span>
                )}
              </button>
            </div>

            {/* Listado actual en la base de datos con Edición en Vivo */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.1rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>Medicinas Activas en la Tablet:</span>
                  <span className="badge badge-info" style={{ fontSize: '0.75rem', padding: '2px 8px' }}>{activeMeds.length}</span>
                </h3>
                <button
                  type="button"
                  onClick={() => setIsAddingManualMed(!isAddingManualMed)}
                  className="btn btn-secondary"
                  style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                  {isAddingManualMed ? <X size={14} /> : <Plus size={14} />}
                  <span>{isAddingManualMed ? 'Cancelar' : 'Añadir Manualmente'}</span>
                </button>
              </div>

              {/* Formulario para añadir medicina manualmente sin PDF */}
              {isAddingManualMed && (
                <form onSubmit={saveManualMed} className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '4px solid var(--color-success)', background: 'rgba(16, 185, 129, 0.04)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <strong style={{ fontSize: '0.95rem', color: 'var(--color-success)' }}>Añadir Medicina Directamente</strong>
                    <button type="button" onClick={() => setIsAddingManualMed(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                      <X size={16} />
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Nombre *</label>
                      <input 
                        type="text" 
                        required
                        value={manualMedForm.name} 
                        onChange={(e) => setManualMedForm(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="ej. Paracetamol"
                        style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', color: '#ffffff', outline: 'none', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Dosis</label>
                      <input 
                        type="text" 
                        value={manualMedForm.dose} 
                        onChange={(e) => setManualMedForm(prev => ({ ...prev, dose: e.target.value }))}
                        placeholder="ej. 1g o 500mg"
                        style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', color: '#ffffff', outline: 'none', fontSize: '0.85rem' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Frecuencia</label>
                      <input 
                        type="text" 
                        value={manualMedForm.frequency} 
                        onChange={(e) => setManualMedForm(prev => ({ ...prev, frequency: e.target.value }))}
                        placeholder="ej. 1 cada 8h"
                        style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', color: '#ffffff', outline: 'none', fontSize: '0.85rem' }}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '0.75rem', color: 'var(--color-info)' }}>Momento del Día</label>
                      <select 
                        value={manualMedForm.period} 
                        onChange={(e) => setManualMedForm(prev => ({ ...prev, period: e.target.value }))}
                        style={{ padding: '8px 10px', background: '#0f172a', border: '1px solid var(--color-info)', borderRadius: 'var(--radius-sm)', color: '#ffffff', outline: 'none', fontSize: '0.85rem' }}
                      >
                        <option value="Mañana" style={{ background: '#0f172a' }}>☀️ Mañana</option>
                        <option value="Mediodia" style={{ background: '#0f172a' }}>🍽️ Mediodía</option>
                        <option value="Tarde" style={{ background: '#0f172a' }}>⛅ Tarde</option>
                        <option value="Noche" style={{ background: '#0f172a' }}>🌙 Noche</option>
                      </select>
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Comentarios / Avisos tomas</label>
                    <input 
                      type="text" 
                      value={manualMedForm.comments} 
                      onChange={(e) => setManualMedForm(prev => ({ ...prev, comments: e.target.value }))}
                      placeholder="ej. Tomar con agua después de comer"
                      style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', color: '#ffffff', outline: 'none', fontSize: '0.85rem' }}
                    />
                  </div>

                  <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                    <button type="button" onClick={() => setIsAddingManualMed(false)} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                      Cancelar
                    </button>
                    <button type="submit" disabled={isSavingMed} className="btn btn-success" style={{ padding: '6px 14px', fontSize: '0.85rem', fontWeight: 700 }}>
                      <Check size={14} />
                      <span>{isSavingMed ? 'Guardando...' : 'Guardar y Activar'}</span>
                    </button>
                  </div>
                </form>
              )}

              {/* Lista de medicamentos activos con modo lectura / edición */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                {activeMeds.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', fontStyle: 'italic', padding: '10px 0' }}>No hay medicamentos activos cargados para este padre.</p>
                ) : (
                  activeMeds.map(med => {
                    const isEditing = editingMedId === med.id;

                    if (isEditing) {
                      return (
                        <div key={med.id} className="glass-card" style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '10px', borderLeft: '4px solid var(--color-warning)', background: 'rgba(245, 158, 11, 0.04)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <strong style={{ fontSize: '0.9rem', color: 'var(--color-warning)' }}>Editando: {med.name}</strong>
                            <button type="button" onClick={cancelEditMed} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)' }}>
                              <X size={16} />
                            </button>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Nombre</label>
                              <input 
                                type="text" 
                                value={editForm.name} 
                                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', color: '#ffffff', outline: 'none', fontSize: '0.85rem' }}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Dosis</label>
                              <input 
                                type="text" 
                                value={editForm.dose} 
                                onChange={(e) => setEditForm(prev => ({ ...prev, dose: e.target.value }))}
                                style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', color: '#ffffff', outline: 'none', fontSize: '0.85rem' }}
                              />
                            </div>
                          </div>

                          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Frecuencia</label>
                              <input 
                                type="text" 
                                value={editForm.frequency} 
                                onChange={(e) => setEditForm(prev => ({ ...prev, frequency: e.target.value }))}
                                style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', color: '#ffffff', outline: 'none', fontSize: '0.85rem' }}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              <label style={{ fontSize: '0.75rem', color: 'var(--color-info)' }}>Momento del Día</label>
                              <select 
                                value={editForm.period} 
                                onChange={(e) => setEditForm(prev => ({ ...prev, period: e.target.value }))}
                                style={{ padding: '6px 10px', background: '#0f172a', border: '1px solid var(--color-info)', borderRadius: 'var(--radius-sm)', color: '#ffffff', outline: 'none', fontSize: '0.85rem' }}
                              >
                                <option value="Mañana" style={{ background: '#0f172a' }}>☀️ Mañana</option>
                                <option value="Mediodia" style={{ background: '#0f172a' }}>🍽️ Mediodía</option>
                                <option value="Tarde" style={{ background: '#0f172a' }}>⛅ Tarde</option>
                                <option value="Noche" style={{ background: '#0f172a' }}>🌙 Noche</option>
                              </select>
                            </div>
                          </div>

                          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Comentarios / Avisos tomas</label>
                            <input 
                              type="text" 
                              value={editForm.comments} 
                              onChange={(e) => setEditForm(prev => ({ ...prev, comments: e.target.value }))}
                              placeholder="ej. Tomar con las comidas"
                              style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', color: '#ffffff', outline: 'none', fontSize: '0.85rem' }}
                            />
                          </div>

                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                            <button type="button" onClick={cancelEditMed} className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>
                              Cancelar
                            </button>
                            <button 
                              type="button" 
                              onClick={() => saveEditedMed(med.id)} 
                              disabled={isSavingMed} 
                              className="btn btn-success" 
                              style={{ padding: '6px 14px', fontSize: '0.85rem', fontWeight: 700 }}
                            >
                              <Save size={14} />
                              <span>{isSavingMed ? 'Guardando...' : 'Guardar Cambios'}</span>
                            </button>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <div key={med.id} className="glass-card" style={{ padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', fontSize: '0.9rem' }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                            <strong style={{ fontSize: '1rem', color: 'var(--color-text-primary)' }}>{med.name}</strong>
                            <span style={{ 
                              fontSize: '0.75rem', 
                              fontWeight: 700, 
                              padding: '2px 8px', 
                              borderRadius: '10px', 
                              background: 'rgba(59, 130, 246, 0.15)', 
                              color: '#60a5fa',
                              border: '1px solid rgba(59, 130, 246, 0.3)'
                            }}>
                              {med.period === 'Mediodia' ? '🍽️ Mediodía' : med.period === 'Tarde' ? '⛅ Tarde' : med.period === 'Noche' ? '🌙 Noche' : '☀️ Mañana'}
                            </span>
                          </div>
                          <div style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginTop: '3px' }}>
                            Dosis: <strong>{med.dose || 'No especificada'}</strong> | Frecuencia: <strong>{med.frequency || 'No especificada'}</strong>
                          </div>
                          {med.comments && (
                            <div style={{ color: 'var(--color-warning)', fontSize: '0.8rem', marginTop: '3px' }}>
                              💡 {med.comments}
                            </div>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <button 
                            type="button"
                            onClick={() => startEditMed(med)} 
                            className="btn btn-secondary" 
                            style={{ padding: '6px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-info)' }}
                            title="Editar este medicamento"
                          >
                            <Pencil size={14} />
                            <span>Editar</span>
                          </button>
                          <button 
                            type="button"
                            onClick={() => deactivateSingleMed(med.id)} 
                            className="btn" 
                            style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--color-error)', border: 'none', padding: '6px 10px', fontSize: '0.8rem' }}
                            title="Desactivar este medicamento de la tablet"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          </div>

          {/* LADO DERECHO: EDICIÓN DE PARSEADO E INSERCIÓN */}
          <div style={{ flex: '2 1 500px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--color-text-secondary)' }}>2. Revisión y Modificación de Resultados</h3>
              {parsedMeds.length > 0 && (
                <button onClick={addEmptyParsedMed} className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.85rem' }}>
                  <Plus size={14} />
                  <span>Añadir fila</span>
                </button>
              )}
            </div>

            {parsedMeds.length === 0 ? (
              <div style={{ border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', padding: '60px 20px', textAlign: 'center', color: 'var(--color-text-muted)', background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <Pill size={32} />
                <p style={{ fontSize: '0.95rem' }}>Los medicamentos procesados aparecerán aquí para tu revisión antes de guardarlos.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ maxHeight: '420px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
                  {parsedMeds.map((med, index) => (
                    <div key={index} className="glass-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px', borderLeft: '4px solid var(--color-info)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '0.85rem', color: 'var(--color-info)', fontWeight: 600 }}>Medicamento #{index + 1}</span>
                        <button onClick={() => removeParsedMed(index)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--color-error)' }}>
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Nombre</label>
                          <input 
                            type="text" 
                            value={med.name} 
                            onChange={(e) => handleParsedMedChange(index, 'name', e.target.value)}
                            style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', color: '#ffffff', outline: 'none' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Dosis</label>
                          <input 
                            type="text" 
                            value={med.dose} 
                            onChange={(e) => handleParsedMedChange(index, 'dose', e.target.value)}
                            style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', color: '#ffffff', outline: 'none' }}
                          />
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1.1fr 1.5fr', gap: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Frecuencia</label>
                          <input 
                            type="text" 
                            value={med.frequency} 
                            onChange={(e) => handleParsedMedChange(index, 'frequency', e.target.value)}
                            style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', color: '#ffffff', outline: 'none' }}
                          />
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '0.8rem', color: 'var(--color-info)', fontWeight: 600 }}>Momento del Día</label>
                          <select 
                            value={med.period || 'Mañana'} 
                            onChange={(e) => handleParsedMedChange(index, 'period', e.target.value)}
                            style={{ padding: '8px 10px', background: '#0f172a', border: '1px solid var(--color-info)', borderRadius: 'var(--radius-sm)', color: '#ffffff', outline: 'none', fontWeight: 600 }}
                          >
                            <option value="Mañana" style={{ background: '#0f172a' }}>☀️ Mañana</option>
                            <option value="Mediodia" style={{ background: '#0f172a' }}>🍽️ Mediodia</option>
                            <option value="Tarde" style={{ background: '#0f172a' }}>⛅ Tarde</option>
                            <option value="Noche" style={{ background: '#0f172a' }}>🌙 Noche</option>
                          </select>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Comentarios / Avisos tomas</label>
                          <input 
                            type="text" 
                            value={med.comments || ''} 
                            onChange={(e) => handleParsedMedChange(index, 'comments', e.target.value)}
                            placeholder="ej. Tomar con las comidas"
                            style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', color: '#ffffff', outline: 'none' }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <button 
                  onClick={saveMedications} 
                  className="btn btn-success" 
                  style={{ width: '100%', padding: '14px', fontSize: '1.05rem', fontWeight: 700, gap: '10px' }}
                >
                  <Save size={18} />
                  <span>Activar estos Medicamentos en la Tablet (Reemplaza lista previa)</span>
                </button>
              </div>
            )}

          </div>

        </div>
      </section>

      {/* ESTILOS INTERNOS */}
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        :global(.spin) {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </main>
  );
}
