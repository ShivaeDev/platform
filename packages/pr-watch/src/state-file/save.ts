import { Effect } from "effect";
import type { State } from "#model.ts";
import { save as saveFile } from "#state-file/adapters/save.ts";

export const save = Effect.fn("StateFile.save")((path: string, state: State) => saveFile(path, state));
