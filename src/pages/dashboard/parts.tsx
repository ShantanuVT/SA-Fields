import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import DataTable, { type Column, type TableFilter } from "@/components/ui/data-table"
import { useAuth } from "@/context/auth-context"
import { supabase } from "@/lib/supabase"
import type { Part, Machine } from "@/types"
import { Plus, Loader2, Package } from "lucide-react"

export default function PartsPage() {
  const { profile } = useAuth()
  const [parts, setParts] = useState<Part[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    part_number: "",
    name: "",
    compatible_models: "",
    stock_status: "in_stock" as Part["stock_status"],
    assigned_machine_id: "",
  })

  const isAdmin = profile?.role === "super_admin" || profile?.role === "admin"
  const isCustomer = profile?.role === "customer"

  useEffect(() => {
    fetchParts()
    if (isAdmin) fetchMachines()
  }, [profile])

  async function fetchParts() {
    try {
      if (isCustomer) {
        const { data: machineIds } = await supabase
          .from("machines")
          .select("id")
          .eq("owner_id", profile!.user_id)
        const ids = machineIds?.map((m) => m.id) || []
        if (ids.length > 0) {
          const { data } = await supabase
            .from("parts")
            .select("*")
            .in("assigned_machine_id", ids)
          if (data) setParts(data)
        }
        return
      }
      const { data } = await supabase
        .from("parts")
        .select("*")
        .order("created_at", { ascending: false })
      if (data) setParts(data)
    } catch (err) {
      console.error("Error fetching parts:", err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchMachines() {
    const { data } = await supabase.from("machines").select("*")
    if (data) setMachines(data)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase.from("parts").insert({
        part_number: form.part_number,
        name: form.name,
        compatible_models: form.compatible_models,
        stock_status: form.stock_status,
        assigned_machine_id: form.assigned_machine_id || null,
      })
      if (!error) {
        setOpen(false)
        setForm({ part_number: "", name: "", compatible_models: "", stock_status: "in_stock", assigned_machine_id: "" })
        fetchParts()
      }
    } catch (err) {
      console.error("Error saving part:", err)
    } finally {
      setSaving(false)
    }
  }

  // ─── DataTable columns ──────────────────────────────────────
  const stockBadge: Record<string, "success" | "warning" | "destructive"> = {
    in_stock: "success",
    low_stock: "warning",
    out_of_stock: "destructive",
  }

  const columns: Column<Part>[] = [
    { key: "part_number", header: "Part #", className: "w-36" },
    { key: "name", header: "Name" },
    { key: "compatible_models", header: "Compatible Models", render: (p: Part) => <span className="text-sm text-muted-foreground">{p.compatible_models || "-"}</span> },
    {
      key: "stock_status",
      header: "Stock Status",
      render: (p: Part) => (
        <Badge variant={stockBadge[p.stock_status] || "secondary"} className="capitalize">
          {p.stock_status.replace("_", " ")}
        </Badge>
      ),
    },
  ]

  const filters: TableFilter[] = [
    {
      key: "stock_status",
      label: "Stock Status",
      options: [
        { value: "in_stock", label: "In Stock" },
        { value: "low_stock", label: "Low Stock" },
        { value: "out_of_stock", label: "Out of Stock" },
      ],
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Parts</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isAdmin ? "Manage spare parts inventory" : "View parts for your machines"}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Part
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Part</DialogTitle>
                <DialogDescription>Add a spare part to inventory</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="partNumber">Part Number</Label>
                      <Input id="partNumber" value={form.part_number} onChange={(e) => setForm({ ...form, part_number: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="name">Part Name</Label>
                      <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="compatible">Compatible Models</Label>
                    <Input id="compatible" value={form.compatible_models} onChange={(e) => setForm({ ...form, compatible_models: e.target.value })} placeholder="e.g., Model-A, Model-B" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="stock">Stock Status</Label>
                      <Select
                        id="stock"
                        value={form.stock_status}
                        onChange={(e) => setForm({ ...form, stock_status: e.target.value as Part["stock_status"] })}
                        options={[
                          { value: "in_stock", label: "In Stock" },
                          { value: "low_stock", label: "Low Stock" },
                          { value: "out_of_stock", label: "Out of Stock" },
                        ]}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="assignedMachine">Assigned Machine</Label>
                      <Select
                        id="assignedMachine"
                        value={form.assigned_machine_id}
                        onChange={(e) => setForm({ ...form, assigned_machine_id: e.target.value })}
                        options={machines.map((m) => ({ value: m.id, label: `${m.name} (${m.serial_number})` }))}
                        placeholder="Optional"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Part"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <DataTable<Part>
        data={parts}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search by part number or name..."
        emptyMessage="No parts found"
        emptyIcon={Package}
        rowKey={(p) => p.id}
        filters={filters}
        exportable={isAdmin}
        exportFilename="parts"
      />
    </div>
  )
}
