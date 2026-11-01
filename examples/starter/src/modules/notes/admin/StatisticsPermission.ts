import { permissionMiddleware } from "@shivaedev/identity/permission.ts";
import { ReadStatistics } from "#ReadStatistics.ts";

export class StatisticsPermission extends permissionMiddleware<StatisticsPermission>()("app/StatisticsPermission", ReadStatistics) {}
