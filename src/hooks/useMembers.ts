import { useCallback, useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAllSalesData } from '@/hooks/useSales';
import { useEntrainements } from '@/hooks/useEntrainements';
import { adherentsApi, mergeMembers, memberKey, useUnsyncedMembers } from '@/lib/members';

/**
 * The adhérents directory the chatbot works from, identical on every device:
 *   • the shared list stored server-side (names added through the chat, from any device),
 *   • everyone already seen as a buyer in the sales sheets,
 *   • the training-group players.
 * A person sold to for the first time joins by themselves — the sale row is what makes
 * them known — and `addMember` files them explicitly in the shared list right away.
 */
export function useMembers() {
  const qc = useQueryClient();
  const { data: sales = [] } = useAllSalesData();
  const { data: training } = useEntrainements();
  const unsynced = useUnsyncedMembers((s) => s.names);
  const { push, drop } = useUnsyncedMembers.getState();

  // Refetched when the app regains focus, so a name added on the other device appears here.
  const { data: shared, isSuccess: sharedLoaded } = useQuery({
    queryKey: ['adherents'],
    queryFn: adherentsApi.list,
    staleTime: 15_000,
    retry: 1,
  });

  // Names typed while the server was unreachable are pushed as soon as it answers.
  useEffect(() => {
    if (!sharedLoaded || !unsynced.length) return;
    for (const name of unsynced) {
      adherentsApi.add(name).then((list) => { qc.setQueryData(['adherents'], list); drop(name); }).catch(() => undefined);
    }
  }, [sharedLoaded, unsynced, qc, drop]);

  const members = useMemo(() => {
    const roster = training?.groups ? Object.values(training.groups).flat().map((p) => p.nom) : [];
    // Sales first: their spelling is the one the backend must match on later payment updates.
    return mergeMembers(sales.map((s) => s.acheteur), roster, shared ?? [], unsynced);
  }, [sales, training, shared, unsynced]);

  /** Files a name in the shared list. `synced: false` = server unreachable, kept on this device
   *  and retried automatically. */
  const addMember = useCallback(async (name: string): Promise<{ synced: boolean }> => {
    try {
      qc.setQueryData(['adherents'], await adherentsApi.add(name));
      drop(name);
      return { synced: true };
    } catch {
      push(name);
      return { synced: false };
    }
  }, [qc, push, drop]);

  /** Removes a name from the shared list only (sales rows and training groups are untouched). */
  const removeMember = useCallback(async (name: string) => {
    qc.setQueryData(['adherents'], await adherentsApi.remove(name));
    drop(name);
  }, [qc, drop]);

  const isShared = useCallback(
    (name: string) => (shared ?? []).some((n) => memberKey(n) === memberKey(name)),
    [shared]
  );

  return { members, addMember, removeMember, isShared };
}
