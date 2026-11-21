import { Effect } from "effect";
import type * as AsyncResult from "effect/reactivity/AsyncResult";
import type * as Atom from "effect/reactivity/Atom";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { expectTypeOf } from "vitest";
import { type ContractClient, makeClient } from "#makeClient.ts";
import type { MissingReadPolicy } from "#readPolicyErrors.ts";
import type { ResumeSource, ResumeWindow } from "#resume.ts";
import { type Note, type NoteMissing, Notes } from "#test/notes.ts";
import { Records } from "#test/queryFailureContract.ts";
import { Preferences } from "#test/sessionContract.ts";
import type { WebSocketRequired } from "#WebSocketRequired.ts";

declare const resume: ResumeSource;
declare const resumeWindow: ResumeWindow;
declare function notesScreen(client: ContractClient<typeof Notes>): void;

const browser = makeClient({ notes: Notes });
const merged = makeClient({ notes: Notes, records: Records }, { headers: { cookie: "session=test" }, url: "https://app.test/rpc" });
notesScreen(browser.api.notes);
notesScreen(merged.api.notes);
// @ts-expect-error A screen typed with one contract refuses another contract's binding.
notesScreen(merged.api.records);
expectTypeOf(merged.api.notes).toEqualTypeOf<ContractClient<typeof Notes>>();
expectTypeOf(merged.api.records).toEqualTypeOf<ContractClient<typeof Records>>();
expectTypeOf(merged.runtime).toEqualTypeOf(browser.runtime);
merged.runtime.atom(merged.api.records.list.run());
merged.runtime.fn(merged.api.notes.rename.run);

expectTypeOf(merged.api.notes.get.run).parameter(0).toEqualTypeOf<{ readonly id: number }>();
expectTypeOf<Effect.Success<ReturnType<typeof merged.api.notes.get.run>>>().toEqualTypeOf<Note>();
expectTypeOf<NoteMissing | MissingReadPolicy | WebSocketRequired>().toExtend<Atom.Failure<ReturnType<typeof merged.api.notes.get.query>>>();
expectTypeOf<ReturnType<typeof merged.api.notes.list.query>>().toExtend<Atom.Atom<AsyncResult.AsyncResult<readonly Note[], unknown>>>();
merged.api.notes.get.query({ id: 1 }, { subject: "bob" });
// @ts-expect-error A subject names an account by its id.
merged.api.notes.get.query({ id: 1 }, { subject: 1 });
// @ts-expect-error Payload types survive client construction.
merged.api.notes.get.run({ id: "1" });
expectTypeOf(merged.api.notes).not.toHaveProperty("missing");
// @ts-expect-error The direct RPC client calls only the record's RPCs.
Effect.map(merged.client, (client) => client["other.get"]);
expectTypeOf(makeClient({ notes: Notes }, { resume, resumeWindow }).api).toEqualTypeOf(browser.api);

makeClient({ notes: Notes, preferences: Preferences }, { registry: AtomRegistry.make(), resume });
// @ts-expect-error A record with a session-scoped contract needs the session's registry.
makeClient({ notes: Notes, preferences: Preferences });
// @ts-expect-error Resume options do not replace a session-scoped client's registry.
makeClient({ preferences: Preferences }, { resume, resumeWindow });
