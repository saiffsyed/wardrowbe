'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Check, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useHomes } from '@/lib/hooks/use-homes';
import { useLaundry, type LaundryLists } from '@/lib/hooks/use-laundry';
import { useTypeLabel } from '@/lib/hooks/use-translated-constants';
import { useMoveWithToast } from './laundry';

type Tab = keyof LaundryLists;
const TABS: Tab[] = ['to_wash', 'wash', 'dry'];

// More → Laundry: clothes to wash, in the wash and at the dry cleaner. Tick some and move them.
export function LaundryScreen() {
  const t = useTranslations('wardrobe.closet.laundry');
  const typeLabel = useTypeLabel();
  const { data: homes } = useHomes();
  const homeId = homes?.find((home) => home.is_current)?.id;
  const { data, isLoading } = useLaundry(homeId);
  const [tab, setTab] = useState<Tab>('to_wash');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const { run, pending } = useMoveWithToast();

  const list = data?.[tab] ?? [];
  const chosen = list.filter((item) => selected.has(item.id)).map((item) => item.id);
  const allOn = list.length > 0 && chosen.length === list.length;
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const move = (to: 'wash' | 'dry' | 'back') => run(chosen, to, () => setSelected(new Set()));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-3 pb-28">
      <h1 className="text-2xl font-extrabold tracking-tight">{t('title')}</h1>
      <div role="tablist" aria-label={t('title')} className="-mx-4 flex gap-1.5 overflow-x-auto px-4">
        {TABS.map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => {
              setTab(value);
              setSelected(new Set());
            }}
            className={`h-9 shrink-0 rounded-full border px-3.5 text-sm ${
              tab === value ? 'border-foreground bg-foreground font-bold text-background' : 'bg-card font-semibold'
            }`}
          >
            {t(`tabs.${value}`)}
            <span className="ml-1.5 opacity-70">{data?.[value].length ?? 0}</span>
          </button>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">{t(`hints.${tab}`)}</p>

      {isLoading ? (
        <Loader2 className="mx-auto my-10 h-6 w-6 animate-spin text-muted-foreground" />
      ) : list.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">{t(`empty.${tab}`)}</p>
      ) : (
        <>
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>{chosen.length ? t('selected', { count: chosen.length }) : t('tapToSelect')}</span>
            <button
              type="button"
              onClick={() => setSelected(allOn ? new Set() : new Set(list.map((item) => item.id)))}
              className="py-1.5 font-bold text-primary"
            >
              {allOn ? t('clear') : t('selectAll')}
            </button>
          </div>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {list.map((item) => {
              const on = selected.has(item.id);
              const name = item.name || typeLabel(item.type);
              return (
                <li key={item.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    aria-label={name}
                    onClick={() => toggle(item.id)}
                    className={`photo-ground relative block aspect-square w-full overflow-hidden rounded-xl border ${on ? 'ring-2 ring-primary' : ''}`}
                  >
                    {item.thumbnail_url && (
                      <Image src={item.thumbnail_url} alt="" fill className="object-contain p-2" sizes="33vw" />
                    )}
                    <span
                      className={`absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full border-2 ${
                        on ? 'border-primary bg-primary text-primary-foreground' : 'border-foreground/40 bg-background/70'
                      }`}
                    >
                      {on && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}

      {list.length > 0 && (
        <div className="fixed inset-x-0 bottom-[4.5rem] z-40 border-t bg-card px-4 pb-3 pt-3 lg:bottom-0 lg:left-72">
          <div className={`mx-auto grid max-w-2xl gap-2 ${tab === 'to_wash' ? 'grid-cols-2' : ''}`}>
            {tab === 'to_wash' ? (
              <>
                <button type="button" disabled={!chosen.length || pending} onClick={() => move('wash')} className="h-12 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-40">
                  {t('actions.wash')}
                </button>
                <button type="button" disabled={!chosen.length || pending} onClick={() => move('dry')} className="h-12 rounded-full bg-muted font-bold disabled:opacity-40">
                  {t('actions.dry')}
                </button>
              </>
            ) : (
              <button type="button" disabled={!chosen.length || pending} onClick={() => move('back')} className="h-12 rounded-full bg-primary font-bold text-primary-foreground disabled:opacity-40">
                {t('actions.back')}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
