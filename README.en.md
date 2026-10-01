<div align="center">

# smart-naive-table

A columns-driven table component for **Vue 3 + Naive UI**<br>
Write `columns`, plug in a `fetcher` — the search form, pagination, dict translation and column settings are generated for you

[![npm](https://img.shields.io/npm/v/smart-naive-table?color=18a058)](https://www.npmjs.com/package/smart-naive-table)
[![license](https://img.shields.io/github/license/SmartCode-X/smart-naive-table?color=18a058)](./LICENSE)

[简体中文](./README.md) | English

</div>

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/SmartCode-X/smart-naive-table/main/assets/basic-dark.png">
  <img alt="smart-naive-table screenshot" src="https://raw.githubusercontent.com/SmartCode-X/smart-naive-table/main/assets/basic-light.png">
</picture>

<p align="center">
  <a href="#quick-start">Quick start</a> ·
  <a href="#recipes">Recipes</a> ·
  <a href="#global-defaults--i18n">i18n</a> ·
  <a href="#api">API</a>
</p>

## Features

- **Columns drive everything**: add `search` to a column and it becomes a search field; add `options` and it translates cells and feeds the select — one declaration, used everywhere
- **One function for the backend**: `fetcher` receives `{ page, pageSize, ...filters }` and returns `{ items, total }`
- **Toolbar out of the box**: refresh (remote mode only), column settings (show / hide, drag to reorder, pin left / right), remembered per table; an optional "More" menu (`toolbar.more`); the density toggle is no longer shown by default (`toolbar: { density: true }` brings it back)
- **Header filters + column resize**: add `filter` to a column for a funnel icon — a checkbox panel or a multi-condition panel (up to 5 conditions, AND / OR, keyboard-accessible); resized widths are remembered, and dragging one column moves only that column
- **Follows your Naive theme**: light / dark and locale come from `<n-config-provider>`
- **Details handled**: race-guarded requests, empty params stripped, fixed-column width fallback, deduped async dicts
- **Lightweight**: the only runtime dependency is `sortablejs` (loaded only when row dragging is on); ESM with full TypeScript types

## Install

```bash
npm i smart-naive-table
```

Requires `vue >= 3.3` and `naive-ui >= 2.34` in your project.

## Quick start

```vue
<script setup lang="ts">
import { SmartTable, type SmartTableColumn, type SmartTableFetcher } from 'smart-naive-table'

interface User {
  id: number
  account: string
  name: string
  status: number
  createTime: string
}

// ① Columns: `search` creates a search field; `options` + `tag` turn status values into colored tags
const columns: SmartTableColumn<User>[] = [
  { type: 'index' },
  { key: 'account', title: 'Account', search: true },
  { key: 'name', title: 'Name', search: true },
  {
    key: 'status',
    title: 'Status',
    search: true,
    tag: true,
    options: [
      { label: 'Active', value: 1, tagType: 'success' },
      { label: 'Resigned', value: 2, tagType: 'error' },
    ],
  },
  { key: 'createTime', title: 'Created', format: 'datetime' },
]

// ② Backend: map your API response to { items, total }
const fetcher: SmartTableFetcher<User> = async ({ page, pageSize, ...query }) => {
  const res = await getUserPage({ current: page, size: pageSize, ...query }) // your API here
  return { items: res.records, total: res.total }
}
</script>

<template>
  <!-- ③ Render; storage-key remembers the user's column settings -->
  <SmartTable :columns="columns" :fetcher="fetcher" storage-key="user-list" />
</template>
```

That gives you a complete list page:

- **Search area**: "Account" and "Name" inputs, a "Status" select (options from `options`), plus Search / Reset buttons
- **Table**: row numbers, status tags, formatted time, pagination at the bottom
- **Toolbar**: refresh (remote mode only), column settings; the density toggle is hidden by default (`toolbar: { density: true }` brings it back)

When you click Search, `fetcher` receives (empty values already stripped):

```js
{ page: 1, pageSize: 100, account: 'user01', status: 1 }
```

> **Tip**: render SmartTable inside `<n-config-provider>` — theme and locale follow it. The full code behind the screenshot is in [playground/DemoBasic.vue](./playground/DemoBasic.vue).

## Recipes

### Search fields

```ts
{ key: 'name', title: 'Name', search: true }                             // input
{ key: 'status', title: 'Status', options: statusOptions, search: true } // has options → select
{ key: 'age', title: 'Age', search: { type: 'number' } }                 // pick the control type
{ key: 'keyword', title: 'Keyword', hideInTable: true, search: true }    // search-only, not a column

// Date range, sent as createRange → fetcher receives createRange: ['2024-01-01', '2024-01-31']
{ key: 'createTime', title: 'Created', search: { type: 'daterange', key: 'createRange' } }
```

Control types: `input` (default), `number`, `select`, `date`, `daterange`, `switch`; use `search.render` for a fully custom control. All fields in [SearchConfig](#searchconfig).

Search area layout:

```vue
<SmartTable :search="{ collapsible: true, collapsedRows: 1 }" /> <!-- collapse beyond 1 row, with expand / collapse -->
<SmartTable :search="{ layout: 'inline' }" />                    <!-- no card, single wrapping row for narrow panes -->
<SmartTable :search="false" />                                   <!-- no search area -->
```

### Dicts, tags and formats

```ts
import type { SmartTableOption } from 'smart-naive-table'

const statusOptions: SmartTableOption[] = [
  { label: 'Active', value: 1, tagType: 'success' },
  { label: 'On leave', value: 2, tagType: 'warning' },
  { label: 'Resigned', value: 3, tagType: 'error' },
]

{ key: 'status', title: 'Status', options: statusOptions, tag: true }       // colored tag
{ key: 'deptId', title: 'Department', options: () => api.getDeptOptions() } // async dict: loading + dedup built in
{ key: 'salary', title: 'Salary', format: 'money' }                         // 6,000.00
{ key: 'birthday', title: 'Birthday', format: 'date' }                      // 2024-01-01
{ key: 'score', title: 'Score', format: (v) => `${v} pts` }                 // custom
```

`options` accepts a static array, a `ref`, or an async function; reload async dicts with the instance method `reloadOptions()`.

### Actions column and custom cells

```ts
import { h } from 'vue'
import { NButton } from 'naive-ui'

{
  key: 'actions',
  title: 'Actions',
  width: 120,
  fixed: 'right',
  hideInSetting: true, // not listed in column settings
  render: (row) => h(NButton, { text: true, type: 'primary', onClick: () => edit(row) }, () => 'Edit'),
}
```

Or use a slot instead of a `render` function:

```vue
<SmartTable :columns="columns" :fetcher="fetcher">
  <template #cell-name="{ row }">
    <a @click="open(row)">{{ row.name }}</a>
  </template>
</SmartTable>
```

Cell priority: `render` → `#cell-{key}` slot → `options` translation → `format` → raw value.

### Column settings

![Column settings](https://raw.githubusercontent.com/SmartCode-X/smart-naive-table/main/assets/column-settings.png)

Open it from the rightmost toolbar icon: toggle visibility, drag to reorder, pin left / right.

- With `storage-key`, settings are saved to localStorage and survive reloads
- When column definitions change, saved settings merge safely: removed columns are dropped, new ones are inserted at their declared position
- `hide: true` starts hidden (can be re-enabled in the panel); `hideInSetting: true` keeps a column out of the panel

### Header filters

Add `filter` to a column and a funnel icon appears in its header. The panel comes in two shapes, picked per column:

- **Checkbox panel** (the column has `options`): tick dict entries; with multi-select this is internally "several *equals* conditions joined by **or**" (`multiple: false` uses the official radio buttons). "Advanced conditions" at the bottom switches to multi-condition editing; conditions the checkboxes can't express (e.g. *not equals*) open there automatically instead of being dropped
- **Condition panel** (no `options`): several "action + value" rows (up to 5; AND / OR once there are 2 or more). Actions default by value type (text gets *contains / not contains / equals / not equals*; numbers and dates get *equals / greater than / less than*, ...)
- The panel edits a draft that only applies on "OK"; Esc closes it and discards the draft, and Tab cycles inside the panel

```ts
const columns: SmartTableColumn<Row>[] = [
  // Has a dict -> checkbox panel; multiple: false makes it single-select
  { key: 'status', title: 'Status', options: statusOptions, tag: true, filter: true },
  // No dict -> condition panel, text defaults to contains / not contains / equals / not equals
  { key: 'name', title: 'Name', filter: true },
  // Number column: an initial value (also what "Reset" restores)
  {
    key: 'salary',
    title: 'Salary',
    format: 'money',
    filter: { defaultValue: { logic: 'and', conditions: [{ action: 'gte', value: 10000 }] } },
  },
  // Date column: a date-only value compares by whole day, so "equals 2024-03-05" matches any time that day
  { key: 'createTime', title: 'Created', format: 'datetime', filter: true },
]
```

**Remote mode** (with `fetcher`) filters on the server: changing conditions goes back to page 1 and reloads. The default request shape is below — translate it into SQL / ORM conditions on your side:

```jsonc
{
  "page": 1,
  "pageSize": 100,
  "filters": [
    { "field": "name", "logic": "and", "conditions": [{ "action": "contains", "value": "ali" }] },
    { "field": "status", "logic": "or", "conditions": [{ "action": "equal", "value": 1 }, { "action": "equal", "value": 2 }] }
  ]
}
```

If your backend expects a different shape, pass your own serializer (or set it once globally via `createSmartTableDefaults({ filterSerializer })`):

```vue
<SmartTable :columns="columns" :fetcher="fetchList" :filter-serializer="toMyBackendShape" />
```

**Static mode** (with `data`) filters on the client, no adapter code needed. For custom matching use `filter.filter`:

```ts
{ key: 'tags', title: 'Tags', filter: { filter: (value, row) => row.tags.some((t) => matchFilterValue(value, t)) } }
```

You can also replace the whole panel; `ctx` carries `value`, `setValue` and `close`:

```ts
{ key: 'deptId', title: 'Department', filter: { render: ({ value, setValue, close }) => h(MyPanel, { value, setValue, close }) } }
```

Filter state is readable and writable: `tableRef.filters`, `tableRef.setFilter(key, value)`, `tableRef.clearFilters()`, and changes emit `@filter-change`.

To show users which conditions are active, add `filter-chips`: a row of chips appears under the toolbar — click a chip to reopen that column's panel, × removes that one condition, and chips that don't fit fold into "+N". When some column declares a `defaultValue`, "Restore defaults" appears only once the state deviates from the defaults; otherwise "Clear all" appears with 2 or more chips:

```vue
<SmartTable :columns="columns" :fetcher="fetchList" filter-chips />
```

To turn every filter off at once (same shape as `:search="false"`; column-level `filter` declarations stop taking effect too):

```vue
<SmartTable :columns="columns" :fetcher="fetchList" :filter="false" />
```

You can also disable them globally with `createSmartTableDefaults({ filterable: false })` and re-enable one table with `:filter="true"`.

### Column resize

Add `resizable` to the table and every data column can be dragged by its right header edge:

```vue
<SmartTable :columns="columns" :fetcher="fetchList" storage-key="staff" resizable @column-resize="onResize" />
```

- To opt a column out, set `resizable: false` on it (a column's own value always wins over the table-level switch)
- With `storage-key`, widths are stored in localStorage next to the column settings and survive reloads
- `@column-resize` (`key`, `width`) fires continuously while dragging; the localStorage write is debounced internally
- **Dragging one column changes only that column**: the first drag pins every column (including index / selection) to its current rendered width and switches the table to `table-layout: fixed` with its width fixed to the sum of the columns. Columns to the left stay put; only the dragged one follows the cursor
- **The table always fills its container**: when the columns add up to less than the container, the leftover width is absorbed by the **last visible, non-fixed, draggable column (the "absorber")**; there is no filler column in the header any more and every other column keeps the width you dragged. Widening past the container scrolls horizontally as before. **The absorber has no drag handle (even before you have dragged anything)**: drag its left neighbour's handle instead; put `resizable: false` on a column to make it opt out (the absorber moves to the previous column). "Restore defaults" in column settings brings back the auto-fit behavior
- Columns can't be dragged to zero: resizable columns get a fallback `minWidth` of 60, or `max(60, icon floor)` for columns with sort / filter icons (93 sort only, 102 filter only, 123 both); an explicit `minWidth` on the column wins
- "Restore defaults" in column settings resets widths too

### Pagination

Pagination defaults to the official `simple` mode (page input / total pages), 100 rows per page, with `[100, 500, 1000]` to choose from:

- The page-size picker is an official `NPagination` nested in the pagination `suffix`, so its text follows the locale of `<n-config-provider>` ("100 / page") with no extra label to configure; `{ label, value }` objects in `pageSizes` are shown as-is, and a current page size missing from the list is merged in
- In the narrow tier (table root narrower than 600px) the page-size picker is not drawn, so the pagination bar never wraps
- Initial page size, in order of precedence: the instance `default-page-size` > the instance `pagination.pageSize` / `pagination.defaultPageSize` > the global `defaultPageSize` > the first entry of `pageSizes` given explicitly by the host (instance or global) > 100
- To go back to the page-number list: `:pagination="{ simple: false }"` (the official `showSizePicker` / `pageSizes` then apply); in `simple` mode Naive doesn't render `showQuickJumper` / `pageSlot`
- ⚠ In remote mode the request now carries `pageSize: 100` by default: if your backend caps `pageSize`, set `default-page-size` or `pageSizes` accordingly
- Changing the page size goes back to page 1 (remote and static-data modes alike)
- Without `fill-height`, after changing pages / page size the page scrolls back to the top of the card if that top has scrolled out of view; with `fill-height` the table body scrolls inside the card and resets to its top instead

### More scenarios

| Scenario | How |
|---|---|
| Server-side sorting | `sorter: true` on a column; `fetcher` receives `sortField` and `sortOrder` (`'asc'` / `'desc'`). For multi-column sorting use the official `sorter: { multiple: n }` (higher wins) and `fetcher` additionally receives `sorts: [{ field, order }]`; a column's `defaultSortOrder` takes effect (sent with the first request) |
| Programmatic sorting | `tableRef.sort(key, order)` / `tableRef.clearSorter()` (same signature as the official `DataTableInst`; remote mode reloads from page 1) |
| Fill the parent | `fill-height`; the parent needs a definite height (the body scrolls inside the card, pagination sticks to the bottom, virtual scroll). Without it, changing pages scrolls back to the top of the card |
| External filters | `:params="{ deptId }"`; changes go back to page 1 and reload (e.g. a department tree) |
| Static data | pass `:data="list"` without `fetcher` for client-side pagination; filter yourself on `@search` |
| Tree table | static rows with a `children` field, plus `row-key` |
| Expandable rows | special column `{ type: 'expand', renderExpand: (row) => ... }` |
| Multi-select | special column `{ type: 'selection' }` + `v-model:checked-row-keys` |
| Master-detail highlight | `:active-row-key="currentId"` + `@row-click` |
| Row drag-to-reorder | `row-draggable` + `@row-drag-sort`; the table reorders, you persist via your API |
| Column resize | `resizable` on the table, or `resizable: true` on a column |
| Header filters | `filter: true` on a column; remote mode receives a `filters` param |
| Active-filter chips | `filter-chips` (a row under the toolbar; click to reopen the panel, × removes one condition) |
| Toolbar "More" menu | `:toolbar="{ more: [{ label: 'Export', key: 'export' }] }"` + `@more-select="(key) => ..."` (the options are the official `NDropdown` `options`; no built-in export / import) |
| Cell grid lines | on by default (internal `single-line: false`); pass `:single-line="true"` for the single-line look |
| Virtual scroll | `virtual-scroll` + `max-height` |
| Summary row | `:summary="(pageData) => ..."` |
| Other table props | put them on SmartTable; they are forwarded to `n-data-table` (e.g. `striped`, `bordered`) |

### Calling table methods

```vue
<script setup lang="ts">
import { ref } from 'vue'
import type { SmartTableInst } from 'smart-naive-table'

const tableRef = ref<SmartTableInst<User>>()

// Call wherever needed:
// tableRef.value?.refresh()  reload the current page (e.g. after editing)
// tableRef.value?.search()   back to page 1 (e.g. after creating)
// tableRef.value?.reset()    clear filters and reload
// tableRef.value?.sort('createTime', 'descend')  programmatic sort; clearSorter() clears it
</script>

<template>
  <SmartTable ref="tableRef" :columns="columns" :fetcher="fetcher" />
</template>
```

### Create / edit / delete dialogs

`useTableCrud` manages the dialog's open / submit / delete state; the dialog and form are your own `n-modal` + `n-form`:

```ts
import { useTableCrud } from 'smart-naive-table'

const crud = useTableCrud({
  form: () => ({ name: '', email: '' }), // empty form for "create"
  create: (form) => api.create(form),
  update: (form, row: User) => api.update(row.id, form),
  remove: (row: User) => api.remove(row.id),
  onSuccess: () => tableRef.value?.refresh(),
})
```

```vue
<!-- Open: crud.openCreate() / crud.openEdit(row); delete: crud.removeRow(row) -->
<n-modal v-model:show="crud.visible.value" preset="card" :title="crud.mode.value === 'create' ? 'Create' : 'Edit'">
  <n-form :model="crud.model.value">
    <n-form-item label="Name"><n-input v-model:value="crud.model.value.name" /></n-form-item>
  </n-form>
  <template #footer>
    <n-button type="primary" :loading="crud.submitting.value" @click="crud.submit()">Save</n-button>
  </template>
</n-modal>
```

On success `crud.submit()` closes the dialog and calls `onSuccess`. Full example: [playground/DemoCrud.vue](./playground/DemoCrud.vue).

## Global defaults & i18n

`provide` defaults once in your entry file and every table inherits them:

```ts
// main.ts
import { computed, createApp } from 'vue'
import { SMART_TABLE_DEFAULTS, createSmartTableDefaults } from 'smart-naive-table'
import App from './App.vue'

const app = createApp(App)
const t = i18n.global.t // your i18n function, e.g. vue-i18n

app.provide(
  SMART_TABLE_DEFAULTS,
  createSmartTableDefaults({
    align: 'left',
    pageSizes: [100, 500, 1000],
    emptyText: '-',
    // a ref / computed makes labels follow the locale — no :labels needed on each page
    labels: computed(() => ({ search: t('common.search'), reset: t('common.reset') /* ... */ })),
    // Chinese-only app? use the built-in set instead: labels: zhCNLabels
  }),
)

app.mount('#app')
```

- **Built-in text** is English; a complete Chinese set ships with the package — `import { zhCNLabels } from 'smart-naive-table'`, then `labels: zhCNLabels` (tweak single words with `{ ...zhCNLabels, search: '查找' }`)
- Override any key via `labels`: `search`, `reset`, `refresh`, `density`, `densityComfortable`, `densityCompact`, `columnSettings`, `columnSettingsReset`, `fixedLeft`, `fixedRight`, `fixedNone`, `expand`, `collapse`, the filter keys, and the keys added in 3.0 (filter panel, chips, "More"). The 3.0 keys are all optional, so a complete 2.1.1 labels object still type-checks; missing keys fall back to English
- **Locale switching**: pass `labels` as a `computed`, and write column `title` / option `label` as functions `() => t('xxx')` — they update instantly
- **Precedence**: prop on the table / value on the column > global default > built-in default
- Input placeholders and date panels come from Naive UI's own locale — set `:locale` / `:date-locale` on `<n-config-provider>`
- All fields in [Global default fields](#global-default-fields)

## API

### Column

Data columns accept every Naive UI column prop (`width`, `minWidth`, `fixed`, `align`, `ellipsis`, `sorter`, `resizable`, ...), plus:

> `filter` is owned by this package (it adds a condition panel and remote wiring on top of Naive's column filter), so Naive's native `filter` / `filterOptions` props are no longer forwarded.

| Field | Type | Description |
|---|---|---|
| `key` | `string` | **Required**. Row field; also the search param name and slot name |
| `title` | `string \| () => VNodeChild` | Column title; the function form follows locale switches |
| `search` | `boolean \| SearchConfig` | Creates a search field; `true` = select if `options` exist, else input |
| `filter` | `boolean \| FilterConfig` | Adds a header filter; `true` = checkbox panel if `options` exist, else condition panel |
| `options` | `Option[] \| Ref<Option[]> \| () => Promise<Option[]>` | Dict: translates cells and feeds the search select |
| `tag` | `boolean` | Render the translated value as an `NTag`, colored by the option's `tagType` |
| `format` | `'date' \| 'datetime' \| 'money' \| (value, row) => string` | Display format |
| `render` | `(row, index) => VNodeChild` | Custom cell, highest priority |
| `hide` | `boolean` | Initially hidden; can be re-enabled in column settings |
| `hideInTable` | `boolean` | Search-only field, never rendered as a column |
| `hideInSetting` | `boolean` | Rendered, but not listed in column settings (typical: actions) |
| `children` | `SmartTableDataColumn[]` | Multi-level headers |

- **Option**: `{ label, value, tagType?, disabled?, children? }`; `tagType` is one of `default` / `primary` / `info` / `success` / `warning` / `error`
- **Special columns**: `{ type: 'index' }` row number (continues across pages), `{ type: 'selection' }` checkbox, `{ type: 'expand', renderExpand }` expandable row

### SearchConfig

| Field | Type | Description |
|---|---|---|
| `type` | `'input' \| 'number' \| 'select' \| 'date' \| 'daterange' \| 'switch'` | Control type |
| `key` | `string` | Request param name; defaults to the column `key` |
| `label` | `string \| () => string` | Form label; defaults to the column title |
| `placeholder` | `string` | Defaults to Naive's locale placeholder |
| `defaultValue` | `any` | Initial value, also restored on reset |
| `order` | `number` | Sort order, smaller first; defaults to column order |
| `span` | `number` | Grid span, default 1 |
| `props` | `object` | Forwarded to the underlying Naive control |
| `render` | `(ctx) => VNodeChild` | Fully custom control; `ctx` has `value`, `setValue`, `params`, `search` |

### FilterConfig

| Field | Type | Default | Description |
|---|---|---|---|
| `mode` | `'options' \| 'condition'` | `'options'` if a dict exists | Panel shape: checkbox list / condition rows |
| `key` | `string` | the column `key` | Filter param name (override when it differs from the displayed field) |
| `options` | same as column `options` | reuses the column dict | Candidates used only by the filter |
| `multiple` | `boolean` | `true` | Multi-select in the checkbox panel |
| `type` | `'input' \| 'number' \| 'select' \| 'date'` | inferred from `format` | Value control in the condition panel |
| `actions` | `FilterAction[]` | by `type` | Selectable actions, see below |
| `defaultValue` | `FilterValue \| null` | `null` | Initial filter value, and what "Reset" restores |
| `props` | `object` | — | Forwarded to the value control |
| `render` | `(ctx) => VNodeChild` | — | Replace the whole panel; `ctx` has `value`, `setValue`, `close` |
| `filter` | `(value, row) => boolean` | built-in evaluation | Custom matching in static `data` mode (ignored in remote mode) |

- **FilterAction** (15): `'equal'`, `'notEqual'`, `'contains'`, `'notContains'`, `'gt'`, `'gte'`, `'lt'`, `'lte'`, plus the 3.0 additions `'isNull'` / `'isNotNull'` (empty / not empty, no value needed), `'like'` (SQL `LIKE`: `%` any run, `_` one character, whole-string, case-insensitive), `'startsWith'` / `'endsWith'` (case-insensitive) and `'in'` / `'notIn'` (the value is an array). **The header panel still offers only the first 8 by default; the others must be enabled explicitly with `filter.actions` on the column**; unknown actions never match
- **FilterValue**: `{ logic: 'and' | 'or', conditions: { action, value }[] }`; conditions whose value is empty (`null` / `''` / `[]`) are ignored (except `isNull` / `isNotNull`), and an all-empty value means "not filtered"
- Columns are always combined with **and**; `logic` only applies within one column
- The built-in panel edits up to 5 conditions per column (AND / OR once there are 2 or more); checkbox mode produces several `equal`s joined by **or**, and a single `in` written back through the checkboxes becomes several `equal`s joined by **or** (same meaning, different serialized shape). A programmatic `setFilter` / `defaultValue` has no limit

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `columns` | `SmartTableColumn[]` | — | **Required**. Column definitions |
| `fetcher` | `(params) => Promise<{ items, total }>` | — | Remote data source |
| `data` | `T[]` | — | Static data (client-side pagination); use instead of `fetcher` |
| `row-key` | `string \| (row) => key` | `'id'` | Row identity |
| `params` | `object` | — | Extra request params; changes go back to page 1 and reload |
| `immediate` | `boolean` | `true` | Fetch on mount |
| `default-page-size` | `number` | `100` | Initial page size; when the host gives `pageSizes`, defaults to its first entry (precedence: see Pagination) |
| `pagination` | `false \| PaginationProps` | — | `false` hides pagination; an object merges over built-in settings; defaults to the official `simple` mode, `{ simple: false }` restores the page-number list |
| `search` | `false \| SearchFormConfig` | — | Search area config (see below); `false` hides it |
| `filter` | `boolean` | `true` | `false` turns off every header filter (even on columns declaring `filter`) |
| `filter-chips` | `boolean` | `false` | Show active-filter chips under the toolbar |
| `toolbar` | `false \| { refresh, density, columnSettings, more }` | refresh (remote only) and column settings; `density` defaults to `false` | Toolbar button switches; `more` holds the "More" menu options (the official `NDropdown` `options`), selecting one emits `more-select` |
| `title` | `string` | — | Table title, or use the `#title` slot |
| `card-props` | `Partial<CardProps>` | — | Official `NCard` props for the cards the library renders (table card, search card), merged over the default `size="small"` + 16px padding on all sides; `{ size: 'medium' }` restores the old look |
| `fill-height` | `boolean` | `false` | Fill the parent: the body scrolls inside the card (official `flex-height` + virtual scroll) and pagination sticks to the bottom; **the parent needs a definite height**; `max-height` is ignored while on |
| `storage-key` | `string` | — | Persist column settings (visibility / order / pinning / widths) to localStorage; **density is only read from / written to storage when `toolbar: { density: true }` (the density button) is on** — otherwise `default-density` decides |
| `default-density` | `'comfortable' \| 'compact'` | `'compact'` | Initial density (reactive: when the host changes it, mounted tables follow) |
| `labels` | `Partial<SmartTableLabels>` | English | Override component text; pass a `computed` for locale switching |
| `active-row-key` | `string \| number \| null` | — | Highlight the matching row |
| `row-draggable` | `boolean` | `false` | Enable row drag-to-reorder |
| `resizable` | `boolean` | `false` | Make all data columns resizable; a column's own `resizable` wins |
| `filter-serializer` | `(state) => object` | see Header filters | Serializes filter state into request params |
| `drag-handle` | `string` | — | CSS selector for the drag handle; whole row if omitted |

Anything not listed (e.g. `striped`, `max-height`, `checked-row-keys`, `virtual-scroll`) is forwarded to `n-data-table`.

**SearchFormConfig** (object form of the `search` prop):

| Field | Default | Description |
|---|---|---|
| `layout` | `'grid'` | `'grid'` card with grid; `'inline'` no card, single wrapping row |
| `cols` | `'1 s:2 m:3 l:4'` | Grid columns (responsive to screen width) |
| `labelPlacement` | `'left'` | `'left'` / `'top'` |
| `labelWidth` | — | Label width |
| `collapsible` | `false` | Collapse when there are many fields (grid only) |
| `collapsedRows` | `1` | Rows kept visible when collapsed |

### Events

| Event | Payload | When |
|---|---|---|
| `search` | `params` | Search clicked (params already cleaned) |
| `reset` | — | Reset clicked |
| `loaded` | `rows, total` | Remote data loaded |
| `error` | `err` | Request failed (the table shows no message; handle it yourself) |
| `row-click` | `row, index` | Row clicked |
| `row-drag-sort` | `{ from, to, reordered }` | Row drag finished |
| `filter-change` | `key, value, state` | A header filter changed (`key` is `''` for `clearFilters`) |
| `column-resize` | `key, width` | Column resized (fires continuously while dragging) |
| `more-select` | `key, option` | An item of the toolbar "More" menu (`toolbar.more`) was selected |

### Slots

| Slot | Props | Description |
|---|---|---|
| `title` | — | Table title |
| `toolbar` | — | Left side of the toolbar, e.g. Create / batch buttons |
| `toolbar-right` | — | Right side of the toolbar, before the built-in buttons |
| `cell-{key}` | `{ row, index }` | Custom cell for a column |
| `header-{key}` | `{ column }` | Custom header for a column |
| `empty` | — | Content when there is no data |
| `pagination-prefix` | Naive pagination info | Left of the pagination, e.g. "3 selected" |

### Instance methods

| Name | Description |
|---|---|
| `refresh()` | Reload with the current page and filters |
| `search()` | Back to page 1 and reload |
| `reset()` | Reset filters and reload |
| `reloadOptions(key?)` | Reload async dicts; all of them when `key` is omitted |
| `loading` / `rows` / `pagination` | Loading state, current rows, pagination state |
| `params` | Reactive search params, readable and writable |
| `filters` | Current filter state (read-only snapshot) |
| `setFilter(key, value)` | Set one column's filter; `null` clears it. Remote mode reloads from page 1 |
| `clearFilters()` | Clear all filters (restoring each column's `defaultValue`) |
| `sort(columnKey?, order?)` | Sort by a column (same signature as the official `DataTableInst.sort`: `order` defaults to `'ascend'`, omitting `columnKey` equals `clearSorter()`). Remote mode reloads from page 1; `@update:sorter` is notified |
| `clearSorter()` | Clear all sorting; `@update:sorter` is notified (payload `null`) |
| `columnWidths` | Widths of columns after dragging |
| `tableRef` | The raw `NDataTable` instance (`scrollTo`, etc.) |

### Global default fields

Set via `createSmartTableDefaults({...})`; all optional:

| Field | Built-in | Description |
|---|---|---|
| `labels` | English | Component text; accepts a `ref` / `computed` |
| `align` / `titleAlign` | `'center'` | Cell / header alignment |
| `emptyText` | `'—'` | Placeholder for empty values |
| `defaultPageSize` | — | Initial page size; when omitted, the first entry of an explicitly given `pageSizes`, else 100 |
| `pageSizes` | `[100, 500, 1000]` | Page size options |
| `showSizePicker` | `true` | Show the page size picker |
| `density` | `'compact'` | Default density |
| `dateValueFormat` | `'yyyy-MM-dd'` | Value format of date search fields |
| `searchCols` | `'1 s:2 m:3 l:4'` | Search grid columns |
| `fixedFallbackWidth` | `120` | Width for fixed columns without `width` |
| `indexWidth` | `64` | Row number column width |
| `tag` | `{ size: 'small', bordered: false }` | Tag style for `tag: true` columns |
| `activeRowBg` | — | Background of the highlighted row |
| `resizable` | `false` | Make every table's columns resizable by default |
| `filterable` | `true` | Whether columns may declare header filters; `false` turns them off globally |
| `resizeMinWidth` | `60` | Minimum width of a resizable column (columns with sort / filter icons use the larger of it and the icon floor) |
| `filterSerializer` | see Header filters | Filter state -> request params |

### Other exports

- `useSmartTable(fetcher, options)`: the UI-agnostic data core the component uses (loading, pagination, search, race guard) — build your own UI on it
- Filter core: `matchFilterValue`, `applyFilters`, `defaultFilterSerializer`, `isFilterActive`, `isOptionsRepresentable`, `NO_VALUE_ACTIONS`, `isValuelessAction`, `actionValueKind`, ... — UI-agnostic, reusable in a backend mock or your own UI
- Helpers and text: `cleanParams`, `formatDate`, `formatDatetime`, `formatMoney`, `defaultLabels`, `zhCNLabels`, ...
- All types: `SmartTableColumn`, `SmartTableFetcher`, `SmartTableInst`, `SmartTableOption`, `SearchConfig`, ...

## Behavior notes

- Search params are cleaned before each request: strings trimmed; empty strings, `null`, `undefined` and empty arrays dropped; `0` and `false` kept
- During fast page flips, stale responses that arrive late are discarded
- Reset restores each field to `defaultValue`, or `null` if none
- A fixed column without `width` gets one automatically (`minWidth` or 120), so Naive's fixed columns stay aligned
- `scroll-x` defaults to the sum of visible column widths (including dragged ones); pass your own to override
- Changing filters goes back to page 1: remote mode reloads, static mode filters on the client
- Conditions whose value is empty (`null` / `''` / `[]`) are dropped and never sent to the backend (`isNull` / `isNotNull` need no value and are sent as usual); `0` and `false` are kept
- A date-only filter value (`YYYY-MM-DD`) compares by whole day, so `equals 2024-03-05` matches any time that day
- Width writes to localStorage are debounced; the stored shape moved from `v1` to `v2`, and existing column visibility / order / pinning keep working; a stored density **only applies when the density button is on (`toolbar: { density: true }`)** — otherwise `default-density` decides (B2)
- Column settings keep at least one column: when only one is visible, its checkbox is disabled

## Development

```bash
npm install
npm run dev        # start the playground (source of the screenshots above)
npm test           # unit tests
npm run typecheck  # type check
npm run build      # build to dist/
```

**Branches & releases**: day-to-day work happens on `dev` and lands on `main` through a PR. To release, run `npm version patch --no-git-tag-version` (or `minor` / `major`) on `dev` and update the [CHANGELOG](./CHANGELOG.md); once merged into `main`, it is published to npm and a GitHub Release is created automatically.

## License

[Apache-2.0](./LICENSE)
