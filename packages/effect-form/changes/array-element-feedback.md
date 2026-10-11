### Added

- `submitter.fail` accepts nested path tuples, and `errorAt` shows typed handler rejections beside Schema messages for individual array elements.
- Optional typed `arrayKeys` selectors keep element rejections with their keys through insertion, removal and reorder, including late save responses. Changed or removed inputs discard their rejection; arrays without selectors use index paths.
