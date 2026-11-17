// The wardrobe's categories: a few main groups, each opening into smaller ones. The server
// owns the tree (backend/app/utils/wardrobe_categories.py) and each person can rearrange their
// own in Settings, so nothing here lists the categories themselves.

export interface CategorySubGroup {
  id: string;
  // A built-in category's translation key; a name the person typed wins over it.
  key?: string | null;
  name?: string | null;
  types: string[];
  item_count: number;
}

export interface CategoryGroup {
  id: string;
  key?: string | null;
  name?: string | null;
  item_count: number;
  children: CategorySubGroup[];
}

export interface WardrobeCategories {
  customised: boolean;
  groups: CategoryGroup[];
  // Item types in no category; their items show only under "All".
  unplaced_types: string[];
}

// What is sent back when a person saves their own arrangement: the tree without the counts.
export interface CategoryTreeInput {
  groups: {
    id: string;
    key?: string;
    name?: string;
    children: { id: string; key?: string; name?: string; types: string[] }[];
  }[];
}

export function toTreeInput(groups: CategoryGroup[]): CategoryTreeInput {
  const label = (node: { key?: string | null; name?: string | null }) => ({
    ...(node.key ? { key: node.key } : {}),
    ...(node.name ? { name: node.name } : {}),
  });
  return {
    groups: groups.map((group) => ({
      id: group.id,
      ...label(group),
      children: group.children.map((child) => ({ id: child.id, ...label(child), types: child.types })),
    })),
  };
}

/** The main group a category id belongs to: itself if it is one, else its parent. */
export function groupOfCategory(groups: CategoryGroup[], id: string): CategoryGroup | undefined {
  return groups.find((group) => group.id === id || group.children.some((child) => child.id === id));
}

export function newCategoryId(): string {
  return `c-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}
