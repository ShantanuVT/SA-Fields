import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useAuth } from "@/context/auth-context"
import { supabase } from "@/lib/supabase"
import type { Machine, UserProfile } from "@/types"
import { Plus, Search, Loader2, Wrench } from "lucide-react"

export default function MachinesPage() {
  const { profile } = useAuth()
  const [machines, setMachines] = useState<Machine[]>([])
  const [customers, setCustomers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
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
    if (isAdmin) {
      fetchCustomers()
    }
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

  const filtered = machines.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.serial_number.toLowerCase().includes(search.toLowerCase()) ||
    m.model_number.toLowerCase().includes(search.toLowerCase())
  )

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

      {/* Search & Filter */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, serial, or model number..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Machines Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Wrench className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">No machines found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-muted-foreground">#</TableHead>
                  <TableHead>Serial #</TableHead>
                  <TableHead>Model #</TableHead>
                  <TableHead>Name</TableHead>
                  {isAdmin && <TableHead>Owner</TableHead>}
                  <TableHead>Status</TableHead>
                  <TableHead>Purchase Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((machine, idx) => (
                  <TableRow key={machine.id}>
                    <TableCell className="text-muted-foreground text-xs tabular-nums">{idx + 1}</TableCell>
                    <TableCell className="font-mono text-xs">{machine.serial_number}</TableCell>
                    <TableCell className="font-mono text-xs">{machine.model_number}</TableCell>
                    <TableCell className="font-medium">{machine.name}</TableCell>
                    {isAdmin && <TableCell>{machine.owner_name}</TableCell>}
                    <TableCell>
                      <Badge
                        variant={
                          machine.status === "active" ? "success" :
                          machine.status === "under_service" ? "warning" :
                          machine.status === "retired" ? "destructive" : "secondary"
                        }
                        className="capitalize"
                      >
                        {machine.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {machine.purchase_date ? new Date(machine.purchase_date).toLocaleDateString() : "-"}
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
