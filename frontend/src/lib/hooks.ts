import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import type { Job, JobsResponse } from '@/types';

export function useJobs() {
  return useQuery<JobsResponse>({
    queryKey: ['jobs'],
    queryFn: () => api.getJobs(),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return false;
      const hasActive = data.jobs.some(
        (j) => j.status === 'pending' || j.status === 'processing'
      );
      return hasActive ? 5000 : false;
    },
  });
}

export function useJobStatus(id: string) {
  return useQuery<Job>({
    queryKey: ['job', id],
    queryFn: () => api.getJob(id),
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data) return 3000;
      if (data.status === 'done' || data.status === 'failed') return false;
      return 3000;
    },
    enabled: !!id,
  });
}
