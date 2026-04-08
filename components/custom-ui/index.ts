/**
 * /components/custom-ui – extended / customized UI components.
 *
 * Architecture rule:
 *   - Use these for patterns that extend shadcn/ui or wrap design-system tokens.
 *   - Keep each component focused on ONE concern.
 *   - Prefer composition over duplication.
 *
 * Components:
 *   TableWrapper / DataTable / Th / Td / Tr  — composable table primitives
 *   SearchFilterBar / FilterSelect            — standardized filter row
 *   PaginationBar                             — prev/next pagination
 *   IconAction                                — pill icon button (view/edit/delete)
 */

export { TableWrapper, DataTable, Th, Td, Tr } from "./data-table";
export { SearchFilterBar, FilterSelect } from "./search-filter-bar";
export { PaginationBar } from "./pagination-bar";
export { IconAction } from "./icon-action";
