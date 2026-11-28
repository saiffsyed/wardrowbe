import { describe, expect, it } from 'vitest';
import {
  boxOf,
  choices,
  dressWith,
  isWarm,
  shuffleOutfit,
  spotOf,
  warmthOf,
  worn,
  type DressItem,
  type Spot,
} from '@/lib/dressing-room';

const item = (id: string, type: string, extra: Partial<DressItem> = {}): DressItem => ({
  id,
  type,
  occasions: [],
  season: [],
  ...extra,
});

const wardrobe: DressItem[] = [
  item('kurti', 'kurti', { occasions: ['casual'] }),
  item('shirt', 'shirt', { occasions: ['work'] }),
  item('saree', 'saree', { occasions: ['wedding'] }),
  item('palazzo', 'palazzo'),
  item('jeans', 'jeans'),
  item('juttis', 'juttis'),
  item('boots', 'boots'),
  item('jacket', 'jacket'),
  item('coat', 'coat'),
  item('jhumkas', 'jhumkas'),
  item('bag', 'bag'),
];

const first = () => 0;

describe('dressing room places', () => {
  it('puts each kind in its place on the figure', () => {
    expect(spotOf('jhumkas')).toBe('head');
    expect(spotOf('necklace')).toBe('neck');
    expect(spotOf('kurti')).toBe('top');
    expect(spotOf('saree')).toBe('top');
    expect(spotOf('jacket')).toBe('outer');
    expect(spotOf('sherwani')).toBe('top');
    expect(spotOf('palazzo')).toBe('bottom');
    expect(spotOf('juttis')).toBe('feet');
    expect(spotOf('dupatta')).toBe('dupatta');
    expect(spotOf('bangles')).toBe('wrist');
    expect(spotOf('clutch')).toBe('bag');
    expect(spotOf('ring')).toBeNull();
  });

  it('sizes pieces by kind', () => {
    expect(boxOf('top', 'shirt').h).toBeLessThan(boxOf('top', 'kurti').h);
    expect(boxOf('outer', 'coat').h).toBeGreaterThan(boxOf('outer', 'jacket').h);
    expect(boxOf('top', 'saree').h).toBeGreaterThan(50);
  });

  it('leaves out the bottom under a saree', () => {
    const outfit = dressWith([wardrobe[2], wardrobe[3]]);
    expect(outfit).toEqual({ top: 'saree', bottom: 'palazzo' });
    expect(worn(outfit, wardrobe).map((entry) => entry.spot)).toEqual(['top']);
  });
});

describe('shuffle', () => {
  it('reads the day as hot, cold or mild', () => {
    expect(warmthOf({ temp_max: 33 })).toBe('hot');
    expect(warmthOf({ temp_max: 8 })).toBe('cold');
    expect(warmthOf({ temp_max: 21 })).toBe('mild');
    expect(warmthOf(null)).toBe('mild');
  });

  it('knows warm clothes', () => {
    expect(isWarm(item('a', 'coat'))).toBe(true);
    expect(isWarm(item('a', 'kurti', { material: 'Merino wool' }))).toBe(true);
    expect(isWarm(item('a', 'shirt', { season: ['winter'] }))).toBe(true);
    expect(isWarm(item('a', 'shirt', { season: ['winter', 'autumn'] }))).toBe(false);
  });

  it('takes the coat off on a hot day and keeps warm shoes away', () => {
    const next = shuffleOutfit({ top: 'kurti', bottom: 'palazzo', outer: 'coat' }, wardrobe, {
      locked: new Set(),
      occasion: null,
      warmth: 'hot',
      random: first,
    });
    expect(next.outer).toBeNull();
    expect(next.feet).toBe('juttis');
  });

  it('puts a warm layer on when it is cold', () => {
    const next = shuffleOutfit({ top: 'kurti' }, wardrobe, { locked: new Set(), occasion: null, warmth: 'cold', random: first });
    expect(next.outer).toBe('coat');
  });

  it('keeps locked places and only changes worn accessories', () => {
    const next = shuffleOutfit({ top: 'shirt', bottom: 'jeans', head: 'jhumkas' }, wardrobe, {
      locked: new Set<Spot>(['top']),
      occasion: null,
      warmth: 'mild',
      random: first,
    });
    expect(next.top).toBe('shirt');
    expect(next.head).toBe('jhumkas');
    expect(next.bag).toBeUndefined();
    expect(next.bottom).toBeTruthy();
  });

  it('dresses for the occasion and drops the bottom under a saree', () => {
    const next = shuffleOutfit({}, wardrobe, { locked: new Set(), occasion: 'wedding', warmth: 'mild', random: first });
    expect(next.top).toBe('saree');
    expect(next.bottom).toBeNull();
  });

  it('offers the pieces not worn for longest first', () => {
    const list = choices(
      [item('a', 'shirt', { lastWorn: '2026-11-10' }), item('b', 'shirt', { lastWorn: '2026-01-01' }), item('c', 'shirt', { lastWorn: null })],
      'top',
      null,
      'mild'
    );
    expect(list.map((entry) => entry.id)).toEqual(['c', 'b', 'a']);
  });
});
