import { useState } from 'react';
import { motion, AnimatePresence, Reorder, useDragControls } from 'framer-motion';
import { GripVertical } from 'lucide-react';
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
  const { references, addReference, updateReference, deleteReference, reorderReferences } = useReferencesStore();
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

  const isEditing = !!editingId || adding;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-40" style={{ background: 'rgba(40,30,22,.35)' }}
            onClick={onClose}
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{ y }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[85vh] max-w-[480px] flex-col border-t-2 border-ink bg-paper"
          >
            {/* Header */}
            <div {...bind()} className="touch-none px-5 pt-4 pb-3">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="font-serif text-[22px] text-ink">Références de volants</span>
                  {!isEditing && <p className="mt-0.5 text-[11px] text-ink-55">Maintenez pour réordonner</p>}
                </div>
                <button onClick={onClose} className="font-mono text-[10px] font-medium tracking-kpi text-ink-45">
                  FERMER
                </button>
              </div>
            </div>

            {/* Reorderable list */}
            <div className="flex-1 overflow-y-auto px-5 pb-2">
              <Reorder.Group as="div" axis="y" values={references} onReorder={reorderReferences}>
                {references.map((ref) =>
                  editingId === ref.id ? (
                    <Reorder.Item as="div" key={ref.id} value={ref} drag={false} className="py-2">
                      <RefForm
                        form={form}
                        setForm={(f) => { setForm(f); setError(''); }}
                        onSave={handleSaveEdit}
                        onCancel={resetState}
                        error={error}
                      />
                    </Reorder.Item>
                  ) : (
                    <DraggableRefRow
                      key={ref.id}
                      ref_={ref}
                      dragDisabled={isEditing}
                      onEdit={() => startEdit(ref)}
                      onDelete={() => deleteReference(ref.id)}
                    />
                  )
                )}
              </Reorder.Group>

              {adding && (
                <div className="py-2">
                  <RefForm
                    form={form}
                    setForm={(f) => { setForm(f); setError(''); }}
                    onSave={handleAdd}
                    onCancel={resetState}
                    isNew
                    error={error}
                  />
                </div>
              )}
            </div>

            {/* Add button */}
            {!adding && !editingId && (
              <div className="px-5 py-4 pb-safe">
                <button
                  onClick={startAdd}
                  className="w-full border-[1.5px] border-dashed border-ink-45 py-3 text-[12px] text-ink-45 transition-colors hover:border-ink hover:text-ink"
                >
                  + Ajouter une référence
                </button>
              </div>
            )}
            {(adding || editingId) && <div className="pb-safe h-4" />}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// Draggable row using useDragControls so only the handle triggers the drag
function DraggableRefRow({
  ref_,
  dragDisabled,
  onEdit,
  onDelete,
}: {
  ref_: ProductReference;
  dragDisabled: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const controls = useDragControls();

  return (
    <Reorder.Item as="div" value={ref_} dragControls={controls} dragListener={false} className="touch-none">
      <div className="flex items-center gap-3 border-b border-dotted border-ink-dot py-2.5 select-none">
        {/* Drag handle */}
        <div
          onPointerDown={dragDisabled ? undefined : (e) => controls.start(e)}
          className={cn(
            'flex-shrink-0',
            dragDisabled ? 'text-ink-30' : 'cursor-grab text-ink-40 active:cursor-grabbing hover:text-ink'
          )}
        >
          <GripVertical className="w-4 h-4" />
        </div>

        {/* Color dot */}
        <div className="h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: getColorHex(ref_.color) }} />

        {/* Name + price */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium text-ink">{ref_.name}</p>
          <p className="font-mono text-[10px] text-ink-45">{ref_.price} € / boîte</p>
        </div>

        {/* Actions */}
        <div className="flex flex-shrink-0 items-center gap-3 font-mono text-[9px] tracking-label">
          <button onPointerDown={(e) => e.stopPropagation()} onClick={onEdit} className="text-ink-45 hover:text-ink">
            MODIF.
          </button>
          {!ref_.isDefault && (
            <button onPointerDown={(e) => e.stopPropagation()} onClick={onDelete} className="text-ink-45 hover:text-alert">
              SUPPR.
            </button>
          )}
        </div>
      </div>
    </Reorder.Item>
  );
}

// Form for add / edit
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
    <div className="space-y-3 border-[1.5px] border-ink p-4">
      <div className="flex gap-2">
        <input
          autoFocus
          type="text"
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && onSave()}
          placeholder="Nom (ex: Yonex AS50)"
          className="flex-1 border-b border-ink bg-transparent px-1 py-2 text-[13px] text-ink placeholder:text-ink-40 focus:outline-none"
        />
        <div className="relative flex w-20 items-center">
          <input
            type="number"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && onSave()}
            placeholder="Prix"
            min="0"
            step="0.5"
            className="w-full border-b border-ink bg-transparent px-1 py-2 pr-5 text-[13px] text-ink placeholder:text-ink-40 focus:outline-none"
          />
          <span className="pointer-events-none absolute right-0 text-[11px] text-ink-45">€</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(COLOR_OPTIONS as readonly { id: string; label: string; hex: string }[]).map((opt) => (
          <button
            key={opt.id}
            type="button"
            onClick={() => setForm({ ...form, color: opt.id })}
            className={cn(
              'h-6 w-6 rounded-full border-2 transition-all active:scale-95',
              form.color === opt.id ? 'border-ink scale-110' : 'border-transparent'
            )}
            style={{ backgroundColor: opt.hex }}
            title={opt.label}
          />
        ))}
      </div>

      {error && <p className="text-[11px] text-alert">{error}</p>}

      <div className="flex gap-4 font-mono text-[10px] tracking-label">
        <button type="button" onClick={onCancel} className="text-ink-45 hover:text-ink">ANNULER</button>
        <button type="button" onClick={onSave} className="font-semibold text-ink">
          {isNew ? 'AJOUTER' : 'ENREGISTRER'}
        </button>
      </div>
    </div>
  );
}
