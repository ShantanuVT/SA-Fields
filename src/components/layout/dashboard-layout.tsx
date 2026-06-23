import { useState, useEffect, useRef } from "react"
import { Outlet, useNavigate } from "react-router-dom"
import { useAuth } from "@/context/auth-context"
import Sidebar from "./sidebar"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import {
  Bell,
  Loader2,
  Menu,
  AlertTriangle,
  UserCheck,
  CheckCheck,
  FileText,
  Info,
  CheckCircle2,
} from "lucide-react"
import { supabase } from "@/lib/supabase"
import type { Notification } from "@/types"

export default function DashboardLayout() {
  const { user, profile, loading } = useAuth()
  const navigate = useNavigate()
  const [unreadCount, setUnreadCount] = useState(0)
  const [recentNotifications, setRecentNotifications] = useState<Notification[]>([])
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth/login")
    }
  }, [user, loading, navigate])

  // Subscribe to notifications
  useEffect(() => {
    if (!user) return

    const channel = supabase
      .channel("notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          setUnreadCount((prev) => prev + 1)
          fetchRecentNotifications()
        }
      )
      .subscribe()

    fetchUnreadCount()
    fetchRecentNotifications()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [user])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [dropdownOpen])

  async function fetchUnreadCount() {
    if (!user) return
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("read", false)
    setUnreadCount(count || 0)
  }

  async function fetchRecentNotifications() {
    if (!user) return
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5)
    if (data) setRecentNotifications(data)
  }

  async function handleMarkRead(id: string) {
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("id", id)
    fetchRecentNotifications()
    fetchUnreadCount()
  }

  async function handleMarkAllRead() {
    if (!user) return
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false)
    fetchRecentNotifications()
    fetchUnreadCount()
  }

  function getNotificationIcon(type: string) {
    switch (type) {
      case "issue_submitted": return <AlertTriangle className="h-4 w-4 text-amber-500" />
      case "engineer_assigned": return <UserCheck className="h-4 w-4 text-blue-500" />
      case "service_completed": return <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      case "report_generated": return <FileText className="h-4 w-4 text-purple-500" />
      default: return <Info className="h-4 w-4 text-muted-foreground" />
    }
  }

  function timeAgo(dateStr: string): string {
    const now = Date.now()
    const diff = now - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return "just now"
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    const days = Math.floor(hours / 24)
    return `${days}d ago`
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-4 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user || !profile) return null

  return (
    <div className="min-h-screen bg-background">
      <Sidebar />

      {/* Main content area */}
      <div className="md:pl-64 transition-all duration-300">
        {/* Top bar */}
        <header className="sticky top-0 z-30 h-16 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <div className="flex items-center justify-between h-full px-4 md:px-6">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                onClick={() => document.querySelector("aside")?.classList.toggle("translate-x-0")}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div>
                <p className="text-sm font-medium">{profile.name}</p>
                <Badge variant="outline" className="capitalize text-xs">
                  {profile.role.replace("_", " ")}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Notification Dropdown */}
              <div className="relative" ref={dropdownRef}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative text-muted-foreground"
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 min-w-[16px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-medium px-1">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </Button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-lg border bg-popover shadow-lg z-50">
                    <div className="flex items-center justify-between px-4 py-3 border-b">
                      <p className="text-sm font-semibold">Notifications</p>
                      {unreadCount > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto text-xs px-2 py-1"
                          onClick={handleMarkAllRead}
                        >
                          <CheckCheck className="h-3 w-3 mr-1" />
                          Mark all read
                        </Button>
                      )}
                    </div>

                    {recentNotifications.length === 0 ? (
                      <div className="text-center py-8">
                        <Bell className="h-8 w-8 mx-auto text-muted-foreground/50" />
                        <p className="mt-2 text-xs text-muted-foreground">No notifications yet</p>
                      </div>
                    ) : (
                      <ScrollArea className="max-h-[320px]">
                        {recentNotifications.map((n) => (
                          <div
                            key={n.id}
                            className={cn(
                              "flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-muted/50",
                              !n.read && "bg-primary/5"
                            )}
                            onClick={() => {
                              handleMarkRead(n.id)
                              if (n.reference_id && n.type === "engineer_assigned") {
                                navigate("/dashboard/issues")
                              }
                            }}
                          >
                            <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                              {getNotificationIcon(n.type)}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-medium truncate">{n.title}</p>
                                <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(n.created_at)}</span>
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                            </div>
                            {!n.read && <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />}
                          </div>
                        ))}
                      </ScrollArea>
                    )}

                    <div className="border-t p-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full text-xs"
                        onClick={() => {
                          setDropdownOpen(false)
                          navigate("/dashboard/notifications")
                        }}
                      >
                        View all notifications
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* User avatar */}
              <Avatar className="h-8 w-8 cursor-pointer ring-2 ring-border hover:ring-primary transition-all">
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                  {profile.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="p-4 md:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
