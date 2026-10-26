import { Schema } from "effect";
import { contract } from "@shivaedev/contract/contract.ts";
import { command, query } from "@shivaedev/contract/operation.ts";
import { RequestTracing } from "@shivaedev/platform/rpc/middleware.ts";
import { Handoff, HandoffInput, HandoffPreview, HandoffReading } from "#browser/handoffs/schema.ts";
import { index, workspace } from "#rpc/keys.ts";
import { responseRejections } from "#rpc/rejections.ts";

const locate = query("handoffSource", {
	payload: { item: Schema.String },
	reads: () => [workspace.list, index.list],
	rejections: responseRejections,
	success: HandoffPreview,
});
const read = query("handoffs", {
	payload: { item: Schema.String },
	reads: () => [workspace.list, index.list],
	rejections: responseRejections,
	success: HandoffReading,
});
const prepare = command("prepareHandoff", {
	invalidates: () => [workspace.list, index.list],
	payload: HandoffInput,
	rejections: responseRejections,
	success: Handoff,
});
export const handoffContract = contract("work-board-handoffs", { commands: [prepare], queries: [locate, read] }).middleware(RequestTracing);
