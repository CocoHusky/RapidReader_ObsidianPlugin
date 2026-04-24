# Rapid Reader Cleanup Process

This document defines exactly how text is normalized before token display/playback.

## Pipeline order

1. **Markdown structural cleanup**
   - fenced code blocks -> `[code block]` (if enabled)
   - images -> `[image]`
   - markdown links -> label text
   - inline code -> `[code]` (if enabled)
   - heading markers (`#`) removed
   - emphasis markers (`**`, `_`, `~~`) removed
   - table rows -> `[table]`

2. **Reader normalization cleanup**
   - remove numeric citations (`[17]`, `[17](url)`) if enabled
   - remove URLs/DOIs if enabled
   - split hyphenated words if enabled
     - `macro-electrodes` -> `macro electrodes`
   - unwrap short acronym parentheses
     - `(IR)` -> `IR`
   - unwrap parenthesized measurement/symbol chunk
     - `(>200 µm)` -> `>200 µm`
   - remove noisy symbols if enabled
     - quotes/backticks/tilde and bracket noise cleaned
   - collapse punctuation noise
     - `.,` -> `.`
     - `,.` -> `.`
     - `...` -> `.`
     - repeated punctuation like `,,` or `!!!` -> single char

3. **Whitespace normalization**
   - repeated spaces collapsed
   - excessive newlines normalized

## Settings that control cleanup

- `Replace code blocks`
- `Replace inline code`
- `Replace URLs during simplify`
- `Remove links in reader`
- `Remove noisy symbols`
- `Split hyphenated words`
- `Strip numeric citations`

## Timing behavior

- Base delay = `60000 / WPM`
- Sentence ending `.` applies punctuation profile *and* `sentencePauseMultiplier`
- `sentencePauseMultiplier` range is `1.0` to `10.0`

## Examples

### Citation + link removal

Input:

`communication[17](https://example.com/ref17 "...")`

Output (with citation/link cleanup enabled):

`communication`

### Parenthesized acronym

Input:

`infrared (IR) communication`

Output:

`infrared IR communication`

### Hyphen split

Input:

`macro-electrodes (>200 µm)`

Output:

`macro electrodes >200 µm`

### Symbol noise

Input:

`Information ...,. "quoted"`

Output:

`Information. quoted`
