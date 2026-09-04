import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Trash2, Check, Pencil } from 'lucide-react';
import { useReferencesStore } from '@/stores/referencesStore';
import { useModalGestures } from '@/hooks/useModalGestures';
import { COLOR_OPTIONS, getColorHex, type ProductReference } from '@/types';
import { cn } from '@/lib/utils';

interface ReferenceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface FormState {
  name: string;
  price: string;
  color: string;
}

const EMPTY_FORM: FormState = { name: '', price: '', color: 'purple' };

export function ReferenceModal({ isOpen, onClose }: ReferenceModalProps) {
  const { references, addReference, updateReference, deleteReference } = useReferencesStore();
  const { y, bind } = useModalGestures(isOpen, onClose);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [error, setError] = useState('');

  const resetState = () => {
    setEditingId(null);
    setAdding(false);
    setForm(EMPTY_FORM);
    setError('');
  };

  const validateForm = (): boolean => {
    if (!form.name.trim()) { setError('Nom requis'); return false; }
    const price = parseFloat(form.price.replace(',', '.'));
    if (isNaN(price) || price <= 0) { setError('Prix invalide'); return false; }
    return true;
  };

  const handleAdd = () => {
    if (!validateForm()) return;
    addReference({ name: form.name.trim(), price: parseFloat(form.price.replace(',', '.')), color: form.color });
    resetState();
  };

  const handleSaveEdit = () => {
    if (!editingId || !validateForm()) return;
    updateReference(editingId, { name: form.name.trim(), price: parseFloat(form.price.replace(',', '.')), color: form.color });
    resetState();
  };

  const startEdit = (ref: ProductReference) => {
    setEditingId(ref.id);
    setAdding(false);
    setForm({ name: ref.name, price: String(ref.price), color: ref.color });
    setError('');
  };

  const startAdd = () => {
    setAdding(true);
    setEditingId(null);
    setForm(EMPTY_FORM);
    setError('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{ y }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-surface-900 rounded-t-3xl border-t border-white/10 max-h-[85vh] flex flex-col"
          >
            {/* Handle */}
            <div {...bind()} className="touch-none px-6 pt-5">
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-6 pb-4">
              <h3 className="font-semibold text-white text-sm">Références de volants</h3>
              <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto px-6 space-y-2 pb-2">
              {references.map((ref) =>
                editingId === ref.id ? (
                  <RefForm
                    key={ref.id}
                    form={form}
                    setForm={(f) => { setForm(f); setError(''); }}
                    onSave={handleSaveEdit}
                    onCancel={resetState}
                    error={error}
                  />
                ) : (
                  <div
                    key={ref.id}
                    className="flex items-center gap-3 bg-surface-800/50 rounded-2xl px-4 py-3 border border-white/6"
                  >
                    <div
                      className="w-3 h-3 rounded-full flex-shrink-0"
                      style={{ backgroundColor: getColorHex(ref.color) }}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{ref.name}</p>
                      <p className="text-xs text-gray-400">{ref.price} € / boîte</p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => startEdit(ref)}
                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-xl transition-colors"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      {!ref.isDefault && (
                        <button
                          onClick={() => deleteReference(ref.id)}
                          className="p-2 text-gray-400 hover:text-danger-400 hover:bg-danger-500/10 rounded-xl transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              )}

              {adding && (
                <RefForm
                  form={form}
                  setForm={(f) => { setForm(f); setError(''); }}
                  onSave={handleAdd}
                  onCancel={resetState}
                  isNew
                  error={error}
                />
              )}
            </div>

            {/* Add button */}
            {!adding && !editingId && (
              <div className="px-6 py-4" style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.5rem)' }}>
                <button
                  onClick={startAdd}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-white/20 text-gray-400 hover:text-white hover:border-white/40 transition-all text-sm active:scale-98"
                >
                  <Plus className="w-4 h-4" />
                  Ajouter une référence
                </button>
              </div>
            )}
            {(adding || editingId) && (
              <div className="pb-safe h-4" />
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

interface RefFormProps {
  form: FormState;
  setForm: (f: FormState) => void;
  onSave: () => void;
  onCancel: () => void;
  isNew?: boolean;
  error?: string;
}

function RefForm({ form, setForm, onSave, onCancel, isNew, error }: RefFormProps) {
  return (
    <div className="bg-surface-800 rounded-2xl p-4 border border-primary-600/40 space-y-3">
      {/* Name + price */}
      <div className="flex gap-2">
        <input
          autoFocus
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && onSave()}
          placeholder="Nom (ex: Yonex AS50)"
          className="flex-1 bg-surface-900 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-600/40"
        />
        <div className="relative flex items-center w-24">
          <input
            type="number"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && onSave()}
            placeholder="Prix"
            min="0"
            step="0.5"
            className="w-full bg-surface-900 border border-white/10 rounded-xl px-3 py-2.5 pr-6 text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-600/40"
          />
          <span className="absolute right-3 text-gray-400 text-xs pointer-events-none">€</span>
        </div>
      </div>

      {/* Color picker */}
      <div className="flex gap-2 flex-wrap">
        {(COLOR_OPTIONS as readonly { id: string; label: string; hex: string }[]).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setForm({ ...form, color: opt.id })}
            className={cn(
              'w-7 h-7 rounded-full transition-all border-2 active:scale-95',
              form.color === opt.id ? 'border-white scale-110' : 'border-transparent'
            )}
            style={{ backgroundColor: opt.hex }}
            title={opt.label}
          />
        ))}
      </div>

      {error && <p className="text-xs text-danger-400">{error}</p>}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white border border-white/10 hover:bg-white/5 transition-colors"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={onSave}
          className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-primary-600 text-white hover:bg-primary-500 transition-colors flex items-center justify-center gap-1.5 active:scale-98"
        >
          <Check className="w-3.5 h-3.5" />
          {isNew ? 'Ajouter' : 'Enregistrer'}
        </button>
      </div>
    </div>
  );
}
