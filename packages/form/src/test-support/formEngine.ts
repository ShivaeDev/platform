import type { Deferred, Schema } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { DraftSession } from "#draftSession.ts";
import type { Config, Decoded, Fields, Form } from "#shape.ts";
import type { checkGate } from "./checkGate.ts";
import type { draftStorage } from "./draftStorage.ts";

export interface FormSupport {
	readonly checked: string[];
	readonly checkGate: ReturnType<typeof checkGate>;
	readonly release: Deferred.Deferred<void>;
	readonly session: DraftSession;
	readonly started: Deferred.Deferred<void>;
	readonly storage: ReturnType<typeof draftStorage>;
}

export interface FormEngine<TFields extends Fields, A, E, R, TRuntimeError> extends FormSupport {
	config: Config<TFields, A, E, R, TRuntimeError>;
	current: Form<TFields, A, E, TRuntimeError> | undefined;
	readonly mounted: Set<Atom.Atom<unknown>>;
	readonly observed: Map<string, Atom.Atom<string | undefined>>;
	readonly registry: AtomRegistry.AtomRegistry;
	schema: Schema.Struct<TFields>;
	readonly submissions: Decoded<TFields>[];
}
