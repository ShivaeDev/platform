# Roadmap

This file owns shared-skill distribution, its implementation and package-local questions. The [framework roadmap](https://github.com/ShivaeDev/platform/blob/main/docs/framework/roadmap.md) owns composed application features and host-level validation. Repository policy and adoption are not another completion checklist here.

## Built

- [x] A shipped `pr-description` skill and selection through `package.json.shivaedevSkills`.
- [x] Real copies of selected skill folders, including supporting files, and relative links from the Claude skill directory to the agent skill directory.
- [x] A manifest recording package version, copied-folder hashes and package ownership of names.
- [x] Sync replacement of managed copies, removal of deselected managed skills, coexistence with local skills and refusal of unowned name collisions before changes begin.
- [x] A check for missing manifest or copies, changed installed version, selection differences and copied-file edits, additions or removals.
- [x] CLI coverage using the shipped skill and a packed executable case that checks its copied files and version.
- [x] An opt-in pnpm GitHub Actions template for syncing shared skills on same-repository pull requests. Its configuration is present; live GitHub permissions and pushes are not validated by the package tests.

## Next

- [ ] Add focused tests for the existing helper validation paths, including malformed selection and manifest files.
- [ ] Add a test of the workflow configuration before making stronger claims about its composition. Hosted execution remains a separate validation task.

## Open questions

- Is `check` intentionally limited to the manifest's names, version and copied-folder hashes, or should it also compare the installed source at the same package version and verify Claude links? The implementation establishes the narrower check; tests do not establish why that boundary was chosen.
- Are the helper modules exposed by the wildcard export map intended as supported integration APIs, or should the package keep its public surface to sync, check and the executable? Existing adoption uses the executable; tests use the helpers.
- Which additional shared skill is worth maintaining here? Let a repository's repeated need decide the next skill rather than building an instruction catalogue in advance.
