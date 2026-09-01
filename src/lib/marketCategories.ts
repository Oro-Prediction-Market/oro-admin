// Canonical category / subcategory lists shared by the market builder
// (MarketForm) and Market Management filters. Kept in their own module so the
// component files only export components (react-refresh/only-export-components).

export const CATEGORIES = [
  { value: "sports", label: "Sports" },
  { value: "gaming", label: "Gaming" },
  { value: "weather", label: "Weather" },
  { value: "entertainment", label: "Entertainment" },
  { value: "economy", label: "Economy" },
  { value: "political", label: "Political" },
  { value: "other", label: "Other" },
] as const

export const SPORT_SUBCATEGORIES = [
  "",
  "International",
  "National",
  "UEFA Champions League",
  "UEFA Europa League",
  "epl-match",
  "epl-season",
  "ucl-match",
  "ucl-season",
  "bpl-match",
  "bpl-winner",
  "bpl-topscorer",
  "Premier League (BPL)",
  "World Cup",
  "wc-winner",
  "wc-group",
  "wc-match",
  "wc-player",
  "Bhutanese Archery",
  "Cricket",
  "UFC",
  "Other",
]

// Esports disciplines — value is the slug the /esports hub buckets on, label is
// the game shown to admins. Keep in sync with ESPORTS_CATEGORIES in the
// PWA/TMA EsportsHubPage.tsx.
export const GAMING_SUBCATEGORIES: { value: string; label: string }[] = [
  { value: "", label: "— None —" },
  { value: "mlbb", label: "MLBB" },
  { value: "pubg", label: "PUBG" },
  { value: "dota2", label: "Dota 2" },
  { value: "lol", label: "League of Legends" },
  { value: "cod", label: "Call of Duty" },
  { value: "ea-fc", label: "EA FC Pro" },
  { value: "street-fighter", label: "Street Fighter" },
  { value: "tekken", label: "Tekken 8" },
  { value: "chess", label: "Chess" },
]
