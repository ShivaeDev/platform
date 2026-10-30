import { Context } from "effect";
import type { StopOptions } from "pg-boss";
import type { AcquiredClient } from "#internal/lifecycle.ts";

export class PgBoss extends Context.Service<
	PgBoss,
	AcquiredClient & { readonly schema: string | undefined; readonly stop: StopOptions | undefined }
>()("@shivaedev/jobs/PgBoss") {}
