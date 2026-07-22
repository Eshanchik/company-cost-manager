"use client";

import * as React from "react";
import { useActionState } from "react";
import { Pencil } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SubmitButton } from "@/components/ui/submit-button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { updateEmployee } from "@/lib/actions/employees";
import type { ActionResult } from "@/lib/actions/types";

export function EditEmployee({
  employee,
}: {
  employee: { id: string; fullName: string; department: string | null };
}) {
  const [open, setOpen] = React.useState(false);
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    updateEmployee,
    null
  );

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? "Готово");
      setOpen(false);
    } else {
      toast.error(state.error);
    }
  }, [state]);

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil className="size-4" /> Изменить
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <form action={formAction} className="space-y-4">
            <DialogHeader>
              <DialogTitle>Изменить сотрудника</DialogTitle>
            </DialogHeader>
            <input type="hidden" name="id" value={employee.id} />
            <div className="space-y-2">
              <Label htmlFor="emp-name">Имя</Label>
              <Input
                id="emp-name"
                name="fullName"
                defaultValue={employee.fullName}
                required
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="emp-dept">Отдел</Label>
              <Input
                id="emp-dept"
                name="department"
                defaultValue={employee.department ?? ""}
                placeholder="Необязательно"
              />
            </div>
            <DialogFooter>
              <SubmitButton>Сохранить</SubmitButton>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
