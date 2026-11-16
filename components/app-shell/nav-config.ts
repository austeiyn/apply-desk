import {
  BarChart3,
  BookOpenCheck,
  Bot,
  Briefcase,
  FileText,
  FileUser,
  LayoutDashboard,
  Megaphone,
  MessagesSquare,
  PlusCircle,
  ScrollText,
  Settings,
  SlidersHorizontal,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Match only the exact path (for index routes). */
  exact?: boolean;
}

export const candidateNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/dashboard/profile", label: "My Profile", icon: UserRound },
  { href: "/dashboard/cv", label: "My CV", icon: FileUser },
  { href: "/dashboard/applications", label: "Job Applications", icon: Briefcase, exact: true },
  { href: "/dashboard/applications/new", label: "Create Application", icon: PlusCircle },
  { href: "/dashboard/resumes", label: "Resume Library", icon: FileText },
  { href: "/dashboard/cover-letters", label: "Cover Letters", icon: ScrollText },
  { href: "/dashboard/interview-prep", label: "Interview Preparation", icon: MessagesSquare },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export const adminNav: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/analytics", label: "Applications Analytics", icon: BarChart3 },
  { href: "/admin/ai-usage", label: "AI Usage", icon: Bot },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone },
  { href: "/admin/settings", label: "Platform Settings", icon: SlidersHorizontal },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: BookOpenCheck },
];

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
