# RLHF Evaluation Dashboard

A browser-based practice workspace for **human-style evaluation** tasks similar to RLHF workflows: you compare model responses (**option selection**) or diagnose short traces (**reason taking**). The app tracks accuracy, time, and session progress locally in your browser.

## What this tool does

1. **Option selection** — You see a prompt and two candidate answers. Pick the stronger response (more accurate, specific, and useful). Your choice is scored against a reference preference.
2. **Reason taking** — You see a short system trace (log lines, HTTP hints, etc.). Submit a short **root-cause** diagnosis; it is checked against an expected keyword rubric (case-insensitive substring match).
3. **Difficulty** — Items are filtered **strictly** by difficulty (**Easy**, **Medium**, **Hard**). Only questions that match both your **section** and **difficulty** appear—no mixing of difficulties in one run.
4. **Section timer** — One shared countdown for the whole run: **total minutes = number of questions** in that section (e.g. 7 questions → 7 minutes). The clock pauses while the root-cause modal is open. If time hits zero before you submit, the current item is recorded with no answer and you move on; when the clock ends mid-run, a **session ended** dialog can appear with your running score.
5. **Progress & analytics** — Session progress bar, totals, accuracy, and a small running-accuracy chart (with difficulty/section noted on the chart).
6. **Skips** — **Skip / next task** records the item as skipped (counts as incorrect) so you can still reach a full section and trigger the completion flow.

## What you can do

- **Restart** — Opens **Configure evaluation**: choose **section** (option selection vs reason taking) and **difficulty**, then **Start**. That starts a **new** run: clears the current attempt list, resets the section timer, and resets charts for a clean session.
- **Download Result** — Exports your current run data as a JSON file (see below). Use this **after** you finish a section or whenever you want a snapshot of what is stored in the browser.
- **Session end dialogs** — When you finish **every** question in the section (answered, skipped, or time-lapsed), or when the **section timer** ends before everything is graded, a dialog shows your **accuracy** and lets you pick another section/difficulty or download results first.

Preferences (section + difficulty) and attempt history are saved in **local storage** so a refresh can resume the same setup until you start a new section from the dialog.

## How to export test results (at the end)

1. Finish your run (or pause whenever you want a file snapshot).
2. Click **Download Result** in the top bar (next to **Restart**).
3. Your browser downloads a file such as `rlhf-eval-results.json`.

The export includes:

- **`exportedAt`** — ISO timestamp.
- **`selectedSection`** / **`selectedDifficulty`** — What you chose for that run.
- **`datasetSize`** — Number of questions in the filtered section.
- **`runGradedTotal`**, **`runCorrectTotal`**, **`runAccuracyPercent`** — Overall counts for everything in the exported `attempts` list.
- **`attempts`** — One object per graded item, including:
  - **`question`**, **`rightAnswer`**, **`givenAnswer`**
  - **`result`** (true/false)
  - **`reason`** (why it was wrong, when applicable)
  - **`difficulty`**, **`taskType`**, **`timedOut`**, **`skipped`**, etc.

You can open the JSON in any text editor or ingest it into a notebook, spreadsheet, or pipeline.

## Try it locally

From the folder that contains `index.html`:

```bash
npx --yes serve -l 8765
```

Then open `http://localhost:8765` in your browser.
