import { expectTypeOf } from "vitest";
import type { LiveBound } from "#automaticLive.ts";
import { composeBindings, liveBindings } from "#composeBindings.ts";
import { makeClient } from "#makeClient.ts";
import { Notes } from "#test/notes.ts";

const notes = makeClient({ notes: Notes }, { url: "https://app.test/rpc" });
const connection = composeBindings({ modules: [{ api: notes.api.notes }] as const }, [notes.api.notes]);
expectTypeOf(connection.modules[0].api).toEqualTypeOf<typeof notes.api.notes>();
expectTypeOf(connection.modules[0].api.get.run).parameter(0).toEqualTypeOf<{ readonly id: number }>();
expectTypeOf(liveBindings(connection)).toEqualTypeOf<readonly LiveBound[]>();
// @ts-expect-error A connection can compose only bound APIs.
composeBindings({ modules: [] }, [{}]);
