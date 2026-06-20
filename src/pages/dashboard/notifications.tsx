import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/context/auth-context"
import { supabase } from "@/lib/supabase"
import type { Notification } from "@/types"
import { Bell, Loader2, CheckCheck, AlertTriangle, UserCheck, FileText, Info } from "lucide-react"

export default function NotificationsPage() {
  const { profile } = useAuth()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNotifications()

    // Realtime subscription
    const channel = supabase
      .channel("notifications-channel")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${profile?.user_id}`,
        },
        () => fetchNotifications()
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [profile])

  async function fetchNotifications() {
    try {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profile!.user_id)
        .order("created_at", { ascending: false })
      if (data) setNotifications(data)
    } catch (err) {
      console.error("Error fetching notifications:", err)
    } finally {
      setLoading(false)
    }
  }

  async function markAllRead() {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", profile!.user_id)
      .eq("read", false)
    fetchNotifications()
  }

  async function markRead(id: string) {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id)
    fetchNotifications()
  }

  const getIcon = (type: string) => {
    switch (type) {
      case "issue_submitted": return <AlertTriangle className="h-4 w-4 text-amber-500" />
      case "engineer_assigned": return <UserCheck className="h-4 w-4 text-blue-500" />
      case "service_completed": return <CheckCheck className="h-4 w-4 text-emerald-500" />
      case "report_generated": return <FileText className="h-4 w-4 text-purple-500" />
      default: return <Info className="h-4 w-4 text-muted-foreground" />
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {unreadCount > 0 ? `You have ${unreadCount} unread notification${unreadCount > 1 ? "s" : ""}` : "All caught up!"}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={markAllRead}>
            <CheckCheck className="h-4 w-4 mr-2" />
            Mark all read
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-12">
              <Bell className="h-12 w-12 mx-auto text-muted-foreground/50" />
              <p className="mt-4 text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 md:p-6 transition-colors cursor-pointer hover:bg-muted/30 ${!notification.read ? "bg-primary/5" : ""}`}
                  onClick={() => !notification.read && markRead(notification.id)}
                >
                  <div className="flex items-start gap-4">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium">{notification.title}</p>
                        <div className="flex items-center gap-2 shrink-0">
                          {!notification.read && <span className="h-2 w-2 rounded-full bg-primary" />}
                          <span className="text-xs text-muted-foreground">
                            {new Date(notification.created_at).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
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
