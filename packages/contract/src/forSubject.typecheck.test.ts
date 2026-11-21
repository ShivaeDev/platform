import { expectTypeOf } from "vitest";
import { forSubject } from "#forSubject.ts";
import { makeClient } from "#makeClient.ts";
import { Notes } from "#test/notes.ts";
import { Records } from "#test/queryFailureContract.ts";

const made = makeClient({ notes: Notes, records: Records });
expectTypeOf(forSubject(made.api, "bob")).toEqualTypeOf(made.api);
expectTypeOf(forSubject(made.api.notes, "bob")).toEqualTypeOf(made.api.notes);
expectTypeOf(forSubject(made.api.notes.rename, "bob")).toEqualTypeOf(made.api.notes.rename);
const screens = { coaching: { notes: made.api.notes }, records: made.api.records };
expectTypeOf(forSubject(screens, "bob")).toEqualTypeOf(screens);
forSubject(made.api, "bob").notes.get.query({ id: 1 }, { subject: "carol" });
forSubject(made.api, "bob").notes.rename.run({ id: 1, title: "Renamed" }, { subject: "carol" });
// @ts-expect-error The value makeClient returns is a Layer that holds the client; a call through it would act for the caller.
forSubject(made, "bob");
// @ts-expect-error A function beside the operations would be called as it is, for the caller's own account.
forSubject({ notes: made.api.notes, open: () => made.api.notes }, "bob");
// @ts-expect-error An Effect beside the operations would run as it is, for the caller's own account.
forSubject({ notes: made.api.notes, sync: made.sync }, "bob");
