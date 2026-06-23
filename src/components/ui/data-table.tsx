import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { Card, CardContent } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
  Loader2,
  FileDown,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { jsPDF } from "jspdf"
import "jspdf-autotable"

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  render?: (item: T) => React.ReactNode
  className?: string
  cellClassName?: string
}

export interface TableFilter {
  key: string
  label: string
  options: { value: string; label: string }[]
}

export interface DataTableProps<T> {
  data: T[]
  columns: Column<T>[]
  loading?: boolean
  searchable?: boolean
  searchPlaceholder?: string
  emptyMessage?: string
  emptyIcon?: React.ElementType
  onRowClick?: (item: T) => void
  pageSize?: number
  exportable?: boolean
  exportFilename?: string
  rowKey: (item: T) => string | number
  filters?: TableFilter[]
}

// ------------------------------------------------------------------
// Helpers
// ------------------------------------------------------------------

function getNestedValue(obj: any, path: string): any {
  return path.split(".").reduce((acc, part) => (acc != null ? acc[part] : undefined), obj)
}

function formatCellValue(val: any): string {
  if (val == null || val === "") return "-"
  if (val instanceof Date) return val.toLocaleDateString()
  if (typeof val === "object") return String(val)
  return String(val)
}

function toExportValue(val: any): string {
  if (val == null || val === "") return "-"
  if (val instanceof Date) return val.toLocaleDateString()
  return String(val)
}

function getRowValue<T>(item: T, col: Column<T>): string {
  // Try render prop first for string output, otherwise raw value
  if (col.render) {
    const rendered = col.render(item)
    // If render returns a string or number use that; otherwise fallback
    if (typeof rendered === "string" || typeof rendered === "number") return String(rendered)
    // For complex React nodes, try the raw nested value
  }
  const raw = getNestedValue(item, col.key)
  return formatCellValue(raw)
}

// ------------------------------------------------------------------
// Component
// ------------------------------------------------------------------

export default function DataTable<T>({
  data,
  columns,
  loading = false,
  searchable = true,
  searchPlaceholder = "Search...",
  emptyMessage = "No data found",
  emptyIcon: EmptyIcon,
  onRowClick,
  pageSize = 25,
  exportable = false,
  exportFilename = "export",
  rowKey,
  filters,
}: DataTableProps<T>) {
  // ─── state ──────────────────────────────────────────────────────
  const [searchText, setSearchText] = useState("")
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc")
  const [currentPage, setCurrentPage] = useState(1)
  const [filterValues, setFilterValues] = useState<Record<string, string>>({})

  // ─── search + filter ────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = data

    // text search across all columns
    if (searchText.trim()) {
      const q = searchText.toLowerCase()
      result = result.filter((item) =>
        columns.some((col) => {
          const val = getRowValue(item, col).toLowerCase()
          return val.includes(q)
        })
      )
    }

    // column filters
    if (filters) {
      for (const f of filters) {
        const fv = filterValues[f.key]
        if (fv) {
          result = result.filter((item) => {
            const raw = getNestedValue(item, f.key)
            return String(raw ?? "") === fv
          })
        }
      }
    }

    return result
  }, [data, searchText, columns, filters, filterValues])

  // ─── sorting ────────────────────────────────────────────────────
  const sorted = useMemo(() => {
    if (!sortKey) return filtered
    return [...filtered].sort((a, b) => {
      const col = columns.find((c) => c.key === sortKey)
      if (!col) return 0
      const aVal = getRowValue(a, col)
      const bVal = getRowValue(b, col)
      const cmp = aVal.localeCompare(bVal)
      return sortDir === "asc" ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir, columns])

  // ─── pagination ─────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const safePage = Math.min(currentPage, totalPages)
  const pageStart = (safePage - 1) * pageSize
  const pageEnd = pageStart + pageSize
  const pageData = sorted.slice(pageStart, pageEnd)

  // ─── sorting handler ────────────────────────────────────────────
  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir("asc")
    }
    setCurrentPage(1)
  }

  // ─── filter handler ─────────────────────────────────────────────
  function handleFilterChange(key: string, value: string) {
    setFilterValues((prev) => ({ ...prev, [key]: value }))
    setCurrentPage(1)
  }

  // ─── PDF export ─────────────────────────────────────────────────
  function handleExportPDF() {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" })
    const title = exportFilename.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    doc.setFontSize(16)
    doc.text(title, 14, 20)
    doc.setFontSize(10)
    doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 27)

    const head = [columns.map((c) => c.header)]
    const body = sorted.map((item) =>
      columns.map((col) => toExportValue(getNestedValue(item, col.key)))
    )

    ;(doc as any).autoTable({
      head,
      body,
      startY: 32,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [59, 130, 246], textColor: 255, fontStyle: "bold" },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      margin: { top: 32 },
    })

    doc.save(`${exportFilename}.pdf`)
  }

  // ─── page number helpers ────────────────────────────────────────
  function getPageNumbers(): (number | "ellipsis")[] {
    const pages: (number | "ellipsis")[] = []
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i)
      return pages
    }
    pages.push(1)
    if (safePage > 3) pages.push("ellipsis")
    const start = Math.max(2, safePage - 1)
    const end = Math.min(totalPages - 1, safePage + 1)
    for (let i = start; i <= end; i++) pages.push(i)
    if (safePage < totalPages - 2) pages.push("ellipsis")
    pages.push(totalPages)
    return pages
  }

  // ─── render ─────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* Toolbar — search + filters + export */}
      <div className="flex flex-col sm:flex-row gap-3 flex-wrap items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-3 flex-1 max-w-xl">
          {searchable && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={searchPlaceholder}
                className="pl-9"
                value={searchText}
                onChange={(e) => {
                  setSearchText(e.target.value)
                  setCurrentPage(1)
                }}
              />
            </div>
          )}
          {filters?.map((filter) => (
            <div key={filter.key} className="w-full sm:w-auto min-w-[140px]">
              <Select
                value={filterValues[filter.key] || ""}
                onChange={(e) => handleFilterChange(filter.key, e.target.value)}
                options={[
                  { value: "", label: `All ${filter.label}` },
                  ...filter.options,
                ]}
              />
            </div>
          ))}
        </div>

        {exportable && sorted.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExportPDF}>
            <FileDown className="h-4 w-4 mr-2" />
            Export PDF
          </Button>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : pageData.length === 0 ? (
            <div className="text-center py-16">
              {EmptyIcon && <EmptyIcon className="h-12 w-12 mx-auto text-muted-foreground/50" />}
              <p className="mt-4 text-sm text-muted-foreground">{emptyMessage}</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12 text-muted-foreground text-xs">#</TableHead>
                    {columns.map((col) => (
                      <TableHead
                        key={col.key}
                        className={cn(
                          "text-nowrap select-none",
                          col.sortable !== false && "cursor-pointer hover:text-foreground",
                          col.className
                        )}
                        onClick={() => col.sortable !== false && handleSort(col.key)}
                      >
                        <div className="flex items-center gap-1">
                          {col.header}
                          {sortKey === col.key ? (
                            sortDir === "asc" ? (
                              <ArrowUp className="h-3 w-3" />
                            ) : (
                              <ArrowDown className="h-3 w-3" />
                            )
                          ) : (
                            col.sortable !== false && <ArrowUpDown className="h-3 w-3 opacity-30" />
                          )}
                        </div>
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pageData.map((item, idx) => {
                    const actualIdx = pageStart + idx
                    return (
                      <TableRow
                        key={rowKey(item)}
                        className={cn(onRowClick && "cursor-pointer")}
                        onClick={() => onRowClick?.(item)}
                      >
                        <TableCell className="text-muted-foreground text-xs tabular-nums">
                          {actualIdx + 1}
                        </TableCell>
                        {columns.map((col) => (
                          <TableCell key={col.key} className={col.cellClassName}>
                            {col.render ? col.render(item) : formatCellValue(getNestedValue(item, col.key))}
                          </TableCell>
                        ))}
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {!loading && sorted.length > 0 && totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            Showing {pageStart + 1}–{Math.min(pageEnd, sorted.length)} of {sorted.length} entries
          </p>
          <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={safePage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {getPageNumbers().map((page, i) =>
              page === "ellipsis" ? (
                <span key={`e-${i}`} className="px-1 text-muted-foreground text-xs">
                  ...
                </span>
              ) : (
                <Button
                  key={page}
                  variant={safePage === page ? "default" : "ghost"}
                  size="icon"
                  className={cn(
                    "h-8 w-8 text-xs font-medium shrink-0",
                    safePage === page && "shadow-sm"
                  )}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              )
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 shrink-0"
              disabled={safePage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Page info when single page */}
      {!loading && totalPages <= 1 && sorted.length > 0 && (
        <p className="text-xs text-muted-foreground text-center sm:text-left">
          Showing all {sorted.length} entr{sorted.length === 1 ? "y" : "ies"}
        </p>
      )}
    </div>
  )
}
