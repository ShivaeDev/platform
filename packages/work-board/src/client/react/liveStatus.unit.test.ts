import { expect, it } from "vitest";
import { liveStatus } from "./liveStatus.ts";

const live = { connection: "live", failed: false, navigationFailed: false, paused: false, pending: 0, waiting: false, watching: true };

it("names a failed sidebar read apart from a failed page read", () => {
	expect(liveStatus({ ...live, navigationFailed: true })).toMatchObject({ state: "stale", text: "Couldn't update the sidebar" });
	expect(liveStatus({ ...live, failed: true, navigationFailed: true })).toMatchObject({ state: "stale", text: "Couldn't update this page" });
});

it("says the Board server is unreachable while reconnecting, even over a failed read", () => {
	expect(liveStatus({ ...live, connection: "reconnecting" })).toMatchObject({ state: "down", text: "Can't reach the Board server" });
	expect(liveStatus({ ...live, connection: "reconnecting", failed: true })).toMatchObject({ state: "stale", text: "Can't reach the Board server" });
	expect(liveStatus({ ...live, watching: false })).toMatchObject({ state: "down", text: "Reconnecting…" });
});
