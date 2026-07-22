"use client";

import * as React from "react";
import { useActionState } from "react";
import { Plus, Copy, Trash2, KeyRound } from "lucide-react";
import { toast } from "sonner";

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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ROLE_LABEL } from "@/lib/roles";
import { formatDate } from "@/lib/format";
import {
  createApiToken,
  revokeApiToken,
  type CreateTokenResult,
} from "@/lib/actions/tokens";
import type { ActionResult } from "@/lib/actions/types";
import type { Role } from "@prisma/client";

export type TokenRow = {
  id: string;
  name: string;
  role: Role;
  prefix: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export function TokensManager({ tokens }: { tokens: TokenRow[] }) {
  const [open, setOpen] = React.useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Токены для REST API и MCP. Значение показывается один раз при создании;
          в БД хранится только хэш.
        </p>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> Создать токен
        </Button>
      </div>

      {tokens.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Токенов пока нет.
        </p>
      ) : (
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Имя</TableHead>
                <TableHead>Роль</TableHead>
                <TableHead>Префикс</TableHead>
                <TableHead>Создан</TableHead>
                <TableHead>Использован</TableHead>
                <TableHead>Статус</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {tokens.map((t) => (
                <TableRow key={t.id} className={t.revokedAt ? "opacity-60" : ""}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">{ROLE_LABEL[t.role]}</Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {t.prefix}…
                  </TableCell>
                  <TableCell className="text-sm">
                    {formatDate(t.createdAt)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {t.lastUsedAt ? formatDate(t.lastUsedAt) : "—"}
                  </TableCell>
                  <TableCell>
                    {t.revokedAt ? (
                      <Badge variant="outline">Отозван</Badge>
                    ) : (
                      <Badge variant="default">Активен</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {!t.revokedAt && <RevokeButton id={t.id} name={t.name} />}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <CreateTokenDialog open={open} onOpenChange={setOpen} />
    </div>
  );
}

function CreateTokenDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [state, formAction] = useActionState<CreateTokenResult | null, FormData>(
    createApiToken,
    null
  );
  const [issued, setIssued] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      setIssued(state.token);
      toast.success(state.message);
    } else {
      toast.error(state.error);
    }
  }, [state]);

  const close = () => {
    setIssued(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())}>
      <DialogContent>
        {issued ? (
          <div className="space-y-4">
            <DialogHeader>
              <div className="flex items-center gap-2">
                <KeyRound className="size-5" />
                <DialogTitle>Токен создан</DialogTitle>
              </div>
              <DialogDescription>
                Скопируйте значение сейчас — оно больше не будет показано.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2">
              <Input readOnly value={issued} className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  navigator.clipboard?.writeText(issued);
                  toast.success("Скопировано");
                }}
              >
                <Copy className="size-4" />
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={close}>Готово</Button>
            </DialogFooter>
          </div>
        ) : (
          <form action={formAction} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Новый API/MCP-токен</DialogTitle>
              <DialogDescription>
                Имя для узнавания и роль доступа. Запись требует Manager+.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="tok-name">Имя</Label>
              <Input
                id="tok-name"
                name="name"
                placeholder="Например, CI-скрипт"
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tok-role">Роль</Label>
              <NativeSelect id="tok-role" name="role" defaultValue="viewer">
                <option value="viewer">Наблюдатель (только чтение)</option>
                <option value="manager">Менеджер (чтение + запись)</option>
                <option value="admin">Администратор</option>
              </NativeSelect>
            </div>
            <DialogFooter>
              <SubmitButton>Создать</SubmitButton>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function RevokeButton({ id, name }: { id: string; name: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    revokeApiToken,
    null
  );

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message ?? "Отозван");
    else toast.error(state.error);
  }, [state]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`Отозвать токен «${name}»? Действие необратимо.`))
          e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        aria-label="Отозвать"
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="size-4" />
      </Button>
    </form>
  );
}
