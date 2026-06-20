import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useAuth } from "@/context/auth-context"
import { supabase } from "@/lib/supabase"
import type { UserProfile } from "@/types"
import { Plus, Search, Loader2, Users, Mail, Phone, MapPin } from "lucide-react"

export default function EngineersPage() {
  const { profile } = useAuth()
  const [engineers, setEngineers] = useState<(UserProfile & { email?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
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
      // Create auth user first
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

  const filtered = engineers.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.email?.toLowerCase().includes(search.toLowerCase())
  )

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

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search engineers..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">No engineers found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-muted-foreground">#</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Mobile</TableHead>
                  <TableHead>Address</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((eng, idx) => (
                  <TableRow key={eng.id}>
                    <TableCell className="text-muted-foreground text-xs tabular-nums">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{eng.name}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm">
                        <Mail className="h-3 w-3" /> {eng.email || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm">
                        <Phone className="h-3 w-3" /> {eng.mobile || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3" /> {eng.address || "-"}
                      </span>
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
