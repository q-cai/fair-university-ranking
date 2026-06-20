# FairRank: Open Faculty-Placement Prestige Rankings

FairRank is a data-driven university faculty-placement prestige signal. Unlike traditional rankings (like QS or Times Higher Education) that rely partly on surveys, resources, or broad research metrics, FairRank focuses on one specific question: where do universities' PhD graduates go on to hold faculty positions?

It uses **Weighted PageRank** to estimate how strongly universities place PhD graduates into influential faculty employers. It is best read as an open academic placement-prestige metric, not a complete measure of university quality.

---

## 🔗 Live Online Dashboard
The interactive visualization dashboard is hosted live online:
👉 **[https://q-cai.github.io/fair-university-ranking/web/](https://q-cai.github.io/fair-university-ranking/web/)**

*Explore the force-directed D3.js network graph showing prestige flows and the side-by-side FairRank vs. QS Rank comparison.*

---

## 💡 Methodology & Core Concepts

### 1. The PhD-to-Faculty Placement Network
Faculty-placement prestige is modeled as a **directed graph ($G$)**:
* **Nodes**: Universities (e.g., Harvard, MIT, Cambridge, Tokyo).
* **Directed Edges ($A \rightarrow B$)**: Institution $A$ hires a faculty member who received their PhD from Institution $B$. 
* **Prestige Flow**: An edge is directed from the **Hirer $\rightarrow$ Alma Mater**. This represents the hiring institution "endorsing" the degree-granting institution. Prestige flows from the employer back to the training institution.
* **Weights**: The number of faculty members hired. Self-loops (hiring one's own PhD graduates) are removed from the ranking graph.

### 2. Weighted PageRank Calculation
We calculate prestige using Google's classic **PageRank algorithm** on the directed placement graph:
$$\text{PR}(u) = \frac{1-\alpha}{N} + \alpha \sum_{v \in B_u} \frac{\text{PR}(v) \cdot W(v, u)}{L(v)}$$
* **Damping Factor ($\alpha = 0.85$)**: Standard PageRank decay to simulate random academic transitions.
* **Absolute Score**: Ranks are based on the absolute PageRank score, so the metric reflects both placement volume and the prestige of hiring institutions.

---

## 🗄️ Data Sources

FairRank uses globally available open data sources, but coverage is still imperfect and should be interpreted with care:

1. **Wikidata SPARQL**: Querying structured data for academic occupations (Professors, Associate Professors, etc.) and matching their current employer (`P108`) with their alma mater (`P69`). Consolidates **10,794** global edges.
2. **OpenAlex API**: Fetches the top 100 most-cited researchers possessing an ORCID profile for each mapped QS university. Mappings are strictly filtered using `type:education` to isolate main campuses.
3. **ORCID API**: Queries ORCID profiles in parallel (utilizing a thread pool with rate-limit backoffs) to extract verified PhD-level education summaries. Consolidates **1,880** global edges.

Combined, this yields an open global network of **12,473 edges** spanning most of the QS Top 100 universities.

---

## 🛠️ Methodological Highlights

* **Entity Resolution (Name Normalization)**: Raw datasets contain massive name fragmentation (e.g., *University of California, Berkeley*, *UC Berkeley*, *University of California Berkeley College of Chemistry*). `fair_ranking.py` runs a normalization layer *before* building the graph to aggregate all incoming edges into a single canonical node, preventing score leakage.
* **Parenthetical Search Cleaning**: Automated mapping cleans search strings (e.g., stripping `(MIT)` to search only for `Massachusetts Institute of Technology`), resolving issues where sub-institutes or joint research facilities were matched instead of main campuses.
* **Bias Caveats**: Wikidata coverage, ORCID adoption, citation visibility, language, institution size, and field mix can all affect the observed network.

---

## 📂 Project Structure

* `data/build_qs_mapping.py`: Clean-queries OpenAlex for correct main-campus IDs (`type:education`) and wikidata QIDs. Outputs `qs_institutions.json`.
* `data/fetch_openalex_orcid.py`: High-performance, concurrent scraper querying ORCID for the top 100 cited researchers per university. Outputs `orcid_faculty.csv`.
* `data/merge_global_data.py`: Merges and aggregates ORCID and Wikidata edge lists. Outputs `edge_lists_global_fair.csv`.
* `fair_ranking.py`: Performs name normalization, builds the directed graph, runs PageRank, and exports web data. Outputs `output/fair_university_rankings.csv` and `web/data.json`.
* `web/`: Frontend dashboard containing:
  - Interactive comparison table of FairRank vs. QS Rank.
  - A premium D3.js force-directed network graph visualizing the Top 20 academic flow topology.

---

## 🚀 How to Run Locally

### 1. Prerequisites
Install required Python libraries:
```bash
pip install pandas networkx requests
```

### 2. Execute Data Pipeline
Run the pipeline sequentially to reconstruct the ranking from scratch:
```bash
# 1. Resolve correct main-campus OpenAlex mappings
python3 data/build_qs_mapping.py

# 2. Scrape top scholars and fetch ORCID education histories
python3 data/fetch_openalex_orcid.py

# 3. Merge Wikidata & ORCID edge lists
python3 data/merge_global_data.py

# 4. Compute PageRank rankings and export web data
python3 fair_ranking.py
```

### 3. Launch Frontend Web UI
Start a local HTTP server from the project root:
```bash
python3 -m http.server 8080
```
Open your browser and navigate to **[http://localhost:8080/web/](http://localhost:8080/web/)** to explore the rankings and the interactive network visualization.
