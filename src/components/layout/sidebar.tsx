import { useState } from "react"
import { Link, useLocation } from "react-router-dom"
import { useAuth } from "@/context/auth-context"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Cog,
  LayoutDashboard,
  Users,
  Wrench,
  Package,
  AlertTriangle,
  FileText,
  ClipboardList,
  Bell,
  Settings,
  ChevronLeft,
  ChevronRight,
  Home,
  History,
  UserCog,
  LogOut,
  Menu,
  X,
} from "lucide-react"
import type { UserRole } from "@/types"

interface NavItem {
  label: string
  href: string
  icon: React.ElementType
  roles: UserRole[]
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, roles: ["super_admin", "admin", "engineer", "customer"] },
  { label: "Overview", href: "/dashboard/overview", icon: Home, roles: ["super_admin", "admin"] },
  // Super Admin & Admin
  { label: "Admins", href: "/dashboard/admins", icon: UserCog, roles: ["super_admin"] },
  { label: "Engineers", href: "/dashboard/engineers", icon: Users, roles: ["super_admin", "admin"] },
  { label: "Customers", href: "/dashboard/customers", icon: Users, roles: ["super_admin", "admin"] },
  { label: "Machines", href: "/dashboard/machines", icon: Wrench, roles: ["super_admin", "admin", "engineer", "customer"] },
  { label: "Parts", href: "/dashboard/parts", icon: Package, roles: ["super_admin", "admin", "customer"] },
  // Issues
  { label: "Issues", href: "/dashboard/issues", icon: AlertTriangle, roles: ["super_admin", "admin", "engineer", "customer"] },
  // Engineer
  { label: "Assignments", href: "/dashboard/assignments", icon: ClipboardList, roles: ["engineer"] },
  // Reports
  { label: "Service Reports", href: "/dashboard/reports", icon: FileText, roles: ["super_admin", "admin", "engineer", "customer"] },
  { label: "Service History", href: "/dashboard/history", icon: History, roles: ["engineer", "customer"] },
  // Customer
  { label: "My Machines", href: "/dashboard/my-machines", icon: Home, roles: ["customer"] },
  // Common
  { label: "Notifications", href: "/dashboard/notifications", icon: Bell, roles: ["super_admin", "admin", "engineer", "customer"] },
  { label: "Settings", href: "/dashboard/settings", icon: Settings, roles: ["super_admin", "admin", "engineer", "customer"] },
]

export default function Sidebar() {
  const { profile, signOut } = useAuth()
  const location = useLocation()
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  const role = profile?.role || "customer"
  const filteredItems = navItems.filter((item) => item.roles.includes(role))

  return (
    <>
      {/* Mobile toggle */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setMobileOpen(!mobileOpen)}
      >
        {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-40 h-screen bg-sidebar-background border-r border-sidebar-border transition-all duration-300 flex flex-col",
          collapsed ? "w-16" : "w-64",
          mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
        )}
      >
        {/* Logo */}
        <div className={cn("flex items-center h-16 border-b border-sidebar-border px-4", collapsed && "justify-center")}>
          <Cog className="h-7 w-7 text-primary shrink-0" />
          {!collapsed && (
            <span className="ml-3 font-bold text-sidebar-foreground text-lg truncate">
              IndSaaS
            </span>
          )}
        </div>

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {filteredItems.map((item) => {
              const isActive = location.pathname === item.href
              const Icon = item.icon
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-sm"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    collapsed && "justify-center px-2"
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  {!collapsed && <span>{item.label}</span>}
                </Link>
              )
            })}
          </nav>
        </ScrollArea>

        {/* Bottom section */}
        <div className="border-t border-sidebar-border p-3">
          {collapsed ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(false)}
              className="w-full"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          ) : (
            <div className="flex items-center justify-between">
              <Button
                variant="ghost"
                size="sm"
                onClick={signOut}
                className="text-sidebar-foreground hover:text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Sign out
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(true)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </aside>
    </>
  )
}
