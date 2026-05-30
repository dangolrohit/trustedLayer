import {
  BarChart3,
  Building2,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  FileUp,
  LayoutDashboard,
  LogOut,
  Activity,
  Users,
} from "lucide-react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";

import { Button } from "./ui/Button";
import { cn, roleLabel } from "../lib/utils";
import { useAuthStore } from "../store/auth";
import { GetStartedModal } from "./GetStartedModal";

const links = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, roles: ["merchant", "loan_department", "admin"] },
  { to: "/app/trust-score", label: "Trust Score", icon: BarChart3, roles: ["merchant", "loan_department", "admin"] },
  { to: "/app/bank-statements", label: "Banks", icon: FileUp, roles: ["merchant", "loan_department", "admin"] },
  { to: "/app/loans", label: "Loans", icon: CreditCard, roles: ["merchant", "loan_department", "admin"] },
  { to: "/app/psychometric", label: "Psychometric", icon: Activity, roles: ["merchant"] },
  { to: "/app/guarantor", label: "Guarantor", icon: Users, roles: ["merchant"] },
  { to: "/app/admin", label: "Admin", icon: Users, roles: ["admin", "loan_department"] },
];

export function AppShell() {
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const navigate = useNavigate();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showGetStarted, setShowGetStarted] = useState(false);

  useEffect(() => {
    const v = localStorage.getItem("show_get_started");
    if (v) setShowGetStarted(true);
  }, []);

  const onLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="min-h-screen bg-background lg:flex">
      <aside
        className={cn(
          "sticky top-0 z-30 flex border-b border-border bg-white/95 backdrop-blur transition-[width] duration-200 lg:h-screen lg:flex-col lg:border-b-0 lg:border-r",
          isCollapsed ? "lg:w-[76px]" : "lg:w-72",
        )}
      >
        <div className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 lg:flex-col lg:items-stretch lg:justify-start lg:px-3 lg:py-4">
          <div className={cn("flex min-w-0 items-center gap-3", isCollapsed && "lg:justify-center")}>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-white">
              <Building2 size={21} />
            </div>
            <div className={cn("min-w-0", isCollapsed && "lg:hidden")}>
              <p className="truncate text-base font-bold text-foreground">Alternative Trust Layer</p>
              <p className="truncate text-xs text-muted-foreground">{roleLabel(user?.role)} workspace</p>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="hidden lg:inline-flex"
            onClick={() => setIsCollapsed((current) => !current)}
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!isCollapsed}
          >
            {isCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
          </Button>

          <Button variant="ghost" size="icon" onClick={onLogout} title="Log out" className="lg:hidden">
            <LogOut size={20} />
          </Button>
        </div>

        <nav className="flex gap-1 overflow-x-auto px-4 pb-3 lg:flex-1 lg:flex-col lg:overflow-x-visible lg:px-3 lg:pb-4">
            {links.filter((link) => user?.role && link.roles.includes(user.role)).map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.to === "/app"}
                title={isCollapsed ? link.label : undefined}
                className={({ isActive }) =>
                  cn(
                    "focus-ring flex h-10 shrink-0 items-center gap-3 rounded-md px-3 text-sm font-medium text-muted-foreground transition",
                    "lg:h-11",
                    isCollapsed && "lg:justify-center lg:px-0",
                    isActive && "bg-sky-50 text-primary",
                  )
                }
              >
                <link.icon size={18} className="shrink-0" />
                <span className={cn(isCollapsed && "lg:hidden")}>{link.label}</span>
              </NavLink>
            ))}
        </nav>

        <div className="hidden border-t border-border p-3 lg:block">
          <Button
            variant="ghost"
            className={cn("w-full", isCollapsed ? "px-0" : "justify-start")}
            onClick={onLogout}
            title="Log out"
          >
            <LogOut size={20} />
            <span className={cn(isCollapsed && "lg:hidden")}>Log out</span>
          </Button>
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <GetStartedModal open={showGetStarted} onClose={() => setShowGetStarted(false)} />
        <div className="mx-auto max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
