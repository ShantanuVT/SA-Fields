import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useAuth } from "@/context/auth-context"
import { supabase } from "@/lib/supabase"
import type { Issue, Machine, UserProfile } from "@/types"
import { Plus, Search, Loader2, CheckCircle2, UserCheck, MessageSquare } from "lucide-react"

export default function IssuesPage() {
  const { profile } = useAuth()
  const [issues, setIssues] = useState<Issue[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [engineers, setEngineers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [assignForm, setAssignForm] = useState({ engineer_id: "", tentative_days: 3 })

  const isAdmin = profile?.role === "super_admin" || profile?.role === "admin"
  const isCustomer = profile?.role === "customer"
  const isEngineer = profile?.role === "engineer"

  const [form, setForm] = useState({
    machine_id: "",
    description: "",
    urgency: "medium" as Issue["urgency"],
  })

  useEffect(() => {
    fetchIssues()
    if (isCustomer) fetchMyMachines()
    if (isAdmin) fetchEngineers()
  }, [profile])

  // Realtime subscription for issues
  useEffect(() => {
    const channel = supabase
      .channel("issues-channel")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "issues" },
        () => fetchIssues()
      )
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile])

  async function fetchIssues() {
    try {
      let query = supabase
        .from("issues")
        .select("*, machines!inner(name, model_number), user_profiles!customer_id(name), user_profiles!assigned_engineer_id(name)")
        .order("created_at", { ascending: false })

      if (isCustomer) {
        query = query.eq("customer_id", profile!.user_id)
      } else if (isEngineer) {
        query = query.eq("assigned_engineer_id", profile!.user_id)
      }

      const { data } = await query
      if (data) {
        setIssues(data.map((i: any) => ({
          ...i,
          machine_name: i.machines?.name,
          machine_model: i.machines?.model_number,
          customer_name: i.user_profiles?.name,
          engineer_name: i.user_profiles_assigned_engineer_id?.name,
        })))
      }
    } catch (err) {
      console.error("Error fetching issues:", err)
    } finally {
      setLoading(false)
    }
  }

  async function fetchMyMachines() {
    const { data } = await supabase
      .from("machines")
      .select("*")
      .eq("owner_id", profile!.user_id)
    if (data) setMachines(data)
  }

  async function fetchEngineers() {
    const { data } = await supabase
      .from("user_profiles")
      .select("*")
      .eq("role", "engineer")
    if (data) setEngineers(data)
  }

  async function handleSubmitIssue(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const { error } = await supabase.from("issues").insert({
        customer_id: profile!.user_id,
        machine_id: form.machine_id,
        description: form.description,
        urgency: form.urgency,
        status: "submitted",
      })
      if (!error) {
        setOpen(false)
        setForm({ machine_id: "", description: "", urgency: "medium" })
        fetchIssues()
      }
    } catch (err) {
      console.error("Error submitting issue:", err)
    } finally {
      setSaving(false)
    }
  }

  async function handleAssign(e: React.FormEvent) {
    e.preventDefault()
    if (!selectedIssue) return
    setSaving(true)
    try {
      const { error } = await supabase
        .from("issues")
        .update({
          assigned_engineer_id: assignForm.engineer_id,
          tentative_days: assignForm.tentative_days,
          status: "assigned",
        })
        .eq("id", selectedIssue.id)

      if (!error) {
        // Create engineer assignment record
        await supabase.from("engineer_assignments").insert({
          engineer_id: assignForm.engineer_id,
          customer_id: selectedIssue.customer_id,
          machine_id: selectedIssue.machine_id,
          issue_id: selectedIssue.id,
          assigned_by_admin_id: profile!.user_id,
          status: "approved",
        })

        // Create notification for engineer
        await supabase.from("notifications").insert({
          user_id: assignForm.engineer_id,
          type: "engineer_assigned",
          title: "New Assignment",
          message: `You have been assigned to issue: ${selectedIssue.description.slice(0, 100)}`,
          reference_id: selectedIssue.id,
        })

        setAssignOpen(false)
        setSelectedIssue(null)
        fetchIssues()
      }
    } catch (err) {
      console.error("Error assigning engineer:", err)
    } finally {
      setSaving(false)
    }
  }

  async function handleResolve(issueId: string) {
    await supabase
      .from("issues")
      .update({ status: "resolved" })
      .eq("id", issueId)
    fetchIssues()
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "success" | "warning" | "info" | "destructive" | "secondary"> = {
      submitted: "info",
      under_review: "warning",
      assigned: "secondary",
      resolved: "success",
    }
    return <Badge variant={variants[status] || "default"} className="capitalize">{status.replace("_", " ")}</Badge>
  }

  const getUrgencyBadge = (urgency: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "warning" | "info"> = {
      low: "secondary",
      medium: "info",
      high: "warning",
      critical: "destructive",
    }
    return <Badge variant={variants[urgency] || "default"} className="capitalize">{urgency}</Badge>
  }

  const filtered = issues.filter((i) =>
    i.description.toLowerCase().includes(search.toLowerCase()) ||
    i.machine_name?.toLowerCase().includes(search.toLowerCase()) ||
    i.customer_name?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Issues</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {isCustomer ? "Report and track issues for your machines" : isEngineer ? "View assigned issues" : "View and manage all reported issues"}
          </p>
        </div>
        {isCustomer && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Report Issue
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Report an Issue</DialogTitle>
                <DialogDescription>Describe the issue with your machine</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmitIssue}>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="machine">Machine</Label>
                    <Select
                      id="machine"
                      value={form.machine_id}
                      onChange={(e) => setForm({ ...form, machine_id: e.target.value })}
                      options={machines.map((m) => ({ value: m.id, label: `${m.name} (${m.model_number})` }))}
                      placeholder="Select a machine"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="urgency">Urgency</Label>
                    <Select
                      id="urgency"
                      value={form.urgency}
                      onChange={(e) => setForm({ ...form, urgency: e.target.value as Issue["urgency"] })}
                      options={[
                        { value: "low", label: "Low" },
                        { value: "medium", label: "Medium" },
                        { value: "high", label: "High" },
                        { value: "critical", label: "Critical" },
                      ]}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      placeholder="Describe the issue in detail..."
                      required
                      rows={4}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Issue"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by description, machine, or customer..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Issues Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <MessageSquare className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">No issues found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12 text-muted-foreground">#</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Machine</TableHead>
                  {isAdmin && <TableHead>Customer</TableHead>}
                  <TableHead>Urgency</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-nowrap">Reported On</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((issue, idx) => (
                  <TableRow key={issue.id}>
                    <TableCell className="text-muted-foreground text-xs tabular-nums">{idx + 1}</TableCell>
                    <TableCell className="max-w-[250px]">
                      <p className="truncate text-sm font-medium">{issue.description}</p>
                    </TableCell>
                    <TableCell>
                      <span className="text-sm">{issue.machine_name || "-"}</span>
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-sm">{issue.customer_name || "-"}</TableCell>
                    )}
                    <TableCell>{getUrgencyBadge(issue.urgency)}</TableCell>
                    <TableCell>{getStatusBadge(issue.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground text-nowrap">
                      {new Date(issue.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {isAdmin && (issue.status === "submitted" || issue.status === "under_review") && (
                          <>
                            {issue.status === "submitted" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  await supabase.from("issues").update({ status: "under_review" }).eq("id", issue.id)
                                  fetchIssues()
                                }}
                              >
                                Review
                              </Button>
                            )}
                            <Button
                              size="sm"
                              onClick={() => {
                                setSelectedIssue(issue)
                                setAssignOpen(true)
                              }}
                            >
                              <UserCheck className="h-3 w-3 mr-1" />
                              Assign
                            </Button>
                          </>
                        )}
                        {isEngineer && issue.status === "assigned" && (
                          <Button size="sm" variant="success" onClick={() => handleResolve(issue.id)}>
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            Resolve
                          </Button>
                        )}
                        {isCustomer && issue.status === "assigned" && issue.engineer_name && (
                          <span className="text-xs text-muted-foreground">
                            Engineer: {issue.engineer_name}
                          </span>
                        )}
                        {issue.status === "resolved" && (
                          <span className="text-xs text-muted-foreground">Resolved</span>
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

      {/* Assign Engineer Dialog */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Engineer</DialogTitle>
            <DialogDescription>
              {selectedIssue && (
                <span className="text-muted-foreground">
                  Issue from <strong>{selectedIssue.customer_name || "customer"}</strong> &mdash;{" "}
                  {selectedIssue.machine_name} ({selectedIssue.machine_model})
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleAssign}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="engineer">Engineer</Label>
                <Select
                  id="engineer"
                  value={assignForm.engineer_id}
                  onChange={(e) => setAssignForm({ ...assignForm, engineer_id: e.target.value })}
                  options={engineers.map((e) => ({ value: e.user_id, label: e.name }))}
                  placeholder="Select engineer"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="days">Tentative Days</Label>
                <Input
                  id="days"
                  type="number"
                  min={1}
                  max={365}
                  value={assignForm.tentative_days}
                  onChange={(e) => setAssignForm({ ...assignForm, tentative_days: parseInt(e.target.value) })}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Assign & Notify"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
