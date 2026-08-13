/**
 * Référentiel central des services hospitaliers — table `departments` (actifs uniquement).
 * Source UNIQUE pour toutes les listes de services du frontend : ne jamais hardcoder
 * une liste de services dans un composant.
 */
import { useQuery } from '@/hooks/useQuery';

export interface ServiceOption {
  id: string;
  name: string;
  code?: string;
}

export function useServices() {
  const q = useQuery<ServiceOption[]>('/infrastructure/services');
  return {
    services: Array.isArray(q.data) ? q.data : [],
    loading: q.loading,
    error: q.error,
    refetch: q.refetch,
  };
}
