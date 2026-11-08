import process from "node:process";
import { Effect } from "effect";

export const nodeInvocation = Effect.sync(() => ({ execArgv: process.execArgv, execPath: process.execPath }));
