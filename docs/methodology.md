# Methodology

TrendInPath analyzes recent pathology literature using a simple topic detection pipeline.

## Article Retrieval

Articles are retrieved from PubMed for a curated list of pathology journals within a rolling 90-day window.

## Filtering

Publications are filtered to remove low-signal entries such as:

- Case reports
- Editorials
- Letters
- Short abstracts

## Feature Extraction

Topic clustering uses:

- Article titles
- MeSH terms
- Author keywords

These fields provide stronger topical signals than full abstracts.

## Topic Clustering

Articles are grouped into clusters based on text similarity.

Clusters below a coherence threshold are discarded.

## Trend Detection

Each cluster is compared across two time periods:

- Recent window (last 30 days)
- Baseline window (previous 60 days)

This allows topics to be labeled as:

- Rising
- Stable
- Declining

## Limitations

TrendInPath is an experimental tool and may not capture all relevant research developments.
