import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/context/auth-context"
import { supabase } from "@/lib/supabase"
import type { MachineHistoryEntry, Machine } from "@/types"
import { Loader2, History, Clock, Wrench, MessageSquare, CheckCircle2, FileText } from "lucide-react"

export default function ServiceHistoryPage() {
  const { profile } = useAuth()
  const [machines, setMachines] = useState<Machine[]>([])
  const [history, setHistory] = useState<MachineHistoryEntry[]>([])
  const [selectedMachine, setSelectedMachine] = useState("")
  const [, setLoading] = useState(true)
  const [historyLoading, setHistoryLoading] = useState(false)

  const canView = ["super_admin", "admin", "engineer", "customer"].includes(profile?.role || "")

  useEffect(() => {
    fetchMachines()
  }, [profile])

  useEffect(() => {
    if (selectedMachine) fetchHistory()
  }, [selectedMachine])

  async function fetchMachines() {
    try {
      let query = supabase.from("machines").select("*")
      if (profile?.role === "customer") {
        query = query.eq("owner_id", profile!.user_id)
      } else if (profile?.role === "engineer") {
        // Get machines assigned to this engineer
        const { data: assignments } = await supabase
          .from("engineer_assignments")
          .select("machine_id")
          .eq("engineer_id", profile!.user_id)
        const machineIds = assignments?.map((a) => a.machine_id) || []
        if (machineIds.length > 0) {
          query = query.in("id", machineIds)
        } else {
          setMachines([])
          setLoading(false)
          return
        }
      }
      const { data } = await query.order("name")
      if (data) setMachines(data)
    } catch (err) {
      console.error("Error fetching machines:", err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchHistory() {
    setHistoryLoading(true)
    try {
      const { data } = await supabase
        .from("machine_history")
        .select("*")
        .eq("machine_id", selectedMachine)
        .order("created_at", { ascending: false })
      if (data) setHistory(data)
    } catch (err) {
      console.error("Error fetching history:", err)
    } finally {
      setHistoryLoading(false)
    }
  }

  const getEventIcon = (type: string) => {
    switch (type) {
      case "issue_raised": return <MessageSquare className="h-4 w-4 text-amber-500" />
      case "engineer_assigned": return <Clock className="h-4 w-4 text-blue-500" />
      case "service_completed": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      case "part_replaced": return <Wrench className="h-4 w-4 text-purple-500" />
      default: return <FileText className="h-4 w-4 text-muted-foreground" />
    }
  }

  if (!canView) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Service History</h1>
        <p className="text-muted-foreground text-sm mt-1">View complete service history for any machine</p>
      </div>

      <div className="w-full max-w-sm">
        <Select
          value={selectedMachine}
          onChange={(e) => setSelectedMachine(e.target.value)}
          options={machines.map((m) => ({ value: m.id, label: `${m.name} (${m.model_number})` }))}
          placeholder="Select a machine..."
        />
      </div>

      {selectedMachine && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Service Timeline</CardTitle>
            <CardDescription>Chronological history of all service events</CardDescription>
          </CardHeader>
          <CardContent>
            {historyLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : history.length === 0 ? (
              <div className="text-center py-12">
                <History className="h-12 w-12 mx-auto text-muted-foreground/50" />
                <p className="mt-4 text-sm text-muted-foreground">No service history for this machine</p>
              </div>
            ) : (
              <div className="space-y-4">
                {history.map((entry) => (
                  <div key={entry.id} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        {getEventIcon(entry.event_type)}
                      </div>
                      <div className="w-px flex-1 bg-border mt-2" />
                    </div>
                    <div className="flex-1 pb-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="capitalize text-xs">
                          {entry.event_type.replace(/_/g, " ")}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-sm mt-1">{entry.description}</p>
                      {entry.created_by && (
                        <p className="text-xs text-muted-foreground mt-1">By: {entry.created_by}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
