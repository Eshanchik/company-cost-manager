import type { ApiActor } from "@/lib/api/token";
import { ApiError } from "@/lib/api/authz";
import * as ops from "@/lib/api/operations";

const PROTOCOL_VERSION = "2025-06-18";
const SERVER_INFO = { name: "subtrack-mcp", version: "1.0.0" };

type JsonSchema = Record<string, unknown>;
type Tool = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  handler: (actor: ApiActor, args: Record<string, unknown>) => Promise<unknown>;
};

const obj = (props: Record<string, JsonSchema>, required: string[] = []): JsonSchema => ({
  type: "object",
  properties: props,
  required,
  additionalProperties: true,
});
const str = (description?: string): JsonSchema => ({ type: "string", description });
const num = (description?: string): JsonSchema => ({ type: "number", description });

// Полный набор инструментов §6, поверх общего слоя операций (тот же, что REST).
export const TOOLS: Tool[] = [
  {
    name: "whoami",
    description: "Имя и роль текущего токена",
    inputSchema: obj({}),
    handler: async (a) => ops.whoami(a),
  },
  {
    name: "overview",
    description: "Сводка: run-rate, прогноз, ожидаемые списания, «требует внимания»",
    inputSchema: obj({}),
    handler: (a) => ops.overview(a),
  },
  {
    name: "list_services",
    description: "Список сервисов. Фильтры: status, category, owner, q",
    inputSchema: obj({ status: str(), category: str(), owner: str(), q: str() }),
    handler: (a, args) => ops.listServices(a, args as never),
  },
  {
    name: "get_service",
    description: "Карточка сервиса с местами",
    inputSchema: obj({ id: str("ID сервиса") }, ["id"]),
    handler: (a, args) => ops.getService(a, String(args.id)),
  },
  {
    name: "create_service",
    description: "Создать сервис (Manager+)",
    inputSchema: obj(
      {
        name: str(),
        billing_model: { type: "string", enum: ["fixed", "per_seat", "hybrid"] },
        billing_cycle: { type: "string", enum: ["monthly", "yearly"] },
        currency: str(),
        price: num(),
        seat_price_default: num(),
        billing_day: num(),
        renewal_date: str("YYYY-MM-DD"),
        owner_email: str(),
        category: str(),
      },
      ["name", "billing_model", "billing_cycle", "currency", "owner_email"]
    ),
    handler: (a, args) => ops.createService(a, args),
  },
  {
    name: "update_service",
    description: "Обновить сервис (Manager+). Полный объект как при создании",
    inputSchema: obj({ id: str() }, ["id"]),
    handler: (a, args) => ops.updateService(a, String(args.id), args),
  },
  {
    name: "set_service_archived",
    description: "Архивировать/разархивировать сервис (Manager+)",
    inputSchema: obj({ id: str(), archived: { type: "boolean" } }, ["id"]),
    handler: (a, args) =>
      ops.setServiceArchived(a, String(args.id), args.archived !== false),
  },
  {
    name: "list_seats",
    description: "Места по service_id или email сотрудника",
    inputSchema: obj({ service_id: str(), email: str() }),
    handler: (a, args) => ops.listSeats(a, args as never),
  },
  {
    name: "add_seat",
    description: "Добавить место (Manager+, автосоздание сотрудника)",
    inputSchema: obj(
      { service_id: str(), email: str(), full_name: str(), seat_price: num() },
      ["service_id", "email"]
    ),
    handler: (a, args) => ops.addSeat(a, args),
  },
  {
    name: "end_seat",
    description: "Закрыть место (Manager+)",
    inputSchema: obj({ id: str() }, ["id"]),
    handler: (a, args) => ops.endSeat(a, String(args.id)),
  },
  {
    name: "list_employees",
    description: "Справочник сотрудников",
    inputSchema: obj({}),
    handler: (a) => ops.listEmployees(a),
  },
  {
    name: "get_employee_costs",
    description: "Стоимость мест сотрудника (по id или email)",
    inputSchema: obj({ id: str(), email: str() }),
    handler: (a, args) => ops.getEmployeeCosts(a, args as never),
  },
  {
    name: "record_payment",
    description: "Ручной платёж (Manager+)",
    inputSchema: obj(
      { service_id: str(), amount: num(), currency: str(), paid_at: str("YYYY-MM-DD"), comment: str() },
      ["service_id", "amount", "currency", "paid_at"]
    ),
    handler: (a, args) => ops.recordPayment(a, args),
  },
  {
    name: "confirm_expected_payment",
    description: "Подтвердить строку плана (Manager+)",
    inputSchema: obj(
      { plan_line_id: str(), amount: num(), paid_at: str(), comment: str() },
      ["plan_line_id"]
    ),
    handler: (a, args) => ops.confirmExpectedPayment(a, args),
  },
  {
    name: "get_monthly_report",
    description: "Отчёт план/факт за месяц (оба представления)",
    inputSchema: obj(
      { month: str("YYYY-MM"), view: { type: "string", enum: ["cashflow", "normalized"] } },
      ["month"]
    ),
    handler: (a, args) => ops.getMonthlyReport(a, args as never),
  },
  {
    name: "costs_summary",
    description: "Сумма факта за период. group_by: category|owner|vendor|billing_cycle",
    inputSchema: obj({ group_by: str(), from: str("YYYY-MM-DD"), to: str("YYYY-MM-DD") }),
    handler: (a, args) => ops.costsSummary(a, args as never),
  },
  {
    name: "upcoming_payments",
    description: "Ближайшие списания на N дней вперёд (по умолчанию 30)",
    inputSchema: obj({ days: num() }),
    handler: (a, args) =>
      ops.upcomingPayments(a, { days: args.days ? Number(args.days) : undefined }),
  },
  {
    name: "needs_attention",
    description: "Просроченные подтверждения + годовые в окне решения",
    inputSchema: obj({}),
    handler: (a) => ops.needsAttention(a),
  },
  {
    name: "import_csv",
    description: "Импорт из CSV (Manager+). kind: services|seats",
    inputSchema: obj(
      { kind: { type: "string", enum: ["services", "seats"] }, csv: str() },
      ["kind", "csv"]
    ),
    handler: (a, args) => ops.importCsv(a, args),
  },
  {
    name: "export_data",
    description: "Выгрузка. kind: services|employees|payments, format: csv|json",
    inputSchema: obj({ kind: str(), format: str() }),
    handler: (a, args) => ops.exportData(a, args as never),
  },
];

const TOOL_MAP = new Map(TOOLS.map((t) => [t.name, t]));

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
};

/**
 * Обрабатывает одно JSON-RPC сообщение MCP (Streamable HTTP). Возвращает
 * ответ или null для уведомлений (без id).
 */
export async function handleMcpMessage(
  actor: ApiActor,
  msg: {
    jsonrpc?: string;
    id?: string | number | null;
    method?: string;
    params?: Record<string, unknown>;
  }
): Promise<JsonRpcResponse | null> {
  const { id = null, method, params = {} } = msg;
  const reply = (result: unknown): JsonRpcResponse => ({ jsonrpc: "2.0", id, result });
  const err = (code: number, message: string): JsonRpcResponse => ({
    jsonrpc: "2.0",
    id,
    error: { code, message },
  });

  // Уведомления (без id) — ответ не требуется.
  if (method === "notifications/initialized" || method === "notifications/cancelled") {
    return null;
  }

  switch (method) {
    case "initialize":
      return reply({
        protocolVersion:
          (params.protocolVersion as string) || PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: SERVER_INFO,
      });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({
        tools: TOOLS.map(({ name, description, inputSchema }) => ({
          name,
          description,
          inputSchema,
        })),
      });
    case "tools/call": {
      const name = String(params.name ?? "");
      const tool = TOOL_MAP.get(name);
      if (!tool) return err(-32602, `Неизвестный инструмент: ${name}`);
      const args = (params.arguments as Record<string, unknown>) ?? {};
      try {
        const result = await tool.handler(actor, args);
        const isCsv =
          result &&
          typeof result === "object" &&
          "format" in result &&
          (result as { format?: string }).format === "csv";
        const text = isCsv
          ? (result as unknown as { data: string }).data
          : JSON.stringify(result, null, 2);
        return reply({ content: [{ type: "text", text }] });
      } catch (e) {
        // Ошибки инструмента — как isError-результат (в т.ч. 403 для Viewer).
        const message =
          e instanceof ApiError ? e.message : "Внутренняя ошибка инструмента";
        return reply({ content: [{ type: "text", text: message }], isError: true });
      }
    }
    default:
      return err(-32601, `Метод не поддерживается: ${method}`);
  }
}
