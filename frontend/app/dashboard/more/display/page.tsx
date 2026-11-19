'use client';

import { DisplaySettings } from '@/components/wardrobe/display-settings';
import { StartScreenSettings } from '@/components/wardrobe/start-screen-settings';

export default function Page() {
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <DisplaySettings />
      <StartScreenSettings />
    </div>
  );
}
