import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, deleteDoc, doc } from 'firebase/firestore';
import { Calendar, Clock, MapPin, X, Activity, CalendarDays, CheckCircle, Lock, Trash2, ArrowLeft, AlertCircle, RefreshCw } from 'lucide-react';

const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'arena-jd-app';

const COURTS = [
  { id: 'jd', name: 'JD' },
  { id: 'barbearia', name: 'Barbearia Lins (Areia)' },
  { id: 'campelo', name: 'Campelo Gomes' },
  { id: 'edite', name: 'Edite Imports (Areia)' }
];

const DURATIONS = [
  { label: '30 Minutos', value: 30, price: 20 },
  { label: '1 Hora', value: 60, price: 40 },
  { label: '1h 30m', value: 90, price: 60 },
  { label: '2 Horas', value: 120, price: 80 },
  { label: '2h 30m', value: 150, price: 100 },
  { label: '3 Horas', value: 180, price: 120 }
];

const generateTimeSlots = () => {
  const slots = [];
  for (let i = 300; i < 1380; i += 30) {
    slots.push(`${String(Math.floor(i/60)).padStart(2,'0')}:${String(i%60).padStart(2,'0')}`);
  }
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
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) await signInWithCustomToken(auth, __initial_auth_token);
        else await signInAnonymously(auth);
      } catch (err) {}
    };
    initAuth();
    return onAuthStateChanged(auth, setUser);
  }, []);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    return onSnapshot(collection(db, 'artifacts', appId, 'public', 'data', 'reservations'), (snapshot) => {
      setReservations(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, () => { showToast("Erro ao carregar.", "error"); setLoading(false); });
  }, [user]);

  const showToast = (message, type = 'success') => setToast({ message, type });

  const handleCreateReservation = async (data) => {
    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'reservations'), { ...data, createdAt: new Date().toISOString() });
      showToast("Agendamento confirmado!");
      return true;
    } catch { showToast("Erro ao agendar.", "error"); return false; }
  };

  const handleDeleteReservation = async (id) => {
    try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'reservations', id)); showToast("Cancelado."); } 
    catch { showToast("Erro ao cancelar.", "error"); }
  };

  const handleBlockTime = async (date, courtId, startTime, durationMins) => {
    try {
       await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'reservations'), { date, courtId, startTime, duration: durationMins, status: 'blocked', customerName: 'BLOQUEIO', customerPhone: '-', price: 0, createdAt: new Date().toISOString() });
       showToast("Bloqueado.");
    } catch { showToast("Erro.", "error"); }
  };

  if (!user || loading) return <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-yellow-400"><RefreshCw className="animate-spin mb-4" size={48} /><h1 className="text-xl font-bold">CARREGANDO...</h1></div>;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-yellow-500 selection:text-black">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      {view === 'login' && <LoginScreen setView={setView} />}
      {view === 'admin_login' && <AdminLoginScreen setView={setView} showToast={showToast} />}
      {view === 'customer' && <CustomerBookingScreen reservations={reservations} onSave={handleCreateReservation} setView={setView} />}
      {view === 'admin_dashboard' && <AdminDashboard reservations={reservations} onDelete={handleDeleteReservation} onBlock={handleBlockTime} setView={setView} />}
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
          <input type="password" value={pwd} onChange={(e) => setPwd(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 text-white px-4 py-3 rounded-xl" placeholder="Senha" autoFocus />
          <button type="submit" className="w-full bg-white text-black font-bold py-3 rounded-xl">Entrar</button>
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
      <header className="sticky top-0 bg-zinc-950/90 border-b border-zinc-900 z-30 px-4 py-4 flex items-center gap-3"><button onClick={() => setView('login')} className="p-2 bg-zinc-900 rounded-full"><ArrowLeft size={20}/></button><h1 className="text-lg font-black"><span className="text-yellow-400">ARENA</span> JD</h1></header>
      <main className="max-w-3xl mx-auto p-4 space-y-8 mt-4">
        <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide snap-x">
          {getNextDays().map(day => <button key={day.full} onClick={() => setSelectedDate(day.full)} className={`snap-center flex-shrink-0 w-20 py-3 rounded-2xl border ${selectedDate===day.full?'bg-yellow-400 border-yellow-400 text-black':'bg-zinc-900 border-zinc-800 text-zinc-400'}`}><span className="text-xs font-bold block mb-1">{day.dayWeek}</span><span className="text-xl font-black">{day.dayNum}</span></button>)}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {COURTS.map(court => <button key={court.id} onClick={() => setSelectedCourt(court.id)} className={`p-4 rounded-xl border text-left flex justify-between items-center ${selectedCourt===court.id?'bg-zinc-800 border-yellow-400':'bg-zinc-900 border-zinc-800'}`}><span className="font-semibold text-sm">{court.name}</span>{selectedCourt===court.id && <CheckCircle size={18} className="text-yellow-400"/>}</button>)}
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {TIME_SLOTS.map(time => { const isAvail = checkAvailability(selectedDate, selectedCourt, time, 30, reservations); return <button key={time} disabled={!isAvail} onClick={() => setBookingModalInfo({time})} className={`py-3 rounded-xl border text-sm font-bold relative overflow-hidden ${isAvail?'bg-zinc-900 border-zinc-700':'bg-zinc-950 border-zinc-900 text-zinc-700 opacity-50'}`}>{time}{!isAvail && <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80"><Lock size={14}/></div>}</button> })}
        </div>
      </main>
      {bookingModalInfo && <BookingFormModal date={selectedDate} courtId={selectedCourt} startTime={bookingModalInfo.time} onClose={() => setBookingModalInfo(null)} onSave={onSave} reservations={reservations} />}
    </div>
  );
};

const BookingFormModal = ({ date, courtId, startTime, onClose, onSave, reservations }) => {
  const [duration, setDuration] = useState(60);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [obs, setObs] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const isDurationValid = useMemo(() => checkAvailability(date, courtId, startTime, duration, reservations), [date, courtId, startTime, duration, reservations]);
  const price = DURATIONS.find(d => d.value === duration).price;
  const courtName = COURTS.find(c => c.id === courtId)?.name;
  
  const handleSubmit = async (e) => { e.preventDefault(); if(!name||!phone) return setError("Preencha nome e telefone."); if(!isDurationValid) return setError("Conflito de horário."); setIsSubmitting(true); const ok = await onSave({date, courtId, startTime, duration, customerName: name, customerPhone: phone, obs, price, status: 'reserved'}); if(ok) onClose(); setIsSubmitting(false); };
  
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 w-full max-w-md rounded-3xl p-6 border border-zinc-800">
        <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold">Confirmar</h3><button onClick={onClose} className="p-2 bg-zinc-800 rounded-full"><X size={20}/></button></div>
        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 mb-6 space-y-3 text-sm text-zinc-300"><div className="flex items-center gap-2"><MapPin size={16} className="text-yellow-400"/> {courtName}</div><div className="flex items-center gap-2"><CalendarDays size={16} className="text-yellow-400"/> {date.split('-').reverse().join('/')}</div><div className="flex items-center gap-2"><Clock size={16} className="text-yellow-400"/> Início às {startTime}</div></div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-2">{DURATIONS.map(d => <button key={d.value} type="button" onClick={() => setDuration(d.value)} className={`py-2 rounded-lg text-sm border font-medium ${duration===d.value?'bg-yellow-400 border-yellow-400 text-black':'bg-zinc-800 border-zinc-700 text-zinc-300'}`}>{d.label}</button>)}</div>
          <input required type="text" placeholder="Nome" value={name} onChange={e => setName(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-yellow-400 focus:outline-none"/>
          <input required type="tel" placeholder="Telefone" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-yellow-400 focus:outline-none"/>
          <textarea placeholder="Obs" value={obs} onChange={e => setObs(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-sm focus:border-yellow-400 focus:outline-none"></textarea>
          {error && <div className="p-3 bg-red-500/20 text-red-400 text-sm rounded-lg border border-red-500/50">{error}</div>}
          <div className="flex justify-between items-center pt-4 border-t border-zinc-800"><p className="text-2xl font-black text-yellow-400">{formatCurrency(price)}</p><button type="submit" disabled={!isDurationValid||isSubmitting} className="bg-white text-black font-bold py-3 px-6 rounded-xl disabled:opacity-50">Confirmar</button></div>
        </form>
      </div>
    </div>
  );
};

const AdminDashboard = ({ reservations, onDelete, onBlock, setView }) => {
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-zinc-950">
      <aside className="w-full md:w-64 bg-zinc-900 border-zinc-800 p-4 sticky top-0 z-20 flex justify-between items-center"><h1 className="font-black text-white">ARENA <span className="text-yellow-400">JD</span></h1><button onClick={() => setView('login')} className="text-zinc-400"><ArrowLeft size={16} /></button></aside>
      <main className="flex-1 p-4"><AdminAgenda reservations={reservations} onDelete={onDelete} onBlock={onBlock} /></main>
    </div>
  );
};

const AdminAgenda = ({ reservations, onDelete, onBlock }) => {
  const [filterDate, setFilterDate] = useState(getDayString(new Date()));
  const [isBlocking, setIsBlocking] = useState(false);
  const daily = reservations.filter(r => r.date === filterDate).sort((a,b) => a.startTime.localeCompare(b.startTime));
  return (
    <div className="space-y-6 pb-20">
      <div className="flex justify-between items-center gap-4"><input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="bg-zinc-900 text-white border border-zinc-800 px-4 py-2 rounded-xl focus:outline-none focus:border-yellow-400" /><button onClick={() => setIsBlocking(true)} className="bg-red-500/10 text-red-400 px-4 py-2 rounded-xl flex items-center gap-2 border border-red-500/20 font-medium"><Lock size={16}/>Bloquear</button></div>
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {COURTS.map(court => {
          const courtRes = daily.filter(r => r.courtId === court.id);
          return (
            <div key={court.id} className="bg-zinc-900 rounded-2xl overflow-hidden border border-zinc-800">
              <div className="bg-zinc-800/50 p-4 text-center text-sm font-bold border-b border-zinc-800">{court.name}</div>
              <div className="p-2 space-y-2">{courtRes.length === 0 ? <p className="text-zinc-600 text-xs text-center p-4">Livre</p> : courtRes.map(res => (
                <div key={res.id} className={`p-3 rounded-xl border text-sm relative group ${res.status==='blocked'?'bg-zinc-950 border-red-900/50':'bg-zinc-950 border-zinc-800'}`}>
                  <div className="flex justify-between mb-1"><span className={`font-bold ${res.status==='blocked'?'text-red-400':'text-yellow-400'}`}>{res.startTime} <span className="text-xs font-normal text-zinc-500">({res.duration}m)</span></span>{res.status!=='blocked' && <span className="text-green-400 font-bold">{formatCurrency(res.price)}</span>}</div>
                  <p className="font-medium truncate">{res.customerName}</p>{res.status!=='blocked' && <p className="text-xs text-zinc-500">{res.customerPhone}</p>}
                  <button onClick={() => { if(window.confirm('Excluir este agendamento?')) onDelete(res.id) }} className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg"><Trash2 size={14}/></button>
                </div>
              ))}</div>
            </div>
          )
        })}
      </div>
      {isBlocking && <AdminBlockModal date={filterDate} onClose={() => setIsBlocking(false)} onBlock={onBlock} reservations={reservations} />}
    </div>
  );
};

const AdminBlockModal = ({ date, onClose, onBlock, reservations }) => {
  const [courtId, setCourtId] = useState(COURTS[0].id);
  const [startTime, setStartTime] = useState('08:00');
  const [duration, setDuration] = useState(60);
  const handleBlock = (e) => { e.preventDefault(); if(checkAvailability(date, courtId, startTime, duration, reservations)) { onBlock(date, courtId, startTime, duration); onClose(); } else alert("Conflito de horário!"); };
  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-900 w-full max-w-sm rounded-3xl p-6 border border-red-900/50">
        <h3 className="text-xl font-bold mb-4 text-red-400 flex items-center gap-2"><Lock size={20}/> Bloquear</h3>
        <form onSubmit={handleBlock} className="space-y-4">
          <select value={courtId} onChange={e=>setCourtId(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm">{COURTS.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <div className="grid grid-cols-2 gap-3"><select value={startTime} onChange={e=>setStartTime(e.target.value)} className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm">{TIME_SLOTS.map(t => <option key={t} value={t}>{t}</option>)}</select><select value={duration} onChange={e=>setDuration(Number(e.target.value))} className="bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 text-sm">{DURATIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}</select></div>
          <div className="flex gap-3 pt-4"><button type="button" onClick={onClose} className="flex-1 py-3 border border-zinc-800 rounded-xl font-medium">Cancelar</button><button type="submit" className="flex-1 bg-red-500 py-3 rounded-xl font-bold text-white">Bloquear</button></div>
        </form>
      </div>
    </div>
  )
}
