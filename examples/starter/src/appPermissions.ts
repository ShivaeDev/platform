import { permission } from "@shivaedev/access/permission.ts";
import { permissionMiddleware } from "@shivaedev/identity/permission.ts";

export const ReadStatistics = permission("notes.statistics.read");
export class StatisticsPermission extends permissionMiddleware<StatisticsPermission>()("app/StatisticsPermission", ReadStatistics) {}
