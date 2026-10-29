import type { Deferred, Schema } from "effect";
import type * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import type { DraftSession } from "#draftSession.ts";
import type { Config, FieldFailure, Fields, Form, Name, Path } from "#shape.ts";
import type { draftStorage } from "./draftStorage.ts";

export interface HeldSave {
	armed: boolean;
	readonly arrived: Deferred.Deferred<void>;
	readonly release: Deferred.Deferred<void>;
}

export interface Rejection<TFields extends Fields> {
	readonly message: string;
	readonly path: Name<TFields> | Path<Name<TFields>>;
}

export interface FormEngine<TFields extends Fields, A, E, R, TRuntimeError, TSupport> {
	config: Config<TFields, A, E | FieldFailure, R, TRuntimeError>;
	current: Form<TFields, A, E | FieldFailure, TRuntimeError> | undefined;
	held: HeldSave | undefined;
	readonly mounted: Set<Atom.Atom<unknown>>;
	readonly opened: (form: Form<TFields, A, E | FieldFailure, TRuntimeError>, read: <T>(atom: Atom.Atom<T>) => T) => void;
	readonly received: unknown[];
	readonly registry: AtomRegistry.AtomRegistry;
	rejection: Rejection<TFields> | undefined;
	schema: Schema.Struct<TFields>;
	readonly session: DraftSession;
	readonly storage: ReturnType<typeof draftStorage>;
	readonly support: TSupport;
}
