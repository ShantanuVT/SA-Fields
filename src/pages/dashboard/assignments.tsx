import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/context/auth-context"
import { supabase } from "@/lib/supabase"

import { Loader2, ClipboardList, Phone, MapPin, Wrench, Calendar } from "lucide-react"

export default function AssignmentsPage() {
  const { profile } = useAuth()
  const [assignments, setAssignments] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const isEngineer = profile?.role === "engineer"

  useEffect(() => {
    if (isEngineer) fetchAssignments()
  }, [profile])

  async function fetchAssignments() {
    try {
      const { data } = await supabase
        .from("engineer_assignments")
        .select(`
          *,
          issues!inner(*, machines!inner(name, model_number), user_profiles!customer_id(name, mobile, address)),
          machines!inner(name, model_number, serial_number)
        `)
        .eq("engineer_id", profile!.user_id)
        .order("created_at", { ascending: false })

      if (data) setAssignments(data)
    } catch (err) {
      console.error("Error fetching assignments:", err)
    } finally {
      setLoading(false)
    }
  }

  if (!isEngineer) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Assignments</h1>
        <p className="text-muted-foreground text-sm mt-1">View your assigned service jobs</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : assignments.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">No assignments yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {assignments.map((assignment: any) => {
            const issue = assignment.issues
            return (
              <Card key={assignment.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-6">
                  <div className="flex flex-col lg:flex-row gap-6">
                    {/* Customer Info */}
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold">{issue?.user_profiles?.name || "Customer"}</h3>
                        <Badge
                          variant={assignment.status === "approved" ? "success" : assignment.status === "pending" ? "warning" : "destructive"}
                          className="capitalize"
                        >
                          {assignment.status}
                        </Badge>
                      </div>

                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          <span>{issue?.user_profiles?.mobile || "N/A"}</span>
                        </div>
                        <div className="flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4" />
                          <span>{issue?.user_profiles?.address || "N/A"}</span>
                        </div>
                      </div>

                      {/* Machine Info */}
                      <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Assigned Machine</p>
                        <div className="flex items-center gap-2">
                          <Wrench className="h-4 w-4 text-primary" />
                          <span className="font-medium">{assignment.machines?.name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {assignment.machines?.model_number} | SN: {assignment.machines?.serial_number}
                        </p>
                      </div>
                    </div>

                    {/* Issue Details */}
                    <div className="flex-1 space-y-3">
                      <h4 className="text-sm font-medium">Issue Details</h4>
                      <p className="text-sm text-muted-foreground">{issue?.description || "No description"}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>Reported: {issue?.created_at ? new Date(issue.created_at).toLocaleDateString() : "N/A"}</span>
                      </div>
                      {issue?.tentative_days && (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="font-medium">Tentative Resolution:</span>
                          <span>{issue.tentative_days} days</span>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
