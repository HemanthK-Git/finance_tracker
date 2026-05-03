import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ThemeToggle } from "./ThemeToggle";

export default function AppLayout() {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const apply = () => setOpen(mql.matches);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  return (
    <SidebarProvider open={open} onOpenChange={setOpen}>
      <div className="min-h-screen flex w-full bg-background">
        <AppSidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 flex items-center justify-between border-b px-4 bg-card/60 backdrop-blur-xl sticky top-0 z-30">
            <SidebarTrigger />
            <ThemeToggle />
          </header>
          <main className="flex-1 p-4 sm:p-6 lg:p-8 animate-fade-in">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
