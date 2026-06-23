import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import DataTable, { type Column } from "@/components/ui/data-table"
import { useAuth } from "@/context/auth-context"
import { supabase } from "@/lib/supabase"
import type { UserProfile } from "@/types"
import { Plus, Loader2, Users, Mail, Phone, MapPin } from "lucide-react"

export default function EngineersPage() {
  const { profile } = useAuth()
  const [engineers, setEngineers] = useState<(UserProfile & { email?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", mobile: "", address: "" })

  const isAdmin = profile?.role === "super_admin" || profile?.role === "admin"

  useEffect(() => {
    if (isAdmin) fetchEngineers()
  }, [profile])

  async function fetchEngineers() {
    try {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("role", "engineer")
        .order("created_at", { ascending: false })

      if (profiles) {
        setEngineers(profiles.map((p: any) => ({
          ...p,
          email: p.email || "",
        })))
      }
    } catch (err) {
      console.error("Error fetching engineers:", err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateEngineer(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: form.email,
        password: "temp123456",
        email_confirm: true,
        user_metadata: { name: form.name, role: "engineer" },
      })

      if (authError) throw new Error(authError.message)

      if (authData.user) {
        const { error: profileError } = await supabase.from("user_profiles").insert({
          user_id: authData.user.id,
          email: form.email,
          name: form.name,
          role: "engineer",
          mobile: form.mobile,
          address: form.address,
        })

        if (profileError) throw new Error(profileError.message)
      }

      setOpen(false)
      setForm({ name: "", email: "", mobile: "", address: "" })
      fetchEngineers()
    } catch (err: any) {
      console.error("Error creating engineer:", err)
    } finally {
      setSaving(false)
    }
  }

  // ─── DataTable columns ──────────────────────────────────────
  const columns: Column<UserProfile & { email?: string }>[] = [
    { key: "name", header: "Name", className: "min-w-[150px]" },
    {
      key: "email",
      header: "Email",
      render: (e) => (
        <span className="flex items-center gap-1 text-sm">
          <Mail className="h-3 w-3 text-muted-foreground" /> {e.email || "-"}
        </span>
      ),
    },
    {
      key: "mobile",
      header: "Mobile",
      render: (e) => (
        <span className="flex items-center gap-1 text-sm">
          <Phone className="h-3 w-3 text-muted-foreground" /> {e.mobile || "-"}
        </span>
      ),
    },
    {
      key: "address",
      header: "Address",
      render: (e) => (
        <span className="flex items-center gap-1 text-sm">
          <MapPin className="h-3 w-3 text-muted-foreground" /> {e.address || "-"}
        </span>
      ),
    },
  ]

  if (!isAdmin) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Engineers</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage engineer accounts and profiles</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Engineer
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Engineer</DialogTitle>
              <DialogDescription>Create a new engineer account</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateEngineer}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name</Label>
                  <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile">Mobile Number</Label>
                  <Input id="mobile" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Engineer"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <DataTable<(UserProfile & { email?: string })>
        data={engineers}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search engineers by name or email..."
        emptyMessage="No engineers found"
        emptyIcon={Users}
        rowKey={(e) => e.id}
        exportable={isAdmin}
        exportFilename="engineers"
      />
    </div>
  )
}
