"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog as DialogPrimitive } from "radix-ui";
import { ArrowLeftRight, LogOut, Menu, Settings, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { SheetContent } from "@/components/ui/dialog";
import {
  Avatar,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/misc";
import { cn, initials } from "@/lib/utils";
import { adminNav, candidateNav, isActive, type NavItem } from "./nav-config";

interface ShellUser {
  fullName: string;
  email: string;
  isAdmin: boolean;
}

function NavList({ items, pathname, onNavigate }: { items: NavItem[]; pathname: string; onNavigate?: () => void }) {
  return (
    <nav aria-label="Main" className="grid gap-0.5">
      {items.map((item) => {
        const active = isActive(pathname, item);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-2.5 rounded-md px-2.5 py-2 text-[13.5px] font-medium transition-colors",
              active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <Icon className={cn("size-4 shrink-0", active ? "text-brand" : "text-muted-foreground/80 group-hover:text-foreground")} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UserMenu({ user, area }: { user: ShellUser; area: "candidate" | "admin" }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="flex w-full min-w-0 items-center gap-2.5 rounded-md p-1.5 text-left transition-colors hover:bg-muted"
          aria-label="Account menu"
        >
          <Avatar initials={initials(user.fullName, user.email[0]?.toUpperCase())} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[13px] font-medium">{user.fullName || "Your account"}</span>
            <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dashboard/settings">
            <Settings /> Settings
          </Link>
        </DropdownMenuItem>
        {user.isAdmin ? (
          <DropdownMenuItem asChild>
            <Link href={area === "admin" ? "/dashboard" : "/admin"}>
              {area === "admin" ? <ArrowLeftRight /> : <ShieldCheck />}
              {area === "admin" ? "Candidate workspace" : "Admin console"}
            </Link>
          </DropdownMenuItem>
        ) : null}
        <DropdownMenuSeparator />
        <form action="/auth/signout" method="post">
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOut /> Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function AppShell({
  user,
  area = "candidate",
  banner,
  children,
}: {
  user: ShellUser;
  area?: "candidate" | "admin";
  banner?: React.ReactNode;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const items = area === "admin" ? adminNav : candidateNav;
  const home = area === "admin" ? "/admin" : "/dashboard";

  // Close the mobile drawer whenever the route changes.
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  const sidebar = (onNavigate?: () => void) => (
    <div className="flex h-full flex-col gap-4 p-3">
      <div className="flex items-center gap-2 px-1.5 pt-1">
        <Logo href={home} />
        {area === "admin" ? (
          <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary-foreground">
            Admin
          </span>
        ) : null}
      </div>
      <div className="flex-1 overflow-y-auto">
        <NavList items={items} pathname={pathname} onNavigate={onNavigate} />
      </div>
      <div className="border-t pt-3">
        <UserMenu user={user} area={area} />
      </div>
    </div>
  );

  return (
    <div className="min-h-dvh lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-dvh border-r bg-sidebar lg:block">{sidebar()}</aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur lg:hidden">
          <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
            <DialogPrimitive.Trigger asChild>
              <Button variant="ghost" size="icon-sm" aria-label="Open navigation">
                <Menu className="size-5" />
              </Button>
            </DialogPrimitive.Trigger>
            <SheetContent side="left" aria-describedby={undefined}>
              <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
              {sidebar(() => setOpen(false))}
            </SheetContent>
          </DialogPrimitive.Root>
          <Logo href={home} />
        </header>

        {banner}
        <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
