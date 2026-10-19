import { useCallback } from 'react';
import { EditSaleModal, type SaleFields } from '@/components/sales/EditSaleModal';
import { NewSaleSheet } from '@/components/sales/NewSaleSheet';
import { ToastContainer } from '@/components/ui/Toast';
import { useUpdateSale } from '@/hooks/useSales';
import { useSaleDeletion } from '@/hooks/useSaleDeletion';
import { useSaleEditor } from '@/stores/saleEditorStore';
import { useGlobalToasts } from '@/stores/toastStore';

/** Rendered once at the app shell: any page opens the same editor through `useSaleEditor`. */
export function SaleEditorHost() {
  const { editing, creating, openEditor, close } = useSaleEditor();
  const { mutateAsync: updateSale } = useUpdateSale();
  const requestDelete = useSaleDeletion();
  const { toasts, remove, add } = useGlobalToasts();

  const onChange = useCallback(
    (patch: Partial<SaleFields>) =>
      updateSale({ rowIndex: editing!._row!, tab: editing!.produit!, ...patch }),
    [updateSale, editing]
  );

  return (
    <>
      {editing && (
        <EditSaleModal
          key={`${editing.produit}-${editing._row}`}
          sale={editing}
          onChange={onChange}
          onDelete={(sale) => { requestDelete(sale); close(); }}
          onClose={close}
        />
      )}
      {creating && (
        <NewSaleSheet
          options={creating}
          onClose={close}
          onCreated={(sale) => { add('Vente créée — ajuste-la ci-dessous', 'success'); openEditor(sale); }}
        />
      )}
      <ToastContainer toasts={toasts} onRemove={remove} />
    </>
  );
}
