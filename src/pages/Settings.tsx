import { useTheme } from "next-themes";
import { Moon, Sun, IndianRupee, Info } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Settings() {
  const { theme, setTheme } = useTheme();
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">Customize your experience</p>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <IndianRupee className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-display font-semibold">Currency</h3>
              <p className="text-sm text-muted-foreground">All amounts are displayed in Indian Rupees.</p>
            </div>
          </div>
          <div className="font-display font-bold text-lg">₹ INR</div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-6 shadow-soft">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-accent/10 text-accent flex items-center justify-center">
              {theme === "dark" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
            </div>
            <div>
              <h3 className="font-display font-semibold">Theme</h3>
              <p className="text-sm text-muted-foreground">Switch between light and dark mode.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant={theme === "light" ? "default" : "outline"} size="sm" onClick={() => setTheme("light")}>
              <Sun className="h-4 w-4 mr-1" /> Light
            </Button>
            <Button variant={theme === "dark" ? "default" : "outline"} size="sm" onClick={() => setTheme("dark")}>
              <Moon className="h-4 w-4 mr-1" /> Dark
            </Button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-muted/40 p-5 flex gap-3">
        <Info className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-sm text-muted-foreground">
          Your data is stored privately in the cloud and tied to this device. No account required.
        </p>
      </div>
    </div>
  );
}
