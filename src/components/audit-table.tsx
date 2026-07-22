import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDateTime } from "@/lib/format";
import { entityLabel, actionLabel } from "@/lib/audit-display";

export type AuditRow = {
  id: string;
  ts: string;
  entity: string;
  entityId: string;
  actor: string;
  action: string;
  diff: unknown;
};

function isFromTo(v: unknown): v is { from: unknown; to: unknown } {
  return (
    typeof v === "object" &&
    v !== null &&
    ("from" in v || "to" in v) &&
    Object.keys(v).every((k) => k === "from" || k === "to")
  );
}

function renderVal(v: unknown): string {
  if (v === null || v === undefined) return "∅";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function DiffCell({ diff }: { diff: unknown }) {
  if (!diff || typeof diff !== "object") {
    return <span className="text-muted-foreground">—</span>;
  }
  const entries = Object.entries(diff as Record<string, unknown>);
  if (entries.length === 0)
    return <span className="text-muted-foreground">—</span>;

  return (
    <ul className="space-y-0.5 text-xs">
      {entries.map(([key, val]) => (
        <li key={key}>
          <span className="font-medium">{key}</span>:{" "}
          {isFromTo(val) ? (
            <span>
              <span className="text-muted-foreground line-through">
                {renderVal(val.from)}
              </span>{" "}
              → <span>{renderVal(val.to)}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{renderVal(val)}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

export function AuditTable({
  rows,
  showEntity = true,
}: {
  rows: AuditRow[];
  showEntity?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
        Записей нет.
      </p>
    );
  }
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-40">Время</TableHead>
            {showEntity && <TableHead>Сущность</TableHead>}
            <TableHead>Действие</TableHead>
            <TableHead>Автор</TableHead>
            <TableHead>Изменения</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r.id}>
              <TableCell className="whitespace-nowrap text-sm text-muted-foreground">
                {formatDateTime(r.ts)}
              </TableCell>
              {showEntity && (
                <TableCell>
                  <Badge variant="secondary">{entityLabel(r.entity)}</Badge>
                </TableCell>
              )}
              <TableCell>
                <Badge variant="outline">{actionLabel(r.action)}</Badge>
              </TableCell>
              <TableCell className="text-sm">{r.actor}</TableCell>
              <TableCell>
                <DiffCell diff={r.diff} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
