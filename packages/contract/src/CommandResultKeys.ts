import { Context, type Ref } from "effect";
import type { Key } from "@shivaedev/changes/keys.ts";

export const CommandResultKeys = Context.Service<Ref.Ref<readonly Key[]>>("@shivaedev/contract/CommandResultKeys");
