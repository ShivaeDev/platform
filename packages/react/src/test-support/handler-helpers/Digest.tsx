import { Crypto, Effect, Option } from "effect";
import * as Hex from "effect/encoding/Hex";
import * as Atom from "effect/reactivity/Atom";
import { clientCrypto } from "#client/adapters/crypto.ts";
import { useAction } from "#client/resultState.ts";

const digest = Atom.runtime(clientCrypto).fn<void>()(() =>
	Effect.gen(function* () {
		const crypto = yield* Crypto.Crypto;
		return Hex.encode(yield* crypto.digest("SHA-256", new TextEncoder().encode("hello")));
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
