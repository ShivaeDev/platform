import { Duration, Effect, Stream } from "effect";
import type { HttpClientResponse } from "effect/http";
import { isSensitiveKey, redactText } from "@shivaedev/errors/sensitive.ts";

export const BODY_EXCERPT_BYTES = 2048;
export const bodyExcerptDeadline = Duration.seconds(1);

// A cut can split a token or a JWT; dropping the partial word keeps half a secret out of the excerpt.
const PARTIAL_WORD = /[^\s"'{}[\]()<>,;:]+$/u;

function isBinary(text: string): boolean {
	for (const character of text) {
		const code = character.codePointAt(0) ?? 0;
		const control = (code < 0x20 && character !== "\t" && character !== "\n" && character !== "\r") || code === 0x7f;
		if (control || character === "\uFFFD") {
			return true;
		}
	}
	return false;
}

export function bodyExcerpt(bytes: Uint8Array, truncated: boolean): string | undefined {
	const decoded = new TextDecoder().decode(bytes, { stream: true });
	if (isBinary(decoded)) {
		return undefined;
	}
	const collapsed = decoded.replaceAll(/\s+/gu, " ").trim();
	const text = truncated ? collapsed.replace(PARTIAL_WORD, "").trimEnd() : collapsed;
	if (text === "") {
		return undefined;
	}
	const redacted = redactText(text, isSensitiveKey, BODY_EXCERPT_BYTES);
	return truncated ? `${redacted}…` : redacted;
}

export function readBodyExcerpt(response: HttpClientResponse.HttpClientResponse): Effect.Effect<string | undefined> {
	return Effect.suspend(() => {
		const kept = new Uint8Array(BODY_EXCERPT_BYTES);
		let size = 0;
		let truncated = false;
		return response.stream.pipe(
			Stream.runForEachWhile((chunk) =>
				Effect.sync(() => {
					const room = BODY_EXCERPT_BYTES - size;
					kept.set(chunk.subarray(0, room), size);
					size += Math.min(room, chunk.byteLength);
					truncated = chunk.byteLength > room;
					return !truncated;
				}),
			),
			Effect.timeout(bodyExcerptDeadline),
			Effect.map(() => bodyExcerpt(kept.subarray(0, size), truncated)),
			Effect.orElseSucceed(() => undefined),
			// A body another reader already consumed dies when its stream opens; the status failure still wins.
			Effect.catchDefect(() => Effect.succeed(undefined)),
		);
	});
}
