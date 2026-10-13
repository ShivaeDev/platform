import { homedir } from "node:os";
import { join } from "node:path";
import { Clock, Config, Effect, FileSystem, Option, Redacted, Schema, Stream } from "effect";
import { ChildProcess, ChildProcessSpawner } from "effect/process";
import { failure } from "#providers/codexRpc.ts";

export interface CodexLogin {
	readonly authFile?: string | undefined;
	readonly refreshCommand?: { readonly command: string; readonly args: readonly string[] } | undefined;
}
const AuthFile = Schema.Struct({
	tokens: Schema.Struct({ accessToken: Schema.String, accountId: Schema.optional(Schema.NullOr(Schema.String)) }).pipe(
		Schema.encodeKeys({ accessToken: "access_token", accountId: "account_id" }),
	),
});
const Claims = Schema.Struct({ exp: Schema.Finite });
const RefreshReply = Schema.Struct({ error: Schema.optional(Schema.Unknown), id: Schema.Literal(2) });
// A token that expires within this window could lapse during the handshake.
const EXPIRY_SKEW_MS = 5 * 60 * 1000;
function unreadable() {
	return failure("unavailable", "Codex login token is unreadable; sign in with the Codex CLI");
}

const authFilePath = Effect.fn("CodexLogin.authFilePath")(function* (login: CodexLogin) {
	if (login.authFile !== undefined) {
		return login.authFile;
	}
	const home = yield* Config.option(Config.String("CODEX_HOME")).pipe(Effect.orElseSucceed(() => Option.none<string>()));
	return join(
		Option.getOrElse(home, () => join(homedir(), ".codex")),
		"auth.json",
	);
});
const readToken = Effect.fn("CodexLogin.readToken")(function* (authFile: string) {
	const fs = yield* FileSystem.FileSystem;
	const content = yield* fs.readFileString(authFile).pipe(Effect.mapError(() => failure("unavailable", "Codex login file is unavailable")));
	const auth = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(AuthFile))(content).pipe(
		Effect.mapError(() => failure("unavailable", "Codex login file has no ChatGPT access token; sign in with the Codex CLI")),
	);
	const payload = yield* Effect.try({
		catch: unreadable,
		try: () => Buffer.from(auth.tokens.accessToken.split(".")[1] ?? "", "base64url").toString("utf8"),
	});
	const claims = yield* Schema.decodeUnknownEffect(Schema.fromJsonString(Claims))(payload).pipe(Effect.mapError(unreadable));
	return { accountId: auth.tokens.accountId ?? undefined, expiresAt: claims.exp * 1000, token: Redacted.make(auth.tokens.accessToken) };
});
// The Codex CLI owns the login file and its refresh-token rotation; Fleet only asks it to refresh.
const refreshLogin = Effect.fn("CodexLogin.refreshLogin")(function* (command: NonNullable<CodexLogin["refreshCommand"]>) {
	const spawner = yield* ChildProcessSpawner.ChildProcessSpawner;
	const messages = [
		{ id: 1, method: "initialize", params: { capabilities: null, clientInfo: { name: "work-fleet", title: "Work Fleet", version: "0.0.0" } } },
		{ method: "initialized" },
		{ id: 2, method: "account/read", params: { refreshToken: true } },
	];
	const stdin = Stream.make(new TextEncoder().encode(messages.map((message) => `${JSON.stringify(message)}\n`).join(""))).pipe(
		Stream.concat(Stream.never),
	);
	const reply = yield* spawner.streamLines(ChildProcess.make(command.command, [...command.args], { stdin })).pipe(
		Stream.filterMap((line) => Schema.decodeUnknownResult(Schema.fromJsonString(RefreshReply))(line)),
		Stream.runHead,
		Effect.mapError(() => failure("unavailable", "Codex CLI could not refresh the login")),
	);
	if (Option.isNone(reply) || reply.value.error !== undefined) {
		return yield* Effect.fail(failure("unavailable", "Codex CLI could not refresh the login; sign in with the Codex CLI"));
	}
});
export const codexCredentials = Effect.fn("CodexLogin.codexCredentials")(function* (login: CodexLogin, timeoutMs: number) {
	const authFile = yield* authFilePath(login);
	const current = yield* readToken(authFile);
	if (current.expiresAt - EXPIRY_SKEW_MS > (yield* Clock.currentTimeMillis)) {
		return current;
	}
	yield* refreshLogin(login.refreshCommand ?? { args: ["app-server", "--listen", "stdio://"], command: "codex" }).pipe(
		Effect.timeout(`${timeoutMs} millis`),
		Effect.catchTag("TimeoutError", () => Effect.fail(failure("unavailable", "Codex CLI login refresh timed out"))),
	);
	const refreshed = yield* readToken(authFile);
	if (refreshed.expiresAt - EXPIRY_SKEW_MS <= (yield* Clock.currentTimeMillis)) {
		return yield* Effect.fail(failure("unavailable", "Codex login is expired; sign in with the Codex CLI"));
	}
	return refreshed;
});

export const codexAccessToken = Effect.fn("CodexLogin.codexAccessToken")((login: CodexLogin, timeoutMs: number) =>
	codexCredentials(login, timeoutMs).pipe(Effect.map((credentials) => credentials.token)),
);
