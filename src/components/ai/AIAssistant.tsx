import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mic, MicOff, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useAIChat } from '@/hooks/useSales';
import { useModalGestures } from '@/hooks/useModalGestures';
import { useReferencesStore } from '@/stores/referencesStore';
import { cn } from '@/lib/utils';

const PLACEHOLDER = [
  'Vente : « 2 CBX RED pour Lucas, payé Square »',
  'Stock : « reçu 20 boites Victor GM »',
  'Réf : « nouvelle référence Yonex AS50 à 25€ »',
  'Modif : « les boites de Paul sont payées site internet »',
].join('\n');

// Detect "nouvelle référence [name] à [price]€"
const REF_REGEX =
  /(?:nouvelle?\s+réf(?:érence)?|ajouter?\s+(?:une?\s+)?(?:réf(?:érence)?|boite?|volant))\s+(.+?)\s+(?:à|a|:)?\s*(\d+(?:[,\.]\d+)?)\s*€?/i;

interface AIAssistantProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export function AIAssistant({ isOpen, onClose, onSuccess, onError }: AIAssistantProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { mutateAsync: sendChat, isPending } = useAIChat();
  const { addReference } = useReferencesStore();
  const { y, bind } = useModalGestures(isOpen, onClose);

  const { isListening, transcript, isSupported, start, stop, reset } = useVoiceInput((final) => {
    setText(final);
  });

  const handleSend = async () => {
    const message = (isListening ? transcript : text).trim();
    if (!message) return;

    // Local: add reference
    const refMatch = message.match(REF_REGEX);
    if (refMatch) {
      const name = refMatch[1].trim();
      const price = parseFloat(refMatch[2].replace(',', '.'));
      if (name && !isNaN(price) && price > 0) {
        addReference({ name, price, color: 'purple' });
        onSuccess(`Référence « ${name} » ajoutée à ${price} € !`);
        setText(''); reset(); onClose();
        return;
      }
    }

    // Send to backend
    try {
      const result = await sendChat(message);
      if (result.success) {
        const msg = result.message ?? (
          result.action === 'modifier'       ? 'Vente(s) mise(s) à jour ✓'        :
          result.action === 'vente'          ? 'Vente(s) ajoutée(s) ✓'            :
          result.action === 'square_payment' ? 'Vente enregistrée · Square ✓'    :
          result.action === 'stock_update'   ? 'Stock mis à jour ✓'               :
          'Enregistré !'
        );
        onSuccess(msg);
        setText(''); reset(); onClose();
      } else {
        onError('Erreur lors de l\'envoi');
      }
    } catch {
      onError('Erreur réseau');
    }
  };

  const displayValue = isListening ? transcript : text;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{ y }}
            className="fixed bottom-0 left-0 right-0 z-50 bg-surface-900 rounded-t-3xl border-t border-white/10 p-6 pb-safe"
          >
            {/* Handle */}
            <div {...bind()} className="touch-none">
              <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary-500" />
                <h3 className="font-semibold text-white text-sm">Assistant IA</h3>
              </div>
              <button onClick={onClose} className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/10">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={displayValue}
              onChange={(e) => !isListening && setText(e.target.value)}
              placeholder={PLACEHOLDER}
              rows={4}
              className={cn(
                'w-full bg-surface-800 border border-white/10 rounded-2xl px-4 py-3 text-white text-base',
                'placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-600/40 resize-none',
                isListening && 'border-primary-600/60 ring-2 ring-primary-600/30'
              )}
            />

            {/* Voice indicator */}
            {isListening && (
              <div className="flex items-center gap-2 mt-2 text-xs text-primary-400">
                <span className="w-1.5 h-1.5 bg-primary-500 rounded-full animate-pulse" />
                Écoute en cours…
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 mt-4">
              {isSupported && (
                <button
                  onClick={isListening ? stop : start}
                  className={cn(
                    'w-11 h-11 rounded-2xl flex items-center justify-center transition-all',
                    isListening
                      ? 'bg-danger-600/20 text-danger-500 ring-2 ring-danger-500/30'
                      : 'bg-surface-800 text-gray-400 border border-white/10'
                  )}
                  aria-label={isListening ? 'Arrêter le micro' : 'Activer le micro'}
                >
                  {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                </button>
              )}
              <Button
                onClick={handleSend}
                loading={isPending}
                disabled={!displayValue.trim()}
                className="flex-1"
              >
                <Send className="w-4 h-4" /> Enregistrer
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
