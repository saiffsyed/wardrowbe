'use client';

import { useMemo, useState } from 'react';
import { ChevronRight, FolderPlus, LayoutList, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getErrorMessage } from '@/lib/api';
import { useClothingTypes } from '@/lib/hooks/use-translated-constants';
import {
  useAddCustomKind,
  useCategoryLabel,
  useDeleteCustomKind,
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
  // Ids of the person's own kinds of item ticked into this category.
  kinds: string[];
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
  const addKind = useAddCustomKind();
  const deleteKind = useDeleteCustomKind();
  const [draft, setDraft] = useState<Draft>({ name: '', types: [], kinds: [] });
  // The sheet for adding a kind of item of the person's own; null while it is closed.
  const [newKind, setNewKind] = useState<{ name: string; baseType: string } | null>(null);
  const [deletingKind, setDeletingKind] = useState<string | null>(null);
  // The kinds already in the category when its sheet opened: listed first, and kept there while
  // boxes are ticked so rows do not jump under the finger.
  const [pinned, setPinned] = useState<string[]>([]);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const groups = useMemo(() => data?.groups ?? [], [data]);
  const kinds = useMemo(() => data?.kinds ?? [], [data]);
  const typeLabel = useMemo(() => {
    const labels = new Map<string, string>(clothingTypes.map((type) => [type.value, type.label]));
    return (value: string) => labels.get(value) ?? value;
  }, [clothingTypes]);
  const allTypesSorted = useMemo(
    () => [...clothingTypes].sort((a, b) => a.label.localeCompare(b.label)),
    [clothingTypes]
  );
  const sortedTypes = useMemo(() => {
    const first = new Set(pinned);
    return [...clothingTypes].sort(
      (a, b) => Number(first.has(b.value)) - Number(first.has(a.value)) || a.label.localeCompare(b.label)
    );
  }, [clothingTypes, pinned]);
  // Where each kind of item sits now, so the list can say "in Tops" beside one that would move.
  const homeOfType = useMemo(() => {
    const homes = new Map<string, { id: string; label: string }>();
    for (const group of groups) {
      for (const child of group.children) {
        const home = { id: child.id, label: categoryLabel(child) };
        for (const type of child.types) homes.set(type, home);
      }
    }
    // One of the person's own kinds sits where it was ticked in, else with the type it is a
    // kind of. Keyed apart from built-in types, whose values never contain a colon.
    for (const kind of kinds) {
      const base = homes.get(kind.base_type);
      if (base) homes.set(`kind:${kind.id}`, base);
    }
    for (const group of groups) {
      for (const child of group.children) {
        for (const id of child.kinds ?? []) homes.set(`kind:${id}`, { id: child.id, label: categoryLabel(child) });
      }
    }
    return homes;
  }, [groups, kinds, categoryLabel]);

  const busy = save.isPending || reset.isPending || addKind.isPending || deleteKind.isPending;

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
    const isSub = target.kind === 'subgroup' && node && 'types' in node;
    const types = isSub ? [...node.types] : [];
    setDraft({ name: node ? categoryLabel(node) : '', types, kinds: isSub ? [...(node.kinds ?? [])] : [] });
    setPinned(types);
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
      const takenKinds = new Set(draft.kinds);
      next = groups.map((group) => {
        // A kind of item lives in one place, so ticking it here takes it out of where it was.
        let children = group.children.map((child) =>
          child.id === editing.childId
            ? { ...named(child), types: draft.types, kinds: draft.kinds }
            : {
                ...child,
                types: child.types.filter((type) => !taken.has(type)),
                kinds: (child.kinds ?? []).filter((id) => !takenKinds.has(id)),
              }
        );
        if (group.id === editing.groupId && !editing.childId) {
          children = [
            ...children,
            { id: newCategoryId(), name, types: draft.types, kinds: draft.kinds, item_count: 0 },
          ];
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

  const toggleKind = (id: string, checked: boolean) =>
    setDraft((previous) => ({
      ...previous,
      kinds: checked ? [...previous.kinds, id] : previous.kinds.filter((value) => value !== id),
    }));

  const submitKind = () => {
    if (!newKind) return;
    const name = newKind.name.trim().replace(/\s+/g, ' ');
    if (!name || !newKind.baseType) return;
    addKind.mutate(
      { name, base_type: newKind.baseType },
      {
        onSuccess: () => {
          toast.success(t('kindAdded'));
          setNewKind(null);
        },
        onError: (error) => toast.error(getErrorMessage(error, t('saveFailed'))),
      }
    );
  };

  const removeKind = (id: string) => {
    if (deletingKind !== id) {
      setDeletingKind(id);
      return;
    }
    deleteKind.mutate(id, {
      onSuccess: () => setDeletingKind(null),
      onError: (error) => toast.error(getErrorMessage(error, t('saveFailed'))),
    });
  };

  const isNew = editing ? (editing.kind === 'group' ? !editing.groupId : !editing.childId) : false;
  const editingId = editing ? (editing.kind === 'group' ? editing.groupId : editing.childId) : null;

  return (
    <Card id="categories" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutList className="h-5 w-5" aria-hidden="true" />
          {t('title')}
        </CardTitle>
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
              <span className="line-clamp-1 min-w-0 break-all text-[15px] font-semibold">{categoryLabel(group)}</span>
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
                      <span className="line-clamp-1 break-all text-sm font-medium">{categoryLabel(child)}</span>
                      <span className="line-clamp-1 break-all text-xs text-muted-foreground">
                        {[
                          ...kinds.filter((kind) => (child.kinds ?? []).includes(kind.id)).map((kind) => kind.name),
                          ...child.types.map(typeLabel),
                        ].join(', ') || t('noTypes')}
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

        <section className="space-y-2 border-t pt-4">
          <h3 className="text-sm font-semibold">{t('kindsTitle')}</h3>
          {kinds.length > 0 && (
            <ul className="divide-y rounded-2xl border">
              {kinds.map((kind) => (
                <li key={kind.id} className="flex min-h-[3.25rem] items-center justify-between gap-3 py-1.5 pl-3.5 pr-1.5">
                  <span className="min-w-0">
                    <span className="line-clamp-1 break-all text-sm font-medium">{kind.name}</span>
                    <span className="line-clamp-1 break-all text-xs text-muted-foreground">
                      {t('kindOf', { type: typeLabel(kind.base_type) })}
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 gap-1.5 text-destructive hover:text-destructive"
                    disabled={busy}
                    aria-label={t('deleteKind', { name: kind.name })}
                    onClick={() => removeKind(kind.id)}
                  >
                    {deletingKind === kind.id ? t('deleteConfirm') : <X className="h-4 w-4" aria-hidden="true" />}
                  </Button>
                </li>
              ))}
            </ul>
          )}
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setNewKind({ name: '', baseType: '' })}
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            {t('addKind')}
          </Button>
        </section>

        <div className="flex flex-wrap gap-2 border-t pt-4">
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
            <DialogDescription className="sr-only">
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
                  {kinds.map((kind) => {
                    const elsewhere = homeOfType.get(`kind:${kind.id}`);
                    const id = `category-kind-${kind.id}`;
                    return (
                      <li key={kind.id}>
                        <label htmlFor={id} className="flex min-h-[2.75rem] items-center gap-3 px-3 py-1.5">
                          <Checkbox
                            id={id}
                            checked={draft.kinds.includes(kind.id)}
                            onCheckedChange={(value) => toggleKind(kind.id, value === true)}
                          />
                          <span className="min-w-0 flex-1 truncate text-sm">{kind.name}</span>
                          {elsewhere && elsewhere.id !== editingId && (
                            <span className="shrink-0 text-xs text-muted-foreground">
                              {t('inOther', { category: elsewhere.label })}
                            </span>
                          )}
                        </label>
                      </li>
                    );
                  })}
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

      <Dialog open={!!newKind} onOpenChange={(next) => !next && !busy && setNewKind(null)}>
        <DialogContent className="max-h-[90dvh] max-w-md overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('addKind')}</DialogTitle>
            <DialogDescription className="sr-only">{t('kindSheetHint')}</DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              submitKind();
            }}
          >
            <div className="space-y-1.5">
              <Label htmlFor="kind-name">{t('name')}</Label>
              <Input
                id="kind-name"
                value={newKind?.name ?? ''}
                maxLength={40}
                placeholder={t('kindNamePlaceholder')}
                onChange={(event) => setNewKind((previous) => previous && { ...previous, name: event.target.value })}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kind-base">{t('kindBase')}</Label>
              <Select
                value={newKind?.baseType ?? ''}
                onValueChange={(value) => setNewKind((previous) => previous && { ...previous, baseType: value })}
              >
                <SelectTrigger id="kind-base">
                  <SelectValue placeholder={t('kindBasePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {allTypesSorted.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" disabled={busy} onClick={() => setNewKind(null)}>
                {t('cancel')}
              </Button>
              <Button type="submit" disabled={busy || !newKind?.name.trim() || !newKind?.baseType}>
                {t('save')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
