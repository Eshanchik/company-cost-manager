"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin, AuthorizationError } from "@/lib/authz";
import { syncDomainGuard, type SyncResult } from "@/lib/domainguard/sync";

/** Предпросмотр синхронизации: что изменится, без записи (Admin). */
export async function previewDomainGuardSync(): Promise<SyncResult> {
  try {
    await requireAdmin();
    return syncDomainGuard({ dryRun: true });
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    console.error("previewDomainGuardSync:", e);
    return { ok: false, error: "Не удалось выполнить предпросмотр" };
  }
}

/** Запуск синхронизации доменов из DomainGuard (Admin). */
export async function runDomainGuardSync(): Promise<SyncResult> {
  try {
    const admin = await requireAdmin();
    const res = await syncDomainGuard({
      actor: admin.email ?? admin.id,
    });
    revalidatePath("/domains");
    revalidatePath("/");
    revalidatePath("/services");
    return res;
  } catch (e) {
    if (e instanceof AuthorizationError) return { ok: false, error: e.message };
    console.error("runDomainGuardSync:", e);
    return { ok: false, error: "Не удалось синхронизировать домены" };
  }
}
