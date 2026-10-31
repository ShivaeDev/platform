import { Context } from "effect";
import type { SessionPolicy, UserSessionShape } from "@shivaedev/identity/server/session.ts";

export class AdminSessions extends Context.Service<AdminSessions, SessionPolicy<UserSessionShape>>()("@shivaedev/admin/AdminSessions") {}
