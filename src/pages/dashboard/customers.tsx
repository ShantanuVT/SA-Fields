import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useAuth } from "@/context/auth-context"
import { supabase } from "@/lib/supabase"
import type { UserProfile } from "@/types"
import { Search, Loader2, Users, Mail, Phone, MapPin } from "lucide-react"

export default function CustomersPage() {
  const { profile } = useAuth()
  const [customers, setCustomers] = useState<(UserProfile & { email?: string })[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

  const isAdmin = profile?.role === "super_admin" || profile?.role === "admin"

  useEffect(() => {
    if (isAdmin) fetchCustomers()
  }, [profile])

  async function fetchCustomers() {
    try {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("*")
        .eq("role", "customer")
        .order("created_at", { ascending: false })

      if (profiles) {
        setCustomers(profiles.map((p: any) => ({
          ...p,
          email: p.email || "",
        })))
      }
    } catch (err) {
      console.error("Error fetching customers:", err)
    } finally {
      setLoading(false)
    }
  }

  const filtered = customers.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.email?.toLowerCase().includes(search.toLowerCase()) ||
    c.mobile?.includes(search)
  )

  if (!isAdmin) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <p className="text-muted-foreground text-sm mt-1">View all registered customers</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search customers..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
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
              <p className="mt-4 text-sm text-muted-foreground">No customers found</p>
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
                  <TableHead>Joined</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c, idx) => (
                  <TableRow key={c.id}>
                    <TableCell className="text-muted-foreground text-xs tabular-nums">{idx + 1}</TableCell>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm">
                        <Mail className="h-3 w-3" /> {c.email || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm">
                        <Phone className="h-3 w-3" /> {c.mobile || "-"}
                      </span>
                    </TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3" /> {c.address || "-"}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {c.created_at ? new Date(c.created_at).toLocaleDateString() : "-"}
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
