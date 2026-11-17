'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { usePreferences } from '@/lib/hooks/use-preferences';
import { startHref } from '@/lib/start-screen';

// Opens the screen chosen under "App starts in". Replaces itself, so Back does not return here.
export default function StartPage() {
  const router = useRouter();
  const { data, isError, isFetched } = usePreferences();

  useEffect(() => {
    if (data || isError || isFetched) router.replace(startHref(data?.start_screen));
  }, [data, isError, isFetched, router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden="true" />
    </div>
  );
}
