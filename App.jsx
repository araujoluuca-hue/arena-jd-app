import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { Calendar, Clock, MapPin, X, Activity, CalendarDays, CheckCircle, Lock, Trash2, ArrowLeft, AlertCircle, RefreshCw, DollarSign, TrendingUp, BarChart3, Users, CreditCard, GraduationCap, Plus } from 'lucide-react';

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

function App() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState('login');
  const [reservations, setReservations] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const initAuth = async () => { try { await signInAnonymously(auth); } catch { setUser({ uid: 'demo' }); } };
    initAuth();
    return onAuthStateChanged(auth, (u) => { if(u) setUser(u) });
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
    try { await addDoc(collection(db, 'artifacts', appId, 'public', 'data', coll), { ...data, createdAt: new Date().toISOString() }); showToast("Salvo com sucesso!"); return true; } 
    catch { showToast("Erro ao salvar.", "error"); return false; }
  };

  const handleDelete = async (coll, id) => {
    try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', coll, id)); showToast("Removido."); } 
    catch { showToast("Erro ao remover.", "error"); }
  };

  if (!user || loading) return <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-yellow-400"><RefreshCw className="animate-spin mb-4" size={48} /><h1 className="text-xl font-bold uppercase tracking-widest">Arena JD</h1></div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-yellow-500 selection:text-black">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {view === 'login' && <LoginScreen setView={setView} />}
      {view === 'admin_login' && <AdminLoginScreen setView={setView} showToast={showToast} />}
      {view === 'customer' && <CustomerBookingScreen reservations={reservations} onSave={(d) => handleCreate('reservations', d)} setView={setView} />}
      {view === 'admin_dashboard' && <AdminDashboard reservations={reservations} enrollments={enrollments} onDeleteRes={(id) => handleDelete('reservations', id)} onDeleteEnr={(id) => handleDelete('enrollments', id)} onBlock={(d) => handleCreate('reservations', d)} onSaveEnr={(d) => handleCreate('enrollments', d)} setView={setView} />}
    </div>
  );
}
const LoginScreen = ({ setView }) => (
  <div className="min-h-screen flex items-center justify-center p-4">
    <div className="max-w-md w-full text-center">
      <div className="bg-yellow-400 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(250,204,21,0.3)]"><Activity size={40} className="text-zinc-950" /></div>
      <h1 className="text-4xl font-black text-white tracking-tight uppercase mb-10">Arena <span className="text-yellow-400">JD</span></h1>
      <button onClick={() => setView('customer')} className="w-full bg-yellow-400 text-zinc-950 font-bold py-4 rounded-2xl flex items-center justify-center gap-3 mb-4 shadow-xl"><Calendar size={24} />AGENDAR HORÁRIO</button>
      <button onClick={() => setView('admin_login')} className="w-full bg-zinc-900 border border-zinc-800 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3"><Lock size={20} className="text-zinc-500" />Acesso ADM</button>
    </div>
  </div>
);

const AdminLoginScreen = ({ setView, showToast }) => {
  const [pwd, setPwd] = useState('');
  const handleLogin = (e) => { e.preventDefault(); if (pwd === 'admin123') setView('admin_dashboard'); else showToast('Senha incorreta!', 'error'); };
  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <button onClick={() => setView('login')} className="absolute top-6 left-6 p-2 bg-zinc-900 rounded-full"><ArrowLeft size={24} /></button>
      <div className="max-w-sm w-full bg-zinc-900 p-8 rounded-3xl border border-zinc-800">
        <Lock size={40} className="text-yellow-400 mx-auto mb-4" />
        <h2 className="text-2xl font-bold text-center mb-8">Acesso ADM</h2>
        <form onSubmit={handleLogin} className="space-y-6">
          <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 text-white px-4 py-3 rounded-xl focus:border-yellow-400 focus:outline-none" placeholder="Senha ADM" autoFocus />
          <button type="submit" className="w-full bg-white text-black font-bold py-3 rounded-xl">Entrar no Painel</button>
        </form>
      </div>
    </div>
  );
};

const CustomerBookingScreen = ({ reservations, onSave, setView }) => {
  const [selectedDate, setSelectedDate] = useState(getDayString(new Date()));
  const [selectedCourt, setSelectedCourt] = useState(COURTS[0].id);
  const [bookingModalInfo, setBookingModalInfo] = useState(null);
  const getNextDays = () => Array.from({length:14}, (_,i) => { const d=new Date(); d.setDate(d.getDate()+i); return { full: getDayString(d), dayNum: d.getDate(), dayWeek: d.toLocaleDateString('pt-BR',{weekday:'short'}).replace('.','').toUpperCase() }; });
  return (
    <div className="pb-24">
      <header className="sticky top-0 bg-zinc-950/90 border-b border-zinc-900 z-30 px-4 py-4 flex items-center gap-3 backdrop-blur-md"><button onClick={() => setView('login')} className="p-2 bg-zinc-900 rounded-full"><ArrowLeft size={20}/></button><h1 className="text-lg font-black"><span className="text-yellow-400">ARENA</span> JD</h1></header>
      <main className="max-w-3xl mx-auto p-4 space-y-8 mt-4">
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide snap-x">
          {getNextDays().map(day => <button key={day.full} onClick={() => setSelectedDate(day.full)} className={`snap-center flex-shrink-0 w-20 py-3 rounded-2xl border transition-all ${selectedDate===day.full?'bg-yellow-400 border-yellow-400 text-black shadow-lg shadow-yellow-400/20':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}><span className="text-xs font-bold block mb-1">{day.dayWeek}</span><span className="text-xl font-black">{day.dayNum}</span></button>)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {COURTS.map(court => <button key={court.id} onClick={() => setSelectedCourt(court.id)} className={`p-4 rounded-xl border text-left flex justify-between items-center transition-all ${selectedCourt===court.id?'bg-zinc-800 border-yellow-400':'bg-zinc-900 border-zinc-800'}`}><span className="font-semibold text-sm">{court.name}</span>{selectedCourt===court.id && <CheckCircle size={18} className="text-yellow-400"/>}</button>)}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {TIME_SLOTS.map(time => { const isAvail = checkAvailability(selectedDate, selectedCourt, time, 30, reservations); return <button key={time} disabled={!isAvail} onClick={() => setBookingModalInfo({time})} className={`py-3 rounded-xl border text-sm font-bold relative overflow-hidden transition-all ${isAvail?'bg-zinc-900 border-zinc-700 hover:border-yellow-400':'bg-zinc-950 border-zinc-900 text-zinc-700 opacity-50'}`}>{time}{!isAvail && <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80"><Lock size={14}/></div>}</button> })}
        </div>
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
  const courtName = COURTS.find(c => c.id === courtId)?.name;
  
  const handleSubmit = async (e) => { e.preventDefault(); if(!name||!phone) return; if(!isDurationValid) return; const ok = await onSave({date, courtId, startTime, duration, sport, payment, customerName: name, customerPhone: phone, price, status: 'reserved'}); if(ok) onClose(); };
  
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-zinc-900 w-full max-w-md rounded-3xl p-6 border border-zinc-800 max-h-[95vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold">Detalhes da Reserva</h3><button onClick={onClose} className="p-2 bg-zinc-800 rounded-full"><X size={20}/></button></div>
        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 mb-4 space-y-2 text-sm text-zinc-300 font-medium"><div className="flex items-center gap-2"><MapPin size={16} className="text-yellow-400"/> {courtName}</div><div className="flex items-center gap-2"><CalendarDays size={16} className="text-yellow-400"/> {date.split('-').reverse().join('/')} às {startTime}</div></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3">
            <div><label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block tracking-widest">Modalidade</label><select value={sport} onChange={e=>setSport(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-yellow-400 focus:outline-none">{SPORTS.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block tracking-widest">Forma de Pagamento</label><select value={payment} onChange={e=>setPayment(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-yellow-400 focus:outline-none">{PAYMENTS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
          </div>
          <div><label className="text-[10px] font-bold text-zinc-500 uppercase mb-1 block tracking-widest">Duração</label><div className="grid grid-cols-2 gap-2">{DURATIONS.map(d => <button key={d.value} type="button" onClick={() => setDuration(d.value)} className={`py-2 rounded-lg text-xs border font-bold ${duration===d.value?'bg-yellow-400 border-yellow-400 text-black':'bg-zinc-800 border-zinc-700 text-zinc-400'}`}>{d.label}</button>)}</div></div>
          <div className="space-y-2"><input required type="text" placeholder="Nome do Cliente" value={name} onChange={e => setName(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-yellow-400 focus:outline-none"/><input required type="tel" placeholder="WhatsApp" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-yellow-400 focus:outline-none"/></div>
          <div className="flex justify-between items-center pt-4 border-t border-zinc-800"><p className="text-2xl font-black text-yellow-400">{formatCurrency(price)}</p><button type="submit" disabled={!isDurationValid} className="bg-white text-black font-bold py-3 px-8 rounded-xl disabled:opacity-50 transition-all hover:bg-zinc-200">Confirmar</button></div>
        </form>
      </div>
    </div>
  );
};
const AdminDashboard = ({ reservations, enrollments, onDeleteRes, onDeleteEnr, onBlock, onSaveEnr, setView }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [showEnrModal, setShowEnrModal] = useState(false);

  const stats = useMemo(() => {
    const today = getDayString(new Date());
    let resTotal = 0, enrTotal = 0, todayTotal = 0;
    reservations.filter(r => r.status !== 'blocked').forEach(r => { resTotal += (r.price || 0); if(r.date === today) todayTotal += (r.price || 0); });
    enrollments.forEach(e => { enrTotal += (e.price || 0); });
    return { resTotal, enrTotal, total: resTotal + enrTotal, todayTotal };
  }, [reservations, enrollments]);

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-zinc-950">
      <aside className="w-full md:w-64 bg-zinc-900 border-zinc-800 p-4 sticky top-0 z-20 flex md:flex-col justify-between items-start border-r border-zinc-800">
        <div className="w-full flex justify-between items-center md:mb-8"><h1 className="font-black text-white text-xl">ARENA <span className="text-yellow-400">ADM</span></h1><button onClick={() => setView('login')} className="text-zinc-500 hover:text-white transition"><ArrowLeft size={20} /></button></div>
        <nav className="hidden md:flex flex-col gap-2 w-full"><button onClick={() => setActiveTab('dashboard')} className={`flex gap-3 px-4 py-3 rounded-xl transition-all ${activeTab==='dashboard'?'bg-yellow-400 text-black font-bold':'text-zinc-400 hover:bg-zinc-800'}`}><BarChart3 size={20}/> Faturamento</button><button onClick={() => setActiveTab('agenda')} className={`flex gap-3 px-4 py-3 rounded-xl transition-all ${activeTab==='agenda'?'bg-yellow-400 text-black font-bold':'text-zinc-400 hover:bg-zinc-800'}`}><CalendarDays size={20}/> Agenda</button><button onClick={() => setActiveTab('alunos')} className={`flex gap-3 px-4 py-3 rounded-xl transition-all ${activeTab==='alunos'?'bg-yellow-400 text-black font-bold':'text-zinc-400 hover:bg-zinc-800'}`}><GraduationCap size={20}/> Matrículas</button></nav>
      </aside>
      <div className="md:hidden flex gap-2 p-2 bg-zinc-900 border-b border-zinc-800 overflow-x-auto sticky top-[60px] z-10"><button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab==='dashboard'?'bg-yellow-400 text-black':'bg-zinc-800 text-zinc-400'}`}>Resumo</button><button onClick={() => setActiveTab('agenda')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab==='agenda'?'bg-yellow-400 text-black':'bg-zinc-800 text-zinc-400'}`}>Agenda</button><button onClick={() => setActiveTab('alunos')} className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeTab==='alunos'?'bg-yellow-400 text-black':'bg-zinc-800 text-zinc-400'}`}>Matrículas</button></div>
      <main className="flex-1 p-4 md:p-8">
        {activeTab === 'dashboard' && <AdminOverview stats={stats} enrollments={enrollments} reservations={reservations} />}
        {activeTab === 'agenda' && <AdminAgenda reservations={reservations} onDelete={onDeleteRes} onBlock={onBlock} />}
        {activeTab === 'alunos' && (
          <div className="space-y-6 animate-fade-in">
            <div className="flex justify-between items-center"><h2 className="text-2xl font-bold">Alunos Matriculados</h2><button onClick={() => setShowEnrModal(true)} className="bg-yellow-400 text-black p-2 rounded-full hover:scale-105 transition-all"><Plus size={24}/></button></div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {enrollments.length === 0 ? <p className="text-zinc-500 text-sm italic">Nenhum aluno cadastrado.</p> : enrollments.map(e => (
                <div key={e.id} className="bg-zinc-900 border border-zinc-800 p-4 rounded-2xl relative group">
                  <p className="font-bold text-white mb-1">{e.name}</p>
                  <p className="text-xs text-zinc-500 mb-2">{e.phone}</p>
                  <div className="flex justify-between items-center"><span className="text-[10px] font-bold bg-zinc-800 px-2 py-1 rounded-md text-yellow-400">{e.plan}</span><span className="text-xs font-bold text-green-400">{formatCurrency(e.price)}</span></div>
                  <button onClick={() => { if(window.confirm('Remover matrícula?')) onDeleteEnr(e.id) }} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={14}/></button>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
      {showEnrModal && <AdminEnrModal onSave={onSaveEnr} onClose={() => setShowEnrModal(false)} />}
    </div>
  );
};

const AdminEnrModal = ({ onSave, onClose }) => {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [planIdx, setPlanIdx] = useState(0);
  const [payment, setPayment] = useState(PAYMENTS[0]);

  const handleSave = async (e) => { e.preventDefault(); if(!name||!phone) return; const ok = await onSave({ name, phone, plan: PLANS[planIdx].name, price: PLANS[planIdx].price, payment }); if(ok) onClose(); };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
      <div className="bg-zinc-900 w-full max-w-sm rounded-3xl p-6 border border-zinc-800">
        <h3 className="text-xl font-bold mb-6 flex items-center gap-2"><GraduationCap className="text-yellow-400"/> Nova Matrícula</h3>
        <form onSubmit={handleSave} className="space-y-4">
          <input required type="text" placeholder="Nome do Aluno" value={name} onChange={e => setName(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-yellow-400 focus:outline-none"/>
          <input required type="tel" placeholder="WhatsApp" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-yellow-400 focus:outline-none"/>
          <div><label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block">Plano de Aula</label><div className="grid grid-cols-1 gap-2">{PLANS.map((p, i) => <button key={i} type="button" onClick={() => setPlanIdx(i)} className={`p-3 rounded-xl border text-left flex justify-between items-center transition-all ${planIdx===i?'bg-zinc-800 border-yellow-400 text-white':'bg-zinc-950 border-zinc-800 text-zinc-500'}`}><span className="text-xs font-bold">{p.name}</span><span className="text-xs">{formatCurrency(p.price)}</span></button>)}</div></div>
          <div><label className="text-[10px] font-bold text-zinc-500 uppercase mb-2 block">Pagamento</label><select value={payment} onChange={e=>setPayment(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-yellow-400 focus:outline-none">{PAYMENTS.map(p => <option key={p} value={p}>{p}</option>)}</select></div>
          <div className="flex gap-2 pt-4"><button type="button" onClick={onClose} className="flex-1 py-3 border border-zinc-800 rounded-xl text-zinc-400 font-bold">Cancelar</button><button type="submit" className="flex-1 bg-yellow-400 text-black py-3 rounded-xl font-bold hover:bg-yellow-500 transition-all">Matricular</button></div>
        </form>
      </div>
    </div>
  );
};

const AdminOverview = ({ stats, enrollments, reservations }) => (
  <div className="space-y-6 animate-fade-in">
    <h2 className="text-2xl font-bold">Visão Financeira</h2>
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl"><p className="text-[10px] font-bold text-zinc-500 uppercase mb-2 tracking-tighter">Faturamento Hoje (Quadras)</p><p className="text-3xl font-black text-white">{formatCurrency(stats.todayTotal)}</p></div>
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl"><p className="text-[10px] font-bold text-zinc-500 uppercase mb-2 tracking-tighter">Total em Matrículas</p><p className="text-3xl font-black text-blue-400">{formatCurrency(stats.enrTotal)}</p></div>
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl border-l-4 border-l-yellow-400"><p className="text-[10px] font-bold text-zinc-500 uppercase mb-2 tracking-tighter">Receita Total Acumulada</p><p className="text-3xl font-black text-yellow-400">{formatCurrency(stats.total)}</p></div>
    </div>
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-4">
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl"><h3 className="font-bold mb-4 flex gap-2"><Activity className="text-yellow-400"/> Faturamento por Quadra</h3><div className="space-y-4">{COURTS.map(court => { let count = 0; reservations.filter(r => r.courtId === court.id && r.status !== 'blocked').forEach(r => count += (r.price || 0)); const pct = stats.resTotal ? Math.round((count/stats.resTotal)*100) : 0; return <div key={court.id}><div className="flex justify-between text-xs mb-1"><span className="text-zinc-400">{court.name}</span><span className="font-bold">{formatCurrency(count)}</span></div><div className="w-full bg-zinc-950 rounded-full h-1.5"><div className="bg-yellow-400 h-1.5 rounded-full" style={{width:`${pct}%`}}></div></div></div> })}</div></div>
      <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-2xl flex flex-col justify-center items-center text-center"><Users size={48} className="text-zinc-800 mb-4" /><h3 className="font-bold text-zinc-400 mb-1 tracking-tight">Alunos Ativos: {enrollments.length}</h3><p className="text-sm text-zinc-500">Mantenha as matrículas atualizadas para análise precisa de receita mensal fixa.</p></div>
    </div>
  </div>
);

const AdminAgenda = ({ reservations, onDelete, onBlock }) => {
  const [filterDate, setFilterDate] = useState(getDayString(new Date()));
  const [isBlocking, setIsBlocking] = useState(false);
  const daily = reservations.filter(r => r.date === filterDate).sort((a,b) => a.startTime.localeCompare(b.startTime));
  return (
    <div className="space-y-6 pb-20 animate-fade-in">
      <div className="flex justify-between items-center gap-4"><input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="bg-zinc-900 text-white border border-zinc-800 px-4 py-2 rounded-xl focus:border-yellow-400 focus:outline-none text-sm" /><button onClick={() => setIsBlocking(true)} className="bg-red-500/10 text-red-400 px-4 py-2 rounded-xl flex items-center gap-2 border border-red-500/20 text-xs font-bold uppercase"><Lock size={14}/>Bloquear</button></div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {COURTS.map(court => {
          const courtRes = daily.filter(r => r.courtId === court.id);
          return (
            <div key={court.id} className="bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800">
              <div className="bg-zinc-800/50 p-3 text-center text-[10px] font-black uppercase border-b border-zinc-800 text-zinc-400">{court.name}</div>
              <div className="p-2 space-y-2">{courtRes.length === 0 ? <p className="text-zinc-700 text-[10px] text-center py-6 font-bold">SEM RESERVAS</p> : courtRes.map(res => (
                <div key={res.id} className={`p-3 rounded-xl border text-sm relative group transition-all ${res.status==='blocked'?'bg-zinc-950 border-red-900/40':'bg-zinc-950 border-zinc-800 hover:border-zinc-700'}`}>
                  <div className="flex justify-between items-center mb-1"><span className={`font-bold ${res.status==='blocked'?'text-red-400':'text-yellow-400'}`}>{res.startTime}</span>{res.status!=='blocked' && <span className="text-[10px] font-black text-green-500">{res.payment}</span>}</div>
                  {res.status !== 'blocked' && <p className="text-[10px] text-zinc-500 uppercase font-black mb-1">{res.sport}</p>}
                  <p className="font-bold text-zinc-200 truncate">{res.customerName}</p>
                  <button onClick={() => { if(window.confirm('Excluir agendamento?')) onDelete(res.id) }} className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-md opacity-0 group-hover:opacity-100 transition-all"><Trash2 size={12}/></button>
                </div>
              ))}</div>
            </div>
          )
        })}
      </div>
      {isBlocking && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-zinc-900 w-full max-w-sm rounded-3xl p-6 border border-red-900/50">
            <h3 className="text-xl font-bold mb-4 text-red-400 flex items-center gap-2 uppercase tracking-tighter"><Lock size={20}/> Bloquear Quadra</h3>
            <div className="space-y-4">
              <select id="blCourt" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm">{COURTS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
              <div className="grid grid-cols-2 gap-3"><select id="blTime" className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm">{TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}</select><select id="blDur" className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm">{DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}</select></div>
              <div className="flex gap-2 pt-4"><button onClick={()=>setIsBlocking(false)} className="flex-1 py-3 border border-zinc-800 rounded-xl font-bold text-zinc-500">Voltar</button><button onClick={()=>{
                const c = document.getElementById('blCourt').value;
                const t = document.getElementById('blTime').value;
                const d = Number(document.getElementById('blDur').value);
                onBlock({ date: filterDate, courtId: c, startTime: t, duration: d, status: 'blocked', customerName: 'BLOQUEIO', customerPhone: '-', price: 0, sport: '-' });
                setIsBlocking(false);
              }} className="flex-1 bg-red-500 py-3 rounded-xl font-bold text-white shadow-lg shadow-red-500/20">Bloquear</button></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) createRoot(rootElement).render(<App />);