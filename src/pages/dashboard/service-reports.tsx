import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import DataTable, { type Column } from "@/components/ui/data-table"
import { useAuth } from "@/context/auth-context"
import { supabase } from "@/lib/supabase"
import type { ServiceReport } from "@/types"
import { FileText, Eye } from "lucide-react"

export default function ServiceReportsPage() {
  const { profile } = useAuth()
  const [reports, setReports] = useState<ServiceReport[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchReports()
  }, [profile])

  async function fetchReports() {
    try {
      let query = supabase
        .from("service_reports")
        .select("*, machines!inner(name, model_number), user_profiles!engineer_id(name)")
        .order("created_at", { ascending: false })

      if (profile?.role === "customer") {
        const { data: machines } = await supabase
          .from("machines")
          .select("id")
          .eq("owner_id", profile!.user_id)
        const machineIds = machines?.map((m) => m.id) || []
        if (machineIds.length > 0) {
          query = query.in("machine_id", machineIds)
        } else {
          setReports([])
          setLoading(false)
          return
        }
      } else if (profile?.role === "engineer") {
        query = query.eq("engineer_id", profile!.user_id)
      }

      const { data } = await query
      if (data) {
        setReports(data.map((r: any) => ({
          ...r,
          machine_name: r.machines?.name,
          machine_model: r.machines?.model_number,
          engineer_name: r.user_profiles?.name,
        })))
      }
    } catch (err) {
      console.error("Error fetching reports:", err)
    } finally {
      setLoading(false)
    }
  }

  const isAdmin = profile?.role === "super_admin" || profile?.role === "admin"

  const columns: Column<ServiceReport>[] = [
    {
      key: "machine_name",
      header: "Machine",
      render: (r) => <span className="font-medium">{r.machine_name} <span className="text-muted-foreground font-normal">({r.machine_model})</span></span>,
    },
    {
      key: "engineer_name",
      header: "Engineer",
      render: (r) => <span className="text-sm">{r.engineer_name || "N/A"}</span>,
    },
    {
      key: "service_details",
      header: "Service Details",
      render: (r) => <p className="text-sm text-muted-foreground line-clamp-2 max-w-[300px]">{r.service_details}</p>,
    },
    {
      key: "next_service_date",
      header: "Next Service",
      render: (r) => <span className="text-sm text-muted-foreground">{r.next_service_date ? new Date(r.next_service_date).toLocaleDateString() : "-"}</span>,
    },
    {
      key: "created_at",
      header: "Date",
      render: (r) => <span className="text-sm text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>,
    },
    {
      key: "pdf_url",
      header: "Report",
      sortable: false,
      render: (r) => (
        r.pdf_url ? (
          <Button size="sm" variant="outline" asChild>
            <a href={r.pdf_url} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
              <Eye className="h-3 w-3 mr-1" />
              View PDF
            </a>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">No PDF</span>
        )
      ),
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Service Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">View all completed service reports</p>
      </div>

      <DataTable<ServiceReport>
        data={reports}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search by machine, model, or details..."
        emptyMessage="No service reports found"
        emptyIcon={FileText}
        rowKey={(r) => r.id}
        exportable={isAdmin}
        exportFilename="service-reports"
      />
    </div>
  )
}
