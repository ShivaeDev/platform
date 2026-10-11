### Added

- `currentResponses(responses)` selects the latest response per author before applying explicit supersession, using recorded time and response identity to order ties. Managed request acknowledgements use the same selection, so a later answer from one author can close the question while different authors remain competing.
