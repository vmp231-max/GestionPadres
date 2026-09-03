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
  X,
  Users,
  Key,
  UserPlus
} from 'lucide-react';
import { 
  ScheduleType, 
  DAYS_OF_WEEK, 
  getScheduleDescription, 
  inferScheduleFromText 
} from '@/lib/medication-schedule';

interface Account {
  id: string;
  user_id: string;
  name: string;
  tablet_pin: string;
}

interface Parent {
  id: string;
  account_id?: string;
  name: string;
  calendar_id?: string | null;
  avatar_url?: string;
}

interface Medication {
  id?: string;
  name: string;
  dose: string;
  frequency: string;
  period?: string;
  schedule_type?: ScheduleType | string;
  schedule_days?: string;
  comments?: string;
}

interface Notice {
  id: string;
  account_id?: string;
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
  account_id?: string;
  parent_id: string;
  title: string;
  start_time: string;
  parents?: { name: string };
}

function ScheduleSelector({
  scheduleType,
  scheduleDays,
  onChangeType,
  onChangeDays,
}: {
  scheduleType: ScheduleType;
  scheduleDays: string;
  onChangeType: (type: ScheduleType) => void;
  onChangeDays: (days: string) => void;
}) {
  const currentDays = scheduleDays ? scheduleDays.split(',').map(s => s.trim().toUpperCase()) : [];

  const toggleDay = (key: string) => {
    if (scheduleType === 'semanal') {
      onChangeDays(key);
      return;
    }
    const newDays = currentDays.includes(key)
      ? currentDays.filter(k => k !== key)
      : [...currentDays, key];
    onChangeDays(newDays.join(','));
  };

  const setPreset = (presetDays: string[]) => {
    onChangeDays(presetDays.join(','));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '10px 12px', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '10px', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <label style={{ fontSize: '0.75rem', color: 'var(--color-info)', fontWeight: 600 }}>Periodicidad / Pauta</label>
          <select
            value={scheduleType}
            onChange={(e) => {
              const newType = e.target.value as ScheduleType;
              onChangeType(newType);
              if (newType === 'semanal' && !scheduleDays) onChangeDays('L');
              if (newType === 'mensual' && !scheduleDays) onChangeDays('1');
            }}
            style={{ padding: '6px 10px', background: '#0f172a', border: '1px solid var(--color-info)', borderRadius: 'var(--radius-sm)', color: '#ffffff', outline: 'none', fontSize: '0.85rem' }}
          >
            <option value="diario">📅 Todos los días (Diario)</option>
            <option value="dias_semana">📆 Días específicos de la semana</option>
            <option value="dias_alternos">🔄 Días alternos (Cada 2 días)</option>
            <option value="semanal">🗓️ Semanal (1 día a la semana)</option>
            <option value="mensual">📆 Mensual (Día del mes)</option>
            <option value="segun_necesidad">🆘 Si precisa / Según necesidad (SOS)</option>
          </select>
        </div>

        {scheduleType === 'mensual' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Día del mes (1 al 31)</label>
            <input
              type="number"
              min="1"
              max="31"
              value={scheduleDays || '1'}
              onChange={(e) => onChangeDays(e.target.value)}
              style={{ padding: '6px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-sm)', color: '#ffffff', outline: 'none', fontSize: '0.85rem' }}
            />
          </div>
        )}

        {scheduleType === 'dias_alternos' && (
          <p style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', margin: 0 }}>
            🔄 Se mostrará un día sí, un día no (cada 48h).
          </p>
        )}

        {scheduleType === 'segun_necesidad' && (
          <p style={{ fontSize: '0.8rem', color: 'var(--color-warning)', margin: 0 }}>
            🆘 Se mostrará en la sección "Si precisa" para tomar a demanda.
          </p>
        )}
      </div>

      {(scheduleType === 'dias_semana' || scheduleType === 'semanal') && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
              {scheduleType === 'semanal' ? 'Selecciona el día de la semana:' : 'Selecciona los días:'}
            </span>
            {scheduleType === 'dias_semana' && (
              <div style={{ display: 'flex', gap: '4px' }}>
                <button type="button" onClick={() => setPreset(['L', 'X', 'V'])} style={{ fontSize: '0.7rem', padding: '1px 6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '4px', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>L-X-V</button>
                <button type="button" onClick={() => setPreset(['M', 'J'])} style={{ fontSize: '0.7rem', padding: '1px 6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '4px', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>M-J</button>
                <button type="button" onClick={() => setPreset(['S', 'D'])} style={{ fontSize: '0.7rem', padding: '1px 6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '4px', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>Fin de semana</button>
                <button type="button" onClick={() => setPreset(['L', 'M', 'X', 'J', 'V', 'S', 'D'])} style={{ fontSize: '0.7rem', padding: '1px 6px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '4px', color: 'var(--color-text-secondary)', cursor: 'pointer' }}>Todos</button>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {DAYS_OF_WEEK.map((d) => {
              const isSelected = scheduleType === 'semanal' 
                ? (scheduleDays || 'L').toUpperCase() === d.key 
                : currentDays.includes(d.key);
              return (
                <button
                  key={d.key}
                  type="button"
                  onClick={() => toggleDay(d.key)}
                  style={{
                    padding: '4px 10px',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    background: isSelected ? 'var(--color-info)' : 'rgba(255,255,255,0.05)',
                    color: isSelected ? '#ffffff' : 'var(--color-text-secondary)',
                    border: isSelected ? '1px solid var(--color-info)' : '1px solid var(--glass-border)'
                  }}
                  title={d.label}
                >
                  {d.key} ({d.short})
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdminPortal() {
  // Autenticación & Cuenta
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [registerFamilyName, setRegisterFamilyName] = useState('');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Cuenta actual
  const [currentAccount, setCurrentAccount] = useState<Account | null>(null);
  const [isEditingFamilyName, setIsEditingFamilyName] = useState(false);
  const [familyNameInput, setFamilyNameInput] = useState('');
  const [isEditingPin, setIsEditingPin] = useState(false);
  const [accountPinInput, setAccountPinInput] = useState('');

  // Gestión de familiares (Padres / Abuelos)
  const [parents, setParents] = useState<Parent[]>([]);
  const [selectedParentId, setSelectedParentId] = useState<string>('');
  const [isAddingParent, setIsAddingParent] = useState(false);
  const [newParentName, setNewParentName] = useState('');
  const [newParentCalendarId, setNewParentCalendarId] = useState('');
  const [editingParentId, setEditingParentId] = useState<string | null>(null);
  const [editingParentName, setEditingParentName] = useState('');
  const [editingParentCalendarId, setEditingParentCalendarId] = useState('');
  
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
    schedule_type: ScheduleType;
    schedule_days: string;
    comments: string;
  }>({ name: '', dose: '', frequency: '', period: 'Mañana', schedule_type: 'diario', schedule_days: '', comments: '' });

  const [isAddingManualMed, setIsAddingManualMed] = useState<boolean>(false);
  const [manualMedForm, setManualMedForm] = useState<{
    name: string;
    dose: string;
    frequency: string;
    period: string;
    schedule_type: ScheduleType;
    schedule_days: string;
    comments: string;
  }>({ name: '', dose: '', frequency: '', period: 'Mañana', schedule_type: 'diario', schedule_days: '', comments: '' });

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

  // 2. Cargar datos aislados de la cuenta autenticada
  const loadAdminData = useCallback(async () => {
    if (!session?.user?.id) return;

    try {
      // Cargar o crear la cuenta del usuario
      let account = currentAccount;
      if (!account) {
        const { data: accData } = await supabase
          .from('accounts')
          .select('*')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (accData) {
          account = accData;
        } else {
          // Generar PIN único aleatorio
          const { data: allAccs } = await supabase.from('accounts').select('tablet_pin');
          const usedPins = new Set((allAccs || []).map((a: any) => a.tablet_pin));
          let autoPin = Math.floor(1000 + Math.random() * 9000).toString();
          while (usedPins.has(autoPin)) {
            autoPin = Math.floor(1000 + Math.random() * 9000).toString();
          }

          const { data: newAcc, error: createAccErr } = await supabase
            .from('accounts')
            .insert([{ user_id: session.user.id, name: registerFamilyName.trim() || 'Mi Familia', tablet_pin: autoPin }])
            .select()
            .single();

          if (!createAccErr && newAcc) {
            account = newAcc;
          }
        }

        if (account) {
          setCurrentAccount(account);
          setAccountPinInput(account.tablet_pin || '1234');
          setFamilyNameInput(account.name || 'Mi Familia');
        }
      }

      const accountId = account?.id;
      if (!accountId) return;

      // Cargar familiares de esta cuenta exclusivamente (100% gestión manual)
      const { data: parentsData } = await supabase
        .from('parents')
        .select('*')
        .eq('account_id', accountId)
        .order('name');

      setParents(parentsData || []);
      const activeParentId = (parentsData && parentsData.some(p => p.id === selectedParentId))
        ? selectedParentId
        : (parentsData?.[0]?.id || '');
      setSelectedParentId(activeParentId);

      // Cargar medicamentos activos del familiar seleccionado
      if (activeParentId) {
        const { data: medsData } = await supabase
          .from('medications')
          .select('*')
          .eq('parent_id', activeParentId)
          .eq('active', true);
        setActiveMeds(medsData || []);
      } else {
        setActiveMeds([]);
      }

      // Cargar avisos asociados a esta cuenta o sus familiares
      const parentIds = (parentsData || []).map(p => p.id);
      let noticesQuery = supabase.from('notices').select('*, parents(name)').order('created_at', { ascending: false });
      
      if (parentIds.length > 0) {
        noticesQuery = noticesQuery.or(`account_id.eq.${accountId},parent_id.in.(${parentIds.join(',')})`);
      } else {
        noticesQuery = noticesQuery.eq('account_id', accountId);
      }

      const { data: noticesData } = await noticesQuery;
      setNotices((noticesData as any) || []);

      // Cargar citas próximas de los familiares de esta cuenta
      if (parentIds.length > 0) {
        const { data: appointmentsData } = await supabase
          .from('appointments')
          .select('*, parents(name)')
          .in('parent_id', parentIds)
          .gte('start_time', new Date().toISOString())
          .order('start_time', { ascending: true })
          .limit(10);
        setAppointments((appointmentsData as any) || []);
      } else {
        setAppointments([]);
      }

    } catch (err) {
      console.error('Error al cargar datos de administración:', err);
    }
  }, [session, currentAccount, selectedParentId, registerFamilyName]);

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
    } else {
      setActiveMeds([]);
    }
  }, [selectedParentId, session]);

  // 3. Acciones de Auth & Registro
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError('');
    setAuthLoading(true);

    try {
      if (isRegistering) {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data?.user) {
          const famName = registerFamilyName.trim() || 'Mi Familia';
          
          // Generar PIN único aleatorio
          const { data: allAccs } = await supabase.from('accounts').select('tablet_pin');
          const usedPins = new Set((allAccs || []).map((a: any) => a.tablet_pin));
          let autoPin = Math.floor(1000 + Math.random() * 9000).toString();
          while (usedPins.has(autoPin)) {
            autoPin = Math.floor(1000 + Math.random() * 9000).toString();
          }

          await supabase
            .from('accounts')
            .insert([{ user_id: data.user.id, name: famName, tablet_pin: autoPin }]);
          alert(`¡Cuenta creada correctamente! Tu PIN único para la tablet es "${autoPin}" (puedes cambiarlo en cualquier momento desde tu panel).`);
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err: any) {
      setAuthError(err.message || 'Error en la autenticación');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setCurrentAccount(null);
  };

  // 4. Gestión de Familiares (Padres / Abuelos)
  const handleAddParent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newParentName.trim() || !currentAccount) return;

    try {
      const { data, error } = await supabase
        .from('parents')
        .insert([{ 
          account_id: currentAccount.id, 
          name: newParentName.trim(),
          calendar_id: newParentCalendarId.trim() || null
        }])
        .select()
        .single();

      if (error) throw error;

      setParents(prev => [...prev, data]);
      setNewParentName('');
      setNewParentCalendarId('');
      setIsAddingParent(false);
      if (!selectedParentId) setSelectedParentId(data.id);
      alert(`¡Familiar "${data.name}" añadido correctamente a tu cuenta!`);
    } catch (err: any) {
      alert(`Error al añadir familiar: ${err.message || err}`);
    }
  };

  const startEditParent = (p: Parent) => {
    setEditingParentId(p.id);
    setEditingParentName(p.name);
    setEditingParentCalendarId(p.calendar_id || '');
  };

  const handleUpdateParent = async (parentId: string) => {
    if (!editingParentName.trim()) return;

    try {
      const { error } = await supabase
        .from('parents')
        .update({ 
          name: editingParentName.trim(),
          calendar_id: editingParentCalendarId.trim() || null
        })
        .eq('id', parentId);

      if (error) throw error;

      setParents(prev => prev.map(p => p.id === parentId ? { 
        ...p, 
        name: editingParentName.trim(),
        calendar_id: editingParentCalendarId.trim() || null
      } : p));
      setEditingParentId(null);
      alert('¡Perfil del familiar actualizado correctamente!');
    } catch (err: any) {
      alert(`Error al actualizar familiar: ${err.message || err}`);
    }
  };

  const handleDeleteParent = async (parentId: string, parentName: string) => {
    if (!confirm(`¿Seguro que deseas eliminar el perfil de ${parentName}? Se eliminarán también todos sus medicamentos y citas asociadas.`)) return;

    try {
      const { error } = await supabase
        .from('parents')
        .delete()
        .eq('id', parentId);

      if (error) throw error;

      const filtered = parents.filter(p => p.id !== parentId);
      setParents(filtered);
      if (selectedParentId === parentId) {
        setSelectedParentId(filtered[0]?.id || '');
      }
      if (filtered.length === 0) {
        setActiveMeds([]);
      }
      alert(`Familiar "${parentName}" eliminado correctamente.`);
    } catch (err: any) {
      alert(`Error al eliminar familiar: ${err.message || err}`);
    }
  };

  // 5. Configuración de Cuenta y PIN
  const handleSavePin = async () => {
    const cleanPin = accountPinInput.trim();
    if (!cleanPin || !currentAccount) return;

    if (cleanPin.length < 4) {
      alert('El PIN debe tener al menos 4 dígitos o caracteres.');
      return;
    }

    try {
      // Comprobar si otra cuenta ya tiene asignado este PIN
      const { data: existing } = await supabase
        .from('accounts')
        .select('id, name')
        .eq('tablet_pin', cleanPin)
        .neq('id', currentAccount.id)
        .maybeSingle();

      if (existing) {
        alert(`El PIN "${cleanPin}" ya está en uso por la familia "${existing.name}".\n\nCada familia debe tener un PIN único e irrepetible para que la tablet detecte automáticamente a tu familia al escribirlo. Por favor, elige un PIN diferente.`);
        return;
      }

      const { error } = await supabase
        .from('accounts')
        .update({ tablet_pin: cleanPin })
        .eq('id', currentAccount.id);

      if (error) {
        if (error.code === '23505' || error.message?.includes('unique')) {
          alert('Ese PIN ya está en uso por otra familia. Por favor elige otro PIN.');
          return;
        }
        throw error;
      }

      setCurrentAccount(prev => prev ? { ...prev, tablet_pin: cleanPin } : null);
      setIsEditingPin(false);
      alert(`¡PIN de la Tablet actualizado a "${cleanPin}"!\nAhora al escribir "${cleanPin}" en la tablet se abrirá directamente el portal de tu familia.`);
    } catch (err: any) {
      alert(`Error al guardar PIN: ${err.message || err}`);
    }
  };

  const handleSaveFamilyName = async () => {
    if (!familyNameInput.trim() || !currentAccount) return;

    try {
      const { error } = await supabase
        .from('accounts')
        .update({ name: familyNameInput.trim() })
        .eq('id', currentAccount.id);

      if (error) throw error;

      setCurrentAccount(prev => prev ? { ...prev, name: familyNameInput.trim() } : null);
      setIsEditingFamilyName(false);
      alert('¡Nombre de la familia actualizado correctamente!');
    } catch (err: any) {
      alert(`Error al guardar nombre: ${err.message || err}`);
    }
  };

  // 6. Sincronizar Google Calendar
  const handleCalendarSync = async () => {
    setIsSyncing(true);
    setSyncStatus('Sincronizando...');
    try {
      const url = currentAccount?.id ? `/api/calendar/sync?accountId=${currentAccount.id}` : '/api/calendar/sync';
      const res = await fetch(url);
      const data = await res.json();
      
      if (!res.ok) throw new Error(data.error || 'Error desconocido');
      
      const successResults = (data.results || [])
        .map((r: any) => `${r.name}: ${r.status === 'success' ? `Sincronizada (${r.syncedCount} citas)` : `Fallo (${r.detail})`}`)
        .join(', ');
        
      setSyncStatus(`Completado: ${successResults || 'Sin calendarios vinculados'}`);
      loadAdminData(); // Recargar citas en el admin
    } catch (err: any) {
      setSyncStatus(`Error: ${err.message || err}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // 7. Cargar y Procesar PDF de recetas
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
    setParsedMeds([...parsedMeds, { 
      name: '', 
      dose: '', 
      frequency: '', 
      period: 'Mañana', 
      schedule_type: 'diario', 
      schedule_days: '', 
      comments: '' 
    }]);
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
      const medsToInsert = parsedMeds.map(med => {
        const inferred = inferScheduleFromText(med.frequency, med.comments);
        return {
          parent_id: selectedParentId,
          name: med.name,
          dose: med.dose,
          frequency: med.frequency,
          period: med.period || 'Mañana',
          schedule_type: med.schedule_type || inferred.schedule_type || 'diario',
          schedule_days: med.schedule_days !== undefined ? med.schedule_days : inferred.schedule_days,
          comments: med.comments || '',
          active: true
        };
      });

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
    const inferred = inferScheduleFromText(med.frequency, med.comments);
    setEditingMedId(med.id);
    setEditForm({
      name: med.name || '',
      dose: med.dose || '',
      frequency: med.frequency || '',
      period: med.period || 'Mañana',
      schedule_type: (med.schedule_type as ScheduleType) || inferred.schedule_type || 'diario',
      schedule_days: med.schedule_days !== undefined ? med.schedule_days : inferred.schedule_days,
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
      const payload: any = {
        name: editForm.name.trim(),
        dose: editForm.dose.trim(),
        frequency: editForm.frequency.trim(),
        period: editForm.period || 'Mañana',
        schedule_type: editForm.schedule_type || 'diario',
        schedule_days: editForm.schedule_days || '',
        comments: editForm.comments.trim()
      };

      const { error } = await supabase
        .from('medications')
        .update(payload)
        .eq('id', medId);

      if (error) throw error;

      setActiveMeds(prev => prev.map(m => m.id === medId ? {
        ...m,
        ...payload
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
      alert('Por favor indica al menos el nombre del medicamento y selecciona el perfil del familiar.');
      return;
    }

    setIsSavingMed(true);
    try {
      const payload: any = {
        parent_id: selectedParentId,
        name: manualMedForm.name.trim(),
        dose: manualMedForm.dose.trim(),
        frequency: manualMedForm.frequency.trim(),
        period: manualMedForm.period || 'Mañana',
        schedule_type: manualMedForm.schedule_type || 'diario',
        schedule_days: manualMedForm.schedule_days || '',
        comments: manualMedForm.comments.trim(),
        active: true
      };

      const { data, error } = await supabase
        .from('medications')
        .insert([payload])
        .select();

      if (error) throw error;

      if (data && data[0]) {
        setActiveMeds(prev => [...prev, data[0]]);
      }

      setIsAddingManualMed(false);
      setManualMedForm({ name: '', dose: '', frequency: '', period: 'Mañana', schedule_type: 'diario', schedule_days: '', comments: '' });
      alert('¡Medicamento añadido y activado correctamente!');
    } catch (err: any) {
      alert(`Error al añadir medicamento: ${err.message || err}`);
    } finally {
      setIsSavingMed(false);
    }
  };

  // 8. Enviar Aviso
  const sendNotice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNoticeText.trim() || !currentAccount) return;

    try {
      const parentId = noticeParentId === 'both' ? null : noticeParentId;
      
      const { error } = await supabase
        .from('notices')
        .insert({
          account_id: currentAccount.id,
          parent_id: parentId,
          message: newNoticeText,
          type: noticeType,
          is_read: false
        });

      if (error) throw error;

      setNewNoticeText('');
      alert('Aviso enviado correctamente en tiempo real a tu tablet familiar.');
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


  // --- VISTA DE LOGIN Y REGISTRO ---
  if (!session) {
    return (
      <main style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
        <div className="bg-blobs">
          <div className="blob blob-1"></div>
          <div className="blob blob-2"></div>
        </div>

        <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', display: 'flex', flexDirection: 'column', gap: '24px', padding: '36px' }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ fontSize: '2.2rem', fontWeight: 800, marginBottom: '8px' }}>Portal de Control</h1>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.95rem' }}>
              {isRegistering ? 'Crea una nueva cuenta para gestionar tu familia' : 'Inicia sesión para administrar la tablet de tu familia'}
            </p>
          </div>

          {/* Toggle Iniciar Sesión / Registro */}
          <div style={{ display: 'flex', background: 'rgba(255,255,255,0.04)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
            <button
              type="button"
              onClick={() => { setIsRegistering(false); setAuthError(''); }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: !isRegistering ? 'var(--color-primary)' : 'transparent',
                color: !isRegistering ? '#ffffff' : 'var(--color-text-muted)',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Iniciar Sesión
            </button>
            <button
              type="button"
              onClick={() => { setIsRegistering(true); setAuthError(''); }}
              style={{
                flex: 1,
                padding: '8px 12px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: isRegistering ? 'var(--color-primary)' : 'transparent',
                color: isRegistering ? '#ffffff' : 'var(--color-text-muted)',
                fontWeight: 700,
                fontSize: '0.9rem',
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
            >
              Crear Cuenta
            </button>
          </div>

          {authError && (
            <div style={{ background: 'var(--color-error-bg)', color: 'var(--color-error)', border: '1px solid var(--color-error)', padding: '12px', borderRadius: 'var(--radius-sm)', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {isRegistering && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--color-text-secondary)' }}>Nombre de tu Familia</label>
                <div style={{ position: 'relative' }}>
                  <Users size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                  <input 
                    type="text" 
                    value={registerFamilyName}
                    onChange={(e) => setRegisterFamilyName(e.target.value)}
                    placeholder="ej. Familia Martínez" 
                    required={isRegistering}
                    style={{ width: '100%', padding: '14px 14px 14px 44px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', color: '#ffffff', outline: 'none', fontSize: '1rem' }}
                  />
                </div>
              </div>
            )}

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

            <button 
              type="submit" 
              disabled={authLoading}
              className="btn btn-primary" 
              style={{ width: '100%', padding: '14px', fontSize: '1.05rem', fontWeight: 700, marginTop: '8px' }}
            >
              {authLoading ? (isRegistering ? 'Creando cuenta...' : 'Iniciando sesión...') : (isRegistering ? 'Crear Cuenta Familiar' : 'Iniciar Sesión')}
            </button>
          </form>

          <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', textAlign: 'center' }}>
            🔒 Cada cuenta dispone de su propio entorno aislado con sus familiares, recetas y avisos.
          </p>
        </div>
      </main>
    );
  }

  // --- VISTA PANEL ADMINISTRACIÓN ---
  return (
    <main style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', padding: '24px', gap: '20px' }}>
      <div className="bg-blobs">
        <div className="blob blob-1"></div>
        <div className="blob blob-2"></div>
      </div>

      {/* Cabecera Admin */}
      <header className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span style={{ fontSize: '0.85rem', color: 'var(--color-info)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Panel de Control Familiar</span>
          <h1 style={{ fontSize: '1.9rem', fontWeight: 800 }}>Gestión Médica de tu Familia</h1>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)' }}>{session.user.email}</span>
          <button onClick={handleLogout} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.9rem' }}>
            <LogOut size={16} />
            <span>Salir</span>
          </button>
        </div>
      </header>

      {/* TARJETA DE GESTIÓN DE CUENTA Y FAMILIARES */}
      <section className="glass-panel" style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px', borderLeft: '4px solid var(--color-primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          
          {/* Nombre de la Familia */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'rgba(59, 130, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#60a5fa' }}>
              <Users size={22} />
            </div>
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>Cuenta Familiar</span>
              {isEditingFamilyName ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <input 
                    type="text" 
                    value={familyNameInput}
                    onChange={(e) => setFamilyNameInput(e.target.value)}
                    style={{ padding: '4px 8px', fontSize: '1rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '4px', color: '#ffffff' }}
                  />
                  <button onClick={handleSaveFamilyName} className="btn btn-success" style={{ padding: '4px 8px', fontSize: '0.8rem' }}><Check size={14} /></button>
                  <button onClick={() => setIsEditingFamilyName(false)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }}><X size={14} /></button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <strong style={{ fontSize: '1.25rem', color: 'var(--color-text-primary)' }}>{currentAccount?.name || 'Mi Familia'}</strong>
                  <button onClick={() => setIsEditingFamilyName(true)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }} title="Cambiar nombre de la familia">
                    <Pencil size={14} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* PIN de la Tablet */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(255,255,255,0.02)', padding: '8px 16px', borderRadius: 'var(--radius-md)', border: '1px solid var(--glass-border)' }}>
            <Key size={18} color="var(--color-warning)" />
            <div>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'block' }}>PIN Tablet</span>
              {isEditingPin ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                  <input 
                    type="text" 
                    value={accountPinInput}
                    onChange={(e) => setAccountPinInput(e.target.value)}
                    maxLength={8}
                    style={{ width: '80px', padding: '4px 8px', fontSize: '0.95rem', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '4px', color: '#ffffff', textAlign: 'center' }}
                  />
                  <button onClick={handleSavePin} className="btn btn-success" style={{ padding: '4px 8px', fontSize: '0.8rem' }}><Check size={14} /></button>
                  <button onClick={() => setIsEditingPin(false)} className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.8rem' }}><X size={14} /></button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <strong style={{ fontSize: '1.1rem', color: 'var(--color-warning)', letterSpacing: '2px' }}>{currentAccount?.tablet_pin || '1234'}</strong>
                  <button onClick={() => setIsEditingPin(true)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }} title="Cambiar PIN de la tablet">
                    <Pencil size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Listado y Creación de Perfiles de Familiares */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid var(--glass-border)', paddingTop: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Familiares registrados en esta cuenta:</span>
            {!isAddingParent && (
              <button 
                onClick={() => setIsAddingParent(true)} 
                className="btn btn-secondary" 
                style={{ padding: '4px 10px', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                <UserPlus size={14} />
                <span>+ Añadir Familiar</span>
              </button>
            )}
          </div>

          {/* Formulario para añadir familiar */}
          {isAddingParent && (
            <form onSubmit={handleAddParent} style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(255,255,255,0.03)', padding: '14px 16px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--glass-border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>Nombre del familiar *</label>
                  <input 
                    type="text" 
                    required
                    value={newParentName}
                    onChange={(e) => setNewParentName(e.target.value)}
                    placeholder="ej. Mamá, Papá, Abuela Carmen"
                    style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '4px', color: '#ffffff', outline: 'none', fontSize: '0.9rem' }}
                    autoFocus
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600 }}>ID de Google Calendar (Opcional)</label>
                  <input 
                    type="text" 
                    value={newParentCalendarId}
                    onChange={(e) => setNewParentCalendarId(e.target.value)}
                    placeholder="ej. ejemplo@gmail.com o ID de calendario"
                    style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: '4px', color: '#ffffff', outline: 'none', fontSize: '0.9rem' }}
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button type="submit" className="btn btn-success" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                  <Check size={14} />
                  <span>Guardar Familiar</span>
                </button>
                <button type="button" onClick={() => setIsAddingParent(false)} className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '0.85rem' }}>
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {/* Chips y tarjetas de familiares */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {parents.length === 0 ? (
              <p style={{ color: 'var(--color-text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>No hay familiares registrados. Pulsa "+ Añadir Familiar" para comenzar.</p>
            ) : (
              parents.map((p) => {
                const isSelected = selectedParentId === p.id;
                const isEditingThis = editingParentId === p.id;

                if (isEditingThis) {
                  return (
                    <div key={p.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255,255,255,0.05)', padding: '12px 14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-info)', width: '100%', maxWidth: '420px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Nombre</label>
                        <input 
                          type="text"
                          value={editingParentName}
                          onChange={(e) => setEditingParentName(e.target.value)}
                          style={{ padding: '6px 8px', fontSize: '0.9rem', background: '#0f172a', border: '1px solid var(--glass-border)', borderRadius: '4px', color: '#ffffff' }}
                          autoFocus
                        />
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>ID de Google Calendar</label>
                        <input 
                          type="text"
                          value={editingParentCalendarId}
                          onChange={(e) => setEditingParentCalendarId(e.target.value)}
                          placeholder="ej. correo@gmail.com o ID de calendario"
                          style={{ padding: '6px 8px', fontSize: '0.85rem', background: '#0f172a', border: '1px solid var(--glass-border)', borderRadius: '4px', color: '#ffffff' }}
                        />
                      </div>
                      <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', marginTop: '4px' }}>
                        <button onClick={() => handleUpdateParent(p.id)} className="btn btn-success" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
                          <Check size={14} /> Guardar
                        </button>
                        <button onClick={() => setEditingParentId(null)} className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.8rem' }}>
                          <X size={14} /> Cancelar
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      padding: '8px 14px',
                      borderRadius: 'var(--radius-sm)',
                      background: isSelected ? 'rgba(59, 130, 246, 0.18)' : 'rgba(255, 255, 255, 0.03)',
                      border: isSelected ? '1px solid #3b82f6' : '1px solid var(--glass-border)',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onClick={() => setSelectedParentId(p.id)}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                      <span style={{ fontWeight: isSelected ? 700 : 600, color: isSelected ? '#60a5fa' : 'var(--color-text-primary)', fontSize: '1rem' }}>
                        {p.name}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); startEditParent(p); }}
                          style={{ background: 'transparent', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '2px' }}
                          title="Editar nombre e ID de calendario"
                        >
                          <Pencil size={13} />
                        </button>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDeleteParent(p.id, p.name); }}
                          style={{ background: 'transparent', border: 'none', color: 'var(--color-error)', cursor: 'pointer', padding: '2px' }}
                          title="Eliminar familiar"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: p.calendar_id ? 'var(--color-info)' : 'var(--color-text-muted)' }}>
                      <Calendar size={11} />
                      <span style={{ maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.calendar_id || 'Sin calendario ID'}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>

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
                <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', fontStyle: 'italic' }}>No hay citas sincronizadas próximamente para tus familiares.</p>
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
                  disabled={parents.length === 0}
                >
                  {parents.length === 0 ? (
                    <option value="" disabled style={{ background: '#0a0f1d' }}>No hay familiares registrados</option>
                  ) : (
                    <>
                      <option value="both" style={{ background: '#0a0f1d' }}>Toda la familia (Todos los miembros)</option>
                      {parents.map(p => (
                        <option key={p.id} value={p.id} style={{ background: '#0a0f1d' }}>{p.name}</option>
                      ))}
                    </>
                  )}
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
                placeholder="Escribe aquí el mensaje... ej: 'Hola, te llamo a las 18:00'"
                required
                rows={3}
                style={{ width: '100%', padding: '12px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', color: '#ffffff', outline: 'none', fontSize: '0.95rem', resize: 'vertical' }}
              />
            </div>

            <button type="submit" disabled={parents.length === 0} className="btn btn-success" style={{ width: '100%', padding: '12px', fontWeight: 700 }}>
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
                            Para: <strong>{ntc.parents?.name || 'Toda la familia'}</strong> | {date.toLocaleDateString('es-ES')} {date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
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
                <label style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', fontWeight: 600 }}>Seleccionar Familiar</label>
                <select 
                  value={selectedParentId} 
                  onChange={(e) => setSelectedParentId(e.target.value)}
                  style={{ width: '100%', padding: '10px', background: 'rgba(255,255,255,0.03)', border: '1px solid var(--glass-border)', borderRadius: 'var(--radius-md)', color: '#ffffff', outline: 'none' }}
                  disabled={parents.length === 0}
                >
                  {parents.length === 0 ? (
                    <option value="" disabled style={{ background: '#0a0f1d' }}>No hay familiares registrados (añade uno arriba)</option>
                  ) : (
                    parents.map(p => (
                      <option key={p.id} value={p.id} style={{ background: '#0a0f1d' }}>{p.name}</option>
                    ))
                  )}
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
                  <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>PDF de receta médica de tu familiar</p>
                </div>
                <input 
                  type="file" 
                  accept="application/pdf"
                  onChange={handlePdfUpload}
                  disabled={parents.length === 0}
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
                      <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Frecuencia (Texto)</label>
                      <input 
                        type="text" 
                        value={manualMedForm.frequency} 
                        onChange={(e) => {
                          const freq = e.target.value;
                          const inferred = inferScheduleFromText(freq, manualMedForm.comments);
                          setManualMedForm(prev => ({ 
                            ...prev, 
                            frequency: freq,
                            schedule_type: prev.schedule_type === 'diario' && inferred.schedule_type !== 'diario' ? inferred.schedule_type : prev.schedule_type,
                            schedule_days: !prev.schedule_days && inferred.schedule_days ? inferred.schedule_days : prev.schedule_days
                          }));
                        }}
                        placeholder="ej. 1 cada 8h o Lunes y Jueves"
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

                  {/* Selector de Periodicidad / Pauta Flexible */}
                  <ScheduleSelector
                    scheduleType={manualMedForm.schedule_type}
                    scheduleDays={manualMedForm.schedule_days}
                    onChangeType={(t) => setManualMedForm(prev => ({ ...prev, schedule_type: t }))}
                    onChangeDays={(d) => setManualMedForm(prev => ({ ...prev, schedule_days: d }))}
                  />

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
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '450px', overflowY: 'auto', paddingRight: '4px' }}>
                {parents.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', fontStyle: 'italic', padding: '10px 0' }}>No hay familiares registrados. Añade un familiar arriba para comenzar a gestionar su medicación.</p>
                ) : activeMeds.length === 0 ? (
                  <p style={{ color: 'var(--color-text-muted)', fontSize: '0.95rem', fontStyle: 'italic', padding: '10px 0' }}>No hay medicamentos activos cargados para este familiar.</p>
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
                              <label style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Frecuencia (Texto)</label>
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

                          {/* Selector de Periodicidad / Pauta Flexible */}
                          <ScheduleSelector
                            scheduleType={editForm.schedule_type}
                            scheduleDays={editForm.schedule_days}
                            onChangeType={(t) => setEditForm(prev => ({ ...prev, schedule_type: t }))}
                            onChangeDays={(d) => setEditForm(prev => ({ ...prev, schedule_days: d }))}
                          />

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
                            <span style={{ 
                              fontSize: '0.75rem', 
                              fontWeight: 700, 
                              padding: '2px 8px', 
                              borderRadius: '10px', 
                              background: 'rgba(6, 182, 212, 0.12)', 
                              color: '#22d3ee',
                              border: '1px solid rgba(6, 182, 212, 0.3)'
                            }}>
                              {getScheduleDescription(med)}
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
                <div style={{ maxHeight: '450px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px', paddingRight: '4px' }}>
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

                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                          <label style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Frecuencia (Texto)</label>
                          <input 
                            type="text" 
                            value={med.frequency} 
                            onChange={(e) => {
                              const freq = e.target.value;
                              const inferred = inferScheduleFromText(freq, med.comments);
                              handleParsedMedChange(index, 'frequency', freq);
                              if (!med.schedule_type || med.schedule_type === 'diario') {
                                if (inferred.schedule_type !== 'diario') {
                                  handleParsedMedChange(index, 'schedule_type', inferred.schedule_type);
                                  handleParsedMedChange(index, 'schedule_days', inferred.schedule_days);
                                }
                              }
                            }}
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
                      </div>

                      {/* Selector de Periodicidad / Pauta Flexible */}
                      <ScheduleSelector
                        scheduleType={(med.schedule_type as ScheduleType) || 'diario'}
                        scheduleDays={med.schedule_days || ''}
                        onChangeType={(t) => handleParsedMedChange(index, 'schedule_type', t)}
                        onChangeDays={(d) => handleParsedMedChange(index, 'schedule_days', d)}
                      />

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
