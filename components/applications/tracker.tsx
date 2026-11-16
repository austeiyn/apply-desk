"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Briefcase, CalendarClock, ExternalLink, FileText, KanbanSquare, ListChecks, ScrollText, Search, Table2 } from "lucide-react";
import { updateStatusAction } from "@/app/dashboard/applications/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, Table, TBody, TD, TH, THead, TR } from "@/components/ui/feedback";
import { Input, NativeSelect } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import { APPLICATION_FILTERS, APPLICATION_STATUSES, STATUS_META, type ApplicationFilter, type ApplicationStatus } from "@/lib/constants";
import { cn, formatDate, relativeTime } from "@/lib/utils";
import { StatusBadge } from "./status-badge";

export interface TrackerItem {
  id: string;
  job_title: string;
  company_name: string;
  location: string | null;
  job_url: string | null;
  application_status: string;
  deadline: string | null;
  next_action: string | null;
  next_action_date: string | null;
  application_date: string | null;
  created_at: string;
  updated_at: string;
  resumeVersion: number | null;
  coverLetters: number;
}

function isFilter(v: string | null): v is ApplicationFilter {
  return v !== null && v in APPLICATION_FILTERS;
}

function deadlineTone(deadline: string | null): string {
  if (!deadline) return "";
  const days = (Date.parse(deadline) - Date.now()) / 86400000;
  if (days < 0) return "text-muted-foreground line-through";
  if (days < 3) return "text-destructive font-medium";
  if (days < 7) return "text-warning font-medium";
  return "";
}

function CardStatusMenu({ item, onChange }: { item: TrackerItem; onChange: (status: string) => void }) {
  return (
    <NativeSelect
      aria-label={`Status for ${item.job_title}`}
      value={item.application_status}
      onChange={(e) => onChange(e.target.value)}
      onPointerDown={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      className="h-7 w-full text-xs"
    >
      {APPLICATION_STATUSES.map((s) => (
        <option key={s} value={s}>
          {STATUS_META[s].label}
        </option>
      ))}
    </NativeSelect>
  );
}

function KanbanCard({ item, onStatus }: { item: TrackerItem; onStatus: (id: string, status: string) => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: item.id, data: { status: item.application_status } });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      aria-roledescription="Draggable application"
      className={cn(
        "cursor-grab touch-manipulation space-y-2 rounded-lg border bg-card p-3 shadow-[0_1px_2px_rgba(15,26,43,0.05)] outline-none transition-shadow focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing",
        isDragging && "z-50 shadow-lg ring-2 ring-brand/30",
      )}
    >
      <div className="space-y-0.5">
        <Link
          href={`/dashboard/applications/${item.id}`}
          className="line-clamp-2 text-sm font-medium hover:text-brand"
          onPointerDown={(e) => e.stopPropagation()}
        >
          {item.job_title}
        </Link>
        <p className="truncate text-xs text-muted-foreground">{[item.company_name, item.location].filter(Boolean).join(" · ") || "—"}</p>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        <span className={cn("inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5", item.resumeVersion ? "text-foreground" : "text-muted-foreground")}>
          <FileText className="size-3" /> {item.resumeVersion ? `Resume v${item.resumeVersion}` : "No resume"}
        </span>
        <span className={cn("inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5", item.coverLetters ? "text-foreground" : "text-muted-foreground")}>
          <ScrollText className="size-3" /> {item.coverLetters ? "Cover letter" : "No letter"}
        </span>
      </div>
      {item.next_action ? (
        <p className="flex items-start gap-1 text-xs">
          <ListChecks className="mt-0.5 size-3 shrink-0 text-brand" />
          <span className="line-clamp-2">
            {item.next_action}
            {item.next_action_date ? <span className="text-muted-foreground"> · {formatDate(item.next_action_date)}</span> : null}
          </span>
        </p>
      ) : null}
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Saved {formatDate(item.created_at)}</span>
        {item.deadline ? (
          <span className={cn("flex items-center gap-1", deadlineTone(item.deadline))}>
            <CalendarClock className="size-3" /> {formatDate(item.deadline)}
          </span>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex-1">
          <CardStatusMenu item={item} onChange={(s) => onStatus(item.id, s)} />
        </div>
        {item.job_url ? (
          <a
            href={item.job_url}
            target="_blank"
            rel="noopener noreferrer nofollow"
            onPointerDown={(e) => e.stopPropagation()}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Open job advertisement"
          >
            <ExternalLink className="size-3.5" />
          </a>
        ) : null}
      </div>
      <p className="text-[11px] text-muted-foreground" suppressHydrationWarning>
        Updated {relativeTime(item.updated_at)}
      </p>
    </div>
  );
}

function KanbanColumn({ status, items, onStatus }: { status: ApplicationStatus; items: TrackerItem[]; onStatus: (id: string, status: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const meta = STATUS_META[status];
  return (
    <section
      ref={setNodeRef}
      aria-label={`${meta.label} column`}
      className={cn("flex w-72 shrink-0 flex-col rounded-xl border bg-muted/40 transition-colors", isOver && "border-brand/50 bg-accent/50")}
    >
      <header className="flex items-center justify-between px-3 py-2.5">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <span className={cn("size-2 rounded-full", meta.dot)} aria-hidden /> {meta.label}
        </h2>
        <span className="rounded-full bg-card px-2 py-0.5 text-xs tabular-nums text-muted-foreground">{items.length}</span>
      </header>
      <div className="flex min-h-24 flex-1 flex-col gap-2 px-2 pb-2">
        {items.map((i) => (
          <KanbanCard key={i.id} item={i} onStatus={onStatus} />
        ))}
        {items.length === 0 ? <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">Drop here</p> : null}
      </div>
    </section>
  );
}

export function ApplicationsTracker({ items: initial }: { items: TrackerItem[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [items, setItems] = useState(initial);
  const [, startTransition] = useTransition();
  const [query, setQuery] = useState(params.get("q") ?? "");

  useEffect(() => setItems(initial), [initial]);

  const view = params.get("view") === "table" ? "table" : "board";
  const filterParam = params.get("filter");
  const filter: ApplicationFilter = isFilter(filterParam) ? filterParam : "all";

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(params);
    if (value === null) next.delete(key);
    else next.set(key, value);
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  };

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const visible = useMemo(() => {
    const statuses = APPLICATION_FILTERS[filter].statuses as readonly string[] | null;
    const q = query.trim().toLowerCase();
    return items.filter(
      (i) => (!statuses || statuses.includes(i.application_status)) && (!q || i.job_title.toLowerCase().includes(q) || i.company_name.toLowerCase().includes(q)),
    );
  }, [items, filter, query]);

  const columns = (APPLICATION_FILTERS[filter].statuses as ApplicationStatus[] | null) ?? [...APPLICATION_STATUSES];

  const changeStatus = (id: string, status: string) => {
    const current = items.find((i) => i.id === id);
    if (!current || current.application_status === status) return;
    const previous = current.application_status;
    setItems((list) => list.map((i) => (i.id === id ? { ...i, application_status: status, updated_at: new Date().toISOString() } : i)));
    startTransition(async () => {
      const res = await updateStatusAction(id, status);
      if (!res.ok) {
        setItems((list) => list.map((i) => (i.id === id ? { ...i, application_status: previous } : i)));
        toast.error(res.error);
      } else {
        toast.success(`Moved to ${STATUS_META[status as ApplicationStatus].label}.`);
        router.refresh();
      }
    });
  };

  const onDragEnd = (e: DragEndEvent) => {
    if (!e.over) return;
    changeStatus(String(e.active.id), String(e.over.id));
  };

  if (initial.length === 0) {
    return (
      <EmptyState
        icon={Briefcase}
        title="Your tracker is empty"
        description="Add a job advertisement to start analysing it, creating tailored documents and tracking your progress."
        action={
          <Button asChild>
            <Link href="/dashboard/applications/new">Create your first application</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="-mx-4 flex gap-1 overflow-x-auto px-4 lg:mx-0 lg:px-0" role="tablist" aria-label="Filter applications">
          {(Object.keys(APPLICATION_FILTERS) as ApplicationFilter[]).map((f) => {
            const statuses = APPLICATION_FILTERS[f].statuses as readonly string[] | null;
            const count = items.filter((i) => !statuses || statuses.includes(i.application_status)).length;
            return (
              <button
                key={f}
                role="tab"
                aria-selected={filter === f}
                onClick={() => setParam("filter", f === "all" ? null : f)}
                className={cn(
                  "whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] font-medium transition-colors",
                  filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {APPLICATION_FILTERS[f].label} <span className="tabular-nums opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 lg:w-72">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              aria-label="Search by company or job title"
              placeholder="Search company or job title"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={() => setParam("q", query.trim() || null)}
              className="pl-8"
            />
          </div>
          <div className="flex rounded-md border bg-card p-0.5" role="group" aria-label="View">
            <Button size="icon-sm" variant={view === "board" ? "secondary" : "ghost"} aria-pressed={view === "board"} aria-label="Board view" onClick={() => setParam("view", null)}>
              <KanbanSquare />
            </Button>
            <Button size="icon-sm" variant={view === "table" ? "secondary" : "ghost"} aria-pressed={view === "table"} aria-label="Table view" onClick={() => setParam("view", "table")}>
              <Table2 />
            </Button>
          </div>
        </div>
      </div>

      {view === "board" ? (
        <DndContext id="applications-board" sensors={sensors} onDragEnd={onDragEnd}>
          <div className="-mx-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div className="flex gap-3">
              {columns.map((s) => (
                <KanbanColumn key={s} status={s} items={visible.filter((i) => i.application_status === s)} onStatus={changeStatus} />
              ))}
            </div>
          </div>
        </DndContext>
      ) : visible.length === 0 ? (
        <EmptyState title="No matching applications" description="Try a different filter or search." />
      ) : (
        <div className="rounded-xl border bg-card">
          <Table>
            <THead>
              <TR className="hover:bg-transparent">
                <TH className="pl-4">Role</TH>
                <TH>Status</TH>
                <TH>Saved</TH>
                <TH>Deadline</TH>
                <TH>Documents</TH>
                <TH>Next action</TH>
                <TH className="pr-4">Updated</TH>
              </TR>
            </THead>
            <TBody>
              {visible.map((i) => (
                <TR key={i.id}>
                  <TD className="max-w-xs pl-4">
                    <Link href={`/dashboard/applications/${i.id}`} className="block truncate font-medium hover:text-brand">
                      {i.job_title}
                    </Link>
                    <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
                      {[i.company_name, i.location].filter(Boolean).join(" · ") || "—"}
                      {i.job_url ? (
                        <a href={i.job_url} target="_blank" rel="noopener noreferrer nofollow" aria-label="Open job advertisement" className="hover:text-foreground">
                          <ExternalLink className="size-3" />
                        </a>
                      ) : null}
                    </span>
                  </TD>
                  <TD>
                    <StatusBadge status={i.application_status} />
                  </TD>
                  <TD className="whitespace-nowrap text-muted-foreground">{formatDate(i.created_at)}</TD>
                  <TD className={cn("whitespace-nowrap", deadlineTone(i.deadline))}>{i.deadline ? formatDate(i.deadline) : "—"}</TD>
                  <TD className="whitespace-nowrap">
                    <div className="flex gap-1">
                      {i.resumeVersion ? <Badge variant="info">Resume v{i.resumeVersion}</Badge> : <Badge variant="outline">No resume</Badge>}
                      {i.coverLetters ? <Badge variant="success">Letter</Badge> : null}
                    </div>
                  </TD>
                  <TD className="max-w-48 truncate text-sm">{i.next_action ?? <span className="text-muted-foreground">—</span>}</TD>
                  <TD className="whitespace-nowrap pr-4 text-muted-foreground" suppressHydrationWarning>
                    {relativeTime(i.updated_at)}
                  </TD>
                </TR>
              ))}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}
