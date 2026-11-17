'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, FolderPlus, LayoutList, Plus, RotateCcw, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getErrorMessage } from '@/lib/api';
import { useClothingTypes } from '@/lib/hooks/use-translated-constants';
import {
  useCategoryLabel,
  useResetWardrobeCategories,
  useSaveWardrobeCategories,
  useWardrobeCategories,
} from '@/lib/hooks/use-wardrobe-categories';
import { newCategoryId, toTreeInput, type CategoryGroup } from '@/lib/wardrobe-categories';

const MAX_GROUPS = 12;
const MAX_SUBGROUPS = 14;

// What the edit sheet is open on: a main group or one of its sub-groups, new or existing.
type Editing =
  | { kind: 'group'; groupId: string | null }
  | { kind: 'subgroup'; groupId: string; childId: string | null };

interface Draft {
  name: string;
  types: string[];
}

// The wardrobe's categories, for the person to arrange: rename, add and remove the main groups
// and the smaller ones inside them, and choose which kinds of item each smaller one holds.
// Every change is saved at once, whole.
export function CategoriesSettings() {
  const t = useTranslations('wardrobe.closet.categorySettings');
  const categoryLabel = useCategoryLabel();
  const clothingTypes = useClothingTypes();
  const { data } = useWardrobeCategories();
  const save = useSaveWardrobeCategories();
  const reset = useResetWardrobeCategories();
  const [editing, setEditing] = useState<Editing | null>(null);
  const [draft, setDraft] = useState<Draft>({ name: '', types: [] });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const groups = useMemo(() => data?.groups ?? [], [data]);
  const typeLabel = useMemo(() => {
    const labels = new Map<string, string>(clothingTypes.map((type) => [type.value, type.label]));
    return (value: string) => labels.get(value) ?? value;
  }, [clothingTypes]);
  const sortedTypes = useMemo(
    () => [...clothingTypes].sort((a, b) => a.label.localeCompare(b.label)),
    [clothingTypes]
  );
  // Where each kind of item sits now, so the list can say "in Tops" beside one that would move.
  const homeOfType = useMemo(() => {
    const homes = new Map<string, { id: string; label: string }>();
    for (const group of groups) {
      for (const child of group.children) {
        for (const type of child.types) homes.set(type, { id: child.id, label: categoryLabel(child) });
      }
    }
    return homes;
  }, [groups, categoryLabel]);

  const busy = save.isPending || reset.isPending;

  const persist = (next: CategoryGroup[], after?: () => void) =>
    save.mutate(toTreeInput(next), {
      onSuccess: () => {
        toast.success(t('saved'));
        after?.();
      },
      onError: (error) => toast.error(getErrorMessage(error, t('saveFailed'))),
    });

  const open = (target: Editing) => {
    const group = groups.find((candidate) => candidate.id === target.groupId);
    const node =
      target.kind === 'group' ? group : group?.children.find((child) => child.id === target.childId);
    setDraft({
      name: node ? categoryLabel(node) : '',
      types: target.kind === 'subgroup' && node && 'types' in node ? [...node.types] : [],
    });
    setConfirmingDelete(false);
    setEditing(target);
  };

  const close = () => setEditing(null);

  const submit = () => {
    if (!editing) return;
    const name = draft.name.trim().replace(/\s+/g, ' ');
    if (!name) return;
    // A built-in category keeps its translated name until the person types a different one.
    const named = <T extends { key?: string | null; name?: string | null; id: string }>(node: T): T =>
      name === categoryLabel(node) ? node : { ...node, name };

    let next: CategoryGroup[];
    if (editing.kind === 'group') {
      next = editing.groupId
        ? groups.map((group) => (group.id === editing.groupId ? named(group) : group))
        : [...groups, { id: newCategoryId(), name, item_count: 0, children: [] }];
    } else {
      const taken = new Set(draft.types);
      next = groups.map((group) => {
        // A kind of item lives in one place, so ticking it here takes it out of where it was.
        let children = group.children.map((child) =>
          child.id === editing.childId
            ? { ...named(child), types: draft.types }
            : { ...child, types: child.types.filter((type) => !taken.has(type)) }
        );
        if (group.id === editing.groupId && !editing.childId) {
          children = [...children, { id: newCategoryId(), name, types: draft.types, item_count: 0 }];
        }
        return { ...group, children };
      });
    }
    persist(next, close);
  };

  const remove = () => {
    if (!editing) return;
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    const next =
      editing.kind === 'group'
        ? groups.filter((group) => group.id !== editing.groupId)
        : groups.map((group) =>
            group.id === editing.groupId
              ? { ...group, children: group.children.filter((child) => child.id !== editing.childId) }
              : group
          );
    persist(next, close);
  };

  const toggleType = (type: string, checked: boolean) =>
    setDraft((previous) => ({
      ...previous,
      types: checked ? [...previous.types, type] : previous.types.filter((value) => value !== type),
    }));

  const isNew = editing ? (editing.kind === 'group' ? !editing.groupId : !editing.childId) : false;
  const editingId = editing ? (editing.kind === 'group' ? editing.groupId : editing.childId) : null;

  return (
    <Card id="categories" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutList className="h-5 w-5" aria-hidden="true" />
          {t('title')}
        </CardTitle>
        <CardDescription>{t('description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {groups.map((group) => (
          <section key={group.id} className="overflow-hidden rounded-2xl border">
            <button
              type="button"
              onClick={() => open({ kind: 'group', groupId: group.id })}
              aria-label={t('editNamed', { name: categoryLabel(group) })}
              className="flex min-h-[3rem] w-full items-center justify-between gap-3 bg-muted/50 px-3.5 py-2 text-left hover:bg-muted"
            >
              <span className="min-w-0 truncate text-[15px] font-semibold">{categoryLabel(group)}</span>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            </button>
            <ul className="divide-y border-t">
              {group.children.map((child) => (
                <li key={child.id}>
                  <button
                    type="button"
                    onClick={() => open({ kind: 'subgroup', groupId: group.id, childId: child.id })}
                    aria-label={t('editNamed', { name: categoryLabel(child) })}
                    className="flex min-h-[3.25rem] w-full items-center justify-between gap-3 px-3.5 py-2 text-left hover:bg-accent/50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium">{categoryLabel(child)}</span>
                      <span className="block truncate text-xs text-muted-foreground">
                        {child.types.length ? child.types.map(typeLabel).join(', ') : t('noTypes')}
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  </button>
                </li>
              ))}
              {group.children.length < MAX_SUBGROUPS && (
                <li>
                  <button
                    type="button"
                    onClick={() => open({ kind: 'subgroup', groupId: group.id, childId: null })}
                    className="flex min-h-[2.75rem] w-full items-center gap-2 px-3.5 py-2 text-left text-sm font-medium text-primary hover:bg-accent/50"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    {t('addSubgroup', { group: categoryLabel(group) })}
                  </button>
                </li>
              )}
            </ul>
          </section>
        ))}

        {!!data?.unplaced_types.length && (
          <p className="text-xs text-muted-foreground">
            {t('unplaced', { types: data.unplaced_types.map(typeLabel).join(', ') })}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {groups.length < MAX_GROUPS && (
            <Button variant="outline" className="gap-2" onClick={() => open({ kind: 'group', groupId: null })}>
              <FolderPlus className="h-4 w-4" aria-hidden="true" />
              {t('addGroup')}
            </Button>
          )}
          {data?.customised && (
            <Button
              variant="ghost"
              className="gap-2"
              disabled={busy}
              onClick={() => {
                if (!confirmingReset) {
                  setConfirmingReset(true);
                  return;
                }
                reset.mutate(undefined, {
                  onSuccess: () => {
                    toast.success(t('resetDone'));
                    setConfirmingReset(false);
                  },
                  onError: (error) => toast.error(getErrorMessage(error, t('saveFailed'))),
                });
              }}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {confirmingReset ? t('resetConfirm') : t('reset')}
            </Button>
          )}
        </div>
      </CardContent>

      <Dialog open={!!editing} onOpenChange={(next) => !next && !busy && close()}>
        <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {isNew
                ? editing?.kind === 'group'
                  ? t('addGroup')
                  : t('newSubgroup')
                : t('editTitle')}
            </DialogTitle>
            <DialogDescription>
              {editing?.kind === 'group' ? t('groupHint') : t('subgroupHint')}
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="category-name">{t('name')}</Label>
              <Input
                id="category-name"
                value={draft.name}
                maxLength={30}
                placeholder={t('namePlaceholder')}
                onChange={(event) => setDraft((previous) => ({ ...previous, name: event.target.value }))}
              />
            </div>

            {editing?.kind === 'subgroup' && (
              <fieldset className="space-y-1.5">
                <legend className="text-sm font-medium leading-none">{t('types')}</legend>
                <ul className="max-h-[40dvh] divide-y overflow-y-auto rounded-xl border">
                  {sortedTypes.map((type) => {
                    const checked = draft.types.includes(type.value);
                    const elsewhere = homeOfType.get(type.value);
                    const id = `category-type-${type.value}`;
                    return (
                      <li key={type.value}>
                        <label htmlFor={id} className="flex min-h-[2.75rem] items-center gap-3 px-3 py-1.5">
                          <Checkbox
                            id={id}
                            checked={checked}
                            onCheckedChange={(value) => toggleType(type.value, value === true)}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm">{type.label}</span>
                          {elsewhere && elsewhere.id !== editingId && (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {t('inOther', { category: elsewhere.label })}
                            </span>
                          )}
                        </label>
                      </li>
                    );
                  })}
                </ul>
              </fieldset>
            )}

            <div className="flex items-center justify-between gap-2">
              {!isNew ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="gap-1.5 text-destructive hover:text-destructive"
                  disabled={busy}
                  onClick={remove}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  {confirmingDelete ? t('deleteConfirm') : t('delete')}
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="ghost" disabled={busy} onClick={close}>
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={busy || !draft.name.trim()}>
                  {t('save')}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
