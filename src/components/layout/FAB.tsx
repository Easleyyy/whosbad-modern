import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';

interface FABProps {
  onClick: () => void;
  label?: string;
}

export function FAB({ onClick, label = 'Nouvelle vente' }: FABProps) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.92 }}
      className="fixed bottom-20 right-4 z-30 w-14 h-14 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 shadow-lg shadow-primary-600/40 flex items-center justify-center"
      aria-label={label}
    >
      <Plus className="w-6 h-6 text-white" />
    </motion.button>
  );
}
