import type { Effect, Option } from "effect";
import type { Key } from "@shivaedev/changes/keys.ts";
import type { Viewer } from "#readPolicy.ts";

export type QueryServerReads<TPayload, E = never, R = never> = (
	payload: TPayload,
	viewer: Option.Option<Viewer>,
) => Effect.Effect<readonly Key[], E, R>;
