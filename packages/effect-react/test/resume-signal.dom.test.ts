import { Effect } from "effect";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { expect, it } from "vitest";
import { type ResumeWindow, resumeSignal } from "../src/index.ts";

const syntheticWindow = () => {
	const target = new EventTarget();
	const listeners = new Set<() => void>();
	const document: { visibilityState: string } = { visibilityState: "visible" };
	const window: ResumeWindow = {
		addEventListener: (type, listener) => {
			listeners.add(listener);
			target.addEventListener(type, listener);
		},
		document,
		removeEventListener: (type, listener) => {
			listeners.delete(listener);
			target.removeEventListener(type, listener);
		},
	};
	return {
		fire: (type: "online" | "visibilitychange", visibility = "visible") => {
			document.visibilityState = visibility;
			target.dispatchEvent(new Event(type));
		},
		listeners,
		window,
	};
};

const syntheticNative = () => {
	const listeners = new Set<() => void>();
	return {
		listeners,
		resume: () => {
			for (const listener of listeners) {
				listener();
			}
		},
		source: (resume: () => void) => {
			listeners.add(resume);
			return () => listeners.delete(resume);
		},
	};
};

const counted = () => {
	let reads = 0;
	return {
		atom: Atom.make(Effect.sync(() => ++reads)),
		reads: () => reads,
	};
};

it("visible browser resume, visible reconnect and native resume each refresh a query; hidden events do not", () => {
	const browser = syntheticWindow();
	const native = syntheticNative();
	const resume = resumeSignal({ native: native.source, window: browser.window });
	const query = counted();
	const registry = AtomRegistry.make();
	const release = registry.mount(Atom.makeRefreshOnSignal(resume)(query.atom));
	expect(query.reads()).toBe(1);
	browser.fire("visibilitychange");
	expect(query.reads()).toBe(2);
	browser.fire("visibilitychange", "hidden");
	browser.fire("online", "hidden");
	expect(query.reads()).toBe(2);
	browser.fire("online");
	expect(query.reads()).toBe(3);
	native.resume();
	expect(query.reads()).toBe(4);
	expect(browser.listeners.size).toBe(2);
	expect(native.listeners.size).toBe(1);
	release();
	registry.dispose();
	expect(browser.listeners.size).toBe(0);
	expect(native.listeners.size).toBe(0);
});

it("swr treats resume as a focus signal and only revalidates stale data", () => {
	const native = syntheticNative();
	const resume = resumeSignal({ native: native.source });
	const fresh = counted();
	const stale = counted();
	const registry = AtomRegistry.make();
	registry.mount(Atom.swr(fresh.atom, { focusSignal: resume, revalidateOnFocus: true, staleTime: "1 hour" }));
	registry.mount(Atom.swr(stale.atom, { focusSignal: resume, revalidateOnFocus: true, revalidateOnMount: false, staleTime: "0 millis" }));
	expect([fresh.reads(), stale.reads()]).toEqual([1, 1]);
	native.resume();
	expect([fresh.reads(), stale.reads()]).toEqual([1, 2]);
	registry.dispose();
	expect(native.listeners.size).toBe(0);
});

it("the browser window is a resume window", () => {
	const registry = AtomRegistry.make();
	const resume = resumeSignal({ window });
	registry.mount(resume);
	window.dispatchEvent(new Event("online"));
	expect(registry.get(resume)).toBe(1);
	registry.dispose();
});
