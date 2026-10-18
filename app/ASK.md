# Ask in Insights

The search field below Insights accepts a question or a previously saved suggestion. An answer replaces the overview with a focused question view. Text appears first, then a chart skeleton resolves into one of the existing interactive charts. Back to Insights restores the overview. Reduced-motion mode shows blocks without the reveal animation.

## Demo

```powershell
python app/server.py 8802
```

The default is **cache only**. Seven GPT-6 Luna answers are saved in `answers/ask_cache.json`, including their chart data, original model output, model name, generation time and data date. They work without a Codex process or model call. An unanswered question offers saved alternatives; it does not silently invent a response.

Answers are dated snapshots. Changing the simulation clock does not re-date or recompute a saved answer. Each embedded chart shows its population and time window. The current examples use the supplied synthetic data through **27 September 2026**. They are English-language examples; the surrounding app still supports its existing languages.

## Live development mode

```powershell
$env:MINDLINE_ASK = 'live'
$env:MINDLINE_ASK_MODEL = 'gpt-6-luna'
python app/server.py 8802
```

The server finds the bundled Codex executable on this Windows installation, or `codex` on PATH. Set `MINDLINE_CODEX` to override it. Existing Codex authentication is reused; no API key is embedded in the app. Codex runs in a temporary empty working directory with a read-only sandbox, no user MCP configuration, shell tools disabled, apps disabled and web search disabled. It receives computed aggregates and a chart catalogue, not patient records.

The model emits JSON blocks: explanation, chart choice, optional number and follow-up questions. The server validates chart names and parameters and supplies the chart data itself. It does **not** execute generated HTML, JavaScript or analysis code. This is a constrained composition demo; a question requiring an analysis outside the catalogue should receive an explicit limitation.

Live jobs expose validated blocks as completed Codex messages become available. The CLI may deliver a whole answer in one message; the UI then reveals its blocks sequentially. This is not guaranteed token-by-token model streaming. Saved answers use the same sequential presentation.

Admin → **Answers** lists active jobs with Stop, completed/stopped/error jobs, and the saved answer cache. Stop terminates the model process and prevents the answer from being saved. There is a 120-second timeout and a maximum of two concurrent jobs; identical concurrent questions share a job. Completed answers persist across server restarts. Forget removes a saved answer so it can be regenerated in live mode.

## Reproduce the sample run

```powershell
python app/seed_answers.py --refresh
python -m unittest discover -s app -p 'test_*.py' -v
```

This explicit development command makes seven model calls. Ordinary server startup does not. The current samples cover trimethoprim trends, ward deviations, counts versus sampling, changing drug associations, annual versus recent evidence, missing-data weeks, and patient-group differences.

The first run exposed missing sample-count facts and overly broad wording. The digest now includes both tested and resistant counts, attribution to sampling versus share, and chart populations/periods. The prompt asks for plain language, preserves uncertainty, and avoids treating susceptibility as treatment success. Known drug/ward codes are expanded to display names; duplicate or invalid chart picks are dropped. The final sample explanations were reviewed against their supplied figures. Model prose is not automatically fact-proven: arbitrary new answers still need review before presentation.

Browser verification covered autocomplete, Enter/Ask submission, multiple charts, the unknown-question path, returning to Insights, leaving during a reveal, and stopping a real live GPT-6 Luna job through Admin. Cancellation and cached-only behavior also have offline regression tests.
