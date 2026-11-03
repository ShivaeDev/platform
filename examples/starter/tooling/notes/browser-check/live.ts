import { Effect } from "effect";
import { Crypto } from "effect/Crypto";
import { Browser } from "@shivaedev/browser-check/Browser.ts";
import { BrowserCheckError } from "@shivaedev/browser-check/BrowserCheckError.ts";
import { rpcHint, rpcListRequest } from "./rpcFrames.ts";

export const liveNotes = Effect.fn("Notes.liveNotes")(function* (
	url: string,
	folder: string,
	credentials: { readonly email: string; readonly password: string },
) {
	const browser = yield* Browser;
	const session = yield* browser.open;
	yield* session.signIn(new URL("/api/auth/sign-in/email", url).href, credentials.email, credentials.password);
	const writer = yield* session.newPage;
	const observer = yield* session.newPage;
	const [rpcSocket] = yield* Effect.all(
		[
			observer.socket("/rpc").pipe(Effect.tap((socket) => socket.received((payload) => rpcHint(payload, "Resync")))),
			writer.visit(new URL("/", url).href).pipe(Effect.andThen(observer.visit(new URL("/", url).href))),
		],
		{ concurrency: "unbounded" },
	);
	yield* observer.waitFor({ name: "Notes", role: "heading" });
	const navigations = yield* observer.navigationCount;
	const crypto = yield* Crypto;
	const title = `Browser check ${yield* crypto.randomUUIDv4()}`;
	yield* Effect.all(
		[
			rpcSocket.received((payload) => rpcHint(payload, "Changed")),
			rpcSocket.sent(rpcListRequest),
			Effect.gen(function* () {
				yield* writer.fill({ label: "New note" }, title);
				yield* writer.click({ name: "Add note", role: "button" });
				yield* observer.waitFor({ name: title, role: "link" });
			}),
		],
		{ concurrency: "unbounded" },
	);
	if ((yield* observer.navigationCount) !== navigations) {
		return yield* new BrowserCheckError({ message: "The second tab navigated instead of updating its open notes list." });
	}
	yield* observer.screenshot(`${folder}/live-notes.png`);
	yield* Effect.all(
		[rpcSocket.closed, writer.click({ name: "Sign out", role: "button" }), observer.waitFor({ role: "alert", text: "Sign in to view your notes." })],
		{ concurrency: "unbounded" },
	);
	yield* writer.waitFor({ name: "Sign in", role: "heading" });
	yield* observer.waitFor({ name: title, role: "link" }, "hidden");
	yield* observer.screenshot(`${folder}/signed-out.png`);
});
