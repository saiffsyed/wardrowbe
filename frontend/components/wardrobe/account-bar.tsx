'use client';

import { LogOut } from 'lucide-react';
import { signOut } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { LocaleSwitcher } from '@/components/locale-switcher';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/hooks/use-auth';
import { useAuthConfig } from '@/lib/hooks/use-auth-config';

function initialsOf(name?: string | null) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Who is signed in, the language, and the way out. On a wide screen it sits in the top bar; on
// a phone, which has no top bar, it sits at the foot of the side menu.
export function AccountBar({ showName = false }: { showName?: boolean }) {
  const { user } = useAuth();
  const authConfig = useAuthConfig();
  const t = useTranslations('nav');

  const handleLogout = () => {
    // The proxy session outlives the NextAuth one, so /auth/logout has to end it too or /login
    // would sign the user straight back in. A config that failed to load takes this path as
    // well, because /auth/logout also works without a proxy. The route clears the session
    // cookies itself; a client signOut first would tell every tab, and one of them could sign
    // back in through the still-live proxy session before the proxy logout.
    if (authConfig.data?.forward_auth !== false) {
      window.location.assign('/auth/logout');
      return;
    }
    signOut({ callbackUrl: '/login' });
  };

  return (
    <div className="flex min-w-0 items-center gap-x-3">
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarImage src={user?.avatar_url || ''} alt={user?.display_name || ''} />
        <AvatarFallback>{initialsOf(user?.display_name)}</AvatarFallback>
      </Avatar>
      <span className={`min-w-0 flex-1 truncate text-sm font-semibold ${showName ? '' : 'hidden lg:block'}`}>
        {user?.display_name || t('userFallback')}
      </span>
      <LocaleSwitcher />
      <Button variant="ghost" size="icon" onClick={handleLogout} aria-label={t('signOut')}>
        <LogOut className="h-5 w-5" />
      </Button>
    </div>
  );
}
