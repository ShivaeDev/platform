import { Schema } from "effect";
import { BadRequest, Conflict, PreconditionFailed, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { PublicationUncertain } from "#rpc/rejections.ts";

export const PublicationFailure = Schema.Union([BadRequest, Conflict, PreconditionFailed, ServiceUnavailable, PublicationUncertain]);
export type PublicationFailure = typeof PublicationFailure.Type;
