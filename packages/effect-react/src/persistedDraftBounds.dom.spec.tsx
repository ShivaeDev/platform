import { Clock, Effect } from "effect";
import { expect, it, vi } from "vitest";
import { expectNoReactWarnings } from "#client/testing.ts";
import { draftStorage } from "#test/draftStorage.ts";
import { persistedDraftView } from "#test/persistedDraftView.tsx";

Object.assign(globalThis, { "IS_REACT_ACT_ENVIRONMENT": true });
expectNoReactWarnings();
draftStorage();

it.each([undefined, 1000])("expires drafts after the default or configured age (%s)", async (maxAgeMs) => {
	let now = Effect.runSync(Clock.currentTimeMillis);
	vi.useFakeTimers({ toFake: ["Date"] });
	vi.setSystemTime(now);
	const config = maxAgeMs === undefined ? { key: "aged" } : { key: "aged", maxAgeMs };
	const first = await persistedDraftView(config);
	await first.change("name", "Old answer");
	expect(window.localStorage.getItem("aged")).not.toBeNull();
	await first.unmount();
	now += (maxAgeMs ?? 7 * 24 * 60 * 60 * 1000) + 1;
	vi.setSystemTime(now);
	const reloaded = await persistedDraftView(config);
	try {
		expect(reloaded.editor().form.values.value.name).toBe("Paper");
		expect(window.localStorage.getItem("aged")).toBeNull();
	} finally {
		await reloaded.unmount();
	}
});

it("bounds the full record by UTF-8 bytes and drops a previously stored draft that grows too large", async () => {
	const view = await persistedDraftView({ key: "bounded", maxBytes: 350 });
	try {
		await view.change("name", "a".repeat(120));
		expect(window.localStorage.getItem("bounded")).not.toBeNull();
		await view.change("name", "é".repeat(120));
		expect(window.localStorage.getItem("bounded")).toBeNull();
		expect(view.editor().form.values.value.name).toBe("é".repeat(120));
	} finally {
		await view.unmount();
	}
});

it("the default size limit drops an oversized draft without changing input", async () => {
	const view = await persistedDraftView();
	try {
		await view.change("name", "a".repeat(256 * 1024));
		expect(window.localStorage.getItem("order-draft")).toBeNull();
		expect(view.editor().form.values.value.name).toHaveLength(256 * 1024);
	} finally {
		await view.unmount();
	}
});

it.each([
	"{",
	"{}",
	JSON.stringify({
		baseline: { name: "Paper", quantity: "300" },
		edited: ["name"],
		session: "first",
		updatedAt: Effect.runSync(Clock.currentTimeMillis),
		values: { name: 42, quantity: "300" },
		version: 1,
	}),
])("drops malformed or incompatible stored input (%s)", async (raw) => {
	window.localStorage.setItem("order-draft", raw);
	const view = await persistedDraftView();
	try {
		expect(view.editor().form.values.value.name).toBe("Paper");
		expect(window.localStorage.getItem("order-draft")).toBeNull();
	} finally {
		await view.unmount();
	}
});

it("drops an oversized record on read and a draft belonging to a different session after reload", async () => {
	const first = await persistedDraftView();
	await first.change("name", "First session");
	const raw = window.localStorage.getItem("order-draft");
	await first.unmount();
	const small = await persistedDraftView({ key: "order-draft", maxBytes: 10 });
	expect(window.localStorage.getItem("order-draft")).toBeNull();
	await small.unmount();
	window.localStorage.setItem("order-draft", raw ?? "");
	const second = await persistedDraftView();
	await second.show("second");
	try {
		expect(second.editor().form.values.value.name).toBe("Paper");
		expect(window.localStorage.getItem("order-draft")).toBeNull();
	} finally {
		await second.unmount();
	}
});
