import { expectTypeOf } from "vitest";
import type { LiveBound } from "#automaticLive.ts";
import { makeClient } from "#bind.ts";
import { composeBindings, liveBindings } from "#composeBindings.ts";
import { Notes } from "#test/notes.ts";

const notes = makeClient(Notes, { url: "https://app.test/rpc" });
const connection = composeBindings({ modules: [{ api: notes.api }] as const }, [notes.api]);
expectTypeOf(connection.modules[0].api).toEqualTypeOf<typeof notes.api>();
expectTypeOf(connection.modules[0].api.get.run).parameter(0).toEqualTypeOf<{ readonly id: number }>();
expectTypeOf(liveBindings(connection)).toEqualTypeOf<readonly LiveBound[]>();
// @ts-expect-error A connection can compose only bound APIs.
composeBindings({ modules: [] }, [{}]);
