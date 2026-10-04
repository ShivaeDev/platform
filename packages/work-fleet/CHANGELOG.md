# Changelog

## 0.1.0

- Add a local Effect coordinator for approved repository batches with SQLite
  persistence, capacity and ownership controls, scoped decisions and generated
  Active, Completed and Needs human views.
- Add worker, independent review, repair and revision-aware delivery flows with
  conservative recovery for uncertain external acknowledgements.
- Add local Codex app-server and GitHub adapters, plus scripted providers for
  offline lifecycle validation. Local Codex requires ChatGPT authentication;
  hosted Cloud and API-billed execution are not implemented.
- Keep test support and test sources out of the published package. Runtime
  dependency fences distinguish colocated tests from application code.
