import { expectTypeOf } from "vitest";
import type { InfrastructureFailure } from "@shivaedev/errors/infrastructure.ts";
import type { PgBossError, PgBossPayloadError } from "#server/error.ts";

expectTypeOf<PgBossError>().toExtend<InfrastructureFailure>();
expectTypeOf<PgBossPayloadError>().toExtend<InfrastructureFailure>();
