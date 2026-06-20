import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useAuth } from "@/context/auth-context"
import { supabase } from "@/lib/supabase"
import type { Part, Machine } from "@/types"
import { Plus, Search, Loader2, Package } from "lucide-react"

export default function PartsPage() {
  const { profile } = useAuth()
  const [parts, setParts] = useState<Part[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
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
      let query = supabase.from("parts").select("*").order("created_at", { ascending: false })
      if (isCustomer) {
        // Get parts for customer's machines
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
      const { data } = await query
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

  const filtered = parts.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.part_number.toLowerCase().includes(search.toLowerCase())
  )

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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search parts..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {/* Parts Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Package className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">No parts found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-muted-foreground">#</TableHead>
                  <TableHead>Part #</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Compatible Models</TableHead>
                  <TableHead>Stock Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((part, idx) => (
                  <TableRow key={part.id}>
                    <TableCell className="text-muted-foreground text-xs tabular-nums">{idx + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{part.part_number}</TableCell>
                    <TableCell className="font-medium">{part.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{part.compatible_models || "-"}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          part.stock_status === "in_stock" ? "success" :
                          part.stock_status === "low_stock" ? "warning" : "destructive"
                        }
                        className="capitalize"
                      >
                        {part.stock_status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
