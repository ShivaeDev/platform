import { Effect, Layer, Schema } from "effect";
import * as Atom from "effect/reactivity/Atom";
import { Conflict, ServiceUnavailable } from "@shivaedev/errors/taxonomy.ts";
import { rejecting } from "#fieldRejection.ts";
import { formStories } from "./formStories.ts";

const Profile = Schema.Struct({ profile: Schema.Struct({ email: Schema.String, name: Schema.String }) });
const initialValues = { profile: { email: "alice@example.com", name: "Taken" } };
const runtime = Atom.runtime(Layer.empty);

function saveProfile(_values: typeof Profile.Type) {
	return Effect.fail(new Conflict({ field: "name", message: "Name is already used" }));
}

export const rejectedProfiles = formStories(() => Profile, {
	config: () => ({
		initialValues,
		onSubmit: rejecting(Profile, saveProfile, (error) =>
			error.field === "name" ? { field: ["profile", "name"] as const, message: error.message } : undefined,
		),
		runtime,
	}),
	support: () => undefined,
	verbs: () => ({}),
});

export const unmappedProfiles = formStories(() => Profile, {
	config: () => ({ initialValues, onSubmit: rejecting(Profile, saveProfile, undefined), runtime }),
	support: () => undefined,
	verbs: (driver) => ({
		failure: () =>
			driver.result().pipe(
				Effect.match({
					onFailure: (error) => (error instanceof Conflict ? `conflict on ${error.field}: ${error.message}` : "unexpected failure"),
					onSuccess: () => "saved",
				}),
			),
	}),
});

export const unavailableProfiles = formStories(() => Profile, {
	config: () => ({
		initialValues,
		onSubmit: rejecting(
			Profile,
			(_values: typeof Profile.Type) => Effect.fail(new ServiceUnavailable({ message: "Directory is offline" })),
			undefined,
		),
		runtime,
	}),
	support: () => undefined,
	verbs: (driver) => ({
		failure: () =>
			driver.result().pipe(
				Effect.match({
					onFailure: (error) => (error instanceof ServiceUnavailable ? `unavailable: ${error.message}` : "unexpected failure"),
					onSuccess: () => "saved",
				}),
			),
	}),
});
