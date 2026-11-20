import { Schema } from "effect";
import { expect, it } from "vitest";
import { Conflict, Forbidden, InternalServerError, NotFound, ServiceUnavailable, Unauthorized } from "@shivaedev/errors/taxonomy.ts";
import { failureKind } from "#failureKind.ts";
import { QueryReadDenied } from "#readPolicyErrors.ts";
import { WebSocketRequired } from "#WebSocketRequired.ts";

class SubtitleRejected extends Schema.TaggedError<SubtitleRejected>()("SubtitleRejected", { message: Schema.String }) {}

it.each([
	["Conflict", new Conflict({ message: "Taken" }), "request"],
	["NotFound", new NotFound({ message: "Gone" }), "request"],
	["Forbidden", new Forbidden({ message: "No" }), "request"],
	["Unauthorized", new Unauthorized({ message: "Sign in" }), "request"],
	["InternalServerError", new InternalServerError({ message: "Internal server error" }), "framework"],
	["ServiceUnavailable", new ServiceUnavailable({ message: "Down" }), "framework"],
	["QueryReadDenied", new QueryReadDenied({ message: "Denied" }), "framework"],
	["WebSocketRequired", new WebSocketRequired({ message: "Live" }), "framework"],
	["an untagged failure", "Title required", "framework"],
	["an app-defined rejection", new SubtitleRejected({ message: "Too long" }), "app"],
] as const)("classifies %s as a %s failure", (_name, error, kind) => {
	expect(failureKind(error)).toBe(kind);
});
