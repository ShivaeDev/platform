import { configureFetchingMain } from "#test/admissionFetch.ts";
import { host } from "#test/hostStory.ts";

export const fetchingMain = host.trait("configuration", "admission fetches main from a real local Git remote", configureFetchingMain);
