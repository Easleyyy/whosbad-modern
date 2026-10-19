import { useMemo } from 'react';
import { useAllSalesData } from '@/hooks/useSales';
import { useMembers } from '@/hooks/useMembers';
import { useEntrainements } from '@/hooks/useEntrainements';
import { buildMemberIndex } from '@/lib/memberStats';

/** Everyone the club knows (shared list ∪ sales buyers ∪ training players) with their totals. */
export function useMemberIndex() {
  const { data: sales = [], isLoading } = useAllSalesData();
  const { members, addMember } = useMembers();
  const { data: training } = useEntrainements();

  const index = useMemo(() => buildMemberIndex(sales, members, training?.groups), [sales, members, training]);
  return { index, isLoading, addMember };
}
