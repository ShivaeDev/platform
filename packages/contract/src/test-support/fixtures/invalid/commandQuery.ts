import { api } from "#test/fixtures/invalid/client.ts";

api.rename.query({ id: 1, title: "t" });
