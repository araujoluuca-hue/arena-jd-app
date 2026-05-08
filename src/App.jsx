import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc } from 'firebase/firestore';
import { 
  Calendar as CalendarIcon, Clock, MapPin, User, ChevronRight, Menu, X, 
  DollarSign, TrendingUp, CalendarDays, CheckCircle, Lock, Users, Activity, 
  Plus, Trash2, ArrowLeft, AlertCircle, RefreshCw, BarChart3
} from 'lucide-react';

// --- FIREBASE SETUP ---
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'arena-jd-app';

// --- CONFIGURAÇÕES DE DOMÍNIO ---
const COURTS = [
  { id: 'jd', name: 'JD' },
  { id: 'barbearia', name: 'Barbearia Lins (Areia de Praia)' },
  { id: 'campelo', name: 'Campelo Gomes' },
  { id: 'edite', name: 'Edite Imports (Areia de Praia)' },
];

const DURATIONS = [
  { label: '30 Minutos', value: 30, price: 20 },
  { label: '1 Hora', value: 60, price: 40 },
  { label: '1h 30m', value: 90, price: 60 },
  { label: '2 Horas', value: 120, price: 80 },
  { label: '2h 30m', value: 150, price: 100 },
  { label: '3 Horas', value: 180, price: 120 },
];

const generateTimeSlots = () => {
  const slots = [];
  for (let i = 5 * 60; i < 23 * 60; i += 30) {
    const h = Math.floor(i / 60).toString().padStart(2, '0');
    const m = (i % 60).toString().padStart(2, '0');
    slots.push(`${h}:${m}`);
  }
  return slots;
};
const TIME_SLOTS = generateTimeSlots();

// --- FUNÇÕES UTILITÁRIAS ---
const getDayString = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const formatCurrency = (value) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

const checkAvailability = (date, courtId, startTimeStr, durationMins, allReservations, ignoreResId = null) => {
  const startMins = parseInt(startTimeStr.split(':')[0]) * 60 + parseInt(startTimeStr.split(':')[1]);
  const endMins = startMins + durationMins;
  
  const dayRes = allReservations.filter(r => r.date === date && r.courtId === courtId && r.id !== ignoreResId);

  for (const res of dayRes) {
    const resStartMins = parseInt(res.startTime.split(':')[0]) * 60 + parseInt(res.startTime.split(':')[1]);
    const resEndMins = resStartMins + res.duration;
    if (Math.max(startMins, resStartMins) < Math.min(endMins, resEndMins)) {
      return false;
    }
  }
  return true;
};

// --- COMPONENTES DA UI ---
const Toast = ({ message, type, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const bgColor = type === 'error' ? 'bg-red-500' : 'bg-green-500';

  return (
    <div className={`fixed bottom-4 right-4 ${bgColor} text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-3 z-50 animate-bounce`}>
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
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          await signInWithCustomToken(auth, __initial_auth_token);
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth error:", err);
      }
    };
    initAuth();
    
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    setLoading(true);
    const reservationsRef = collection(db, 'artifacts', appId, 'public', 'data', 'reservations');
    
    const unsubscribe = onSnapshot(reservationsRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReservations(data);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching data:", error);
      showToast("Erro ao carregar dados.", "error");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
  };

  const handleCreateReservation = async (reservationData) => {
    try {
      const reservationsRef = collection(db, 'artifacts', appId, 'public', 'data', 'reservations');
      await addDoc(reservationsRef, {
        ...reservationData,
        createdAt: new Date().toISOString()
      });
      showToast("Agendamento confirmado com sucesso!");
      return true;
    } catch (error) {
      console.error("Erro ao agendar:", error);
      showToast("Erro ao processar agendamento.", "error");
      return false;
    }
  };

  const handleDeleteReservation = async (id) => {
    try {
      const docRef = doc(db, 'artifacts', appId, 'public', 'data', 'reservations', id);
      await deleteDoc(docRef);
      showToast("Agendamento cancelado.");
    } catch (error) {
      showToast("Erro ao cancelar.", "error");
    }
  };

  const handleBlockTime = async (date, courtId, startTime, durationMins) => {
    try {
       const reservationsRef = collection(db, 'artifacts', appId, 'public', 'data', 'reservations');
       await addDoc(reservationsRef, {
        date,
        courtId,
        startTime,
        duration: durationMins,
        status: 'blocked',
        customerName: 'BLOQUEIO ADMINISTRATIVO',
        customerPhone: '-',
        price: 0,
        createdAt: new Date().toISOString()
       });
       showToast("Horário bloqueado com sucesso.");
    } catch (error) {
      showToast("Erro ao bloquear horário.", "error");
    }
  };

  if (!user || loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center text-yellow-400">
        <RefreshCw className="animate-spin mb-4" size={48} />
        <h1 className="text-xl font-bold tracking-widest">CARREGANDO ARENA JD...</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-yellow-500 selection:text-black">
      {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      
      {view === 'login' && <LoginScreen setView={setView} />}
      {view === 'admin_login' && <AdminLoginScreen setView={setView} showToast={showToast} />}
      {view === 'customer' && (
        <CustomerBookingScreen reservations={reservations} onSave={handleCreateReservation} setView={setView} />
      )}
      {view === 'admin_dashboard' && (
        <AdminDashboard reservations={reservations} onDelete={handleDeleteReservation} onBlock={handleBlockTime} setView={setView} />
      )}
    </div>
  );
}

// ============================================================================
// LOGIN SCREENS
// ============================================================================

const LoginScreen = ({ setView }) => {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="text-center mb-10">
          <div className="bg-yellow-400 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 shadow-[0_0_30px_rgba(250,204,21,0.3)]">
            <Activity size={40} className="text-zinc-950" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight uppercase">Arena <span className="text-yellow-400">JD</span></h1>
          <p className="text-zinc-400 mt-2 font-medium tracking-wide">Beach Tennis • Agendamentos</p>
        </div>

        <div className="space-y-4">
          <button 
            onClick={() => setView('customer')}
            className="w-full bg-yellow-400 hover:bg-yellow-500 text-zinc-950 font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all transform hover:scale-[1.02] active:scale-95 shadow-xl"
          >
            <CalendarIcon size={24} />
            AGENDAR HORÁRIO
          </button>
          
          <button 
            onClick={() => setView('admin_login')}
            className="w-full bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-white font-bold py-4 rounded-2xl flex items-center justify-center gap-3 transition-all"
          >
            <Lock size={20} className="text-zinc-500" />
            Acesso Restrito (ADM)
          </button>
        </div>
      </div>
    </div>
  );
};

const AdminLoginScreen = ({ setView, showToast }) => {
  const [pwd, setPwd] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (pwd === 'admin123') {
      setView('admin_dashboard');
      showToast('Bem-vindo, Administrador!');
    } else {
      showToast('Senha incorreta!', 'error');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative">
      <button onClick={() => setView('login')} className="absolute top-6 left-6 p-2 bg-zinc-900 rounded-full hover:bg-zinc-800">
        <ArrowLeft size={24} />
      </button>

      <div className="max-w-sm w-full bg-zinc-900 p-8 rounded-3xl border border-zinc-800 shadow-2xl">
        <div className="text-center mb-8">
          <Lock size={40} className="text-yellow-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold">Acesso ADM</h2>
          <p className="text-zinc-400 text-sm mt-1">Insira a credencial administrativa</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-zinc-400 text-sm font-medium mb-2">Senha de Acesso</label>
            <input 
              type="password" 
              value={pwd}
              onChange={(e) => setPwd(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 text-white px-4 py-3 rounded-xl focus:outline-none focus:border-yellow-400 focus:ring-1 focus:ring-yellow-400 transition-all"
              placeholder="••••••••"
              autoFocus
            />
            <p className="text-xs text-zinc-600 mt-2">Dica: a senha padrão é admin123</p>
          </div>
          <button type="submit" className="w-full bg-white text-black font-bold py-3 rounded-xl hover:bg-zinc-200 transition-colors">
            Entrar no Painel
          </button>
        </form>
      </div>
    </div>
  );
};

// ============================================================================
// CUSTOMER BOOKING SCREEN
// ============================================================================

const CustomerBookingScreen = ({ reservations, onSave, setView }) => {
  const [selectedDate, setSelectedDate] = useState(getDayString(new Date()));
  const [selectedCourt, setSelectedCourt] = useState(COURTS[0].id);
  const [bookingModalInfo, setBookingModalInfo] = useState(null);

  const getNextDays = () => {
    const days = [];
    const today = new Date();
    for(let i=0; i<14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push({
        full: getDayString(d),
        dayNum: d.getDate(),
        dayWeek: d.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '').toUpperCase()
      });
    }
    return days;
  };

  const handleTimeClick = (time, isAvailable) => {
    if (!isAvailable) return;
    setBookingModalInfo({ time });
  };

  return (
    <div className="pb-24">
      <header className="sticky top-0 bg-zinc-950/90 backdrop-blur-md border-b border-zinc-900 z-30 px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => setView('login')} className="p-2 bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition">
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-lg font-black tracking-wide"><span className="text-yellow-400">ARENA</span> JD</h1>
            <p className="text-xs text-zinc-500">Agendamento Online</p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 space-y-8 mt-4">
        <section>
          <h2 className="text-sm font-bold text-zinc-400 mb-3 flex items-center gap-2 uppercase tracking-wider">
            <CalendarDays size={16} /> 1. Escolha a Data
          </h2>
          <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide snap-x">
            {getNextDays().map(day => (
              <button 
                key={day.full}
                onClick={() => setSelectedDate(day.full)}
                className={`snap-center flex-shrink-0 w-20 py-3 rounded-2xl border flex flex-col items-center justify-center transition-all ${
                  selectedDate === day.full 
                  ? 'bg-yellow-400 border-yellow-400 text-zinc-950 shadow-[0_0_15px_rgba(250,204,21,0.2)]' 
                  : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600'
                }`}
              >
                <span className="text-xs font-bold mb-1">{day.dayWeek}</span>
                <span className="text-xl font-black">{day.dayNum}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-sm font-bold text-zinc-400 mb-3 flex items-center gap-2 uppercase tracking-wider">
            <MapPin size={16} /> 2. Escolha a Quadra
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {COURTS.map(court => (
              <button
                key={court.id}
                onClick={() => setSelectedCourt(court.id)}
                className={`p-4 rounded-xl border text-left transition-all flex items-center justify-between ${
                  selectedCourt === court.id
                  ? 'bg-zinc-800 border-yellow-400'
                  : 'bg-zinc-900 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                <span className="font-semibold text-sm">{court.name}</span>
                {selectedCourt === court.id && <CheckCircle size={18} className="text-yellow-400" />}
              </button>
            ))}
          </div>
        </section>

        <section>
           <h2 className="text-sm font-bold text-zinc-400 mb-3 flex items-center gap-2 uppercase tracking-wider">
            <Clock size={16} /> 3. Horários Disponíveis
          </h2>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
            {TIME_SLOTS.map(time => {
              const isAvailable = checkAvailability(selectedDate, selectedCourt, time, 30, reservations);
              return (
                <button
                  key={time}
                  disabled={!isAvailable}
                  onClick={() => handleTimeClick(time, isAvailable)}
                  className={`py-3 rounded-xl border text-sm font-bold transition-all flex justify-center items-center ${
                    isAvailable
                    ? 'bg-zinc-900 border-zinc-700 hover:border-yellow-400 hover:text-yellow-400'
                    : 'bg-zinc-950 border-zinc-900 text-zinc-700 cursor-not-allowed opacity-50 relative overflow-hidden'
                  }`}
                >
                  {time}
                  {!isAvailable && (
                    <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 backdrop-blur-[1px]">
                      <Lock size={14} />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </section>
      </main>

      {bookingModalInfo && (
        <BookingFormModal 
          date={selectedDate}
          courtId={selectedCourt}
          startTime={bookingModalInfo.time}
          onClose={() => setBookingModalInfo(null)}
          onSave={onSave}
          reservations={reservations}
        />
      )}
    </div>
  );
};

const BookingFormModal = ({ date, courtId, startTime, onClose, onSave, reservations }) => {
  const courtName = COURTS.find(c => c.id === courtId)?.name;
  const [duration, setDuration] = useState(60);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [obs, setObs] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isDurationValid = useMemo(() => {
    return checkAvailability(date, courtId, startTime, duration, reservations);
  }, [date, courtId, startTime, duration, reservations]);

  const selectedDurationData = DURATIONS.find(d => d.value === duration);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !phone) {
      setError("Preencha nome e telefone.");
      return;
    }
    if (!isDurationValid) {
      setError("Este período possui conflito com outro agendamento.");
      return;
    }

    setIsSubmitting(true);
    const success = await onSave({
      date,
      courtId,
      startTime,
      duration,
      customerName: name,
      customerPhone: phone,
      obs,
      price: selectedDurationData.price,
      status: 'reserved'
    });
    
    if (success) onClose();
    setIsSubmitting(false);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="bg-zinc-900 w-full max-w-md sm:rounded-3xl rounded-t-3xl p-6 shadow-2xl border border-zinc-800 h-[90vh] sm:h-auto overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold">Confirmar Reserva</h3>
          <button onClick={onClose} className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700">
            <X size={20} />
          </button>
        </div>

        <div className="bg-zinc-950 p-4 rounded-xl border border-zinc-800 mb-6 space-y-3 text-sm">
          <div className="flex items-center text-zinc-300 gap-2"><MapPin size={16} className="text-yellow-400"/> {courtName}</div>
          <div className="flex items-center text-zinc-300 gap-2"><CalendarDays size={16} className="text-yellow-400"/> {date.split('-').reverse().join('/')}</div>
          <div className="flex items-center text-zinc-300 gap-2"><Clock size={16} className="text-yellow-400"/> Início às {startTime}</div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-zinc-400 text-xs font-bold uppercase mb-2">Duração da Reserva</label>
            <div className="grid grid-cols-2 gap-2">
              {DURATIONS.map(d => (
                <button
                  key={d.value}
                  type="button"
                  onClick={() => setDuration(d.value)}
                  className={`py-2 rounded-lg text-sm border font-medium transition-all ${
                    duration === d.value 
                    ? 'bg-yellow-400 border-yellow-400 text-black' 
                    : 'bg-zinc-800 border-zinc-700 text-zinc-300 hover:border-zinc-500'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {!isDurationValid && (
              <p className="text-red-400 text-xs mt-2 flex items-center gap-1">
                <AlertCircle size={14} /> Duração indisponível. Conflito de horário.
              </p>
            )}
 
