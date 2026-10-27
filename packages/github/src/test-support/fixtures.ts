import { Schema } from "effect";

export const PullRequest = Schema.Struct({ number: Schema.Number, title: Schema.String });
export const FIXTURE_TOKEN = "github-fixture-secret";
