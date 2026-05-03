import { useEffect, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ThemeToggle } from "./ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { LogIn, ShieldCheck, Lock } from "lucide-react";
import { Button } from "./ui/button";

export default function AppLayout() {
  const [open, setOpen] = useState(true);

  const { pathname } = useLocation();

  const { user, loading, login } = useAuth();

  useEffect(() => {
    const isMobile = window.innerWidth < 1024;
    if (isMobile) {
      setOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    const mql = window.matchMedia("(min-width: 1024px)");
    const apply = () => setOpen(mql.matches);
    apply();
    mql.addEventListener("change", apply);
    return () => mql.removeEventListener("change", apply);
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="max-w-md w-full space-y-8 text-center animate-scale-in">
          <div className="space-y-4">
            <div className="mx-auto h-20 w-20 rounded-3xl gradient-primary shadow-glow flex items-center justify-center">
              <Lock className="h-10 w-10 text-primary-foreground" />
            </div>
            <h1 className="text-4xl font-display font-bold tracking-tight">Private Access</h1>
            <p className="text-muted-foreground text-lg">
              Your financial data is encrypted and private. Please sign in to access your vault.
            </p>
          </div>
          
          <div className="grid gap-4 bg-card border rounded-3xl p-8 shadow-elegant">
            <div className="flex items-center gap-3 text-left p-3 rounded-2xl bg-muted/50">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <div className="text-sm">
                <span className="font-semibold block">Secured by Firebase</span>
                <span className="text-muted-foreground">Only you can see your data.</span>
              </div>
            </div>
            
            <Button 
              onClick={login} 
              size="lg" 
              className="w-full h-14 rounded-2xl gradient-primary text-primary-foreground font-semibold text-lg shadow-glow hover:scale-[1.02] transition-all"
            >
              <LogIn className="mr-2 h-5 w-5" /> Sign in with Google
            </Button>
          </div>
          
          <p className="text-sm text-muted-foreground px-6">
            By signing in, you agree to keep your financial pulse healthy and private.
          </p>
        </div>
      </div>
    );
  }

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
