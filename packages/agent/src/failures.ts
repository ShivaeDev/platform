import { Schema } from "effect";
import { BackendDescriptor } from "#features.ts";

const details = { backend: Schema.String, message: Schema.String, providerCode: Schema.optional(Schema.String) };

export class Rejected extends Schema.TaggedError<Rejected>()("Rejected", details) {}
export class BackendUnavailable extends Schema.TaggedError<BackendUnavailable>()("BackendUnavailable", details) {}
export class ProtocolFailure extends Schema.TaggedError<ProtocolFailure>()("ProtocolFailure", details) {}
export class UnknownAcceptance extends Schema.TaggedError<UnknownAcceptance>()("UnknownAcceptance", {
	...details,
	operationId: Schema.String,
}) {}

export const BackendFailure = Schema.Union([Rejected, BackendUnavailable, ProtocolFailure, UnknownAcceptance]);
export type BackendFailure = typeof BackendFailure.Type;
export type ReadFailure = BackendUnavailable | ProtocolFailure;

export class UnsupportedCapability extends Schema.TaggedError<UnsupportedCapability>()("UnsupportedCapability", {
	available: BackendDescriptor,
	backend: Schema.String,
	requirement: Schema.String,
}) {}
