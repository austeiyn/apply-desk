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

/** Section colours: related pages share one (see TONE_CLASSES in app-shell.tsx). */
export type NavTone = "grape" | "coral" | "mint" | "ocean" | "bloom" | "slate";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  tone: NavTone;
  /** Match only the exact path (for index routes). */
  exact?: boolean;
}

export const candidateNav: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, tone: "grape", exact: true },
  { href: "/dashboard/profile", label: "My Profile", icon: UserRound, tone: "ocean" },
  { href: "/dashboard/cv", label: "My CV", icon: FileUser, tone: "ocean" },
  { href: "/dashboard/applications", label: "Job Applications", icon: Briefcase, tone: "coral", exact: true },
  { href: "/dashboard/applications/new", label: "Create Application", icon: PlusCircle, tone: "coral" },
  { href: "/dashboard/resumes", label: "Resume Library", icon: FileText, tone: "bloom" },
  { href: "/dashboard/cover-letters", label: "Cover Letters", icon: ScrollText, tone: "bloom" },
  { href: "/dashboard/interview-prep", label: "Interview Preparation", icon: MessagesSquare, tone: "mint" },
  { href: "/dashboard/settings", label: "Settings", icon: Settings, tone: "slate" },
];

export const adminNav: NavItem[] = [
  { href: "/admin", label: "Overview", icon: LayoutDashboard, tone: "grape", exact: true },
  { href: "/admin/users", label: "Users", icon: Users, tone: "ocean" },
  { href: "/admin/analytics", label: "Applications Analytics", icon: BarChart3, tone: "coral" },
  { href: "/admin/ai-usage", label: "AI Usage", icon: Bot, tone: "bloom" },
  { href: "/admin/announcements", label: "Announcements", icon: Megaphone, tone: "mint" },
  { href: "/admin/settings", label: "Platform Settings", icon: SlidersHorizontal, tone: "slate" },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: BookOpenCheck, tone: "slate" },
];

export function isActive(pathname: string, item: NavItem): boolean {
  if (item.exact) return pathname === item.href;
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}
