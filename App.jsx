import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { Calendar, Clock, MapPin, X, Activity, CalendarDays, CheckCircle, Lock, Trash2, ArrowLeft, AlertCircle, RefreshCw, DollarSign, TrendingUp, BarChart3, Users, GraduationCap, Plus, CreditCard, Info, MessageCircle, KeyRound, Settings, Bell, FileText, Printer, ChevronDown, Check } from 'lucide-react';

const firebaseConfig = {
  apiKey: "AIzaSyAESjcStj4qQotTmSuU3-GAdellNR-DGwE",
  authDomain: "arena-jd.firebaseapp.com",
  projectId: "arena-jd",
  storageBucket: "arena-jd.firebasestorage.app",
  messagingSenderId: "1068375009215",
  appId: "1:1068375009215:web:bbd498a6db6e326981630a",
  measurementId: "G-2STXPKJB9M"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = 'arena-jd-app';

// Default Data Settings
const DEFAULT_COURTS = [
  { id: 'jd', name: 'JD' },
  { id: 'barbearia', name: 'Barbearia Lins (Areia de Praia)' },
  { id: 'campelo', name: 'Campelo Gomes' },
  { id: 'edite', name: 'Edite Imports (Areia de Praia)' }
];

const DEFAULT_DURATIONS = [
  { label: '30 Minutos', value: 30, price: 20 }, { label: '1 Hora', value: 60, price: 40 },
  { label: '1h 30m', value: 90, price: 60 }, { label: '2 Horas', value: 120, price: 80 },
  { label: '2h 30m', value: 150, price: 100 }, { label: '3 Horas', value: 180, price: 120 }
];

const SPORTS = ['Beach Tênis', 'Vôlei Adaptado/Normal', 'Futevôlei', 'Carimba', 'Exercícios Funcionais'];
const PAYMENTS = ['Pix', 'Cartão Débito', 'Cartão Crédito', 'Dinheiro'];
const PLANS = [
  { id: 'start', name: 'Plano Start (1x na semana)', price: 60 },
  { id: 'evolution', name: 'Plano Evolution (2x na semana)', price: 110 }
];

// Helper Functions
const generateTimeSlots = () => {
  const slots = [];
  for (let i = 300; i < 1380; i += 30) slots.push(`${String(Math.floor(i/60)).padStart(2,'0')}:${String(i%60).padStart(2,'0')}`);
  return slots;
};
const TIME_SLOTS = generateTimeSlots();

const getDayString = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
const formatCurrency = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const checkAvailability = (date, courtId, startTimeStr, durationMins, allReservations, ignoreResId = null) => {
  const startMins = parseInt(startTimeStr.split(':')[0]) * 60 + parseInt(startTimeStr.split(':')[1]);
  const endMins = startMins + durationMins;
  const dayRes = allReservations.filter(r => r.date === date && r.courtId === courtId && r.id !== ignoreResId && r.status !== 'cancelled');
  for (const res of dayRes) {
    const resStartMins = parseInt(res.startTime.split(':')[0]) * 60 + parseInt(res.startTime.split(':')[1]);
    if (Math.max(startMins, resStartMins) < Math.min(endMins, resStartMins + res.duration)) return false;
  }
  return true;
};

// Toast Component
const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer); }, [onClose]);
  return (
    <div className={`fixed bottom-4 right-4 ${type === 'error' ? 'bg-red-500' : 'bg-green-500'} text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50 animate-bounce`}>
      {type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
      <span className="font-medium text-sm md:text-base">{message}</span>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login');
  const [reservations, setReservations] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [sysSettings, setSysSettings] = useState({ courts: DEFAULT_COURTS, durations: DEFAULT_DURATIONS });
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    onAuthStateChanged(auth, (u) => { if(u) setUser(u); else signInAnonymously(auth); });
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    
    // Listeners
    const unsubRes = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'reservations'), (s) => setReservations(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubEnr = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'enrollments'), (s) => setEnrollments(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubNotif = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'notifications'), (s) => {
        setNotifications(s.docs.map(d => ({ id: d.id, ...d.data() })).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt)));
    });
    
    // Settings logic (merge local with DB)
    const settingsRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'general');
    const unsubSet = onSnapshot(settingsRef, (docSnap) => {
      if(docSnap.exists()) {
        const data = docSnap.data();
        setSysSettings({ courts: data.courts || DEFAULT_COURTS, durations: data.durations || DEFAULT_DURATIONS });
      }
      setLoading(false);
    });

    return () => { unsubRes(); unsubEnr(); unsubNotif(); unsubSet(); };
  }, [user]);

  const showToast = (message, type = 'success') => setToast({ message, type });

  const notifyEvent = async (title, message, type) => {
    await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'notifications'), {
        title, message, type, read: false, createdAt: new Date().toISOString()
    });
  };

  const handleCreateReservation = async (data) => {
    try { 
        await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'reservations'), { ...data, createdAt: new Date().toISOString() }); 
        showToast("Agendamento Confirmado!"); 
        await notifyEvent('Novo Agendamento', `${data.customerName} reservou para ${data.date} às ${data.startTime}.`, 'NEW');
        return true; 
    } catch { showToast("Erro ao salvar.", "error"); return false; }
  };

  const handleUpdateReservationTime = async (id, newTime, resData) => {
    try {
        await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'reservations', id), { startTime: newTime });
        showToast("Horário alterado com sucesso!");
        await notifyEvent('Remarcação', `O horário de ${resData.customerName} foi alterado para ${newTime}.`, 'UPDATE');
    } catch { showToast("Erro ao remarcar.", "error"); }
  };

  const handleDeleteReservation = async (id, resData) => {
    try { 
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'reservations', id)); 
        showToast("Removido com sucesso."); 
        if(resData.status !== 'blocked') {
            await notifyEvent('Cancelamento', `O agendamento de ${resData.customerName} (${resData.date}) foi cancelado.`, 'CANCEL');
        }
    } catch { showToast("Erro ao remover.", "error"); }
  };

  const handleCreateEnrollment = async (data) => {
    try { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'enrollments'), { ...data, createdAt: new Date().toISOString() }); showToast("Matrícula Confirmada!"); return true; } 
    catch { showToast("Erro ao salvar.", "error"); return false; }
  };

  const handleDeleteEnrollment = async (id) => {
    try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'enrollments', id)); showToast("Matrícula removida."); } 
    catch { showToast("Erro ao remover.", "error"); }
  };

  const handleAdminLogin = async (pwd) => {
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'admin');
      const docSnap = await getDoc(docRef);
      const currentPwd = docSnap.exists() && docSnap.data().password ? docSnap.data().password : 'dheyminarena';
      if (pwd === currentPwd) setView('admin_dashboard'); else showToast('Senha incorreta!', 'error');
    } catch (e) { showToast('Erro ao verificar a senha.', 'error'); }
  };

  const handleUpdateSettings = async (type, payload) => {
    try {
      if(type === 'password') {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'admin'), { password: payload }, { merge: true });
      } else {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'general'), payload, { merge: true });
      }
      showToast('Configurações salvas com sucesso!');
      return true;
    } catch {
      showToast('Erro ao salvar.', 'error');
      return false;
    }
  };

  const handleMarkNotificationRead = async (id) => {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'notifications', id), { read: true });
  };

  if (loading) return <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-[#F58021]"><RefreshCw className="animate-spin mb-4" size={48} /><h1 className="text-xl font-bold uppercase tracking-widest text-white">Arena JD</h1></div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {view === 'login' && <LoginScreen setView={setView} />}
      {view === 'how_to' && <HowToBookScreen setView={setView} />}
      {view === 'admin_login' && <AdminLoginScreen setView={setView} onLogin={handleAdminLogin} />}
      {view === 'customer' && <CustomerBookingScreen sysSettings={sysSettings} reservations={reservations} onSave={handleCreateReservation} setView={setView} />}
      {view === 'admin_dashboard' && <AdminDashboard 
          sysSettings={sysSettings} 
          reservations={reservations} 
          enrollments={enrollments} 
          notifications={notifications}
          onDeleteRes={handleDeleteReservation} 
          onUpdateRes={handleUpdateReservationTime}
          onDeleteEnr={handleDeleteEnrollment} 
          onBlock={handleCreateReservation} 
          onSaveEnr={handleCreateEnrollment} 
          onSaveSettings={handleUpdateSettings} 
          onMarkNotificationRead={handleMarkNotificationRead}
          setView={setView} 
      />}
    </div>
  );
}

// --- SCREENS ---

const LoginScreen = ({ setView }) => (
  <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-950">
    <div className="max-w-md w-full text-center">
      <img src="https://i.postimg.cc/j21g4jhM/Screenshot-20260508-202911-Instagram-2.jpg" alt="Arena JD" className="w-48 h-48 mx-auto mb-6 rounded-full object-cover shadow-[0_0_30px_rgba(90,44,129,0.4)] border-4 border-[#5A2C81]" />
      <h1 className="text-4xl font-black text-white uppercase mb-10 tracking-tighter">Arena <span className="text-[#F58021]">JD</span></h1>
      <button onClick={() => setView('customer')} className="w-full bg-[#F58021] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 mb-4 shadow-xl shadow-[#F58021]/20 active:scale-95 transition-all hover:bg-[#e0751e]"><Calendar size={24} />AGENDAR HORÁRIO</button>
      <button onClick={() => setView('how_to')} className="w-full bg-zinc-800 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 mb-4 active:scale-95 transition-all hover:bg-zinc-700"><Info size={24} className="text-[#F58021]" />COMO AGENDAR</button>
      <button onClick={() => setView('admin_login')} className="w-full bg-zinc-900 border border-[#5A2C81] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 active:bg-zinc-800 transition-all hover:bg-zinc-800"><Lock size={20} className="text-[#F58021]" />ACESSO RESTRITO</button>
    </div>
  </div>
);

const HowToBookScreen = ({ setView }) => {
  const steps = [
    "Escolha a data", "Escolha a quadra", "Escolha o horário", "Escolha o tipo de esporte", 
    "Escolha a forma de pagamento", "Escolha o tempo do agendamento", "Preencha seu nome e número do WhatsApp"
  ];
  return (
    <div className="min-h-screen bg-zinc-950 pb-20">
      <header className="sticky top-0 bg-zinc-950/90 border-b border-zinc-900 z-30 px-4 py-4 flex items-center gap-3 backdrop-blur-md">
        <button onClick={() => setView('login')} className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition-colors"><ArrowLeft size={20}/></button>
        <h1 className="text-lg font-black uppercase tracking-tight text-white">Como <span className="text-[#F58021]">Agendar</span></h1>
      </header>
      <main className="max-w-md mx-auto p-4 space-y-3 mt-4">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-4 bg-zinc-900 p-4 rounded-2xl border border-zinc-800 hover:border-zinc-700 transition-all">
            <div className="bg-[#F58021] text-zinc-950 font-black w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-lg shadow-[#F58021]/30">{i+1}</div>
            <p className="text-sm font-bold text-zinc-200">{step}</p>
          </div>
        ))}
        <div className="mt-8 bg-[#5A2C81]/20 border border-[#5A2C81] p-6 rounded-2xl text-center">
           <Activity className="text-[#F58021] mx-auto mb-3" size={32} />
           <p className="text-sm text-zinc-300 leading-relaxed">Após confirmar o agendamento, sua reserva será <b>salva automaticamente</b> no sistema da arena de forma simples e rápida!</p>
        </div>
      </main>
    </div>
  );
};

const AdminLoginScreen = ({ setView, onLogin }) => {
  const [pwd, setPwd] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (e) => { 
    e.preventDefault(); 
    setIsLoading(true);
    await onLogin(pwd); 
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <button onClick={() => setView('login')} className="absolute top-6 left-6 p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition-colors"><ArrowLeft size={24} /></button>
      <div className="max-w-sm w-full bg-zinc-900 p-8 rounded-3xl border border-zinc-800 shadow-2xl">
        <Lock size={40} className="text-[#F58021] mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-center mb-8">Login ADM</h2>
        <form onSubmit={handleLogin} className="space-y-6">
          <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 text-white px-4 py-3 rounded-xl focus:border-[#F58021] outline-none transition-all" placeholder="Senha" autoFocus />
          <button type="submit" disabled={isLoading} className="w-full bg-[#5A2C81] text-white font-bold py-3 rounded-xl hover:bg-[#4a246a] disabled:opacity-50 transition-all shadow-lg shadow-[#5A2C81]/20">
            {isLoading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};

const CustomerBookingScreen = ({ sysSettings, reservations, onSave, setView }) => {
  const COURTS = sysSettings.courts;
  const [selectedDate, setSelectedDate] = useState(getDayString(new Date()));
  const [selectedCourt, setSelectedCourt] = useState(COURTS[0]?.id || 'jd');
  const [bookingModalInfo, setBookingModalInfo] = useState(null);

  const days = Array.from({length: 60}, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return { full: getDayString(d), dayNum: d.getDate(), dayWeek: d.toLocaleDateString('pt-BR', {weekday: 'short'}).toUpperCase().replace('.', ''), month: d.toLocaleDateString('pt-BR', {month: 'long'}).toUpperCase() };
  });
  const currentMonth = days.find(d => d.full === selectedDate)?.month;

  return (
    <div className="pb-24">
      <header className="sticky top-0 bg-zinc-950/90 border-b border-zinc-900 z-30 px-4 py-4 flex items-center gap-3 backdrop-blur-md">
        <button onClick={() => setView('login')} className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition-colors"><ArrowLeft size={20}/></button>
        <h1 className="text-lg font-black uppercase tracking-tight">Arena <span className="text-[#F58021]">JD</span></h1>
      </header>
      <main className="max-w-4xl mx-auto p-4 space-y-8 mt-4">
        <section>
          <div className="flex items-center justify-between mb-3"><h2 className="text-[10px] md:text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2"><CalendarDays size={16}/> Selecione a Data</h2><span className="text-[10px] md:text-xs font-black text-[#F58021]">{currentMonth}</span></div>
          <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide snap-x">
            {days.map(day => <button key={day.full} onClick={() => setSelectedDate(day.full)} className={`snap-center flex-shrink-0 w-16 md:w-20 py-3 md:py-4 rounded-2xl border transition-all ${selectedDate===day.full?'bg-[#F58021] border-[#F58021] text-white shadow-lg shadow-[#F58021]/20 scale-105':'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600'}`}><span className="text-[9px] md:text-[11px] font-bold block mb-1">{day.dayWeek}</span><span className="text-lg md:text-xl font-black">{day.dayNum}</span></button>)}
          </div>
        </section>
        <section className="space-y-3">
          <h2 className="text-[10px] md:text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2"><MapPin size={16}/> Selecione a Quadra</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {COURTS.map(court => <button key={court.id} onClick={() => setSelectedCourt(court.id)} className={`p-4 rounded-xl border text-left flex justify-between items-center transition-all ${selectedCourt===court.id?'bg-zinc-800 border-[#F58021] shadow-md':'bg-zinc-900 border-zinc-800 hover:bg-zinc-800/50'}`}><span className="font-bold text-sm">{court.name}</span>{selectedCourt===court.id && <CheckCircle size={18} className="text-[#F58021]"/>}</button>)}
          </div>
        </section>
        <section className="space-y-3">
          <h2 className="text-[10px] md:text-xs font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Clock size={16}/> Horários Disponíveis</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
            {TIME_SLOTS.map(time => { const isAvail = checkAvailability(selectedDate, selectedCourt, time, 30, reservations); return <button key={time} disabled={!isAvail} onClick={() => setBookingModalInfo({time})} className={`py-3 rounded-xl border text-sm font-bold relative overflow-hidden transition-all ${isAvail?'bg-zinc-900 border-zinc-700 hover:border-[#5A2C81] hover:-translate-y-1':'bg-zinc-950 border-zinc-900 text-zinc-800 opacity-50'}`}>{time}{!isAvail && <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80"><Lock size={14}/></div>}</button> })}
          </div>
        </section>
      </main>
      {bookingModalInfo && <BookingFormModal sysSettings={sysSettings} date={selectedDate} courtId={selectedCourt} startTime={bookingModalInfo.time} onClose={() => setBookingModalInfo(null)} onSave={onSave} reservations={reservations} />}
    </div>
  );
};

const BookingFormModal = ({ sysSettings, date, courtId, startTime, onClose, onSave, reservations }) => {
  const DURATIONS = sysSettings.durations;
  const [duration, setDuration] = useState(DURATIONS[0]?.value || 60);
  const [sport, setSport] = useState(SPORTS[0]);
  const [payment, setPayment] = useState(PAYMENTS[0]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  
  const isDurationValid = useMemo(() => checkAvailability(date, courtId, startTime, duration, reservations), [date, courtId, startTime, duration, reservations]);
  const durationObj = DURATIONS.find(d => d.value === duration);
  const price = durationObj ? durationObj.price : 0;
  
  const handleSubmit = async (e) => { 
    e.preventDefault(); 
    if(!name||!phone||!isDurationValid) return; 
    const ok = await onSave({date, courtId, startTime, duration, sport, payment, customerName: name, customerPhone: phone, price, status: 'reserved'}); 
    if(ok) onClose(); 
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-zinc-900 w-full max-w-md rounded-3xl p-6 border border-zinc-800 max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold">Dados da Reserva</h3><button onClick={onClose} className="p-2 bg-zinc-800 rounded-full text-zinc-500 hover:text-white transition-colors"><X size={20}/></button></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Esporte</label><select value={sport} onChange={e=>setSport(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F58021] transition-all">{SPORTS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Pagamento</label><select value={payment} onChange={e=>setPayment(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F58021] transition-all">{PAYMENTS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
          </div>
          <div><label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block">Tempo de Quadra</label><div className="grid grid-cols-2 md:grid-cols-3 gap-2">{DURATIONS.map(d => <button key={d.value} type="button" onClick={() => setDuration(d.value)} className={`py-2 px-1 rounded-lg text-xs border font-bold transition-all ${duration===d.value?'bg-[#5A2C81] border-[#5A2C81] text-white shadow-md':'bg-zinc-800 border-zinc-700 text-zinc-400 hover:border-zinc-500'}`}>{d.label}</button>)}</div></div>
          <input required type="text" placeholder="Seu Nome" value={name} onChange={e => setName(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F58021] transition-all"/>
          <input required type="tel" placeholder="Seu WhatsApp" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F58021] transition-all"/>
          <div className="flex justify-between items-center pt-4 border-t border-zinc-800"><p className="text-2xl font-black text-[#F58021]">{formatCurrency(price)}</p><button type="submit" disabled={!isDurationValid} className="bg-[#F58021] text-white font-bold py-3 px-8 rounded-xl disabled:opacity-50 hover:bg-[#e0751e] transition-all shadow-lg shadow-[#F58021]/20">CONFIRMAR</button></div>
        </form>
      </div>
    </div>
  );
};

// --- ADMIN COMPONENTS ---

const AdminDashboard = ({ sysSettings, reservations, enrollments, notifications, onDeleteRes, onUpdateRes, onDeleteEnr, onBlock, onSaveEnr, onSaveSettings, onMarkNotificationRead, setView }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showEnrModal, setShowEnrModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showNotifPanel, setShowNotifPanel] = useState(false);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-zinc-950">
      <aside className="w-full md:w-64 bg-zinc-900 border-r border-zinc-800 p-4 sticky top-0 z-20 flex md:flex-col justify-between items-start print:hidden">
        <div className="w-full flex justify-between items-center md:mb-8">
          <h1 className="font-black text-white text-xl uppercase italic tracking-tighter">Arena <span className="text-[#F58021]">ADM</span></h1>
          <div className="flex gap-4 items-center">
            <div className="relative">
                <button onClick={() => setShowNotifPanel(!showNotifPanel)} className="text-zinc-500 hover:text-white transition-colors relative" title="Notificações">
                    <Bell size={20} />
                    {unreadCount > 0 && <span className="absolute -top-1 -right-1 bg-red-500 w-3 h-3 rounded-full border-2 border-zinc-900"></span>}
                </button>
            </div>
            <button onClick={() => setShowSettingsModal(true)} className="text-zinc-500 hover:text-white transition-colors" title="Configurações"><Settings size={20} /></button>
            <button onClick={() => setView('login')} className="text-zinc-500 hover:text-white transition-colors" title="Sair"><ArrowLeft size={20} /></button>
          </div>
        </div>
        <nav className="hidden md:flex flex-col gap-2 w-full">
            <SidebarBtn icon={<BarChart3 size={20}/>} label="Resumo Financeiro" active={activeTab==='dashboard'} onClick={()=>setActiveTab('dashboard')} />
            <SidebarBtn icon={<CalendarDays size={20}/>} label="Agenda" active={activeTab==='agenda'} onClick={()=>setActiveTab('agenda')} />
            <SidebarBtn icon={<GraduationCap size={20}/>} label="Alunos/Matrículas" active={activeTab==='alunos'} onClick={()=>setActiveTab('alunos')} />
            <SidebarBtn icon={<FileText size={20}/>} label="Fechamento Mensal" active={activeTab==='fechamento'} onClick={()=>setActiveTab('fechamento')} />
        </nav>
      </aside>
      
      {/* Mobile Tabs */}
      <div className="md:hidden flex gap-2 p-2 bg-zinc-900 border-b border-zinc-800 overflow-x-auto sticky top-0 z-10 scrollbar-hide print:hidden">
          <MobileTab label="RESUMO" active={activeTab==='dashboard'} onClick={()=>setActiveTab('dashboard')} />
          <MobileTab label="AGENDA" active={activeTab==='agenda'} onClick={()=>setActiveTab('agenda')} />
          <MobileTab label="ALUNOS" active={activeTab==='alunos'} onClick={()=>setActiveTab('alunos')} />
          <MobileTab label="MENSAL" active={activeTab==='fechamento'} onClick={()=>setActiveTab('fechamento')} />
      </div>

      <main className="flex-1 p-4 md:p-8 min-w-0">
        {activeTab === 'dashboard' && <AdminFinance sysSettings={sysSettings} reservations={reservations} enrollments={enrollments} />}
        {activeTab === 'agenda' && <AdminAgenda sysSettings={sysSettings} reservations={reservations} onDelete={onDeleteRes} onUpdateRes={onUpdateRes} onBlock={onBlock} />}
        {activeTab === 'alunos' && <AdminEnrollments enrollments={enrollments} onDelete={onDeleteEnr} onAdd={()=>setShowEnrModal(true)} />}
        {activeTab === 'fechamento' && <AdminMonthlyClosure sysSettings={sysSettings} reservations={reservations} enrollments={enrollments} />}
      </main>

      {/* Modals */}
      {showEnrModal && <AdminEnrModal onSave={onSaveEnr} onClose={() => setShowEnrModal(false)} />}
      {showSettingsModal && <AdminSettingsModal sysSettings={sysSettings} onSave={onSaveSettings} onClose={() => setShowSettingsModal(false)} />}
      {showNotifPanel && <NotificationsPanel notifications={notifications} onMarkRead={onMarkNotificationRead} onClose={()=>setShowNotifPanel(false)} />}
    </div>
  );
};

const SidebarBtn = ({ icon, label, active, onClick }) => (
    <button onClick={onClick} className={`flex gap-3 px-4 py-3 rounded-xl transition-all w-full items-center ${active?'bg-[#F58021] text-white font-bold shadow-lg shadow-[#F58021]/20':'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`}>
        {icon} <span className="truncate">{label}</span>
    </button>
);

const MobileTab = ({ label, active, onClick }) => (
    <button onClick={onClick} className={`px-4 py-2 rounded-lg text-[10px] font-bold flex-shrink-0 transition-colors ${active?'bg-[#F58021] text-white':'bg-zinc-800 text-zinc-500'}`}>{label}</button>
);

// --- NOTIFICATIONS PANEL ---
const NotificationsPanel = ({ notifications, onMarkRead, onClose }) => {
    return (
        <div className="fixed inset-y-0 right-0 w-full md:w-96 bg-zinc-900 shadow-2xl z-50 flex flex-col border-l border-zinc-800 transform transition-transform duration-300">
            <div className="p-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
                <h3 className="font-bold text-white flex items-center gap-2"><Bell className="text-[#F58021]" size={18}/> Notificações</h3>
                <button onClick={onClose} className="p-2 text-zinc-400 hover:text-white"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {notifications.length === 0 ? <p className="text-center text-zinc-500 text-sm mt-10 italic">Nenhuma notificação</p> : notifications.map(notif => (
                    <div key={notif.id} className={`p-4 rounded-xl border relative ${notif.read ? 'bg-zinc-950 border-zinc-800 opacity-70' : 'bg-zinc-800 border-[#5A2C81]/50 shadow-md'}`}>
                        <div className="flex justify-between items-start mb-1">
                            <span className="text-[10px] font-black uppercase text-[#F58021]">{notif.type}</span>
                            <span className="text-[9px] text-zinc-500">{new Date(notif.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                        </div>
                        <h4 className="font-bold text-sm text-white mb-1">{notif.title}</h4>
                        <p className="text-xs text-zinc-300 leading-relaxed">{notif.message}</p>
                        {!notif.read && (
                            <button onClick={()=>onMarkRead(notif.id)} className="mt-3 text-[10px] font-bold text-[#5A2C81] hover:text-white flex items-center gap-1 transition-colors"><Check size={12}/> Marcar como lida</button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- SETTINGS MODAL ---
const AdminSettingsModal = ({ sysSettings, onSave, onClose }) => {
    const [tab, setTab] = useState('geral');
    const [pwd, setPwd] = useState('');
    const [courts, setCourts] = useState([...sysSettings.courts]);
    const [durations, setDurations] = useState([...sysSettings.durations]);

    const handleSaveGeneral = async (e) => {
        e.preventDefault();
        const ok = await onSave('general', { courts, durations });
        if(ok) onClose();
    };

    const handleSavePwd = async (e) => {
        e.preventDefault();
        if(pwd.length < 6) return alert('Mínimo 6 caracteres');
        const ok = await onSave('password', pwd);
        if(ok) onClose();
    };

    const updateCourtName = (index, val) => {
        const newCourts = [...courts];
        newCourts[index].name = val;
        setCourts(newCourts);
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="bg-zinc-900 w-full max-w-lg rounded-3xl p-6 border border-zinc-800 max-h-[90vh] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold flex items-center gap-2"><Settings className="text-[#F58021]"/> Configurações</h3>
                    <button onClick={onClose} className="p-2 text-zinc-500 hover:text-white bg-zinc-800 rounded-full"><X size={20}/></button>
                </div>
                
                <div className="flex gap-2 mb-6 border-b border-zinc-800 pb-2 overflow-x-auto">
                    <button onClick={()=>setTab('geral')} className={`px-4 py-2 text-sm font-bold rounded-lg ${tab==='geral'?'bg-[#F58021] text-white':'text-zinc-500'}`}>Quadras & Tempo</button>
                    <button onClick={()=>setTab('seguranca')} className={`px-4 py-2 text-sm font-bold rounded-lg ${tab==='seguranca'?'bg-[#5A2C81] text-white':'text-zinc-500'}`}>Segurança (Senha)</button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2">
                    {tab === 'geral' && (
                        <form onSubmit={handleSaveGeneral} className="space-y-6">
                            <div>
                                <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-3">Nomes das Quadras</h4>
                                <div className="space-y-3">
                                    {courts.map((c, i) => (
                                        <div key={c.id} className="flex flex-col">
                                            <label className="text-[10px] text-zinc-400 mb-1">ID: {c.id}</label>
                                            <input type="text" value={c.name} onChange={(e)=>updateCourtName(i, e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm outline-none focus:border-[#F58021]" required />
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div>
                                <h4 className="text-xs font-black text-zinc-500 uppercase tracking-widest mb-3">Tempos Habilitados</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    {DEFAULT_DURATIONS.map(d => {
                                        const isActive = durations.find(dur => dur.value === d.value);
                                        return (
                                            <button key={d.value} type="button" onClick={() => {
                                                if(isActive) setDurations(durations.filter(dur => dur.value !== d.value));
                                                else setDurations([...durations, d].sort((a,b)=>a.value-b.value));
                                            }} className={`py-2 px-3 border rounded-xl text-xs font-bold text-left flex justify-between items-center transition-all ${isActive ? 'bg-[#5A2C81] border-[#5A2C81] text-white' : 'bg-zinc-950 border-zinc-800 text-zinc-500'}`}>
                                                {d.label} {isActive && <CheckCircle size={14}/>}
                                            </button>
                                        )
                                    })}
                                </div>
                            </div>
                            <button type="submit" className="w-full bg-[#F58021] text-white font-bold py-3 rounded-xl shadow-lg">SALVAR CONFIGURAÇÕES</button>
                        </form>
                    )}

                    {tab === 'seguranca' && (
                        <form onSubmit={handleSavePwd} className="space-y-4">
                            <div>
                                <label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block">Nova Senha de Acesso</label>
                                <input required type="text" value={pwd} onChange={e => setPwd(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#F58021]" placeholder="Digite a nova senha..." />
                            </div>
                            <button type="submit" className="w-full bg-[#F58021] text-white font-bold py-3 rounded-xl shadow-lg">ATUALIZAR SENHA</button>
                        </form>
                    )}
                </div>
            </div>
        </div>
    )
}

// --- ADMIN FINANCE (RESUMO) ---
const AdminFinance = ({ sysSettings, reservations, enrollments }) => {
  const COURTS = sysSettings.courts;
  const [period, setPeriod] = useState('diario');
  const [refDate, setRefDate] = useState(getDayString(new Date()));

  const stats = useMemo(() => {
    let filteredRes = [];
    const targetD = new Date(refDate + 'T00:00:00');

    if (period === 'diario') {
        filteredRes = reservations.filter(r => r.date === refDate && r.status !== 'blocked');
    } else if (period === 'semanal') {
        const start = new Date(targetD); start.setDate(start.getDate() - targetD.getDay());
        const end = new Date(start); end.setDate(end.getDate() + 6);
        filteredRes = reservations.filter(r => {
            const d = new Date(r.date + 'T00:00:00');
            return d >= start && d <= end && r.status !== 'blocked';
        });
    } else if (period === 'mensal') {
        const yMonth = refDate.substring(0, 7);
        filteredRes = reservations.filter(r => r.date.startsWith(yMonth) && r.status !== 'blocked');
    }

    let resTotal = 0, courtMap = {};
    filteredRes.forEach(r => {
        resTotal += (r.price || 0);
        courtMap[r.courtId] = (courtMap[r.courtId] || 0) + (r.price || 0);
    });

    const qty = filteredRes.length;
    const ticketMedio = qty > 0 ? resTotal / qty : 0;
    
    // Enrollments apply globally to revenue
    let enrTotal = 0;
    enrollments.forEach(e => enrTotal += (e.price || 0));

    return { resTotal, enrTotal, total: resTotal + enrTotal, qty, ticketMedio, courtMap };
  }, [reservations, enrollments, period, refDate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
          <div>
              <h2 className="text-xl font-bold flex items-center gap-2"><BarChart3 className="text-[#F58021]"/> Resumo Financeiro Dinâmico</h2>
              <p className="text-xs text-zinc-400">Analise os resultados conforme o período selecionado.</p>
          </div>
          <div className="flex items-center gap-3 bg-zinc-950 p-1.5 rounded-xl border border-zinc-800">
              <select value={period} onChange={e=>setPeriod(e.target.value)} className="bg-transparent text-sm font-bold text-white outline-none pl-2">
                  <option value="diario">Diário</option>
                  <option value="semanal">Semanal</option>
                  <option value="mensal">Mensal</option>
              </select>
              <input type="date" value={refDate} onChange={e=>setRefDate(e.target.value)} className="bg-zinc-800 text-white text-xs px-3 py-2 rounded-lg outline-none border border-zinc-700"/>
          </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Receita Quadras" value={stats.resTotal} highlight="white" />
        <StatCard title="Mensalidades Alunos" value={stats.enrTotal} highlight="white" />
        <StatCard title="Receita Bruta (Quadra+Aluno)" value={stats.total} highlight="#F58021" border="#F58021" />
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col justify-center relative overflow-hidden group">
            <TrendingUp size={40} className="absolute -bottom-2 -right-2 text-zinc-800 group-hover:text-[#5A2C81]/40 transition-colors" />
            <p className="text-[10px] font-bold text-zinc-500 uppercase mb-2 relative z-10">Ticket Médio (Quadra)</p>
            <p className="text-3xl font-black text-white relative z-10">{formatCurrency(stats.ticketMedio)}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-4">
        <div className="lg:col-span-2 bg-zinc-900 border border-zinc-800 p-6 rounded-2xl shadow-sm hover:shadow-md transition-shadow">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold flex gap-2 items-center"><Activity className="text-[#F58021]"/> Receita por Quadra no Período</h3>
                <span className="text-xs font-bold text-zinc-500 bg-zinc-950 px-3 py-1 rounded-full">{stats.qty} reservas</span>
            </div>
            <div className="space-y-5">
                {COURTS.map(court => { 
                    const amt = stats.courtMap[court.id] || 0;
                    const pct = stats.resTotal ? Math.round((amt/stats.resTotal)*100) : 0; 
                    return (
                        <div key={court.id}>
                            <div className="flex justify-between text-xs mb-2">
                                <span className="text-zinc-300 font-bold">{court.name}</span>
                                <div className="flex items-center gap-2">
                                    <span className="text-zinc-500">{pct}%</span>
                                    <span className="font-bold text-[#F58021]">{formatCurrency(amt)}</span>
                                </div>
                            </div>
                            <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden border border-zinc-800">
                                <div className="bg-gradient-to-r from-[#F58021] to-[#5A2C81] h-full rounded-full transition-all duration-1000 ease-out" style={{width:`${pct}%`}}></div>
                            </div>
                        </div>
                    ) 
                })}
            </div>
        </div>
        
        <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col justify-center items-center text-center shadow-sm">
            <Users size={56} className="text-[#5A2C81] mb-4" />
            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Total de Alunos Ativos</p>
            <h3 className="text-5xl font-black text-white">{enrollments.length}</h3>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, highlight, border }) => (
    <div className={`bg-zinc-900 border p-6 rounded-2xl shadow-sm flex flex-col justify-center transition-all hover:-translate-y-1 ${border ? `border-[${border}] bg-[#5A2C81]/10` : 'border-zinc-800'}`}>
        <p className={`text-[10px] font-bold uppercase mb-2 tracking-widest ${border ? `text-[${border}]` : 'text-zinc-500'}`}>{title}</p>
        <p className="text-3xl font-black truncate" style={{color: highlight}}>{formatCurrency(value)}</p>
    </div>
);


// --- ADMIN MONTHLY CLOSURE (FECHAMENTO) ---
const AdminMonthlyClosure = ({ sysSettings, reservations, enrollments }) => {
    const COURTS = sysSettings.courts;
    const today = new Date();
    const [monthStr, setMonthStr] = useState(`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}`);

    const closureData = useMemo(() => {
        const currRes = reservations.filter(r => r.date.startsWith(monthStr) && r.status !== 'blocked');
        
        const [y, m] = monthStr.split('-');
        let prevM = parseInt(m) - 1, prevY = parseInt(y);
        if (prevM === 0) { prevM = 12; prevY -= 1; }
        const prevMonthStr = `${prevY}-${String(prevM).padStart(2,'0')}`;
        const prevRes = reservations.filter(r => r.date.startsWith(prevMonthStr) && r.status !== 'blocked');

        const calculateStats = (resList) => {
            let total = 0, countMap = {}, timeMap = {};
            resList.forEach(r => {
                total += (r.price || 0);
                countMap[r.courtId] = (countMap[r.courtId] || 0) + 1;
                timeMap[r.startTime] = (timeMap[r.startTime] || 0) + 1;
            });
            
            let bestC = '-', bestCCount = 0;
            for(let c in countMap) { if(countMap[c] > bestCCount) { bestCCount = countMap[c]; bestC = c; } }
            
            let bestT = '-', bestTCount = 0;
            for(let t in timeMap) { if(timeMap[t] > bestTCount) { bestTCount = timeMap[t]; bestT = t; } }

            return { total, resCount: resList.length, bestC, bestT };
        };

        const curr = calculateStats(currRes);
        const prev = calculateStats(prevRes);
        
        // Add enrollments to global revenue logic
        const enrRev = enrollments.reduce((acc, e) => acc + (e.price || 0), 0);
        curr.total += enrRev; prev.total += enrRev; // Assuming same enrollments for comparison simplicity

        const daysInMonth = new Date(y, m, 0).getDate();
        const avgDaily = curr.total / daysInMonth;
        
        const bestCourtName = COURTS.find(c => c.id === curr.bestC)?.name || 'N/A';
        const growth = prev.total === 0 ? 100 : ((curr.total - prev.total) / prev.total) * 100;

        return { ...curr, prevTotal: prev.total, bestCourtName, avgDaily, growth };
    }, [reservations, enrollments, monthStr, COURTS]);

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-zinc-900 p-4 rounded-2xl border border-zinc-800 print:hidden">
                <h2 className="text-xl font-bold flex items-center gap-2"><FileText className="text-[#F58021]"/> Fechamento Mensal</h2>
                <div className="flex gap-3">
                    <input type="month" value={monthStr} onChange={e=>setMonthStr(e.target.value)} className="bg-zinc-950 text-white text-sm px-4 py-2 rounded-xl border border-zinc-800 outline-none focus:border-[#F58021]"/>
                    <button onClick={handlePrint} className="bg-[#5A2C81] text-white px-4 py-2 rounded-xl font-bold flex items-center gap-2 hover:bg-[#4a246a] transition-colors"><Printer size={16}/> Exportar PDF</button>
                </div>
            </div>

            {/* Print Area */}
            <div className="print:block print:bg-white print:text-black space-y-6 p-4 print:p-0">
                <div className="hidden print:flex flex-col items-center border-b pb-4 mb-6">
                    <h1 className="text-2xl font-black uppercase">Arena JD - Relatório de Fechamento</h1>
                    <p className="font-bold text-gray-500">Mês de Referência: {monthStr}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-zinc-900 print:bg-gray-100 border border-zinc-800 print:border-gray-300 p-6 rounded-2xl text-center">
                        <p className="text-[10px] font-bold text-zinc-500 print:text-gray-600 uppercase mb-2">Faturamento Bruto</p>
                        <p className="text-4xl font-black text-[#F58021] print:text-black">{formatCurrency(closureData.total)}</p>
                        <div className={`mt-2 text-xs font-bold ${closureData.growth >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                            {closureData.growth > 0 ? '+' : ''}{closureData.growth.toFixed(1)}% vs. Mês Anterior
                        </div>
                    </div>
                    <div className="bg-zinc-900 print:bg-gray-100 border border-zinc-800 print:border-gray-300 p-6 rounded-2xl text-center">
                        <p className="text-[10px] font-bold text-zinc-500 print:text-gray-600 uppercase mb-2">Total de Reservas</p>
                        <p className="text-4xl font-black text-white print:text-black">{closureData.resCount}</p>
                        <p className="mt-2 text-xs text-zinc-500 print:text-gray-600">Quadras alugadas no mês</p>
                    </div>
                    <div className="bg-zinc-900 print:bg-gray-100 border border-zinc-800 print:border-gray-300 p-6 rounded-2xl text-center">
                        <p className="text-[10px] font-bold text-zinc-500 print:text-gray-600 uppercase mb-2">Média Diária Bruta</p>
                        <p className="text-3xl font-black text-white print:text-black">{formatCurrency(closureData.avgDaily)}</p>
                        <p className="mt-2 text-xs text-zinc-500 print:text-gray-600">Considerando dias do mês</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-zinc-900 print:bg-white border border-zinc-800 print:border-gray-300 p-6 rounded-2xl flex items-center gap-4">
                        <div className="bg-[#5A2C81]/20 print:bg-gray-200 p-4 rounded-full"><MapPin className="text-[#5A2C81] print:text-black" size={32}/></div>
                        <div>
                            <p className="text-[10px] font-bold text-zinc-500 print:text-gray-600 uppercase">Quadra Mais Utilizada</p>
                            <p className="text-lg font-black text-white print:text-black">{closureData.bestCourtName}</p>
                        </div>
                    </div>
                    <div className="bg-zinc-900 print:bg-white border border-zinc-800 print:border-gray-300 p-6 rounded-2xl flex items-center gap-4">
                        <div className="bg-[#F58021]/20 print:bg-gray-200 p-4 rounded-full"><Clock className="text-[#F58021] print:text-black" size={32}/></div>
                        <div>
                            <p className="text-[10px] font-bold text-zinc-500 print:text-gray-600 uppercase">Horário de Pico</p>
                            <p className="text-lg font-black text-white print:text-black">{closureData.bestT}</p>
                        </div>
                    </div>
                </div>
                
                {/* Simulated Chart Area for Visuals */}
                <div className="bg-zinc-900 print:bg-white border border-zinc-800 print:border-gray-300 p-6 rounded-2xl">
                    <h3 className="font-bold text-white print:text-black mb-4">Comparativo: Este Mês vs Mês Anterior</h3>
                    <div className="space-y-6 mt-6">
                        <div>
                            <div className="flex justify-between text-xs mb-1 font-bold"><span className="text-zinc-400 print:text-gray-600">Mês Atual</span><span className="text-[#F58021] print:text-black">{formatCurrency(closureData.total)}</span></div>
                            <div className="w-full bg-zinc-950 print:bg-gray-200 rounded-full h-4 overflow-hidden"><div className="bg-[#F58021] print:bg-gray-600 h-full" style={{width: '100%'}}></div></div>
                        </div>
                        <div>
                            <div className="flex justify-between text-xs mb-1 font-bold"><span className="text-zinc-400 print:text-gray-600">Mês Anterior</span><span className="text-zinc-300 print:text-black">{formatCurrency(closureData.prevTotal)}</span></div>
                            <div className="w-full bg-zinc-950 print:bg-gray-200 rounded-full h-4 overflow-hidden"><div className="bg-zinc-600 print:bg-gray-400 h-full" style={{width: closureData.total ? `${Math.min((closureData.prevTotal/closureData.total)*100, 100)}%` : '0%'}}></div></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};


// --- ADMIN AGENDA ---
const AdminAgenda = ({ sysSettings, reservations, onDelete, onUpdateRes, onBlock }) => {
  const COURTS = sysSettings.courts;
  const TIME_SLOTS_FULL = sysSettings.durations; // For block selection
  const [filterDate, setFilterDate] = useState(getDayString(new Date()));
  const [isBlocking, setIsBlocking] = useState(false);
  const daily = reservations.filter(r => r.date === filterDate).sort((a,b) => a.startTime.localeCompare(b.startTime));
  
  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
          <h2 className="text-xl font-bold flex items-center gap-2"><CalendarDays className="text-[#F58021]"/> Agenda Operacional</h2>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="w-full sm:w-auto bg-zinc-950 text-white border border-zinc-800 px-4 py-2 rounded-xl focus:border-[#F58021] text-sm outline-none transition-all" />
            <button onClick={() => setIsBlocking(true)} className="bg-red-500/10 text-red-500 px-4 py-2 rounded-xl flex items-center justify-center gap-2 border border-red-500/20 text-xs font-bold uppercase hover:bg-red-500 hover:text-white transition-all"><Lock size={16}/>Bloquear</button>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {COURTS.map(court => {
          const courtRes = daily.filter(r => r.courtId === court.id);
          return (
            <div key={court.id} className="bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800 flex flex-col shadow-sm">
              <div className="bg-zinc-950 p-3 text-center text-xs font-black uppercase border-b border-zinc-800 text-[#F58021] tracking-tighter shadow-inner truncate">{court.name}</div>
              <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[60vh] custom-scrollbar">
                  {courtRes.length === 0 ? <p className="text-zinc-700 text-xs text-center py-10 font-bold uppercase italic tracking-widest">Livre</p> : courtRes.map(res => (
                <div key={res.id} className={`p-3 rounded-xl border text-sm relative group transition-all hover:border-[#5A2C81] ${res.status==='blocked'?'bg-zinc-950 border-red-900/30':'bg-zinc-950 border-zinc-800'}`}>
                  <div className="flex justify-between items-center mb-1">
                      <span className={`font-bold text-base ${res.status==='blocked'?'text-red-400':'text-[#F58021]'}`}>{res.startTime} <span className="text-[10px] text-zinc-500 font-medium">({res.duration}m)</span></span>
                      {res.status!=='blocked' && <span className="text-[9px] font-black bg-zinc-800 px-2 py-0.5 rounded text-zinc-300">{res.payment}</span>}
                  </div>
                  {res.status !== 'blocked' && <p className="text-[9px] text-[#5A2C81] uppercase font-black mb-1 bg-[#5A2C81]/10 inline-block px-1 rounded">{res.sport}</p>}
                  <p className="font-bold text-zinc-200 truncate pr-16">{res.customerName}</p>
                  
                  <div className="absolute bottom-3 right-2 flex flex-col gap-1.5 opacity-100 lg:opacity-0 group-hover:opacity-100 transition-opacity">
                    {res.status !== 'blocked' && res.customerPhone && res.customerPhone !== '-' && (
                      <button onClick={() => { 
                        const cleanPhone = res.customerPhone.replace(/\D/g, '');
                        window.open(`https://wa.me/${cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`}`, '_blank');
                      }} className="p-2 bg-green-500/20 text-green-500 rounded-lg hover:bg-green-500 hover:text-white transition-colors" title="WhatsApp"><MessageCircle size={14}/></button>
                    )}
                    <button onClick={() => { if(window.confirm('Excluir agendamento?')) onDelete(res.id, res) }} className="p-2 bg-red-500/20 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-colors" title="Excluir"><Trash2 size={14}/></button>
                  </div>
                </div>
              ))}</div>
            </div>
          )
        })}
      </div>
      
      {/* Block Modal */}
      {isBlocking && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 w-full max-w-sm rounded-3xl p-6 border border-red-900/50 shadow-2xl">
            <h3 className="text-xl font-bold mb-4 text-red-500 flex items-center gap-2 uppercase tracking-tighter"><Lock size={20}/> Bloqueio Administrativo</h3>
            <div className="space-y-4">
              <div><label className="text-[10px] text-zinc-500 uppercase font-bold mb-1 block">Quadra</label><select id="blCourt" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-red-500">{COURTS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
              <div className="grid grid-cols-2 gap-3">
                  <div><label className="text-[10px] text-zinc-500 uppercase font-bold mb-1 block">Início</label><select id="blTime" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-red-500">{TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                  <div><label className="text-[10px] text-zinc-500 uppercase font-bold mb-1 block">Duração</label><select id="blDur" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-red-500">{TIME_SLOTS_FULL.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}</select></div>
              </div>
              <div className="flex gap-2 pt-4">
                  <button onClick={()=>setIsBlocking(false)} className="flex-1 py-3 border border-zinc-800 rounded-xl font-bold text-zinc-400 hover:bg-zinc-800 transition-colors">VOLTAR</button>
                  <button onClick={()=>{
                    const c = document.getElementById('blCourt').value; const t = document.getElementById('blTime').value; const d = Number(document.getElementById('blDur').value);
                    onBlock({ date: filterDate, courtId: c, startTime: t, duration: d, status: 'blocked', customerName: 'BLOQUEIO ADM', customerPhone: '-', price: 0, sport: '-', payment: '-' }); setIsBlocking(false);
                  }} className="flex-1 bg-red-500 py-3 rounded-xl font-bold text-white shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all">CONFIRMAR</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


// --- ADMIN ENROLLMENTS (ALUNOS) ---
const AdminEnrollments = ({ enrollments, onDelete, onAdd }) => (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
          <div>
              <h2 className="text-xl font-bold flex items-center gap-2"><GraduationCap className="text-[#F58021]"/> Gestão de Alunos</h2>
              <p className="text-xs text-zinc-400">Gerencie planos e matrículas ativas.</p>
          </div>
          <button onClick={onAdd} className="bg-[#F58021] text-white p-3 rounded-full hover:scale-110 transition-all shadow-lg shadow-[#F58021]/30"><Plus size={24}/></button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {enrollments.map(e => (
            <div key={e.id} className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl relative group hover:border-[#5A2C81] transition-all">
              <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-white text-sm truncate">{e.name}</p>
                    <p className="text-xs text-zinc-500">{e.phone}</p>
                  </div>
                  <div className="bg-[#5A2C81]/20 p-2 rounded-lg text-[#5A2C81]"><CreditCard size={18}/></div>
              </div>
              <div className="bg-zinc-950 p-3 rounded-xl mb-3">
                  <span className="text-[10px] font-black text-zinc-500 uppercase block mb-1">Plano</span>
                  <span className="text-xs font-bold text-zinc-300">{e.plan}</span>
              </div>
              <div className="flex justify-between items-center border-t border-zinc-800 pt-3">
                  <span className="text-lg font-black text-[#F58021]">{formatCurrency(e.price)}</span>
                  <button onClick={() => { if(window.confirm('Remover matrícula permanentemente?')) onDelete(e.id) }} className="p-2 bg-red-500/10 text-red-500 rounded-lg opacity-100 lg:opacity-0 group-hover:opacity-100 hover:bg-red-500 hover:text-white transition-all"><Trash2 size={16}/></button>
              </div>
            </div>
      ))}</div>
    </div>
);

const AdminEnrModal = ({ onSave, onClose }) => {
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [planIdx, setPlanIdx] = useState(0); const [payment, setPayment] = useState(PAYMENTS[0]);
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-zinc-900 w-full max-w-sm rounded-3xl p-6 border border-zinc-800 shadow-2xl">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><GraduationCap className="text-[#F58021]"/> Nova Matrícula</h3>
        <form onSubmit={async (e) => { e.preventDefault(); const ok = await onSave({ name, phone, plan: PLANS[planIdx].name, price: PLANS[planIdx].price, payment }); if(ok) onClose(); }} className="space-y-4">
          <input required type="text" placeholder="Nome completo" value={name} onChange={e => setName(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F58021] transition-colors"/>
          <input required type="tel" placeholder="WhatsApp" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F58021] transition-colors"/>
          <div><label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block">Selecione o Plano</label><div className="grid grid-cols-1 gap-2">{PLANS.map((p, i) => <button key={i} type="button" onClick={() => setPlanIdx(i)} className={`p-3 rounded-xl border text-left flex justify-between items-center transition-all ${planIdx===i?'bg-[#5A2C81]/20 border-[#5A2C81] text-white':'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700'}`}><span className="text-xs font-bold">{p.name}</span><span className="text-xs font-black text-[#F58021]">{formatCurrency(p.price)}</span></button>)}</div></div>
          <div><label className="text-[10px] font-bold text-zinc-500 mb-2 block uppercase tracking-widest">Forma de Pagamento</label><select value={payment} onChange={e=>setPayment(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F58021] transition-colors">{PAYMENTS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
          <div className="flex gap-2 pt-4"><button type="button" onClick={onClose} className="flex-1 py-3 border border-zinc-800 rounded-xl text-zinc-400 font-bold hover:bg-zinc-800 transition-colors">Cancelar</button><button type="submit" className="flex-1 bg-[#F58021] text-white py-3 rounded-xl font-bold shadow-lg shadow-[#F58021]/20 hover:bg-[#e0751e] transition-colors">Salvar Aluno</button></div>
        </form>
      </div>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) createRoot(rootElement).render(<App />);
