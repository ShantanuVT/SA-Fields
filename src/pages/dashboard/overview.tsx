import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/context/auth-context"
import { supabase } from "@/lib/supabase"
import type { DashboardStats, Issue } from "@/types"
import {
  Wrench,
  AlertTriangle,
  Users,
  CheckCircle2,
  Clock,
} from "lucide-react"

export default function DashboardOverview() {
  const { profile } = useAuth()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [recentIssues, setRecentIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch stats based on role
        const isAdmin = profile?.role === "super_admin" || profile?.role === "admin"

        const [machinesRes, issuesRes, engineersRes, customersRes] = await Promise.all([
          supabase.from("machines").select("*", { count: "exact", head: true }),
          supabase.from("issues").select("*", { count: "exact", head: true }).in("status", ["submitted", "under_review", "assigned"]),
          supabase.from("user_profiles").select("*", { count: "exact", head: true }).eq("role", "engineer"),
          supabase.from("user_profiles").select("*", { count: "exact", head: true }).eq("role", "customer"),
        ])

        setStats({
          totalMachines: machinesRes.count || 0,
          activeIssues: issuesRes.count || 0,
          totalEngineers: engineersRes.count || 0,
          totalCustomers: customersRes.count || 0,
          resolvedThisMonth: 0,
          pendingAssignments: 0,
        })

        // Fetch recent issues
        if (isAdmin) {
          const { data } = await supabase
            .from("issues")
            .select("*, machines!inner(name, model_number)")
            .order("created_at", { ascending: false })
            .limit(5)

          if (data) {
            setRecentIssues(data.map((i: any) => ({
              ...i,
              machine_name: i.machines?.name,
              machine_model: i.machines?.model_number,
            })))
          }
        }
      } catch (err) {
        console.error("Error fetching dashboard data:", err)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [profile])

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  const statCards = [
    { title: "Total Machines", value: stats?.totalMachines || 0, icon: Wrench, color: "text-blue-600 bg-blue-100" },
    { title: "Active Issues", value: stats?.activeIssues || 0, icon: AlertTriangle, color: "text-amber-600 bg-amber-100" },
    { title: "Engineers", value: stats?.totalEngineers || 0, icon: Users, color: "text-emerald-600 bg-emerald-100" },
    { title: "Customers", value: stats?.totalCustomers || 0, icon: Users, color: "text-purple-600 bg-purple-100" },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Welcome back, {profile?.name}. Here's what's happening.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => (
          <Card key={stat.title} className="hover:shadow-md transition-shadow">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
              <div className={`p-2 rounded-lg ${stat.color}`}>
                <stat.icon className="h-4 w-4" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Recent Issues (Admin view) */}
      {(profile?.role === "super_admin" || profile?.role === "admin") && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Issues</CardTitle>
            <CardDescription>Latest customer-reported issues requiring attention</CardDescription>
          </CardHeader>
          <CardContent>
            {recentIssues.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No recent issues</p>
            ) : (
              <div className="space-y-4">
                {recentIssues.map((issue) => (
                  <div key={issue.id} className="flex items-center justify-between border-b pb-3 last:border-0 last:pb-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{issue.description}</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {issue.machine_name} ({issue.machine_model})
                      </p>
                    </div>
                    <Badge
                      variant={
                        issue.urgency === "critical" ? "destructive" :
                        issue.urgency === "high" ? "warning" :
                        issue.urgency === "medium" ? "info" : "secondary"
                      }
                      className="ml-2 capitalize"
                    >
                      {issue.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Engineer view */}
      {profile?.role === "engineer" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pending Assignments</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Completed Services</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">0</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Customer view */}
      {profile?.role === "customer" && (
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">My Machines</CardTitle>
              <Wrench className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalMachines || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Open Issues</CardTitle>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.activeIssues || 0}</div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}
