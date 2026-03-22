/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { 
  Package, Search, Plus, Minus, AlertTriangle, 
  History, LayoutDashboard, X, Save, 
  Filter, ArrowUpRight, ArrowDownLeft, Trash2
} from 'lucide-react';
import { 
  collection, addDoc, updateDoc, deleteDoc, 
  doc, onSnapshot, query, orderBy, serverTimestamp 
} from 'firebase/firestore';
import { db } from './firebase';

// --- TIPI ---
interface InventoryItem {
  id: string;
  type: string;
  format: string;
  weight: string;
  stock: number;
  unit: string;
  minStock: number;
  supplier: string;
  location: string;
  color?: string;
  finish?: string;
  usage?: string;
  notes?: string;
}

interface LogEntry {
  id: string;
  itemId: string;
  user: string;
  action: 'in' | 'out' | 'edit' | 'create';
  qty: string;
  item: string;
  date: string;
  timestamp?: any;
}

// --- COMPONENTE PRINCIPALE ---
export default function App() {
  const [view, setView] = useState('inventory');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    type: "", format: "", weight: "", stock: 0, unit: "risme",
    supplier: "", location: "", minStock: 0, color: "", finish: "",
    usage: "", notes: "", operator: ""
  });

  const [editData, setEditData] = useState<InventoryItem | null>(null);
  const [editOperator, setEditOperator] = useState("");
  const [isDeletingConfirm, setIsDeletingConfirm] = useState(false);
  const [deleteOperator, setDeleteOperator] = useState("");

  // --- CARICA DATI DA FIRESTORE IN TEMPO REALE ---
  useEffect(() => {
    const invUnsub = onSnapshot(collection(db, 'inventory'), (snap) => {
      setInventory(snap.docs.map(d => ({ id: d.id, ...d.data() } as InventoryItem)));
      setLoading(false);
    });

    const logsUnsub = onSnapshot(
      query(collection(db, 'logs'), orderBy('timestamp', 'desc')),
      (snap) => {
        setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as LogEntry)));
      }
    );

    return () => { invUnsub(); logsUnsub(); };
  }, []);

  // --- HELPER LOG ---
  const addLog = async (itemId: string, user: string, action: 'in' | 'out' | 'edit' | 'create', qty: string, itemName: string) => {
    await addDoc(collection(db, 'logs'), {
      itemId, user, action, qty, item: itemName,
      date: new Date().toLocaleString('it-IT', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }),
      timestamp: serverTimestamp()
    });
  };

  // --- AGGIORNA STOCK ---
  const updateStock = async (id: string, delta: number) => {
    const operator = window.prompt("Inserisci il tuo nome per confermare l'operazione:");
    if (!operator) return;
    const item = inventory.find(i => i.id === id);
    if (!item) return;
    const newStock = Math.max(0, item.stock + delta);
    await updateDoc(doc(db, 'inventory', id), { stock: newStock });
    await addLog(id, operator, delta > 0 ? 'in' : 'out', `${Math.abs(delta)} ${item.unit}`, item.type);
  };

  // --- AGGIUNGI PRODOTTO ---
  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.type || !formData.format || !formData.operator) return;

    const docRef = await addDoc(collection(db, 'inventory'), {
      type: formData.type, format: formData.format, weight: formData.weight,
      stock: formData.stock, unit: formData.unit, supplier: formData.supplier,
      location: formData.location, minStock: formData.minStock, color: formData.color,
      finish: formData.finish, usage: formData.usage, notes: formData.notes
    });

    await addLog(docRef.id, formData.operator, 'create', `${formData.stock} ${formData.unit}`, formData.type);
    setIsModalOpen(false);
    setFormData({ type: "", format: "", weight: "", stock: 0, unit: "risme", supplier: "", location: "", minStock: 0, color: "", finish: "", usage: "", notes: "", operator: "" });
  };

  // --- SALVA MODIFICA ---
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editData || !editOperator) return;
    const oldItem = inventory.find(i => i.id === editData.id);
    if (!oldItem) return;

    const { id, ...dataToSave } = editData;
    await updateDoc(doc(db, 'inventory', id), dataToSave);

    if (editData.stock !== oldItem.stock) {
      const diff = editData.stock - oldItem.stock;
      await addLog(id, editOperator, diff > 0 ? 'in' : 'out', `${Math.abs(diff)} ${editData.unit}`, editData.type);
    } else {
      await addLog(id, editOperator, 'edit', "Modifica dettagli", editData.type);
    }

    setSelectedItem(editData);
    setIsEditing(false);
    setEditOperator("");
  };

  // --- ELIMINA PRODOTTO ---
  const deleteItem = async (id: string) => {
    const itemToDelete = inventory.find(i => i.id === id);
    if (!itemToDelete || !deleteOperator) {
      alert("Inserisci il nome dell'operatore per confermare l'eliminazione.");
      return;
    }
    await deleteDoc(doc(db, 'inventory', id));
    await addLog(id, deleteOperator, 'out', "Eliminato", itemToDelete.type);
    setSelectedItem(null);
    setIsDeletingConfirm(false);
    setDeleteOperator("");
  };

  const filteredInventory = inventory.filter(item => 
    item.type.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.supplier?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.format.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.location?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (item.color && item.color.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (item.usage && item.usage.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#F9FAFB]">
      <div className="text-center">
        <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
          <Package size={24} className="text-white" />
        </div>
        <p className="text-slate-500 text-sm font-medium">Caricamento PaperFlow...</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-[#F9FAFB] text-slate-900 font-sans pb-16 md:pb-0">
      
      {/* SIDEBAR (Desktop) */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-gray-200 p-6 sticky top-0 h-screen">
        <div className="flex items-center gap-3 mb-10 px-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white">
            <Package size={20} />
          </div>
          <span className="text-xl font-bold tracking-tight">PaperFlow</span>
        </div>
        <nav className="space-y-1">
          <NavItem active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard size={20}/>} label="Dashboard" />
          <NavItem active={view === 'inventory'} onClick={() => setView('inventory')} icon={<Package size={20}/>} label="Magazzino" />
          <NavItem active={view === 'logs'} onClick={() => setView('logs')} icon={<History size={20}/>} label="Cronologia" />
        </nav>
        <div className="mt-auto p-4 bg-blue-50 rounded-2xl">
          <p className="text-xs font-bold text-blue-600 uppercase mb-1">Status Sistema</p>
          <p className="text-sm text-blue-800">Database cloud attivo ✓</p>
        </div>
      </aside>

      {/* MOBILE NAVIGATION */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around items-center h-16 z-40 px-2">
        <MobileNavItem active={view === 'dashboard'} onClick={() => setView('dashboard')} icon={<LayoutDashboard size={20}/>} label="Home" />
        <MobileNavItem active={view === 'inventory'} onClick={() => setView('inventory')} icon={<Package size={20}/>} label="Stock" />
        <MobileNavItem active={view === 'logs'} onClick={() => setView('logs')} icon={<History size={20}/>} label="Log" />
        <button onClick={() => setIsModalOpen(true)} className="flex flex-col items-center justify-center text-blue-600">
          <div className="bg-blue-600 text-white p-2 rounded-full -mt-8 shadow-lg shadow-blue-500/40 border-4 border-[#F9FAFB]">
            <Plus size={24} />
          </div>
          <span className="text-[10px] font-bold mt-1 uppercase">Aggiungi</span>
        </button>
      </nav>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 md:px-8 sticky top-0 z-30">
          <div className="flex md:hidden items-center gap-2 mr-4">
            <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center text-white">
              <Package size={16} />
            </div>
            <span className="font-bold text-sm">PaperFlow</span>
          </div>
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input 
              type="text" placeholder="Cerca..." 
              className="w-full pl-9 pr-10 py-2 bg-gray-50 border-none rounded-xl text-xs sm:text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
              value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-slate-600 transition-colors">
                <X size={14} />
              </button>
            )}
          </div>
          <div className="hidden md:flex items-center gap-4 ml-4">
            <button onClick={() => setIsModalOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-blue-500/20">
              <Plus size={20} />
              <span className="font-medium text-sm">Nuovo Arrivo</span>
            </button>
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-6 md:p-8">
          {view === 'dashboard' && (
            <div className="space-y-6">
              <h1 className="text-xl sm:text-2xl font-bold">Dashboard</h1>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                <StatCard label="Totale Articoli" value={inventory.length} />
                <StatCard label="Sottoscorta" value={inventory.filter(i => i.stock <= i.minStock).length} color="text-amber-500" />
                <StatCard label="Movimenti Totali" value={logs.length} color="text-blue-600" />
              </div>
            </div>
          )}

          {view === 'inventory' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold">Giacenze Magazzino</h1>
                  <p className="text-slate-500 text-xs sm:text-sm">Gestisci e monitora i lotti di carta disponibili.</p>
                </div>
              </div>
              {filteredInventory.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                  <Package size={40} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-slate-400 font-medium">Nessun articolo in magazzino.</p>
                  <p className="text-slate-300 text-sm mt-1">Clicca "Nuovo Arrivo" per aggiungere il primo prodotto.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                  {filteredInventory.map(item => (
                    <InventoryCard key={item.id} item={item} onUpdate={updateStock} onClick={() => setSelectedItem(item)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {view === 'logs' && (
            <div className="max-w-4xl mx-auto space-y-6">
              <h1 className="text-xl sm:text-2xl font-bold">Cronologia Movimenti</h1>
              {logs.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-200">
                  <History size={40} className="mx-auto text-gray-300 mb-4" />
                  <p className="text-slate-400 font-medium">Nessun movimento registrato.</p>
                </div>
              ) : (
                <div className="bg-white rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm overflow-hidden">
                  {logs.map((log, i) => (
                    <div key={log.id} className={`p-3 sm:p-4 flex items-center justify-between ${i !== 0 ? 'border-t border-gray-50' : ''}`}>
                      <div className="flex items-center gap-3 sm:gap-4">
                        <div className={`p-1.5 sm:p-2 rounded-full ${log.action === 'out' ? 'bg-red-50 text-red-600' : log.action === 'in' ? 'bg-emerald-50 text-emerald-600' : log.action === 'create' ? 'bg-blue-50 text-blue-600' : 'bg-amber-50 text-amber-600'}`}>
                          {log.action === 'out' ? <ArrowDownLeft size={18}/> : log.action === 'in' ? <ArrowUpRight size={18}/> : log.action === 'create' ? <Plus size={18}/> : <History size={18}/>}
                        </div>
                        <div>
                          <p className="text-xs sm:text-sm font-semibold">
                            {log.user}
                            <span className="font-normal text-slate-500 hidden sm:inline ml-1">
                              {log.action === 'out' ? (log.qty === 'Eliminato' ? 'ha eliminato' : 'ha prelevato') : log.action === 'in' ? 'ha caricato' : log.action === 'create' ? 'ha creato' : 'ha modificato'}
                            </span>
                          </p>
                          <p className="text-[10px] sm:text-xs text-blue-600 font-bold uppercase truncate max-w-[120px] sm:max-w-none">{log.item}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm sm:text-base font-bold ${log.action === 'out' ? 'text-red-600' : log.action === 'in' ? 'text-emerald-600' : log.action === 'create' ? 'text-blue-600' : 'text-amber-600'}`}>
                          {log.action === 'edit' ? 'Modifica' : log.action === 'create' ? 'Nuovo' : `${log.action === 'out' ? '-' : '+'} ${log.qty}`}
                        </p>
                        <p className="text-[9px] sm:text-[10px] text-slate-400 uppercase font-bold tracking-tighter">{log.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* MODAL INSERIMENTO */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full sm:max-w-md bg-white h-full shadow-2xl p-6 sm:p-8 flex flex-col">
            <div className="flex justify-between items-center mb-6 sm:mb-8">
              <h2 className="text-xl font-bold">Nuovo Prodotto</h2>
              <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full"><X size={20}/></button>
            </div>
            <form className="flex-1 flex flex-col overflow-hidden" onSubmit={handleAddItem}>
              <div className="flex-1 overflow-y-auto space-y-5 sm:space-y-6 pr-1">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">Dettagli Carta</label>
                  <div className="mb-3">
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Tipo Carta</label>
                    <input type="text" placeholder="es. Patinata Opaca" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:border-blue-200 transition-all" value={formData.type} onChange={(e) => setFormData({...formData, type: e.target.value})} required />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Formato</label>
                      <input type="text" placeholder="es. 70x100" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:border-blue-200 transition-all" value={formData.format} onChange={(e) => setFormData({...formData, format: e.target.value})} required />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Grammatura</label>
                      <input type="number" placeholder="es. 150" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:border-blue-200 transition-all" value={formData.weight} onChange={(e) => setFormData({...formData, weight: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Colore</label>
                      <input type="text" placeholder="es. Bianco" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:border-blue-200 transition-all" value={formData.color} onChange={(e) => setFormData({...formData, color: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Finitura</label>
                      <input type="text" placeholder="es. Lucida" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:border-blue-200 transition-all" value={formData.finish} onChange={(e) => setFormData({...formData, finish: e.target.value})} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Fornitore</label>
                      <input type="text" placeholder="Fornitore" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:border-blue-200 transition-all" value={formData.supplier} onChange={(e) => setFormData({...formData, supplier: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Posizione</label>
                      <input type="text" placeholder="es. A1" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:border-blue-200 transition-all" value={formData.location} onChange={(e) => setFormData({...formData, location: e.target.value})} />
                    </div>
                  </div>
                  <div className="mt-3">
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Uso Previsto</label>
                    <input type="text" placeholder="es. Biglietti da visita" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:border-blue-200 transition-all" value={formData.usage} onChange={(e) => setFormData({...formData, usage: e.target.value})} />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">Giacenza e Alert</label>
                  <div className="flex gap-3 mb-3">
                    <div className="flex-1">
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Giacenza Iniziale</label>
                      <div className="flex gap-2">
                        <input type="number" placeholder="0" className="flex-1 p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:border-blue-200 transition-all" value={formData.stock === 0 ? "" : formData.stock} onChange={(e) => setFormData({...formData, stock: e.target.value === "" ? 0 : parseInt(e.target.value) || 0})} />
                        <select className="bg-gray-50 border border-gray-100 rounded-xl p-3 outline-none" value={formData.unit} onChange={(e) => setFormData({...formData, unit: e.target.value})}>
                          <option value="risme">Risme</option>
                          <option value="fogli">Fogli</option>
                        </select>
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Soglia Minima (Alert Scorta Bassa)</label>
                    <input type="number" placeholder="5" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:border-blue-200 transition-all" value={formData.minStock === 0 ? "" : formData.minStock} onChange={(e) => setFormData({...formData, minStock: e.target.value === "" ? 0 : parseInt(e.target.value) || 0})} />
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">Note e Appunti</label>
                  <textarea placeholder="Inserisci qui eventuali note..." className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none h-24 resize-none" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-2 tracking-widest">Operatore</label>
                  <input type="text" placeholder="Il tuo nome" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none focus:bg-white focus:border-blue-200 transition-all" value={formData.operator} onChange={(e) => setFormData({...formData, operator: e.target.value})} required />
                </div>
              </div>
              <div className="pt-6 border-t border-gray-100 mt-auto">
                <button type="submit" className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all flex items-center justify-center gap-2">
                  <Save size={20} /> Salva in Inventario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DETTAGLI PRODOTTO */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/60 backdrop-blur-sm">
          <div className="w-full sm:max-w-xl bg-white h-full shadow-2xl p-6 sm:p-8 flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">{isEditing ? 'Modifica Prodotto' : 'Dettagli Prodotto'}</h2>
              <button onClick={() => { setSelectedItem(null); setIsEditing(false); }} className="p-2 hover:bg-gray-100 rounded-full"><X size={20}/></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-8">
              {isEditing ? (
                <form id="editForm" onSubmit={handleSaveEdit} className="space-y-6">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Tipo Carta</label>
                      <input type="text" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none" value={editData?.type || ""} onChange={(e) => setEditData(prev => prev ? {...prev, type: e.target.value} : null)} required />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Formato</label>
                        <input type="text" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none" value={editData?.format || ""} onChange={(e) => setEditData(prev => prev ? {...prev, format: e.target.value} : null)} required />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Grammatura</label>
                        <input type="number" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none" value={editData?.weight || ""} onChange={(e) => setEditData(prev => prev ? {...prev, weight: e.target.value} : null)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Colore</label>
                        <input type="text" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none" value={editData?.color || ""} onChange={(e) => setEditData(prev => prev ? {...prev, color: e.target.value} : null)} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Finitura</label>
                        <input type="text" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none" value={editData?.finish || ""} onChange={(e) => setEditData(prev => prev ? {...prev, finish: e.target.value} : null)} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Uso Previsto</label>
                      <input type="text" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none" value={editData?.usage || ""} onChange={(e) => setEditData(prev => prev ? {...prev, usage: e.target.value} : null)} />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Giacenza</label>
                        <input type="number" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none" value={editData?.stock === 0 ? "" : editData?.stock} onChange={(e) => setEditData(prev => prev ? {...prev, stock: e.target.value === "" ? 0 : parseInt(e.target.value) || 0} : null)} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Soglia Minima</label>
                        <input type="number" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none" value={editData?.minStock === 0 ? "" : editData?.minStock} onChange={(e) => setEditData(prev => prev ? {...prev, minStock: e.target.value === "" ? 0 : parseInt(e.target.value) || 0} : null)} />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Fornitore</label>
                        <input type="text" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none" value={editData?.supplier || ""} onChange={(e) => setEditData(prev => prev ? {...prev, supplier: e.target.value} : null)} />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Posizione</label>
                        <input type="text" className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none" value={editData?.location || ""} onChange={(e) => setEditData(prev => prev ? {...prev, location: e.target.value} : null)} />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Note</label>
                      <textarea className="w-full p-3 bg-gray-50 border border-gray-100 rounded-xl outline-none h-24 resize-none" value={editData?.notes || ""} onChange={(e) => setEditData(prev => prev ? {...prev, notes: e.target.value} : null)} />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Operatore (Richiesto)</label>
                      <input type="text" placeholder="Tuo nome" className="w-full p-3 bg-blue-50 border border-blue-100 rounded-xl outline-none" value={editOperator} onChange={(e) => setEditOperator(e.target.value)} required />
                    </div>
                  </div>
                </form>
              ) : (
                <>
                  <div className="bg-slate-50 rounded-3xl p-6 border border-slate-100">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 bg-blue-100 px-2 py-1 rounded-md">
                          {selectedItem.format} • {selectedItem.weight ? (selectedItem.weight.toLowerCase().includes('g') ? selectedItem.weight : `${selectedItem.weight} g/m²`) : 'N/D'}
                        </span>
                        <h3 className="text-2xl font-black mt-2 text-slate-900">{selectedItem.type}</h3>
                        <p className="text-sm text-slate-500 font-medium">
                          {selectedItem.supplier}{selectedItem.finish && ` • ${selectedItem.finish}`}{selectedItem.color && ` • ${selectedItem.color}`}{` • Posizione: ${selectedItem.location}`}
                        </p>
                        <div className="mt-4 grid grid-cols-2 gap-4">
                          {selectedItem.color && <div><p className="text-[9px] uppercase font-bold text-slate-400">Colore</p><p className="text-sm font-bold text-slate-700">{selectedItem.color}</p></div>}
                          {selectedItem.finish && <div><p className="text-[9px] uppercase font-bold text-slate-400">Finitura</p><p className="text-sm font-bold text-slate-700">{selectedItem.finish}</p></div>}
                          {selectedItem.usage && <div className="col-span-2"><p className="text-[9px] uppercase font-bold text-slate-400">Uso Previsto</p><p className="text-sm font-bold text-slate-700">{selectedItem.usage}</p></div>}
                          {selectedItem.notes && <div className="col-span-2 pt-2 border-t border-slate-200"><p className="text-[9px] uppercase font-bold text-slate-400">Note</p><p className="text-xs text-slate-600 italic whitespace-pre-wrap">{selectedItem.notes}</p></div>}
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-tighter">Giacenza Attuale</p>
                        <p className={`text-3xl font-black ${selectedItem.stock <= selectedItem.minStock ? 'text-amber-500' : 'text-slate-900'}`}>
                          {selectedItem.stock} <span className="text-sm font-bold text-slate-500 uppercase">{selectedItem.unit}</span>
                        </p>
                        {selectedItem.stock <= selectedItem.minStock && (
                          <p className="text-[9px] font-bold text-amber-600 uppercase mt-1 flex items-center justify-end gap-1">
                            <AlertTriangle size={10} /> Sottoscorta (Min: {selectedItem.minStock})
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold uppercase text-slate-400 mb-4 tracking-widest flex items-center gap-2">
                      <History size={16} /> Cronologia Articolo
                    </h4>
                    <div className="space-y-3">
                      {logs.filter(l => l.itemId === selectedItem.id).length > 0 ? (
                        logs.filter(l => l.itemId === selectedItem.id).map(log => (
                          <div key={log.id} className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-2xl shadow-sm">
                            <div className="flex items-center gap-3">
                              <div className={`p-1.5 rounded-full ${log.action === 'out' ? 'bg-red-50 text-red-600' : log.action === 'in' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                                {log.action === 'out' ? <ArrowDownLeft size={16}/> : log.action === 'in' ? <ArrowUpRight size={16}/> : <History size={16}/>}
                              </div>
                              <div>
                                <p className="text-xs font-bold">{log.user}</p>
                                <p className="text-[10px] text-slate-500">{log.date}</p>
                              </div>
                            </div>
                            <p className={`text-sm font-bold ${log.action === 'out' ? 'text-red-600' : log.action === 'in' ? 'text-emerald-600' : 'text-blue-600'}`}>
                              {log.action === 'edit' ? 'Modifica' : log.action === 'create' ? 'Creato' : `${log.action === 'out' ? '-' : '+'} ${log.qty}`}
                            </p>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                          <p className="text-xs text-slate-400 font-medium italic">Nessun movimento registrato per questo articolo.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="pt-6 border-t border-gray-100 mt-auto flex flex-col gap-3">
              {isEditing ? (
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setIsEditing(false)} className="py-4 bg-gray-100 text-slate-600 rounded-2xl font-bold hover:bg-gray-200 transition-all">Annulla</button>
                  <button form="editForm" type="submit" className="py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all">Salva Modifiche</button>
                </div>
              ) : isDeletingConfirm ? (
                <div className="bg-red-50 p-6 rounded-3xl border border-red-100">
                  <p className="text-sm font-bold text-red-700 mb-4 text-center">Conferma Eliminazione Definitiva</p>
                  <input type="text" placeholder="Tuo nome per confermare" className="w-full p-3 bg-white border border-red-200 rounded-xl outline-none mb-3 text-sm" value={deleteOperator} onChange={(e) => setDeleteOperator(e.target.value)} />
                  <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => { setIsDeletingConfirm(false); setDeleteOperator(""); }} className="py-3 bg-white text-slate-600 border border-gray-200 rounded-xl font-bold text-sm">Annulla</button>
                    <button onClick={() => deleteItem(selectedItem.id)} className="py-3 bg-red-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-red-500/30">Elimina Ora</button>
                  </div>
                </div>
              ) : (
                <>
                  <button onClick={() => { setEditData({...selectedItem}); setIsEditing(true); }} className="w-full py-4 bg-blue-50 text-blue-600 rounded-2xl font-bold hover:bg-blue-100 transition-all flex items-center justify-center gap-2">
                    <History size={20} /> Modifica Prodotto / Scorte
                  </button>
                  <button onClick={() => setIsDeletingConfirm(true)} className="w-full py-4 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-all flex items-center justify-center gap-2">
                    <Trash2 size={20} /> Elimina Scheda Prodotto
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// --- SOTTO-COMPONENTI UI ---
function StatCard({ label, value, color = "text-slate-900" }: { label: string, value: number, color?: string }) {
  return (
    <div className="bg-white p-5 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-sm">
      <p className="text-slate-500 text-xs sm:text-sm font-medium">{label}</p>
      <p className={`text-2xl sm:text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

interface NavItemProps { icon: React.ReactNode; label: string; active: boolean; onClick: () => void; }

function MobileNavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center justify-center flex-1 py-1 transition-all ${active ? 'text-blue-600' : 'text-slate-400'}`}>
      {icon}
      <span className="text-[10px] font-bold mt-1 uppercase tracking-tighter">{label}</span>
    </button>
  );
}

function NavItem({ icon, label, active, onClick }: NavItemProps) {
  return (
    <button onClick={onClick} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${active ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-500 hover:bg-gray-50 hover:text-slate-900'}`}>
      {icon}
      <span className="text-sm">{label}</span>
    </button>
  );
}

interface InventoryCardProps { item: InventoryItem; onUpdate: (id: string, delta: number) => void; onClick: () => void; }

function InventoryCard({ item, onUpdate, onClick }: InventoryCardProps) {
  const isLow = item.stock <= item.minStock;
  return (
    <div onClick={onClick} className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer active:scale-[0.98]">
      <div className="flex justify-between items-start mb-6">
        <div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-blue-600 bg-blue-50 px-2 py-1 rounded-md">
            {item.format} • {item.weight ? (item.weight.toLowerCase().includes('g') ? item.weight : `${item.weight} g/m²`) : 'N/D'}
          </span>
          <h3 className="text-lg font-bold mt-2 text-slate-800">{item.type}</h3>
          <p className="text-xs text-slate-400 font-medium">
            {item.supplier}{item.finish && ` • ${item.finish}`}{item.color && ` • ${item.color}`}{` • Posizione: ${item.location}`}
          </p>
        </div>
        {isLow && <AlertTriangle className="text-amber-500" size={20} />}
      </div>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-tighter">Disponibilità</p>
          <div className="flex items-baseline gap-1">
            <span className={`text-3xl font-black ${isLow ? 'text-amber-500' : 'text-slate-900'}`}>{item.stock}</span>
            <span className="text-slate-500 text-xs font-bold uppercase">{item.unit}</span>
          </div>
        </div>
      </div>
      {isLow && (
        <div className="mt-4 p-2 bg-amber-50 rounded-xl flex items-center gap-2 text-[10px] font-bold text-amber-700 uppercase">
          <AlertTriangle size={12}/> Sottoscorta
        </div>
      )}
    </div>
  );
}