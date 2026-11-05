import { Effect, Option } from "effect";
import { Digest as Digests } from "effect/crypto";
import * as Atom from "effect/reactivity/Atom";
import { clientCrypto } from "#client/adapters/crypto.ts";
import { useAction } from "#client/resultState.ts";

const digest = Atom.runtime(clientCrypto).fn<void>()(() =>
	Effect.gen(function* () {
		const digests = yield* Digests.Digest;
		return yield* digests.digestHex(Digests.sha256, new TextEncoder().encode("hello"));
	}),
);

export function Digest() {
	const action = useAction(digest);
	return (
		<section>
			<button onClick={() => action.dispatch()} type="button">
				Digest
			</button>
			<output data-digest>{Option.getOrElse(action.data, () => "empty")}</output>
		</section>
	);
}
