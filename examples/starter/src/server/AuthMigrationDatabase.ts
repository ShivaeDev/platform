import { Context } from "effect";
import type { Pool } from "pg";

export class AuthMigrationDatabase extends Context.Service<AuthMigrationDatabase, Pool>()("App/AuthMigrationDatabase") {}
