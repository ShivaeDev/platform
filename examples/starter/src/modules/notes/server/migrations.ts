import { resolve } from "node:path";
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { Migrator } from "effect/sql";

export const notesMigrations = Migrator.fromFileSystem(resolve(import.meta.dirname, "migrations")).pipe(Effect.provide(NodeServices.layer));
