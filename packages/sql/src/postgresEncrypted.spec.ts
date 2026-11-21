import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { type ConfiguredKey, connected, type EncryptedRole, encryptedTokens, keyConfigured } from "#test/encryptedTokens.ts";

encryptedTokens.it(
	"a connected token is read back as a Redacted that prints <redacted> while its bytea column holds the version byte, a nonce and the sealed bytes, without the token's text",
	[],
	function* ({ connect, storedToken, token }) {
		yield* connect("alice", "withings-refresh-a");

		yield* outcomes([
			["alice's token as read back", () => token("alice"), { opened: "withings-refresh-a", printed: "<redacted>" }],
			["stored token column", () => storedToken("alice"), { bytes: 1 + 24 + 20 + 16, type: "bytea", version: 1 }],
			[
				"stored token column holds the token's text",
				() => Effect.map(storedToken("alice"), ({ asText }) => asText.includes("withings-refresh-a")),
				false,
			],
		]);
	},
);

encryptedTokens.it(
	"two connections with the same token store different bytes and both read back the token",
	[],
	function* ({ connect, storedToken, token }) {
		yield* connect("alice", "shared-token");
		yield* connect("bob", "shared-token");

		const [alice, bob] = [yield* storedToken("alice"), yield* storedToken("bob")];
		yield* outcomes([
			["alice's and bob's stored bytes are equal", () => Effect.succeed(alice.base64 === bob.base64), false],
			["alice's token", () => token("alice"), { opened: "shared-token" }],
			["bob's token", () => token("bob"), { opened: "shared-token" }],
		]);
	},
);

encryptedTokens.it(
	"reading a token after the application restarts with another key fails with a schema error that names the field and leaves the token out",
	[connected({ alice: "whoop-access-a" })],
	function* ({ keyReplaced, token }) {
		yield* keyReplaced();

		const read = yield* token("alice");

		expect(read).toBe(
			'SchemaError: the sealed value does not open with the column key: it was sealed with another key or its bytes were changed\n  at ["token"]',
		);
	},
);

encryptedTokens.it(
	"encoding a read connection with the model's select schema fails at the token, so a response cannot carry it",
	[connected({ alice: "whoop-access-a" })],
	function* ({ encodedRead }) {
		expect(yield* encodedRead("alice")).toBe('SchemaError: Cannot encode Redacted\n  at ["token"]');
	},
);

encryptedTokens.it(
	"a key read from COLUMN_ENCRYPTION_KEY seals a token that reads back",
	[keyConfigured("32 random bytes in base64")],
	function* ({ connect, token }) {
		yield* connect("alice", "withings-refresh-a");

		expect(yield* token("alice")).toEqual({ opened: "withings-refresh-a", printed: "<redacted>" });
	},
);

const refusedKeys = [
	{ configured: "nothing", refusal: "COLUMN_ENCRYPTION_KEY is not set; encrypted fields need it to hold 32 random bytes in base64" },
	{ configured: "16 random bytes in base64", refusal: "COLUMN_ENCRYPTION_KEY must hold exactly 32 bytes in base64" },
	{ configured: "text that is not base64", refusal: "COLUMN_ENCRYPTION_KEY must hold exactly 32 bytes in base64" },
] as const satisfies readonly { readonly configured: ConfiguredKey; readonly refusal: string }[];

for (const { configured, refusal } of refusedKeys) {
	encryptedTokens.it(
		`when COLUMN_ENCRYPTION_KEY holds ${configured}, the key's Layer builds and the first token written fails naming the config value without its text`,
		[keyConfigured(configured)],
		function* ({ configuredValue, connect }) {
			const written = yield* connect("alice", "withings-refresh-a");

			yield* outcomes([
				["connection", () => Effect.succeed(written), `SchemaError: ${refusal}\n  at ["token"]`],
				["failure holds the configured text", () => Effect.map(configuredValue(), (value) => written.includes(value)), false],
			]);
		},
	);
}

for (const role of ["the ID column", "a bucket", "a tuple bucket column", "a conflict column"] as const satisfies readonly EncryptedRole[]) {
	encryptedTokens.it(
		`building a repository refuses the encrypted token as ${role}, whose sealed bytes never compare equal`,
		[],
		function* ({ register }) {
			expect(yield* register(role)).toBe(
				'EncryptedKeyError: Repository for refused_connections: encrypted fields ["token"] cannot be an ID column, a bucket or a conflict column, because every write seals them under a fresh random nonce, so equal values never match; key the table by another column',
			);
		},
	);
}
