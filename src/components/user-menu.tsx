import { LogOut } from "lucide-react";

import { signOutAction } from "@/lib/auth-actions";
import { Button } from "@/components/ui/button";
import { ROLE_LABEL } from "@/lib/roles";
import type { SessionUser } from "@/lib/authz";

export function UserMenu({ user }: { user: SessionUser }) {
  return (
    <div className="flex items-center gap-3">
      <div className="hidden text-right sm:block">
        <div className="text-sm font-medium leading-tight">
          {user.name ?? user.email}
        </div>
        <div className="text-xs text-muted-foreground">
          {ROLE_LABEL[user.role]}
        </div>
      </div>
      <form action={signOutAction}>
        <Button
          type="submit"
          variant="ghost"
          size="icon"
          aria-label="Выйти"
          title="Выйти"
        >
          <LogOut className="size-4" />
        </Button>
      </form>
    </div>
  );
}
