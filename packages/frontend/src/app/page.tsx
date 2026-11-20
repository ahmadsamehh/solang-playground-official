'use client';

import Console from "@/components/Console";
import Editor from "@/components/Editor";
import { Header, FileTabs } from "@/components/Header";
import Sidebar from "@/components/Sidebar";
import RightPanel from "@/components/RightPanel";
import { Toaster } from "@/components/ui/sonner"
import { useSelector } from "@xstate/store/react";
import { store } from "@/state";

/** Non-blocking activity indicator for compile / deploy (replaces the full-screen spinner). */
function BusyBar() {
  const busy = useSelector(store, (state) => state.context.showSpinnerDialog);
  return (
    <div className="pointer-events-none absolute inset-x-0 top-12 z-40 h-0.5 overflow-hidden" aria-hidden={!busy}>
      {busy && <div className="h-full w-1/4 animate-progress-indeterminate bg-gradient-to-r from-transparent via-brand-soft to-transparent" />}
    </div>
  );
}

export default function Home() {
  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-ide-bg text-ide-text">
      <Header />
      <BusyBar />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          <FileTabs />
          <div className="relative z-10 min-h-0 flex-1">
            <Editor />
          </div>
        </div>
        <RightPanel />
      </div>
      <div className="relative z-20">
        <Console />
      </div>
      <Toaster />
    </div>
  );
}
