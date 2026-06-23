import { useState, useEffect } from "react"
import DataTable, { type Column } from "@/components/ui/data-table"
import { useAuth } from "@/context/auth-context"
import { supabase } from "@/lib/supabase"
import type { UserProfile } from "@/types"
import { Users, Mail, Phone, MapPin } from "lucide-react"

export default function CustomersPage() {
  const { profile } = useAuth()
  const [customers, setCustomers] = useState<(UserProfile & { email?: string })[]>([])
  const [loading, setLoading] = useState(true)

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

  const columns: Column<UserProfile & { email?: string }>[] = [
    { key: "name", header: "Name", className: "min-w-[150px]" },
    {
      key: "email",
      header: "Email",
      render: (c) => (
        <span className="flex items-center gap-1 text-sm">
          <Mail className="h-3 w-3 text-muted-foreground" /> {c.email || "-"}
        </span>
      ),
    },
    {
      key: "mobile",
      header: "Mobile",
      render: (c) => (
        <span className="flex items-center gap-1 text-sm">
          <Phone className="h-3 w-3 text-muted-foreground" /> {c.mobile || "-"}
        </span>
      ),
    },
    {
      key: "address",
      header: "Address",
      render: (c) => (
        <span className="flex items-center gap-1 text-sm">
          <MapPin className="h-3 w-3 text-muted-foreground" /> {c.address || "-"}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Joined",
      render: (c) => (
        <span className="text-sm text-muted-foreground">
          {c.created_at ? new Date(c.created_at).toLocaleDateString() : "-"}
        </span>
      ),
    },
  ]

  if (!isAdmin) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <p className="text-muted-foreground text-sm mt-1">View all registered customers</p>
      </div>

      <DataTable<(UserProfile & { email?: string })>
        data={customers}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search customers by name, email, or mobile..."
        emptyMessage="No customers found"
        emptyIcon={Users}
        rowKey={(c) => c.id}
        exportable={isAdmin}
        exportFilename="customers"
      />
    </div>
  )
}
