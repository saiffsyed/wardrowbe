'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Sidebar } from '@/components/sidebar';
import { MobileNav } from '@/components/mobile-nav';
import { Header } from '@/components/header';
import { BackToMore } from '@/components/wardrobe/back-to-more';
import { isReachedFromMore, MORE_HREF } from '@/lib/more-routes';
import { AiRouteGuard } from '@/components/ai-route-guard';
import { OfflineIndicator } from '@/components/offline-indicator';
import { UploadQueueIndicator } from '@/components/upload-queue-indicator';
import { ImageLightbox } from '@/components/image-lightbox';
import { LightboxProvider } from '@/lib/lightbox-context';
import { useAuth } from '@/lib/hooks/use-auth';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  // Screens opened from the More tab get a way back to it on a phone; More itself does not.
  const showBackToMore = pathname !== MORE_HREF && isReachedFromMore(pathname);
  const t = useTranslations('dashboard');

  const { user, isAuthenticated, isLoading, error } = useAuth();

  useEffect(() => {
    // If auth check completed and user is not authenticated, redirect to login
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  // Check onboarding status from API user
  useEffect(() => {
    if (user && user.onboarding_completed === false) {
      router.push('/onboarding');
    }
  }, [user, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">{t('layout.loading')}</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <LightboxProvider>
      <div className="min-h-screen bg-background">
        <Sidebar />
        <div className="lg:pl-72">
          <Header />
          {showBackToMore && (
            <div className="px-4 pt-2 sm:px-6 lg:hidden">
              <BackToMore />
            </div>
          )}
          <main className="px-4 pb-24 pt-4 sm:px-6 lg:px-8 lg:py-6 overflow-x-hidden">
            <AiRouteGuard>{children}</AiRouteGuard>
          </main>
        </div>
        <MobileNav />
        <OfflineIndicator />
        <UploadQueueIndicator />
        <ImageLightbox />
      </div>
    </LightboxProvider>
  );
}
