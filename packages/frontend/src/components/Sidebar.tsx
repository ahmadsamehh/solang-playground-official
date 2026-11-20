"use client";

import { SidebarView, useAppStore } from "@/app/state";
import FileExplorer from "./FileExplorer";
import Settings from "./Settings";
import { store } from "@/state";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { BookOpen, ChevronLeft, ChevronRight, Files } from "lucide-react";
import { cn } from "@/lib/utils";
import ResizeHandle, { usePanelSize } from "./ResizeHandle";

const CompileExplorer = dynamic(() => import("./CompileExplorer"), { ssr: false });
const DeployExplorer = dynamic(() => import("./DeployExplorer"), { ssr: false });

const COLLAPSED_WIDTH = 44;

function Sidebar() {
  const { sidebar } = useAppStore();
  const { explorer } = store.getSnapshot().context;

  if (sidebar === SidebarView.SETTINGS) {
    return <Settings />;
  }

  if (sidebar === SidebarView.COMPILE) {
    return <CompileExplorer />;
  }

  if (sidebar === SidebarView.DEPLOY) {
    return <DeployExplorer />;
  }

  return <FileExplorer root={explorer} />;
}

const TABS = [
  { view: SidebarView.FILE_EXPLORER, label: "Files", icon: Files },
  { view: SidebarView.COMPILE, label: "Examples", icon: BookOpen },
] as const;

function SidebarLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [dragging, setDragging] = useState(false);
  const { sidebar, setSidebar } = useAppStore();
  const { size, setSize, persist, reset } = usePanelSize("sidebar", 260, 200, 520);

  useEffect(() => {
    const collapseForViewport = () => {
      if (window.innerWidth < 1024) {
        setCollapsed(true);
      }
    };

    collapseForViewport();
    window.addEventListener("resize", collapseForViewport);
    return () => window.removeEventListener("resize", collapseForViewport);
  }, []);

  const openView = (view: SidebarView) => {
    setSidebar(view);
    setCollapsed(false);
  };

  return (
    <aside
      style={{ width: collapsed ? COLLAPSED_WIDTH : size }}
      className={cn(
        "relative flex h-full shrink-0 flex-col border-r border-ide-border bg-ide-panel text-ide-subtle",
        !dragging && "transition-[width] duration-200 ease-out",
      )}
    >
      {collapsed ? (
        // Icon rail
        <div className="flex flex-col items-center gap-1 pt-2">
          {TABS.map(({ view, label, icon: Icon }) => (
            <button
              key={view}
              type="button"
              title={label}
              aria-label={label}
              onClick={() => openView(view)}
              className={cn(
                "flex h-8 w-8 items-center justify-center rounded-md transition-colors",
                sidebar === view ? "bg-brand-muted text-brand-soft" : "text-ide-muted hover:bg-ide-hover hover:text-ide-text",
              )}
            >
              <Icon size={16} />
            </button>
          ))}
        </div>
      ) : (
        <>
          <div className="flex h-9 shrink-0 items-center gap-1 border-b border-ide-border px-2">
            {TABS.map(({ view, label, icon: Icon }) => (
              <button
                key={view}
                type="button"
                onClick={() => setSidebar(view)}
                className={cn(
                  "flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
                  sidebar === view ? "bg-ide-hover text-ide-text" : "text-ide-muted hover:bg-ide-hover/60 hover:text-ide-subtle",
                )}
              >
                <Icon size={13} />
                {label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Collapse files panel"
              title="Collapse files panel"
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-ide-muted transition-colors hover:bg-ide-hover hover:text-ide-text"
            >
              <ChevronLeft size={15} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-2 animate-fade-in-up">
            <Sidebar />
          </div>
        </>
      )}

      {collapsed && (
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Expand files panel"
          title="Expand files panel"
          className="absolute bottom-2 left-1/2 z-20 flex h-7 w-7 -translate-x-1/2 items-center justify-center rounded-md text-ide-muted transition-colors hover:bg-ide-hover hover:text-ide-text"
        >
          <ChevronRight size={15} />
        </button>
      )}

      {!collapsed && (
        <ResizeHandle
          axis="x"
          className="right-0 translate-x-1/2"
          size={size}
          onResize={setSize}
          onResizeEnd={persist}
          onReset={reset}
          onDraggingChange={setDragging}
        />
      )}
    </aside>
  );
}

export default SidebarLayout;
