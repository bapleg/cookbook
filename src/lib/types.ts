export type Lang = 'fr' | 'en' | 'vi';
export type Category = 'plats' | 'entrees' | 'salades' | 'desserts';
export type Member = 'mummy' | 'papa' | 'tita' | 'juju' | 'artie';
export type MealSlot = 'lunch' | 'dinner';

export interface RecipeText {
  title: string;
  difficulty?: string;
  ingredients: string[];
  /** Steps separated by newlines (kept as a string for compatibility with the old gist format). */
  directions: string;
  notes?: string;
}

export interface Recipe {
  id: number;
  emoji: string;
  category: Category;
  tags: string[];
  author?: string;
  servings?: string;
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  photo?: string;
  sourceUrl?: string;
  fr?: RecipeText;
  en?: RecipeText;
  vi?: RecipeText;
  /** Original language the recipe was written in. */
  lang?: Lang;
  updatedAt?: number;
  deleted?: boolean;
}

/** recipeId -> member -> stars (1..5). `t` = last change timestamp, used for merging. */
export type Ratings = Record<string, Partial<Record<Member, number>> & { t?: number }>;

export interface PlanEntry {
  id: number; // recipe id
  servings: number;
  t: number;
  deleted?: boolean;
}
/** key = `${YYYY-MM-DD}|${slot}|${recipeId}` (older keys `${date}|${slot}` are still read) — several meals per slot */
export interface Plan {
  slots: Record<string, PlanEntry>;
}

export interface ShopCheck { checked: boolean; t: number }
export interface ShopExtra { id: string; text: string; checked: boolean; t: number; deleted?: boolean }
export interface Shopping {
  checks: Record<string, ShopCheck>;
  extras: Record<string, ShopExtra>;
  /** Ingredients the family always has (normalised names) -> timestamp; value null = removed. */
  pantry: Record<string, { on: boolean; t: number }>;
}

export interface SharedData {
  recipes: Recipe[];
  ratings: Ratings;
  plan: Plan;
  shopping: Shopping;
}

export interface LocalPrefs {
  lang: Lang;
  favs: number[];
  householdServings: number;
  showLunch: boolean;
  weeks: 1 | 2;
  dietFilters: DietFilter[];
  theme: 'auto' | 'light' | 'dark';
  redmart: boolean;
}

export type DietFilter = 'veg' | 'gf' | 'df' | 'ef' | 'quick';
