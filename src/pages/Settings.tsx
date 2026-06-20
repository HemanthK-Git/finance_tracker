import { useTheme } from "next-themes";
import { Moon, Sun, IndianRupee, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Settings() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="max-w-2xl mx-auto space-y-3">
      <div>
        <h1 className="font-bold text-sm">Settings</h1>
        <p className="text-[10px] text-muted-foreground">Customize your experience</p>
      </div>

      <div className="rounded-lg border bg-card p-3 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <IndianRupee className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-semibold text-xs">Currency</h3>
              <p className="text-[10px] text-muted-foreground">All amounts in Indian Rupees.</p>
            </div>
          </div>
          <div className="font-bold text-sm">₹ INR</div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-3 shadow-soft">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-accent/10 text-accent flex items-center justify-center">
              {theme === "dark" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </div>
            <div>
              <h3 className="font-semibold text-xs">Theme</h3>
              <p className="text-[10px] text-muted-foreground">Light or dark mode.</p>
            </div>
          </div>
          <div className="flex gap-1.5">
            <Button variant={theme === "light" ? "default" : "outline"} size="sm" className="h-7 text-[10px] px-2" onClick={() => setTheme("light")}>
              <Sun className="h-3.5 w-3.5 mr-1" /> Light
            </Button>
            <Button variant={theme === "dark" ? "default" : "outline"} size="sm" className="h-7 text-[10px] px-2" onClick={() => setTheme("dark")}>
              <Moon className="h-3.5 w-3.5 mr-1" /> Dark
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-muted/40 p-3 flex gap-2">
        <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-[10px] text-muted-foreground">
          Your data is stored privately in the cloud. No account required.
        </p>
      </div>
    </div>
  );
}
