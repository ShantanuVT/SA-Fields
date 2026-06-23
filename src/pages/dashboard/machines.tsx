import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import DataTable, { type Column, type TableFilter } from "@/components/ui/data-table"
import { useAuth } from "@/context/auth-context"
import { supabase } from "@/lib/supabase"
import type { Machine, UserProfile } from "@/types"
import { Plus, Loader2, Wrench } from "lucide-react"

export default function MachinesPage() {
  const { profile } = useAuth()
  const [machines, setMachines] = useState<Machine[]>([])
  const [customers, setCustomers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    serial_number: "",
    model_number: "",
    name: "",
    specs: "",
    owner_id: "",
    purchase_date: "",
    status: "active" as Machine["status"],
  })

  const isAdmin = profile?.role === "super_admin" || profile?.role === "admin"

  useEffect(() => {
    fetchMachines()
    if (isAdmin) fetchCustomers()
  }, [profile])

  async function fetchMachines() {
    try {
      let query = supabase.from("machines").select("*, user_profiles!owner_id(name)")
      if (profile?.role === "customer") {
        query = query.eq("owner_id", profile.user_id)
      }
      const { data } = await query.order("created_at", { ascending: false })
      if (data) {
        setMachines(data.map((m: any) => ({
          ...m,
          owner_name: m.user_profiles?.name,
        })))
      }
    } catch (err) {
      console.error("Error fetching machines:", err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchCustomers() {
    const { data } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("role", "customer")
    if (data) setCustomers(data)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase.from("machines").insert({
        serial_number: form.serial_number,
        model_number: form.model_number,
        name: form.name,
        specs: form.specs,
        owner_id: form.owner_id,
        purchase_date: form.purchase_date,
        status: form.status,
      })
      if (!error) {
        setOpen(false)
        setForm({ serial_number: "", model_number: "", name: "", specs: "", owner_id: "", purchase_date: "", status: "active" })
        fetchMachines()
      }
    } catch (err) {
      console.error("Error saving machine:", err)
    } finally {
      setSaving(false)
    }
  }

  // ─── DataTable columns ──────────────────────────────────────
  const statusBadge: Record<string, "success" | "warning" | "destructive" | "secondary"> = {
    active: "success",
    under_service: "warning",
    retired: "destructive",
    inactive: "secondary",
  }

  const columns: Column<Machine>[] = [
    { key: "serial_number", header: "Serial #", className: "w-32" },
    { key: "model_number", header: "Model #", className: "w-32" },
    { key: "name", header: "Name" },
    ...(isAdmin
      ? [{ key: "owner_name" as const, header: "Owner", render: (m: Machine) => <span className="text-sm">{m.owner_name || "-"}</span> }]
      : []),
    {
      key: "status",
      header: "Status",
      render: (m: Machine) => (
        <Badge variant={statusBadge[m.status] || "secondary"} className="capitalize">
          {m.status.replace("_", " ")}
        </Badge>
      ),
    },
    {
      key: "purchase_date",
      header: "Purchase Date",
      render: (m: Machine) => (
        <span className="text-sm text-muted-foreground">{m.purchase_date ? new Date(m.purchase_date).toLocaleDateString() : "-"}</span>
      ),
    },
  ]

  const filters: TableFilter[] = [
    {
      key: "status",
      label: "Status",
      options: [
        { value: "active", label: "Active" },
        { value: "inactive", label: "Inactive" },
        { value: "under_service", label: "Under Service" },
        { value: "retired", label: "Retired" },
      ],
    },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Machines</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isAdmin ? "Manage all registered machines" : "View your registered machines"}
          </p>
        </div>
        {isAdmin && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Machine
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Machine</DialogTitle>
                <DialogDescription>Register a new industrial machine</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="serial">Serial Number</Label>
                      <Input id="serial" value={form.serial_number} onChange={(e) => setForm({ ...form, serial_number: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="model">Model Number</Label>
                      <Input id="model" value={form.model_number} onChange={(e) => setForm({ ...form, model_number: e.target.value })} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="name">Machine Name</Label>
                    <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="specs">Specifications</Label>
                    <Textarea id="specs" value={form.specs} onChange={(e) => setForm({ ...form, specs: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="owner">Owner</Label>
                      <Select
                        id="owner"
                        value={form.owner_id}
                        onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
                        options={customers.map((c) => ({ value: c.user_id, label: c.name }))}
                        placeholder="Select customer"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="purchaseDate">Purchase Date</Label>
                      <Input id="purchaseDate" type="date" value={form.purchase_date} onChange={(e) => setForm({ ...form, purchase_date: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="status">Status</Label>
                    <Select
                      id="status"
                      value={form.status}
                      onChange={(e) => setForm({ ...form, status: e.target.value as Machine["status"] })}
                      options={[
                        { value: "active", label: "Active" },
                        { value: "inactive", label: "Inactive" },
                        { value: "under_service", label: "Under Service" },
                        { value: "retired", label: "Retired" },
                      ]}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Machine"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <DataTable<Machine>
        data={machines}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search by name, serial, or model number..."
        emptyMessage="No machines found"
        emptyIcon={Wrench}
        rowKey={(m) => m.id}
        filters={filters}
        exportable={isAdmin}
        exportFilename="machines"
      />
    </div>
  )
}
