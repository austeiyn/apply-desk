"use client";

import { useEffect, useRef } from "react";
import { BookmarkPlus } from "lucide-react";
import { toast } from "@/components/ui/sonner";

/** sessionStorage key used to hand a clipped advertisement to the new-application form. */
export const CLIP_STORAGE_KEY = "applydesk:clip";

/**
 * The bookmarklet. Runs on the job site, in the user's own browser, when they
 * click the bookmark: it reads the page they are looking at (JSON-LD job data
 * and visible text) and opens ApplyDesk's /clip page with it in the URL
 * fragment, which is never sent to any server. Nothing on the job site is
 * bypassed; this is the same as copying the advertisement by hand.
 */
export function bookmarkletSource(origin: string): string {
  const code = `(function(){try{
var all=[].slice.call(document.querySelectorAll('script[type="application/ld+json"]')).map(function(s){return s.textContent||""}).filter(function(j){return j.length<30000});
var jobs=all.filter(function(j){return /JobPosting/.test(j)});
var root=document.querySelector("main")||document.body;
var d={url:location.href,title:document.title,ld:(jobs.length?jobs:all).slice(0,5),text:(root.innerText||"").slice(0,jobs.length?15000:30000)};
window.open(${JSON.stringify(origin)}+"/clip#d="+encodeURIComponent(JSON.stringify(d)),"_blank");
}catch(e){alert("ApplyDesk couldn't read this page. Copy the advertisement text and paste it instead.")}})()`;
  return `javascript:${encodeURIComponent(code.replace(/\n/g, ""))}`;
}

/** A link the user drags to their bookmarks bar. */
export function SendToApplyDeskButton() {
  const ref = useRef<HTMLAnchorElement>(null);
  useEffect(() => {
    // Set directly: React blocks javascript: URLs in props, and the origin is
    // only known in the browser.
    ref.current?.setAttribute("href", bookmarkletSource(window.location.origin));
  }, []);
  return (
    <a
      ref={ref}
      data-testid="send-to-applydesk"
      draggable
      onClick={(e) => {
        e.preventDefault();
        toast.info("Drag this button to your bookmarks bar, then click it while viewing a job advertisement.");
      }}
      className="inline-flex h-8 shrink-0 cursor-grab items-center justify-center gap-1.5 whitespace-nowrap rounded-md border border-brand/40 bg-brand/10 px-3 text-[13px] font-medium text-brand active:cursor-grabbing"
    >
      <BookmarkPlus className="size-4" /> Send to ApplyDesk
    </a>
  );
}
