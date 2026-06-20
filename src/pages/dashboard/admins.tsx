import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useAuth } from "@/context/auth-context"
import { supabase } from "@/lib/supabase"
import type { UserProfile } from "@/types"
import { Plus, Search, Loader2, UserCog, Shield } from "lucide-react"

export default function AdminsPage() {
  const { profile } = useAuth()
  const [admins, setAdmins] = useState<(UserProfile & { email?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ name: "", email: "", mobile: "", address: "" })

  const isSuperAdmin = profile?.role === "super_admin"

  useEffect(() => {
    if (isSuperAdmin) fetchAdmins()
  }, [profile])

  async function fetchAdmins() {
    try {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("*")
        .in("role", ["super_admin", "admin"])
        .order("created_at", { ascending: false })

      if (profiles) {
        setAdmins(profiles.map((p: any) => ({
          ...p,
          email: p.email || "",
        })))
      }
    } catch (err) {
      console.error("Error fetching admins:", err)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateAdmin(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: form.email,
        password: "temp123456",
        email_confirm: true,
        user_metadata: { name: form.name, role: "admin" },
      })

      if (authError) throw new Error(authError.message)

      if (authData.user) {
        await supabase.from("user_profiles").insert({
          user_id: authData.user.id,
          email: form.email,
          name: form.name,
          role: "admin",
          mobile: form.mobile,
          address: form.address,
        })
      }

      setOpen(false)
      setForm({ name: "", email: "", mobile: "", address: "" })
      fetchAdmins()
    } catch (err: any) {
      console.error("Error creating admin:", err)
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleRole(userId: string, currentRole: string) {
    const newRole = currentRole === "admin" ? "super_admin" : "admin"
    await supabase.from("user_profiles").update({ role: newRole }).eq("user_id", userId)
    fetchAdmins()
  }

  const filtered = admins.filter((a) =>
    a.name.toLowerCase().includes(search.toLowerCase()) ||
    a.email?.toLowerCase().includes(search.toLowerCase())
  )

  if (!isSuperAdmin) return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Admin Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage administrator accounts and permissions</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Admin
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Admin</DialogTitle>
              <DialogDescription>Create a new administrator account</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateAdmin}>
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
                  <Label htmlFor="mobile">Mobile</Label>
                  <Input id="mobile" value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Input id="address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={saving}>
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create Admin"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search admins..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <UserCog className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">No admins found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-muted-foreground">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((admin, idx) => (
                  <TableRow key={admin.id}>
                    <TableCell className="text-muted-foreground text-xs tabular-nums">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{admin.name}</TableCell>
                    <TableCell className="text-sm">{admin.email || "-"}</TableCell>
                    <TableCell>
                      <Badge variant={admin.role === "super_admin" ? "default" : "secondary"}>
                        {admin.role === "super_admin" ? "Super Admin" : "Admin"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {admin.role !== "super_admin" && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleRole(admin.user_id, admin.role)}
                          >
                            <Shield className="h-3 w-3 mr-1" />
                            Make Super Admin
                          </Button>
                        )}
                      </div>
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
