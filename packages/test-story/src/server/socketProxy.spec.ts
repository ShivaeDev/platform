import { expect } from "vitest";
import { socketProxy } from "#test/socketProxy.ts";

socketProxy.it(
	"carries RPC results and live updates over one WebSocket when IPv6 is unavailable",
	[],
	function* ({ initialResult, initialHint, sockets, socketUrl, writeElsewhere, nextHint, read }) {
		expect(initialResult()).toBe("First page");
		expect(initialHint()).toEqual({ _tag: "Resync" });
		expect(sockets()).toEqual([socketUrl()]);
		expect(sockets()[0]).toMatch(/^ws:\/\/127\.0\.0\.1:/u);

		yield* writeElsewhere("A live page");

		expect(yield* nextHint()).toEqual({ _tag: "Changed", keys: [{ _tag: "Item", collection: "pages", id: 1 }] });
		expect(yield* read()).toBe("A live page");
		expect(sockets()).toEqual([socketUrl()]);
	},
);

socketProxy.it(
	"holds a query until online and then reads the change made while held",
	[],
	function* ({ hold, startsRead, writeElsewhere, readPending, online, readResult, nextHint }) {
		yield* hold();
		yield* startsRead();

		yield* writeElsewhere("Changed while held");

		expect(readPending()).toBe(true);

		yield* online();

		expect(yield* readResult()).toBe("Changed while held");
		expect(yield* nextHint()).toEqual({ _tag: "Changed", keys: [{ _tag: "Item", collection: "pages", id: 1 }] });
	},
);

socketProxy.it(
	"holds live updates while another client sees the write, until online restores traffic",
	[],
	function* ({ hold, writeElsewhere, readElsewhere, queuedHints, online, nextHint }) {
		yield* hold();

		yield* writeElsewhere("A held live update");

		expect(yield* readElsewhere()).toBe("A held live update");
		expect(yield* queuedHints()).toEqual([]);

		yield* online();

		expect(yield* nextHint()).toEqual({ _tag: "Changed", keys: [{ _tag: "Item", collection: "pages", id: 1 }] });
	},
);

socketProxy.it(
	"drops the shared socket and signals reconnection on its first client frame, after the upgrade",
	[],
	function* ({
		gateClientFrames,
		disconnect,
		clientCloses,
		online,
		clientOpens,
		waitForClientFrame,
		reconnected,
		releaseClientFrames,
		reconnection,
		read,
		sockets,
		socketUrl,
	}) {
		yield* gateClientFrames();

		yield* disconnect();
		yield* clientCloses();

		expect(reconnected()).toBe(false);

		yield* online();
		yield* clientOpens();
		yield* waitForClientFrame();

		expect(reconnected()).toBe(false);

		yield* releaseClientFrames();
		yield* reconnection();

		expect(reconnected()).toBe(true);
		expect(yield* read()).toBe("First page");
		expect(sockets()).toEqual([socketUrl(), socketUrl()]);
	},
);
