"use client";

import * as React from "react";
import { useActionState } from "react";
import { UserPlus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { Role } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { NativeSelect } from "@/components/ui/native-select";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate } from "@/lib/format";
import { ROLE_LABEL } from "@/lib/roles";
import {
  inviteEmail,
  updateAllowedRole,
  removeAllowedEmail,
} from "@/lib/actions/whitelist";
import type { ActionResult } from "@/lib/actions/types";

export type AccessRow = {
  id: string;
  email: string;
  role: Role;
  addedBy: string | null;
  createdAt: string;
  hasLoggedIn: boolean;
  isSelf: boolean;
};

export function AccessManager({ rows }: { rows: AccessRow[] }) {
  return (
    <div className="space-y-6">
      <InviteForm />

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Список доступа пуст.
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Email</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead>Добавил</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {r.email}
                    {r.isSelf && (
                      <span className="ml-2 text-xs text-muted-foreground">
                        (вы)
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    {r.isSelf ? (
                      <Badge variant="secondary">{ROLE_LABEL[r.role]}</Badge>
                    ) : (
                      <RoleForm id={r.id} role={r.role} />
                    )}
                  </TableCell>
                  <TableCell>
                    {r.hasLoggedIn ? (
                      <Badge variant="default">Входил</Badge>
                    ) : (
                      <Badge variant="outline">Приглашён</Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {r.addedBy ?? "—"} · {formatDate(r.createdAt)}
                  </TableCell>
                  <TableCell>
                    {!r.isSelf && <RemoveButton id={r.id} email={r.email} />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function InviteForm() {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    inviteEmail,
    null
  );
  const ref = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? "Приглашён");
      ref.current?.reset();
    } else toast.error(state.error);
  }, [state]);

  return (
    <form
      ref={ref}
      action={formAction}
      className="flex flex-wrap items-end gap-3 rounded-md border p-4"
    >
      <div className="flex-1 min-w-56 space-y-2">
        <Label htmlFor="inv-email">Email для приглашения</Label>
        <Input
          id="inv-email"
          name="email"
          type="email"
          placeholder="person@company.com"
          required
        />
      </div>
      <div className="w-44 space-y-2">
        <Label htmlFor="inv-role">Роль</Label>
        <NativeSelect id="inv-role" name="role" defaultValue="viewer">
          <option value="viewer">Наблюдатель</option>
          <option value="manager">Менеджер</option>
          <option value="admin">Администратор</option>
        </NativeSelect>
      </div>
      <SubmitButton>
        <UserPlus className="size-4" /> Пригласить
      </SubmitButton>
      <p className="w-full text-xs text-muted-foreground">
        Приглашённый сможет войти через Google. Доступ открывается сразу, без
        перезапуска.
      </p>
    </form>
  );
}

function RoleForm({ id, role }: { id: string; role: Role }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    updateAllowedRole,
    null
  );
  const ref = React.useRef<HTMLFormElement>(null);

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message ?? "Готово");
    else toast.error(state.error);
  }, [state]);

  return (
    <form ref={ref} action={formAction}>
      <input type="hidden" name="id" value={id} />
      <NativeSelect
        name="role"
        defaultValue={role}
        className="h-8 w-40"
        onChange={() => ref.current?.requestSubmit()}
      >
        <option value="viewer">Наблюдатель</option>
        <option value="manager">Менеджер</option>
        <option value="admin">Администратор</option>
      </NativeSelect>
    </form>
  );
}

function RemoveButton({ id, email }: { id: string; email: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    removeAllowedEmail,
    null
  );

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message ?? "Отозвано");
    else toast.error(state.error);
  }, [state]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`Отозвать доступ для ${email}?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        aria-label="Отозвать доступ"
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="size-4" />
      </Button>
    </form>
  );
}
