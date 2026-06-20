import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/context/auth-context"
import { supabase } from "@/lib/supabase"
import type { ServiceReport } from "@/types"
import { Search, Loader2, FileText, Eye } from "lucide-react"

export default function ServiceReportsPage() {
  const { profile } = useAuth()
  const [reports, setReports] = useState<ServiceReport[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")

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
        // Get customer's machines
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

  const filtered = reports.filter((r) =>
    r.service_details?.toLowerCase().includes(search.toLowerCase()) ||
    r.machine_name?.toLowerCase().includes(search.toLowerCase()) ||
    r.machine_model?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Service Reports</h1>
        <p className="text-muted-foreground text-sm mt-1">View all completed service reports</p>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search reports..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">No service reports found</p>
            </div>
          ) : (
            <div className="divide-y">
              {filtered.map((report) => (
                <div key={report.id} className="p-4 md:p-6 hover:bg-muted/30 transition-colors">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        <p className="font-medium">
                          {report.machine_name} ({report.machine_model})
                        </p>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        <span>Engineer: {report.engineer_name || "N/A"}</span>
                        <span>Service: {new Date(report.created_at).toLocaleDateString()}</span>
                        {report.next_service_date && (
                          <span>Next: {new Date(report.next_service_date).toLocaleDateString()}</span>
                        )}
                      </div>
                      <p className="text-sm mt-2 text-muted-foreground line-clamp-2">
                        {report.remarks || report.service_details?.slice(0, 150)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {report.pdf_url && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={report.pdf_url} target="_blank" rel="noopener noreferrer">
                            <Eye className="h-3 w-3 mr-1" />
                            View PDF
                          </a>
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
