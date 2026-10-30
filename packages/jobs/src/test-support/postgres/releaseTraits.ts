import { Effect } from "effect";
import { makeWorkerRelease } from "@shivaedev/sql/WorkerRelease.ts";
import { database } from "./database.ts";

export function releaseHeld(by: "this deployment" | "another deployment") {
	return database.trait("database", `${by} holds the database release`, function* (engine) {
		const release = yield* makeWorkerRelease();
		yield* release.setActive(by === "this deployment");
		engine.release = release;
	});
}

export const handedOver = database.trait("jobs", "this deployment has handed the database release to another deployment", (engine) =>
	Effect.suspend(() =>
		engine.release === undefined ? Effect.die(new Error("No database release control was set up")) : engine.release.setActive(false),
	),
);
