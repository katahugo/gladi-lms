"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

type CatalogFiltersProps = {
  categories: string[];
  selectedCategories: string[];
  query: string;
  sort: string;
  minRating: boolean;
};

function buildHref(
  base: {
    q?: string;
    sort?: string;
    minRating?: boolean;
  },
  categories: string[],
) {
  const params = new URLSearchParams();
  if (base.q) params.set("q", base.q);
  if (base.sort && base.sort !== "popular") params.set("sort", base.sort);
  if (base.minRating) params.set("minRating", "4");
  if (categories.length === 1) params.set("category", categories[0]);
  else if (categories.length > 1) params.set("category", categories.join(","));
  const qs = params.toString();
  return qs ? `/courses?${qs}` : "/courses";
}

/**
 * Sidebar filter katalog — update query string tanpa reload penuh (client nav).
 */
export function CatalogFilters({
  categories,
  selectedCategories,
  query,
  sort,
  minRating,
}: CatalogFiltersProps) {
  const router = useRouter();

  function toggleCategory(cat: string) {
    const next = selectedCategories.includes(cat)
      ? selectedCategories.filter((c) => c !== cat)
      : [...selectedCategories, cat];
    router.push(buildHref({ q: query, sort, minRating }, next));
  }

  function toggleMinRating() {
    router.push(
      buildHref({ q: query, sort, minRating: !minRating }, selectedCategories),
    );
  }

  return (
    <aside className="w-full flex-shrink-0 space-y-10 md:w-64">
      <div className="flex items-center justify-between">
        <h2 className="font-headline text-headline-md text-on-surface">Filters</h2>
        <Link
          href={query ? `/courses?q=${encodeURIComponent(query)}` : "/courses"}
          className="font-headline text-label-md font-semibold text-primary hover:underline"
        >
          Reset
        </Link>
      </div>

      <div className="space-y-4">
        <span className="font-headline text-label-md font-bold tracking-widest text-on-surface-variant/70 uppercase">
          Category
        </span>
        <div className="space-y-3">
          {categories.map((cat) => {
            const checked = selectedCategories.includes(cat);
            return (
              <label
                key={cat}
                className="group flex cursor-pointer items-center gap-3"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleCategory(cat)}
                  className="h-5 w-5 cursor-pointer rounded-md border-outline-variant text-primary transition-all focus:ring-primary"
                />
                <span
                  className={`text-body-md transition-colors group-hover:text-primary ${
                    checked
                      ? "font-semibold text-primary"
                      : "text-on-surface-variant"
                  }`}
                >
                  {cat}
                </span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="space-y-4">
        <span className="font-headline text-label-md font-bold tracking-widest text-on-surface-variant/70 uppercase">
          Level
        </span>
        <div className="space-y-3">
          {["Beginner", "Intermediate", "Advanced"].map((level) => (
            <label
              key={level}
              className="group flex cursor-not-allowed items-center gap-3 opacity-60"
              title="Filter level segera hadir"
            >
              <input
                type="checkbox"
                disabled
                className="h-5 w-5 rounded-md border-outline-variant text-primary"
              />
              <span className="text-body-md text-on-surface-variant">{level}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-4">
        <span className="font-headline text-label-md font-bold tracking-widest text-on-surface-variant/70 uppercase">
          Minimum Rating
        </span>
        <button
          type="button"
          onClick={toggleMinRating}
          className="group flex items-center gap-2 text-body-md transition-colors hover:text-primary"
        >
          <span className="flex text-primary-container">
            {[1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className="material-symbols-outlined text-[20px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                star
              </span>
            ))}
            <span className="material-symbols-outlined text-[20px]">star</span>
          </span>
          <span
            className={`font-medium transition-colors group-hover:text-primary ${
              minRating ? "font-semibold text-primary" : "text-on-surface-variant"
            }`}
          >
            4.0 & Up
          </span>
        </button>
      </div>
    </aside>
  );
}

type CatalogSortProps = {
  sort: string;
  query: string;
  categories: string[];
  minRating: boolean;
};

/**
 * Dropdown sort katalog.
 */
export function CatalogSort({
  sort,
  query,
  categories,
  minRating,
}: CatalogSortProps) {
  const router = useRouter();

  return (
    <div className="flex items-center gap-4">
      <span className="font-headline text-label-md font-medium text-on-surface-variant">
        Sort by:
      </span>
      <select
        value={sort}
        onChange={(e) => {
          router.push(
            buildHref(
              { q: query, sort: e.target.value, minRating },
              categories,
            ),
          );
        }}
        className="catalog-select min-w-[180px] cursor-pointer rounded-xl border-none bg-surface-container-low px-6 py-2.5 pr-10 font-headline text-label-md focus:ring-2 focus:ring-primary/20 focus:outline-none"
      >
        <option value="popular">Most Popular</option>
        <option value="newest">Newest Release</option>
        <option value="price-asc">Price: Low to High</option>
        <option value="price-desc">Price: High to Low</option>
      </select>
    </div>
  );
}
