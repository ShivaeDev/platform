import { Crypto, Effect, Layer, PlatformError } from "effect";

export const clientCrypto = Layer.succeed(
	Crypto.Crypto,
	Crypto.make({
		digest: (algorithm, data) =>
			Effect.tryPromise({
				catch: (cause) =>
					PlatformError.systemError({ _tag: "Unknown", cause, description: "Could not compute digest", method: "digest", module: "Crypto" }),
				try: () => globalThis.crypto.subtle.digest(algorithm, new Uint8Array(data)).then((buffer) => new Uint8Array(buffer)),
			}),
		randomBytes: (size) => globalThis.crypto.getRandomValues(new Uint8Array(size)),
	}),
);
