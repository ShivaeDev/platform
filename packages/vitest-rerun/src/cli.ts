#!/usr/bin/env node
import process from "node:process";
import { NodeServices } from "@effect/platform-node";
import { Effect } from "effect";
import { main } from "#internal/main.ts";

process.exitCode = await Effect.runPromise(main(process.argv.slice(2), process.cwd()).pipe(Effect.provide(NodeServices.layer)));
