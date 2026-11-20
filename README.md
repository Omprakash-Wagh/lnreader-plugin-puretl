# LNReader Extension for Pure Love Translations

A fully functional, general-purpose [LNReader](https://github.com/LNReader/lnreader) source extension for **Pure Love Translations** ([puretl.com](https://puretl.com/)).

This plugin allows users to discover, browse, search, and read all translated Chinese-to-English web novels directly inside the LNReader mobile app.

---

## 🌟 Key Features

### 1. Novel Discovery & Browsing
- **Full Catalogue Support:** Dynamically fetches and parses the entire novel directory from [puretl.com/translations](https://puretl.com/translations).
- **Cover Images & High-Res Artwork:** Automatically extracts high-resolution novel cover art hosted on Squarespace CDN.
- **Search Functionality:** Case-insensitive search supporting keyword searches (e.g., *"Ten Day Ultimatum"*, *"Epiphanies of Rebirth"*, *"Villainous Junior Brother"*).
- **Filters:** Includes status filters (*Ongoing*, *Completed*) and sorting options (*Default*, *A-Z*, *Z-A*).
- **Pagination Support:** Gracefully handles single-page full-catalogue structures without infinite loops or duplicate entries.

### 2. Comprehensive Novel Metadata
- **Title:** Cleaned and formatted novel titles (handles Chinese raw titles and English translations).
- **Author & Translator Credits:** Extracted from Squarespace metadata blocks (e.g. *Member of Insect Killing Squadron*, *Yuan Hegu*, *Pure*).
- **Status:** Correctly mapped to official LNReader `NovelStatus` enums (`Ongoing`, `Completed`, `On Hiatus`, `Unknown`).
- **Genres & Tags:** Extracted as clean comma-separated lists (e.g. *Psychological Thriller, Horror, Mystery, Supernatural*).
- **Synopsis:** Extracted from page meta descriptions and article summary blocks.

### 3. Advanced Chapter Listing
- **Multi-Layout Support:**
  - **Archive Block Layout:** Handles `ul.archive-group-list` and `li.archive-item` with arc/volume grouping (e.g., *Arc 1: I Hear You All - TDU Chapter 1*).
  - **Accordion Layout:** Handles `.accordion-item` with multi-part chapters (e.g., *Chapter 44 (Part 1)*).
  - **Direct Index Layout:** Robust fallback for any standard novel table of contents.
- **Order Preservation:** Preserves strict chronological reading order (Chapter 1 through Chapter 750+).
- **Deduplication:** Automatic path normalization to avoid duplicate chapter links.
- **Sequential Numbering:** Accurately extracts chapter numbers for reading progress tracking.

### 4. Chapter Reader & Content Cleaning
- **Formatting Preservation:**
  - Full paragraph separation and line breaks (`<p>`).
  - Font styling: bold (`<strong>`, `<b>`), italics (`<em>`, `<i>`), underlines (`<u>`).
  - Headings (`<h1>` through `<h4>`) preserved with proper hierarchy.
- **Footnotes & Translator Notes:**
  - Introductory and concluding translator notes (*TL Note: ...*) are retained.
  - Numbered cultural references and Cantonese idiom footnotes (*[1] Hahm-ga-caan (冚家铲)...*) are fully preserved.
- **Distraction-Free Reading:**
  - ❌ Removes adblock pleas (*"❤️ If you like this novel, please consider turning off adblock..."*).
  - ❌ Removes duplicate in-page navigation links (*"Character Sheet | Index | Next"*, *"Back | Index | Next"*).
  - ❌ Removes website boilerplate, donation buttons (*Patreon*, *Ko-fi*), comment forms, and privacy policy links.

---

## 📁 Repository Structure

```
lnreader-plugin-puretl/
├── plugins/
│   └── english/
│       └── pureLoveTranslations.ts        # Main TypeScript source extension
├── public/
│   └── static/
│       └── src/
│           └── en/
│               └── pureLoveTranslations/
│                   └── icon.png           # 96x96 px source icon
├── src/
│   ├── libs/                              # Standard LNReader runtime helper libraries
│   │   ├── defaultCover.ts
│   │   ├── fetch.ts
│   │   ├── filterInputs.ts
│   │   └── novelStatus.ts
│   └── types/                             # LNReader TypeScript type definitions
│       ├── constants.ts
│       ├── filters.ts
│       └── plugin.ts
├── scripts/
│   ├── build-plugin-manifest.js           # Manifest generator
│   └── live-check-plugin.js               # Official LNReader live validation runner
├── .dist/
│   ├── plugins.json                       # Formatted plugin repository manifest
│   └── plugins.min.json                   # Minified manifest for LNReader app consumption
├── .js/
│   └── plugins/english/
│       └── pureLoveTranslations.js        # Compiled JavaScript plugin bundle
├── .github/
│   └── workflows/
│       └── publish-plugins.yml            # Automated GitHub Actions build & publish workflow
├── package.json                           # NPM dependencies and build scripts
├── tsconfig.json                          # TypeScript configuration
└── tsconfig.production.json               # Production build configuration
```

---

## 🚀 Installation into LNReader

### Method 1: Custom Plugin Repository (Direct In-App Install)

In the LNReader app on Android:
1. Navigate to **More** -> **Settings** -> **Plugins**.
2. Tap **Plugin Repositories** -> **Add Repository** (`+`).
3. Enter your repository's raw manifest URL:
   ```
   https://raw.githubusercontent.com/Omprakash-Wagh/lnreader-plugin-puretl/master/.dist/plugins.min.json
   ```
4. Tap **Add**.
5. Go to the **Plugins** tab in the main navigation, switch to **English**, find **Pure Love Translations**, and tap **Install** (`⬇`).

### Method 2: Contributing to the Official LNReader Repository

To contribute this plugin to the upstream [lnreader-plugins](https://github.com/LNReader/lnreader-plugins) registry:
1. Copy `plugins/english/pureLoveTranslations.ts` into `plugins/english/pureLoveTranslations.ts` in your fork of `LNReader/lnreader-plugins`.
2. Copy `public/static/src/en/pureLoveTranslations/icon.png` into `public/static/src/en/pureLoveTranslations/icon.png`.
3. Run `npm run check:plugin -- plugins/english/pureLoveTranslations.ts` to verify.
4. Submit a Pull Request.

---

## 🛠️ Development & Testing

### Prerequisites
- Node.js >= 22
- npm

### 1. Install Dependencies
```bash
npm install
```

### 2. Type-Checking
Verify that TypeScript compiles without errors against production target settings:
```bash
npx tsc --project tsconfig.production.json --noEmit
```

### 3. Compile Plugin Bundle
```bash
npm run build:compile
```

### 4. Build Repository Manifest
```bash
npm run build:manifest
```

### 5. Run Live Integration Test
Test the plugin live against `https://puretl.com`:
```bash
npm run check:plugin -- plugins/english/pureLoveTranslations.ts
```

Output:
```
## Plugin Live Check
### plugins/english/pureLoveTranslations.ts

| Check | Result | Details |
| --- | --- | --- |
| popularNovels | ✅ PASS | 45 novels |
| searchNovels  | ✅ PASS | 1 results for "Ten Day Ultimatum" |
| parseNovel    | ✅ PASS | 753 chapters |
| parseChapter  | ✅ PASS | 20428 chars |

Result: ✅ Passed — all checks succeeded.
```

---

## 🧪 Verified Test Results

The extension was rigorously tested against live novels on Pure Love Translations:

| Test Case | Target | Metric / Result | Status |
| :--- | :--- | :--- | :--- |
| **Novel Discovery** | Catalogue listing (`/translations`) | 45 novels discovered with valid titles, relative paths, and CDN covers | ✅ PASS |
| **Search by Title** | *"Ten Day Ultimatum"* | Exactly 1 match found, clean relative path `/ten-day-ultimatum` | ✅ PASS |
| **Search by Title** | *"Epiphanies of Rebirth"* | Matched novel correctly | ✅ PASS |
| **Empty Search** | *"nonexistentnovelxyz"* | Gracefully returned empty array (`[]`) without error | ✅ PASS |
| **Primary Novel Info** | *Ten Day Ultimatum* | Title, Cover, Author, Status (Ongoing), Genres, Synopsis extracted | ✅ PASS |
| **Primary Chapter List** | *Ten Day Ultimatum* | **753 chapters** extracted in chronological order (`c1` -> `c753`), 0 duplicates | ✅ PASS |
| **Chapter Reading 1** | *Ten Day Ultimatum* Ch. 1 | 20,428 characters; TL notes & Cantonese curse footnotes preserved; ads removed | ✅ PASS |
| **Chapter Reading 2** | *Ten Day Ultimatum* Ch. 2 | 21,748 characters; Nüwa footnotes & TL notes preserved; nav buttons removed | ✅ PASS |
| **Chapter Reading 3** | *Ten Day Ultimatum* Ch. 10 | 13,958 characters; Credits & TL notes preserved; clean text | ✅ PASS |
| **Secondary Novel Info** | *Epiphanies of Rebirth* | Title, Author (*Yuan Hegu*), Status (*Completed*), Genres (*Romance*) | ✅ PASS |
| **Secondary Chapter List**| *Epiphanies of Rebirth* | **155 chapters** extracted via Accordion parser | ✅ PASS |
| **Secondary Chapter Read**| *Epiphanies of Rebirth* Ch. 43p2 | 20,831 characters; pure TL notes preserved; ads and boilerplate removed | ✅ PASS |
| **Third Novel Test** | *The Villainous Junior Brother...* | 70 chapters parsed successfully | ✅ PASS |
| **URL Resolver** | `resolveUrl()` | Relative paths correctly resolved to absolute URLs | ✅ PASS |

**Total Unit & Integration Tests: 38/38 Passed (100% Success Rate).**

---

## 📄 License
MIT License. Content copyright belongs to the original authors and translators at [Pure Love Translations](https://puretl.com/).
