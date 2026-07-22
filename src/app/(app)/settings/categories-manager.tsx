"use client";

import * as React from "react";
import { useActionState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import type { Category } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import {
  createCategory,
  updateCategory,
  deleteCategory,
} from "@/lib/actions/categories";
import type { ActionResult } from "@/lib/actions/types";

export function CategoriesManager({ categories }: { categories: Category[] }) {
  const [editing, setEditing] = React.useState<Category | null>(null);
  const [open, setOpen] = React.useState(false);

  const openCreate = () => {
    setEditing(null);
    setOpen(true);
  };
  const openEdit = (c: Category) => {
    setEditing(c);
    setOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Категории сервисов (например, Dev tools, Design, Infra).
        </p>
        <Button size="sm" onClick={openCreate}>
          <Plus className="size-4" /> Добавить
        </Button>
      </div>

      {categories.length === 0 ? (
        <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
          Пока нет категорий.
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Название</TableHead>
              <TableHead>Цвет</TableHead>
              <TableHead className="w-24 text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {categories.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <span
                      className="inline-block size-4 rounded-full border"
                      style={{ backgroundColor: c.color }}
                    />
                    <span className="text-muted-foreground">{c.color}</span>
                  </span>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Изменить"
                      onClick={() => openEdit(c)}
                    >
                      <Pencil className="size-4" />
                    </Button>
                    <DeleteButton id={c.id} name={c.name} />
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <CategoryDialog
        key={editing?.id ?? "new"}
        open={open}
        onOpenChange={setOpen}
        category={editing}
      />
    </div>
  );
}

function CategoryDialog({
  open,
  onOpenChange,
  category,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  category: Category | null;
}) {
  const action = category ? updateCategory : createCategory;
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    action,
    null
  );

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) {
      toast.success(state.message ?? "Готово");
      onOpenChange(false);
    } else {
      toast.error(state.error);
    }
  }, [state, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form action={formAction} className="space-y-4">
          <DialogHeader>
            <DialogTitle>
              {category ? "Изменить категорию" : "Новая категория"}
            </DialogTitle>
            <DialogDescription>
              Название и цвет для визуальной маркировки.
            </DialogDescription>
          </DialogHeader>
          {category && <input type="hidden" name="id" value={category.id} />}
          <div className="space-y-2">
            <Label htmlFor="cat-name">Название</Label>
            <Input
              id="cat-name"
              name="name"
              defaultValue={category?.name ?? ""}
              placeholder="Например, Design"
              required
              autoFocus
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="cat-color">Цвет</Label>
            <div className="flex items-center gap-2">
              <Input
                id="cat-color"
                name="color"
                type="color"
                defaultValue={category?.color ?? "#3b82f6"}
                className="h-9 w-16 p-1"
              />
              <span className="text-sm text-muted-foreground">
                Формат #RRGGBB
              </span>
            </div>
          </div>
          <DialogFooter>
            <SubmitButton>{category ? "Сохранить" : "Создать"}</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteButton({ id, name }: { id: string; name: string }) {
  const [state, formAction] = useActionState<ActionResult | null, FormData>(
    deleteCategory,
    null
  );

  React.useEffect(() => {
    if (!state) return;
    if (state.ok) toast.success(state.message ?? "Удалено");
    else toast.error(state.error);
  }, [state]);

  return (
    <form
      action={formAction}
      onSubmit={(e) => {
        if (!confirm(`Удалить категорию «${name}»?`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        aria-label="Удалить"
        className="text-destructive hover:text-destructive"
      >
        <Trash2 className="size-4" />
      </Button>
    </form>
  );
}
