import { Bell, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ThemeToggle } from "./ThemeToggle";

interface TopbarProps {
  title: string;
}

export const Topbar = ({ title }: TopbarProps) => {
  const { profile, signOut } = useAuth();

  const fullName = profile?.full_name?.trim() || "مستخدم";
  const jobTitle = profile?.job_title?.trim() || (profile?.is_admin ? "مسؤول النظام" : "موظف");
  const initial = fullName.charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/85 px-4 md:px-8 backdrop-blur-md">
      {/* Right side (RTL start): user identity */}
      <div className="flex items-center gap-3 min-w-0">
        <Avatar className="h-10 w-10 ring-2 ring-border">
          <AvatarImage src={profile?.avatar_url ?? undefined} alt={fullName} />
          <AvatarFallback className="bg-gradient-primary text-primary-foreground font-semibold">
            {initial}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 hidden sm:block">
          <p className="truncate text-sm font-semibold text-foreground leading-tight">{fullName}</p>
          <p className="truncate text-xs text-muted-foreground mt-0.5">{jobTitle}</p>
        </div>
      </div>

      {/* Left side (RTL end): actions */}
      <div className="flex items-center gap-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="relative rounded-full" aria-label="الإشعارات" disabled>
              <Bell className="h-[1.15rem] w-[1.15rem]" />
              <span className="absolute top-2 end-2 h-2 w-2 rounded-full bg-accent" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>قريبًا — الإشعارات</TooltipContent>
        </Tooltip>

        <ThemeToggle />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={signOut}
              aria-label="تسجيل الخروج"
              className="rounded-full text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-[1.15rem] w-[1.15rem]" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>تسجيل الخروج</TooltipContent>
        </Tooltip>
      </div>
    </header>
  );
};
