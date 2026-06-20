import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/auth-context"
import { supabase } from "@/lib/supabase"
import type { Machine } from "@/types"
import { Loader2, Wrench, AlertTriangle } from "lucide-react"
import { useNavigate } from "react-router-dom"

export default function MyMachinesPage() {
  const { profile } = useAuth()
  const [machines, setMachines] = useState<Machine[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    if (profile?.role === "customer") fetchMachines()
  }, [profile])

  async function fetchMachines() {
    try {
      const { data } = await supabase
        .from("machines")
        .select("*")
        .eq("owner_id", profile!.user_id)
        .order("name")
      if (data) setMachines(data)
    } catch (err) {
      console.error("Error fetching machines:", err)
    } finally {
      setLoading(false)
    }
  }

  if (profile?.role !== "customer") return null

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Machines</h1>
          <p className="text-muted-foreground text-sm mt-1">View and manage your registered machines</p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : machines.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Wrench className="h-12 w-12 mx-auto text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">You don't have any machines registered yet</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {machines.map((machine) => (
            <Card key={machine.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-base">{machine.name}</CardTitle>
                    <CardDescription>{machine.model_number}</CardDescription>
                  </div>
                  <Badge
                    variant={
                      machine.status === "active" ? "success" :
                      machine.status === "under_service" ? "warning" :
                      machine.status === "retired" ? "destructive" : "secondary"
                    }
                    className="capitalize"
                  >
                    {machine.status.replace("_", " ")}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1 text-sm">
                  <p><span className="text-muted-foreground">Serial:</span> {machine.serial_number}</p>
                  <p><span className="text-muted-foreground">Model:</span> {machine.model_number}</p>
                  {machine.purchase_date && (
                    <p><span className="text-muted-foreground">Purchased:</span> {new Date(machine.purchase_date).toLocaleDateString()}</p>
                  )}
                </div>
                {machine.specs && (
                  <p className="text-xs text-muted-foreground border-t pt-2">{machine.specs}</p>
                )}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => navigate("/dashboard/issues")}
                  >
                    <AlertTriangle className="h-3 w-3 mr-1" />
                    Report Issue
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
