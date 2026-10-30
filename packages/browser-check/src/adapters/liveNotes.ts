import { randomUUID } from "node:crypto";
import { join } from "node:path";
import type { BrowserContext, Page } from "playwright";

export async function liveNotes(context: BrowserContext, writer: Page, url: string, folder: string) {
	const observer = await context.newPage();
	observer.setDefaultTimeout(5000);
	const socketReady = observer
		.waitForEvent("websocket", { predicate: (socket) => new URL(socket.url()).pathname === "/rpc" })
		.then(async (socket) => {
			await socket.waitForEvent("framereceived", { predicate: (frame) => String(frame.payload).includes('"Resync"') });
			return socket;
		});
	await writer.goto(new URL("/", url).href);
	await observer.goto(new URL("/", url).href);
	const rpcSocket = await socketReady;
	await observer.getByRole("heading", { exact: true, name: "Notes" }).waitFor();
	let navigated = false;
	observer.on("framenavigated", (frame) => {
		if (frame === observer.mainFrame()) {
			navigated = true;
		}
	});
	const title = `Browser check ${randomUUID()}`;
	const changed = rpcSocket.waitForEvent("framereceived", { predicate: (frame) => String(frame.payload).includes('"Changed"') });
	const reread = rpcSocket.waitForEvent("framesent", { predicate: (frame) => String(frame.payload).includes('"notes.list"') });
	await writer.getByLabel("New note", { exact: true }).fill(title);
	await writer.getByRole("button", { exact: true, name: "Add note" }).click();
	await Promise.all([changed, reread, observer.getByRole("link", { exact: true, name: title }).waitFor()]);
	if (navigated) {
		throw new Error("The second tab navigated instead of updating its open notes list.");
	}
	await observer.screenshot({ fullPage: true, path: join(folder, "live-notes.png") });
	await Promise.all([
		rpcSocket.waitForEvent("close"),
		writer.getByRole("button", { exact: true, name: "Sign out" }).click(),
		observer.getByRole("alert").filter({ hasText: "Sign in to view your notes." }).waitFor(),
	]);
	await writer.getByRole("heading", { exact: true, name: "Sign in" }).waitFor();
	if (await observer.getByRole("link", { exact: true, name: title }).count()) {
		throw new Error("The signed-out second tab still displays the private note.");
	}
	await observer.screenshot({ fullPage: true, path: join(folder, "signed-out.png") });
}
