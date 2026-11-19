'use client';

import { LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/lib/hooks/use-auth';
import { useAuthConfig } from '@/lib/hooks/use-auth-config';

// Who is signed in, the app's language, and signing out.
export function AccountScreen() {
  const t = useTranslations('wardrobe.closet.more');
  const tNav = useTranslations('nav');
  const { user } = useAuth();
  const authConfig = useAuthConfig();

  const handleLogout = () => {
    // The same route the top bar used: a proxy session outlives the NextAuth one, so
    // /auth/logout has to end it too or /login would sign the user straight back in.
    if (authConfig.data?.forward_auth !== false) {
      window.location.assign('/auth/logout');
      return;
    }
    signOut({ callbackUrl: '/login' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('items.account.title')}</CardTitle>
        <CardDescription>{t('accountHint')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="flex items-center gap-4 pb-3">
          <Avatar className="h-12 w-12 shrink-0">
            <AvatarImage src={user?.avatar_url || ''} alt="" />
            <AvatarFallback>{(user?.display_name || '?').charAt(0).toUpperCase()}</AvatarFallback>
          </Avatar>
          <span className="min-w-0">
            <span className="block truncate font-semibold">{user?.display_name || tNav('userFallback')}</span>
            {user?.email && <span className="block truncate text-sm text-muted-foreground">{user.email}</span>}
          </span>
        </div>
        <div className="flex min-h-[3.5rem] items-center justify-between gap-3 border-t">
          <span className="text-[15px] font-medium">{t('language')}</span>
          <LocaleSwitcher />
        </div>
        <div className="border-t pt-3">
          <Button variant="outline" className="w-full gap-2 text-destructive hover:text-destructive" onClick={handleLogout}>
            <LogOut className="h-4 w-4" aria-hidden="true" />
            {tNav('signOut')}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
