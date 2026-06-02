import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { Calendar, Clock, MapPin, X, Activity, CalendarDays, CheckCircle, Lock, Trash2, ArrowLeft, AlertCircle, RefreshCw, DollarSign, TrendingUp, BarChart3, Users, GraduationCap, Plus, CreditCard, Info, MessageCircle, KeyRound } from 'lucide-react';

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

const COURTS = [
  { id: 'jd', name: 'JD' },
  { id: 'barbearia', name: 'Barbearia Lins (Areia de Praia)' },
  { id: 'campelo', name: 'Campelo Gomes' },
  { id: 'edite', name: 'Edite Imports (Areia de Praia)' }
];

const DURATIONS = [
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
  const dayRes = allReservations.filter(r => r.date === date && r.courtId === courtId && r.id !== ignoreResId);
  for (const res of dayRes) {
    const resStartMins = parseInt(res.startTime.split(':')[0]) * 60 + parseInt(res.startTime.split(':')[1]);
    if (Math.max(startMins, resStartMins) < Math.min(endMins, resStartMins + res.duration)) return false;
  }
  return true;
};

const Toast = ({ message, type, onClose }) => {
  useEffect(() => { const timer = setTimeout(onClose, 3000); return () => clearTimeout(timer); }, [onClose]);
  return (
    <div className={`fixed bottom-4 right-4 ${type === 'error' ? 'bg-red-500' : 'bg-green-500'} text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50 animate-bounce`}>
      {type === 'error' ? <AlertCircle size={20} /> : <CheckCircle size={20} />}
      <span className="font-medium">{message}</span>
    </div>
  );
};

export default function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login');
  const [reservations, setReservations] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    onAuthStateChanged(auth, (u) => { if(u) setUser(u); else signInAnonymously(auth); });
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const unsubRes = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'reservations'), (s) => setReservations(s.docs.map(d => ({ id: d.id, ...d.data() }))));
    const unsubEnr = onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'enrollments'), (s) => { setEnrollments(s.docs.map(d => ({ id: d.id, ...d.data() }))); setLoading(false); });
    return () => { unsubRes(); unsubEnr(); };
  }, [user]);

  const showToast = (message, type = 'success') => setToast({ message, type });

  const handleCreate = async (coll, data) => {
    try { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', coll), { ...data, createdAt: new Date().toISOString() }); showToast("Confirmado!"); return true; } 
    catch { showToast("Erro ao salvar.", "error"); return false; }
  };

  const handleDelete = async (coll, id) => {
    try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', coll, id)); showToast("Removido."); } 
    catch { showToast("Erro ao remover.", "error"); }
  };

  const handleAdminLogin = async (pwd) => {
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'admin');
      const docSnap = await getDoc(docRef);
      const currentPwd = docSnap.exists() && docSnap.data().password ? docSnap.data().password : 'dheyminarena';
      
      if (pwd === currentPwd) {
        setView('admin_dashboard');
      } else {
        showToast('Senha incorreta!', 'error');
      }
    } catch (e) {
      showToast('Erro ao verificar a senha.', 'error');
    }
  };

  const handleUpdatePassword = async (newPwd) => {
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'settings', 'admin'), { password: newPwd }, { merge: true });
      showToast('Senha alterada com sucesso!');
      return true;
    } catch {
      showToast('Erro ao alterar senha.', 'error');
      return false;
    }
  };

  if (loading) return <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-[#F58021]"><RefreshCw className="animate-spin mb-4" size={48} /><h1 className="text-xl font-bold uppercase tracking-widest text-white">Arena JD</h1></div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {view === 'login' && <LoginScreen setView={setView} />}
      {view === 'how_to' && <HowToBookScreen setView={setView} />}
      {view === 'admin_login' && <AdminLoginScreen setView={setView} onLogin={handleAdminLogin} />}
      {view === 'customer' && <CustomerBookingScreen reservations={reservations} onSave={(d) => handleCreate('reservations', d)} setView={setView} />}
      {view === 'admin_dashboard' && <AdminDashboard reservations={reservations} enrollments={enrollments} onDeleteRes={(id) => handleDelete('reservations', id)} onDeleteEnr={(id) => handleDelete('enrollments', id)} onBlock={(d) => handleCreate('reservations', d)} onSaveEnr={(d) => handleCreate('enrollments', d)} onSavePassword={handleUpdatePassword} setView={setView} />}
    </div>
  );
}

const LoginScreen = ({ setView }) => (
  <div className="min-h-screen flex items-center justify-center p-4 bg-zinc-950">
    <div className="max-w-md w-full text-center">
      <img src="https://i.postimg.cc/j21g4jhM/Screenshot-20260508-202911-Instagram-2.jpg" alt="Arena JD" className="w-48 h-48 mx-auto mb-6 rounded-full object-cover shadow-[0_0_30px_rgba(90,44,129,0.4)] border-4 border-[#5A2C81]" />
      <h1 className="text-4xl font-black text-white uppercase mb-10 tracking-tighter">Arena <span className="text-[#F58021]">JD</span></h1>
      
      <button onClick={() => setView('customer')} className="w-full bg-[#F58021] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 mb-4 shadow-xl shadow-[#F58021]/20 active:scale-95 transition-all"><Calendar size={24} />AGENDAR HORÁRIO</button>
      
      <button onClick={() => setView('how_to')} className="w-full bg-zinc-800 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 mb-4 active:scale-95 transition-all"><Info size={24} className="text-[#F58021]" />COMO AGENDAR</button>

      <button onClick={() => setView('admin_login')} className="w-full bg-zinc-900 border border-[#5A2C81] text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 active:bg-zinc-800 transition-all"><Lock size={20} className="text-[#F58021]" />ACESSO RESTRITO</button>
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
        <button onClick={() => setView('login')} className="p-2 bg-zinc-900 rounded-full text-zinc-400"><ArrowLeft size={20}/></button>
        <h1 className="text-lg font-black uppercase tracking-tight text-white">Como <span className="text-[#F58021]">Agendar</span></h1>
      </header>
      <main className="max-w-md mx-auto p-4 space-y-3 mt-4">
        {steps.map((step, i) => (
          <div key={i} className="flex items-center gap-4 bg-zinc-900 p-4 rounded-2xl border border-zinc-800">
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
      <button onClick={() => setView('login')} className="absolute top-6 left-6 p-2 bg-zinc-900 rounded-full text-zinc-400"><ArrowLeft size={24} /></button>
      <div className="max-w-sm w-full bg-zinc-900 p-8 rounded-3xl border border-zinc-800">
        <Lock size={40} className="text-[#F58021] mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-center mb-8">Login ADM</h2>
        <form onSubmit={handleLogin} className="space-y-6">
          <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 text-white px-4 py-3 rounded-xl focus:border-[#F58021] outline-none" placeholder="Senha" autoFocus />
          <button type="submit" disabled={isLoading} className="w-full bg-[#5A2C81] text-white font-bold py-3 rounded-xl hover:bg-[#4a246a] disabled:opacity-50">
            {isLoading ? 'Verificando...' : 'Entrar'}
          </button>
        </form>
      </div>
    </div>
  );
};

const CustomerBookingScreen = ({ reservations, onSave, setView }) => {
  const [selectedDate, setSelectedDate] = useState(getDayString(new Date()));
  const [selectedCourt, setSelectedCourt] = useState(COURTS[0].id);
  const [bookingModalInfo, setBookingModalInfo] = useState(null);

  const days = Array.from({length: 60}, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() + i);
    return { full: getDayString(d), dayNum: d.getDate(), dayWeek: d.toLocaleDateString('pt-BR', {weekday: 'short'}).toUpperCase().replace('.', ''), month: d.toLocaleDateString('pt-BR', {month: 'long'}).toUpperCase() };
  });
  const currentMonth = days.find(d => d.full === selectedDate)?.month;

  return (
    <div className="pb-24">
      <header className="sticky top-0 bg-zinc-950/90 border-b border-zinc-900 z-30 px-4 py-4 flex items-center gap-3 backdrop-blur-md">
        <button onClick={() => setView('login')} className="p-2 bg-zinc-900 rounded-full text-zinc-400"><ArrowLeft size={20}/></button>
        <h1 className="text-lg font-black uppercase tracking-tight">Arena <span className="text-[#F58021]">JD</span></h1>
      </header>
      <main className="max-w-3xl mx-auto p-4 space-y-8 mt-4">
        <section>
          <div className="flex items-center justify-between mb-3"><h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2"><CalendarDays size={14}/> Selecione a Data</h2><span className="text-[10px] font-black text-[#F58021]">{currentMonth}</span></div>
          <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide snap-x">
            {days.map(day => <button key={day.full} onClick={() => setSelectedDate(day.full)} className={`snap-center flex-shrink-0 w-16 py-3 rounded-2xl border transition-all ${selectedDate===day.full?'bg-[#F58021] border-[#F58021] text-white shadow-lg shadow-[#F58021]/20':'bg-zinc-900 border-zinc-800 text-zinc-500'}`}><span className="text-[9px] font-bold block mb-1">{day.dayWeek}</span><span className="text-lg font-black">{day.dayNum}</span></button>)}
          </div>
        </section>
        <section className="space-y-3">
          <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2"><MapPin size={14}/> Selecione a Quadra</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {COURTS.map(court => <button key={court.id} onClick={() => setSelectedCourt(court.id)} className={`p-4 rounded-xl border text-left flex justify-between items-center transition-all ${selectedCourt===court.id?'bg-zinc-800 border-[#F58021] shadow-md':'bg-zinc-900 border-zinc-800'}`}><span className="font-bold text-sm">{court.name}</span>{selectedCourt===court.id && <CheckCircle size={18} className="text-[#F58021]"/>}</button>)}
          </div>
        </section>
        <section className="space-y-3">
          <h2 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2"><Clock size={14}/> Horários Disponíveis</h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {TIME_SLOTS.map(time => { const isAvail = checkAvailability(selectedDate, selectedCourt, time, 30, reservations); return <button key={time} disabled={!isAvail} onClick={() => setBookingModalInfo({time})} className={`py-3 rounded-xl border text-sm font-bold relative overflow-hidden transition-all ${isAvail?'bg-zinc-900 border-zinc-700 hover:border-[#5A2C81]':'bg-zinc-950 border-zinc-900 text-zinc-800 opacity-50'}`}>{time}{!isAvail && <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80"><Lock size={14}/></div>}</button> })}
          </div>
        </section>
      </main>
      {bookingModalInfo && <BookingFormModal date={selectedDate} courtId={selectedCourt} startTime={bookingModalInfo.time} onClose={() => setBookingModalInfo(null)} onSave={onSave} reservations={reservations} />}
    </div>
  );
};

const BookingFormModal = ({ date, courtId, startTime, onClose, onSave, reservations }) => {
  const [duration, setDuration] = useState(60);
  const [sport, setSport] = useState(SPORTS[0]);
  const [payment, setPayment] = useState(PAYMENTS[0]);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const isDurationValid = useMemo(() => checkAvailability(date, courtId, startTime, duration, reservations), [date, courtId, startTime, duration, reservations]);
  const price = DURATIONS.find(d => d.value === duration).price;
  
  const handleSubmit = async (e) => { 
    e.preventDefault(); 
    if(!name||!phone||!isDurationValid) return; 
    
    const ok = await onSave({date, courtId, startTime, duration, sport, payment, customerName: name, customerPhone: phone, price, status: 'reserved'}); 
    
    if(ok) {
      onClose(); 
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-zinc-900 w-full max-w-md rounded-3xl p-6 border border-zinc-800 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold">Dados da Reserva</h3><button onClick={onClose} className="p-2 bg-zinc-800 rounded-full text-zinc-500"><X size={20}/></button></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Esporte</label><select value={sport} onChange={e=>setSport(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F58021]">{SPORTS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block">Pagamento</label><select value={payment} onChange={e=>setPayment(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F58021]">{PAYMENTS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
          </div>
          <div><label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block">Tempo de Quadra</label><div className="grid grid-cols-2 gap-2">{DURATIONS.map(d => <button key={d.value} type="button" onClick={() => setDuration(d.value)} className={`py-2 rounded-lg text-xs border font-bold ${duration===d.value?'bg-[#5A2C81] border-[#5A2C81] text-white':'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>{d.label}</button>)}</div></div>
          <input required type="text" placeholder="Seu Nome" value={name} onChange={e => setName(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F58021]"/>
          <input required type="tel" placeholder="Seu WhatsApp" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F58021]"/>
          <div className="flex justify-between items-center pt-4 border-t border-zinc-800"><p className="text-2xl font-black text-[#F58021]">{formatCurrency(price)}</p><button type="submit" disabled={!isDurationValid} className="bg-[#F58021] text-white font-bold py-3 px-8 rounded-xl disabled:opacity-50">CONFIRMAR</button></div>
        </form>
      </div>
    </div>
  );
};

const AdminDashboard = ({ reservations, enrollments, onDeleteRes, onDeleteEnr, onBlock, onSaveEnr, onSavePassword, setView }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showEnrModal, setShowEnrModal] = useState(false);
  const [showPwdModal, setShowPwdModal] = useState(false);

  const stats = useMemo(() => {
    const today = getDayString(new Date());
    let resTotal = 0, enrTotal = 0, todayTotal = 0;
    reservations.filter(r => r.status !== 'blocked').forEach(r => { resTotal += (r.price || 0); if(r.date === today) todayTotal += (r.price || 0); });
    enrollments.forEach(e => { enrTotal += (e.price || 0); });
    return { resTotal, enrTotal, total: resTotal + enrTotal, todayTotal };
  }, [reservations, enrollments]);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-zinc-950">
      <aside className="w-full md:w-64 bg-zinc-900 border-r border-zinc-800 p-4 sticky top-0 z-20 flex md:flex-col justify-between items-start">
        <div className="w-full flex justify-between items-center md:mb-8">
          <h1 className="font-black text-white text-xl uppercase italic">Arena <span className="text-[#F58021]">ADM</span></h1>
          <div className="flex gap-4">
            <button onClick={() => setShowPwdModal(true)} className="text-zinc-500 hover:text-white" title="Alterar Senha"><KeyRound size={20} /></button>
            <button onClick={() => setView('login')} className="text-zinc-500 hover:text-white" title="Sair"><ArrowLeft size={20} /></button>
          </div>
        </div>
        <nav className="hidden md:flex flex-col gap-2 w-full"><button onClick={() => setActiveTab('dashboard')} className={`flex gap-3 px-4 py-3 rounded-xl transition-all ${activeTab==='dashboard'?'bg-[#F58021] text-white font-bold shadow-lg shadow-[#F58021]/20':'text-zinc-500 hover:bg-zinc-800'}`}><BarChart3 size={20}/> Resumo Financeiro</button><button onClick={() => setActiveTab('agenda')} className={`flex gap-3 px-4 py-3 rounded-xl transition-all ${activeTab==='agenda'?'bg-[#F58021] text-white font-bold shadow-lg shadow-[#F58021]/20':'text-zinc-500 hover:bg-zinc-800'}`}><CalendarDays size={20}/> Agenda</button><button onClick={() => setActiveTab('alunos')} className={`flex gap-3 px-4 py-3 rounded-xl transition-all ${activeTab==='alunos'?'bg-[#F58021] text-white font-bold shadow-lg shadow-[#F58021]/20':'text-zinc-500 hover:bg-zinc-800'}`}><GraduationCap size={20}/> Alunos/Matrículas</button></nav>
      </aside>
      <div className="md:hidden flex gap-2 p-2 bg-zinc-900 border-b border-zinc-800 overflow-x-auto sticky top-0 z-10"><button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-lg text-[10px] font-bold flex-shrink-0 ${activeTab==='dashboard'?'bg-[#F58021] text-white':'bg-zinc-800 text-zinc-500'}`}>RESUMO</button><button onClick={() => setActiveTab('agenda')} className={`px-4 py-2 rounded-lg text-[10px] font-bold flex-shrink-0 ${activeTab==='agenda'?'bg-[#F58021] text-white':'bg-zinc-800 text-zinc-500'}`}>AGENDA</button><button onClick={() => setActiveTab('alunos')} className={`px-4 py-2 rounded-lg text-[10px] font-bold flex-shrink-0 ${activeTab==='alunos'?'bg-[#F58021] text-white':'bg-zinc-800 text-zinc-500'}`}>ALUNOS</button></div>
      <main className="flex-1 p-4 md:p-8">
        {activeTab === 'dashboard' && <AdminOverview stats={stats} enrollments={enrollments} reservations={reservations} />}
        {activeTab === 'agenda' && <AdminAgenda reservations={reservations} onDelete={onDeleteRes} onBlock={onBlock} />}
        {activeTab === 'alunos' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center"><h2 className="text-2xl font-bold">Matrículas</h2><button onClick={() => setShowEnrModal(true)} className="bg-[#F58021] text-white p-2 rounded-full hover:scale-105 transition-all"><Plus size={24}/></button></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">{enrollments.map(e => (
              <div key={e.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl relative">
                <p className="font-bold text-white pr-10">{e.name}</p>
                <p className="text-xs text-zinc-500 mb-2">{e.phone}</p>
                <div className="flex justify-between items-center"><span className="text-[10px] font-bold bg-[#5A2C81] px-2 py-1 rounded text-white">{e.plan}</span><span className="text-xs font-bold text-green-400">{formatCurrency(e.price)}</span></div>
                <button onClick={() => { if(window.confirm('Remover matrícula?')) onDeleteEnr(e.id) }} className="absolute top-3 right-3 p-2 bg-red-500/20 text-red-500 rounded-md transition-all"><Trash2 size={16}/></button>
              </div>
            ))}</div>
          </div>
        )}
      </main>
      {showEnrModal && <AdminEnrModal onSave={onSaveEnr} onClose={() => setShowEnrModal(false)} />}
      {showPwdModal && <AdminPwdModal onSave={onSavePassword} onClose={() => setShowPwdModal(false)} />}
    </div>
  );
};

const AdminPwdModal = ({ onSave, onClose }) => {
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if(newPwd !== confirmPwd) {
       setError('As senhas não coincidem!');
       return;
    }
    if(newPwd.length < 6) {
       setError('A senha deve ter no mínimo 6 caracteres.');
       return;
    }
    const ok = await onSave(newPwd);
    if(ok) onClose();
  };

  return (
     <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
       <div className="bg-zinc-900 w-full max-w-sm rounded-3xl p-6 border border-zinc-800">
         <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><KeyRound className="text-[#F58021]"/> Alterar Senha</h3>
         {error && <p className="text-red-500 text-xs mb-4 font-bold">{error}</p>}
         <form onSubmit={handleSubmit} className="space-y-4">
           <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block">Nova Senha</label>
              <input required type="text" value={newPwd} onChange={e => setNewPwd(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#F58021]" />
           </div>
           <div>
              <label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block">Confirmar Nova Senha</label>
              <input required type="text" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-[#F58021]" />
           </div>
           <div className="flex gap-2 pt-4">
             <button type="button" onClick={onClose} className="flex-1 py-3 border border-zinc-800 rounded-xl text-zinc-500 font-bold">Cancelar</button>
             <button type="submit" className="flex-1 bg-[#F58021] text-white py-3 rounded-xl font-bold shadow-lg shadow-[#F58021]/20">Salvar</button>
           </div>
         </form>
       </div>
     </div>
  );
};

const AdminEnrModal = ({ onSave, onClose }) => {
  const [name, setName] = useState(''); const [phone, setPhone] = useState(''); const [planIdx, setPlanIdx] = useState(0); const [payment, setPayment] = useState(PAYMENTS[0]);
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-zinc-900 w-full max-w-sm rounded-3xl p-6 border border-zinc-800">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><GraduationCap className="text-[#F58021]"/> Novo Aluno</h3>
        <form onSubmit={async (e) => { e.preventDefault(); const ok = await onSave({ name, phone, plan: PLANS[planIdx].name, price: PLANS[planIdx].price, payment }); if(ok) onClose(); }} className="space-y-4">
          <input required type="text" placeholder="Nome" value={name} onChange={e => setName(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F58021]"/>
          <input required type="tel" placeholder="WhatsApp" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F58021]"/>
          <div><label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block">Plano</label><div className="grid grid-cols-1 gap-2">{PLANS.map((p, i) => <button key={i} type="button" onClick={() => setPlanIdx(i)} className={`p-3 rounded-xl border text-left flex justify-between items-center ${planIdx===i?'bg-zinc-800 border-[#5A2C81] text-white':'bg-zinc-950 border-zinc-800 text-zinc-500'}`}><span className="text-xs font-bold">{p.name}</span><span className="text-xs">{formatCurrency(p.price)}</span></button>)}</div></div>
          <div><label className="text-[10px] font-bold text-zinc-500 mb-2 block uppercase tracking-widest">Pagamento</label><select value={payment} onChange={e=>setPayment(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm outline-none focus:border-[#F58021]">{PAYMENTS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
          <div className="flex gap-2 pt-4"><button type="button" onClick={onClose} className="flex-1 py-3 border border-zinc-800 rounded-xl text-zinc-500">Voltar</button><button type="submit" className="flex-1 bg-[#5A2C81] text-white py-3 rounded-xl font-bold">SALVAR</button></div>
        </form>
      </div>
    </div>
  );
};

const AdminOverview = ({ stats, enrollments, reservations }) => (
  <div className="space-y-6">
    <h2 className="text-2xl font-bold">Faturamento</h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl"><p className="text-[10px] font-bold text-zinc-500 uppercase mb-2">Hoje (Quadras)</p><p className="text-3xl font-black text-white">{formatCurrency(stats.todayTotal)}</p></div>
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl border-l-4 border-l-[#5A2C81]"><p className="text-[10px] font-bold text-zinc-500 uppercase mb-2">Total Alunos/Mês</p><p className="text-3xl font-black text-[#F58021]">{formatCurrency(stats.enrTotal)}</p></div>
      <div className="bg-[#5A2C81]/10 border border-[#5A2C81]/30 p-6 rounded-2xl"><p className="text-[10px] font-bold text-[#F58021] uppercase mb-2 tracking-widest">Receita Total Bruta</p><p className="text-4xl font-black text-white">{formatCurrency(stats.total)}</p></div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl"><h3 className="font-bold mb-4 flex gap-2"><Activity className="text-[#F58021]"/> Ranking por Quadra</h3><div className="space-y-4">{COURTS.map(court => { let count = 0; reservations.filter(r => r.courtId === court.id && r.status !== 'blocked').forEach(r => count += (r.price || 0)); const pct = stats.resTotal ? Math.round((count/stats.resTotal)*100) : 0; return <div key={court.id}><div className="flex justify-between text-xs mb-1"><span className="text-zinc-400 font-bold">{court.name}</span><span className="font-bold text-[#F58021]">{formatCurrency(count)}</span></div><div className="w-full bg-zinc-950 rounded-full h-1.5"><div className="bg-[#F58021] h-1.5 rounded-full" style={{width:`${pct}%`}}></div></div></div> })}</div></div>
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col justify-center items-center text-center"><Users size={48} className="text-zinc-800 mb-4" /><h3 className="font-bold text-zinc-400 mb-1 tracking-widest">TOTAL DE ALUNOS: {enrollments.length}</h3></div>
    </div>
  </div>
);

const AdminAgenda = ({ reservations, onDelete, onBlock }) => {
  const [filterDate, setFilterDate] = useState(getDayString(new Date()));
  const [isBlocking, setIsBlocking] = useState(false);
  const daily = reservations.filter(r => r.date === filterDate).sort((a,b) => a.startTime.localeCompare(b.startTime));
  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center gap-4"><input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="bg-zinc-900 text-white border border-zinc-800 px-4 py-2 rounded-xl focus:border-[#F58021] text-xs outline-none" /><button onClick={() => setIsBlocking(true)} className="bg-red-500/10 text-red-500 px-4 py-2 rounded-xl flex items-center gap-2 border border-red-500/20 text-[10px] font-bold uppercase"><Lock size={14}/>Bloquear</button></div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {COURTS.map(court => {
          const courtRes = daily.filter(r => r.courtId === court.id);
          return (
            <div key={court.id} className="bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800">
              <div className="bg-zinc-800/50 p-3 text-center text-[10px] font-black uppercase border-b border-zinc-800 text-zinc-400 tracking-tighter">{court.name}</div>
              <div className="p-2 space-y-2">{courtRes.length === 0 ? <p className="text-zinc-800 text-[10px] text-center py-6 font-bold uppercase italic tracking-widest">Livre</p> : courtRes.map(res => (
                <div key={res.id} className={`p-3 pr-16 rounded-xl border text-sm relative ${res.status==='blocked'?'bg-zinc-950 border-red-900/30':'bg-zinc-950 border-zinc-800'}`}>
                  <div className="flex justify-between items-center mb-1"><span className={`font-bold ${res.status==='blocked'?'text-red-400':'text-[#F58021]'}`}>{res.startTime} <span className="text-[10px] text-zinc-500 font-medium">({res.duration} min)</span></span>{res.status!=='blocked' && <span className="text-[9px] font-black bg-zinc-800 px-1 rounded text-zinc-500">{res.payment}</span>}</div>
                  {res.status !== 'blocked' && <p className="text-[9px] text-[#5A2C81] uppercase font-black mb-1">{res.sport}</p>}
                  <p className="font-bold text-zinc-300 truncate tracking-tight">{res.customerName}</p>
                  <div className="absolute top-2 right-2 flex gap-1.5 transition-all">
                    {res.status !== 'blocked' && res.customerPhone && res.customerPhone !== '-' && (
                      <button onClick={() => { 
                        const cleanPhone = res.customerPhone.replace(/\D/g, '');
                        const waUrl = cleanPhone.startsWith('55') ? cleanPhone : `55${cleanPhone}`;
                        window.open(`https://wa.me/${waUrl}`, '_blank');
                      }} className="p-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors shadow-lg" title="Chamar no WhatsApp">
                        <MessageCircle size={16}/>
                      </button>
                    )}
                    <button onClick={() => { if(window.confirm('Excluir?')) onDelete(res.id) }} className="p-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors shadow-lg" title="Excluir">
                      <Trash2 size={16}/>
                    </button>
                  </div>
                </div>
              ))}</div>
            </div>
          )
        })}
      </div>
      {isBlocking && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 w-full max-w-sm rounded-3xl p-6 border border-red-900/30">
            <h3 className="text-xl font-bold mb-4 text-red-500 flex items-center gap-2 uppercase tracking-tighter"><Lock size={20}/> Bloqueio Adm</h3>
            <div className="space-y-4">
              <select id="blCourt" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white outline-none">{COURTS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <div className="grid grid-cols-2 gap-3"><select id="blTime" className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white outline-none">{TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}</select><select id="blDur" className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm text-white outline-none">{DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}</select></div>
              <div className="flex gap-2 pt-4"><button onClick={()=>setIsBlocking(false)} className="flex-1 py-3 border border-zinc-800 rounded-xl font-bold text-zinc-500">VOLTAR</button><button onClick={()=>{
                const c = document.getElementById('blCourt').value; const t = document.getElementById('blTime').value; const d = Number(document.getElementById('blDur').value);
                onBlock({ date: filterDate, courtId: c, startTime: t, duration: d, status: 'blocked', customerName: 'BLOQUEIO', customerPhone: '-', price: 0, sport: '-' }); setIsBlocking(false);
              }} className="flex-1 bg-red-500 py-3 rounded-xl font-bold text-white shadow-lg shadow-red-500/20">BLOQUEAR</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) createRoot(rootElement).render(<App />);
