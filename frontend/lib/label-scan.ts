import type { ClosetDetailEdits } from '@/lib/hooks/use-homes';
import type { Item, LabelReading, MaterialShare } from '@/lib/types';

export type LabelTextField = 'brand' | 'article_number' | 'size' | 'size_system' | 'care_instructions';
export type LabelField = LabelTextField | 'composition';

export const LABEL_FIELDS: LabelField[] = ['brand', 'article_number', 'size', 'size_system', 'composition', 'care_instructions'];

// new: the item has nothing for this detail. different: it has something else. same: the label
// agrees with what is saved, so there is nothing to decide.
export type LabelRowKind = 'new' | 'different' | 'same';

interface RowBase {
  kind: LabelRowKind;
}
export interface TextRow extends RowBase {
  field: LabelTextField;
  current: string | null;
  read: string;
}
export interface CompositionRow extends RowBase {
  field: 'composition';
  current: MaterialShare[] | null;
  read: MaterialShare[];
}
export type LabelRow = TextRow | CompositionRow;

// What the person has decided for one row: whether to take the label's value, and (for text)
// that value as they corrected it.
export interface LabelChoice {
  use: boolean;
  value: string;
}
export type LabelChoices = Partial<Record<LabelField, LabelChoice>>;

function sameText(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function sameComposition(a: MaterialShare[], b: MaterialShare[]): boolean {
  const key = (shares: MaterialShare[]) =>
    shares
      .map((share) => `${share.material.trim().toLowerCase()}:${share.percent}`)
      .sort()
      .join('|');
  return key(a) === key(b);
}

function currentText(item: Item, field: LabelTextField): string | null {
  const value = field === 'brand' ? item.brand : item.tags?.[field];
  return value?.trim() || null;
}

/** One row per detail the label gave, compared with what the item already has. */
export function labelRows(item: Item, reading: LabelReading): LabelRow[] {
  const rows: LabelRow[] = [];
  for (const field of LABEL_FIELDS) {
    if (field === 'composition') {
      if (!reading.composition.length) continue;
      const current = item.tags?.composition?.length ? item.tags.composition : null;
      const kind = !current ? 'new' : sameComposition(current, reading.composition) ? 'same' : 'different';
      rows.push({ field, current, read: reading.composition, kind });
      continue;
    }
    const read = reading[field]?.trim();
    if (!read) continue;
    const current = currentText(item, field);
    const kind = !current ? 'new' : sameText(current, read) ? 'same' : 'different';
    rows.push({ field, current, read, kind });
  }
  return rows;
}

/** A new detail is taken unless unticked; a saved detail is kept unless the label is picked. */
export function initialChoices(rows: LabelRow[]): LabelChoices {
  const choices: LabelChoices = {};
  for (const row of rows) {
    if (row.kind === 'same') continue;
    choices[row.field] = { use: row.kind === 'new', value: row.field === 'composition' ? '' : row.read };
  }
  return choices;
}

/** Only the details the person chose to take from the label; everything else is left out. */
export function editsFromChoices(rows: LabelRow[], choices: LabelChoices): ClosetDetailEdits | null {
  const edits: ClosetDetailEdits = {};
  const tags: NonNullable<ClosetDetailEdits['tags']> = {};
  for (const row of rows) {
    const choice = choices[row.field];
    if (row.kind === 'same' || !choice?.use) continue;
    if (row.field === 'composition') {
      tags.composition = row.read;
      continue;
    }
    const value = choice.value.trim();
    // A label value the person emptied means "don't take it", not "clear what is saved".
    if (!value) continue;
    if (row.field === 'brand') edits.brand = value;
    else tags[row.field] = value;
  }
  if (Object.keys(tags).length) edits.tags = tags;
  return Object.keys(edits).length ? edits : null;
}
