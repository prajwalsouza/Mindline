# Product data

Mindline runs from the six CSVs in [`synthetic_microbiology_dataset/`](synthetic_microbiology_dataset/). All records are synthetic. Preserve their source bytes and supplier README; `.gitattributes` prevents automatic line-ending conversion.

The active loader is `data-prep/simulator/feedsim/data.py`. The application reads these CSVs directly; no generated SQLite database, earlier prototype directory or external patient-level download is required.

- [Supplier description](synthetic_microbiology_dataset/README.md): fields, generation assumptions and limitations.
- [Data dictionary](DATA_DICTIONARY.md): meaning of the source columns.
- [Counting rules](COUNTING_RULES.md): samples, isolates, susceptibility results and cohort caveats.
- [Source and license record](../docs/DATA-SOURCES.md): provenance and the private redistribution boundary.

A culture is a submitted sample; an isolate is an organism found in it; a susceptibility row is one reported organism–antibiotic test. Keep these denominators separate. The source does not provide treatment outcomes or a complete patient clinical history.

Earlier analysis notebooks and data-pipeline experiments remain outside this product repository. Documentation of their schemas is retained only where it helps explain the source; they are not runtime dependencies.
