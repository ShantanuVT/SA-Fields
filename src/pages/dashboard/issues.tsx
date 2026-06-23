import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import DataTable, { type Column, type TableFilter } from "@/components/ui/data-table"
import { useAuth } from "@/context/auth-context"
import { supabase } from "@/lib/supabase"
import type { Issue, Machine, UserProfile } from "@/types"
import FileUpload, { type UploadedFile } from "@/components/ui/file-upload"
import { Plus, Loader2, UserCheck, CheckCircle2, MessageSquare, FileText } from "lucide-react"

export default function IssuesPage() {
  const { profile } = useAuth()
  const [issues, setIssues] = useState<Issue[]>([])
  const [machines, setMachines] = useState<Machine[]>([])
  const [engineers, setEngineers] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [assignOpen, setAssignOpen] = useState(false)
  const [selectedIssue, setSelectedIssue] = useState<Issue | null>(null)
  const [assignForm, setAssignForm] = useState({ engineer_id: "", tentative_days: 3 })
  const [reportOpen, setReportOpen] = useState(false)
  const [reportSaving, setReportSaving] = useState(false)
  const [issueForReport, setIssueForReport] = useState<Issue | null>(null)
  const [reportForm, setReportForm] = useState({
    service_details: "",
    parts_replaced: "",
    next_service_date: "",
    actual_resolution_date: new Date().toISOString().split("T")[0],
    remarks: "",
  })

  const isAdmin = profile?.role === "super_admin" || profile?.role === "admin"
  const isCustomer = profile?.role === "customer"
  const isEngineer = profile?.role === "engineer"

  const [mediaFiles, setMediaFiles] = useState<UploadedFile[]>([])
  const [reportPdf, setReportPdf] = useState<UploadedFile[]>([])

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
      // 1. Create the issue
      const { data: issueData, error } = await supabase.from("issues").insert({
        customer_id: profile!.user_id,
        machine_id: form.machine_id,
        description: form.description,
        urgency: form.urgency,
        status: "submitted",
      }).select("id").single()

      if (error) throw new Error(error.message)

      // 2. Upload media files and insert issue_media records
      if (mediaFiles.length > 0 && issueData) {
        const mediaRecords = mediaFiles.map((f) => ({
          issue_id: issueData.id,
          file_url: f.url,
          file_type: f.type.startsWith("video/") ? "video" as const : "image" as const,
        }))

        const { error: mediaError } = await supabase
          .from("issue_media")
          .insert(mediaRecords)

        if (mediaError) console.error("Error saving media records:", mediaError)
      }

      setOpen(false)
      setForm({ machine_id: "", description: "", urgency: "medium" })
      setMediaFiles([])
      fetchIssues()
    } catch (err: any) {
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
        await supabase.from("engineer_assignments").insert({
          engineer_id: assignForm.engineer_id,
          customer_id: selectedIssue.customer_id,
          machine_id: selectedIssue.machine_id,
          issue_id: selectedIssue.id,
          assigned_by_admin_id: profile!.user_id,
          status: "approved",
        })

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

  async function handleSubmitReport(e: React.FormEvent) {
    e.preventDefault()
    if (!issueForReport) return
    setReportSaving(true)
    try {
      // 1. Insert service report (with PDF URL if uploaded)
      const pdfUrl = reportPdf.length > 0 ? reportPdf[0].url : ""
      const { error: reportError } = await supabase.from("service_reports").insert({
        issue_id: issueForReport.id,
        machine_id: issueForReport.machine_id,
        engineer_id: profile!.user_id,
        service_details: reportForm.service_details,
        parts_replaced: reportForm.parts_replaced,
        next_service_date: reportForm.next_service_date || null,
        actual_resolution_date: reportForm.actual_resolution_date,
        remarks: reportForm.remarks,
        pdf_url: pdfUrl,
      })

      if (reportError) throw new Error(reportError.message)

      // 2. Update issue status to resolved
      await supabase
        .from("issues")
        .update({ status: "resolved" })
        .eq("id", issueForReport.id)

      // 3. Log machine history
      await supabase.from("machine_history").insert({
        machine_id: issueForReport.machine_id,
        event_type: "service_completed",
        description: `Service completed: ${reportForm.service_details.slice(0, 150)}`,
        reference_id: issueForReport.id,
        created_by: profile?.name || "Engineer",
      })

      // 4. Update machine status back to active if it was under_service
      await supabase
        .from("machines")
        .update({ status: "active" })
        .eq("id", issueForReport.machine_id)
        .eq("status", "under_service")

      // 5. Notify the customer
      await supabase.from("notifications").insert({
        user_id: issueForReport.customer_id,
        type: "service_completed",
        title: "Issue Resolved",
        message: `Your issue has been resolved: ${issueForReport.description.slice(0, 100)}`,
        reference_id: issueForReport.id,
      })

      // Close dialog and reset
      setReportOpen(false)
      setIssueForReport(null)
      setReportPdf([])
      setReportForm({
        service_details: "",
        parts_replaced: "",
        next_service_date: "",
        actual_resolution_date: new Date().toISOString().split("T")[0],
        remarks: "",
      })
      fetchIssues()
    } catch (err) {
      console.error("Error submitting service report:", err)
    } finally {
      setReportSaving(false)
    }
  }

  // ─── Badge helpers ──────────────────────────────────────────
  const statusVariants: Record<string, "default" | "success" | "warning" | "info" | "destructive" | "secondary"> = {
    submitted: "info",
    under_review: "warning",
    assigned: "secondary",
    resolved: "success",
  }

  const urgencyVariants: Record<string, "default" | "secondary" | "destructive" | "warning" | "info"> = {
    low: "secondary",
    medium: "info",
    high: "warning",
    critical: "destructive",
  }

  // ─── DataTable columns ──────────────────────────────────────
  const columns: Column<Issue>[] = [
    {
      key: "description",
      header: "Description",
      render: (i) => <p className="truncate max-w-[250px] text-sm font-medium">{i.description}</p>,
    },
    {
      key: "machine_name",
      header: "Machine",
      render: (i) => <span className="text-sm">{i.machine_name || "-"}</span>,
    },
    ...(isAdmin
      ? [{ key: "customer_name" as const, header: "Customer", render: (i: Issue) => <span className="text-sm">{i.customer_name || "-"}</span> }]
      : []),
    {
      key: "urgency",
      header: "Urgency",
      render: (i) => (
        <Badge variant={urgencyVariants[i.urgency] || "default"} className="capitalize">
          {i.urgency}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (i) => (
        <Badge variant={statusVariants[i.status] || "default"} className="capitalize">
          {i.status.replace("_", " ")}
        </Badge>
      ),
    },
    {
      key: "created_at",
      header: "Reported On",
      render: (i) => <span className="text-sm text-muted-foreground text-nowrap">{new Date(i.created_at).toLocaleDateString()}</span>,
    },
    {
      key: "actions",
      header: "Actions",
      sortable: false,
      className: "text-right",
      render: (issue) => (
        <div className="flex items-center justify-end gap-2">
          {isAdmin && (issue.status === "submitted" || issue.status === "under_review") && (
            <>
              {issue.status === "submitted" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async (e) => {
                    e.stopPropagation()
                    await supabase.from("issues").update({ status: "under_review" }).eq("id", issue.id)
                    fetchIssues()
                  }}
                >
                  Review
                </Button>
              )}
              <Button
                size="sm"
                onClick={(e) => {
                  e.stopPropagation()
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
            <Button size="sm" variant="success" onClick={(e) => {
              e.stopPropagation()
              setIssueForReport(issue)
              setReportForm({
                service_details: "",
                parts_replaced: "",
                next_service_date: "",
                actual_resolution_date: new Date().toISOString().split("T")[0],
                remarks: "",
              })
              setReportOpen(true)
            }}>
              <FileText className="h-3 w-3 mr-1" />
              Complete Service
            </Button>
          )}
          {isCustomer && issue.status === "assigned" && issue.engineer_name && (
            <span className="text-xs text-muted-foreground">Engineer: {issue.engineer_name}</span>
          )}
          {issue.status === "resolved" && (
            <span className="text-xs text-muted-foreground">Resolved</span>
          )}
        </div>
      ),
    },
  ]

  const filters: TableFilter[] = [
    {
      key: "status",
      label: "Status",
      options: [
        { value: "submitted", label: "Submitted" },
        { value: "under_review", label: "Under Review" },
        { value: "assigned", label: "Assigned" },
        { value: "resolved", label: "Resolved" },
      ],
    },
    {
      key: "urgency",
      label: "Urgency",
      options: [
        { value: "low", label: "Low" },
        { value: "medium", label: "Medium" },
        { value: "high", label: "High" },
        { value: "critical", label: "Critical" },
      ],
    },
  ]

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

                  {/* Attachment upload */}
                  <div className="space-y-2">
                    <Label>Attachments (optional)</Label>
                    <FileUpload
                      bucket="issue-media"
                      accept="image/*,video/*"
                      maxSizeMB={10}
                      maxFiles={5}
                      files={mediaFiles}
                      onChange={setMediaFiles}
                      acceptLabel="Upload images or videos showing the issue"
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

      <DataTable<Issue>
        data={issues}
        columns={columns}
        loading={loading}
        searchPlaceholder="Search by description, machine, or customer..."
        emptyMessage="No issues found"
        emptyIcon={MessageSquare}
        rowKey={(i) => i.id}
        filters={filters}
        exportable={isAdmin}
        exportFilename="issues"
      />

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

      {/* Service Report Dialog */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Complete Service</DialogTitle>
            <DialogDescription>
              {issueForReport && (
                <span className="text-muted-foreground">
                  Issue: <strong>{issueForReport.description.slice(0, 100)}</strong>
                  {issueForReport.description.length > 100 && "..."}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitReport}>
            <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto pr-1">
              <div className="space-y-2">
                <Label htmlFor="service_details">
                  Service Details <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="service_details"
                  value={reportForm.service_details}
                  onChange={(e) => setReportForm({ ...reportForm, service_details: e.target.value })}
                  placeholder="Describe the service performed, what was found, and what was done..."
                  required
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="parts_replaced">Parts Replaced</Label>
                <Textarea
                  id="parts_replaced"
                  value={reportForm.parts_replaced}
                  onChange={(e) => setReportForm({ ...reportForm, parts_replaced: e.target.value })}
                  placeholder="List any parts that were replaced during service..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="resolution_date">Resolution Date</Label>
                  <Input
                    id="resolution_date"
                    type="date"
                    value={reportForm.actual_resolution_date}
                    onChange={(e) => setReportForm({ ...reportForm, actual_resolution_date: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="next_service">Next Service Date</Label>
                  <Input
                    id="next_service"
                    type="date"
                    value={reportForm.next_service_date}
                    onChange={(e) => setReportForm({ ...reportForm, next_service_date: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  value={reportForm.remarks}
                  onChange={(e) => setReportForm({ ...reportForm, remarks: e.target.value })}
                  placeholder="Any additional notes or recommendations..."
                  rows={2}
                />
              </div>

              {/* PDF upload */}
              <div className="space-y-2">
                <Label>Service Report PDF (optional)</Label>
                <FileUpload
                  bucket="service-reports"
                  accept=".pdf,application/pdf"
                  maxSizeMB={20}
                  maxFiles={1}
                  files={reportPdf}
                  onChange={setReportPdf}
                  acceptLabel="Upload the service report as PDF"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReportOpen(false)} disabled={reportSaving}>
                Cancel
              </Button>
              <Button type="submit" disabled={reportSaving}>
                {reportSaving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                {reportSaving ? "Submitting..." : "Complete & Submit Report"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
