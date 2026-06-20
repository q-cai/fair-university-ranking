# XRank: Global Academic Prestige Rankings

XRank is a data-driven, globally fair university prestige ranking system. Unlike traditional rankings (like QS or Times Higher Education) that rely on subjective surveys or financial metrics, XRank computes academic prestige by analyzing the global **PhD-to-Faculty employment network**. 

It uses **Weighted PageRank** to determine how effectively universities train PhD graduates who are subsequently hired into faculty positions at top-tier institutions worldwide.

---

## 🔗 Live Online Dashboard
The interactive visualization dashboard is hosted live online:
👉 **[https://q-cai.github.io/fair-university-ranking/web/](https://q-cai.github.io/fair-university-ranking/web/)**

*Explore the force-directed D3.js network graph showing prestige flows and the side-by-side XRank vs. QS Rank comparison.*

---

## 💡 Methodology & Core Concepts

### 1. The PhD-to-Faculty Placement Network
Academic prestige is defined as the ability to produce top-tier scholars. XRank models this as a **directed graph ($G$)**:
* **Nodes**: Universities (e.g., Harvard, MIT, Cambridge, Tokyo).
* **Directed Edges ($A \rightarrow B$)**: Institution $A$ hires a faculty member who received their PhD from Institution $B$. 
* **Prestige Flow**: An edge is directed from the **Hirer $\rightarrow$ Alma Mater**. This represents the hiring institution "endorsing" the degree-granting institution. Prestige flows from the employer back to the training institution.
* **Weights**: The number of faculty members hired. Self-loops (hiring one's own PhD graduates) are removed to prevent inbreeding biases.

### 2. Weighted PageRank Calculation
We calculate prestige using Google's classic **PageRank algorithm** on the directed placement graph:
$$\text{PR}(u) = \frac{1-\alpha}{N} + \alpha \sum_{v \in B_u} \frac{\text{PR}(v) \cdot W(v, u)}{L(v)}$$
* **Damping Factor ($\alpha = 0.85$)**: Standard PageRank decay to simulate random academic transitions.
* **Absolute Score**: Ranks are based on the absolute prestige score, ensuring that large, historically dominant research institutions are justly evaluated.

---

## 🗄️ Data Sources (Globally Fair & Uniform)

To eliminate regional census bias (e.g., historical datasets only covering US universities), XRank is built entirely on globally uniform open APIs:

1. **Wikidata SPARQL**: Querying structured data for academic occupations (Professors, Associate Professors, etc.) and matching their current employer (`P108`) with their alma mater (`P69`). Consolidates **10,794** global edges.
2. **OpenAlex API**: Fetches the top 100 most-cited researchers possessing an ORCID profile for each mapped QS university. Mappings are strictly filtered using `type:education` to isolate main campuses.
3. **ORCID API**: Queries ORCID profiles in parallel (utilizing a thread pool with rate-limit backoffs) to extract verified PhD-level education summaries. Consolidates **1,880** global edges.

Combined, this yields a robust, un-biased global network of **12,473 edges** spanning **95** of the QS Top 100 universities.

---

## 🛠️ Methodological Highlights

* **Entity Resolution (Name Normalization)**: Raw datasets contain massive name fragmentation (e.g., *University of California, Berkeley*, *UC Berkeley*, *University of California Berkeley College of Chemistry*). `xrank.py` runs a normalization layer *before* building the graph to aggregate all incoming edges into a single canonical node, preventing score leakage.
* **Parenthetical Search Cleaning**: Automated mapping cleans search strings (e.g., stripping `(MIT)` to search only for `Massachusetts Institute of Technology`), resolving issues where sub-institutes or joint research facilities were matched instead of main campuses.
* **No Regional Bias**: Evaluates US and non-US schools under the exact same API-driven sampling criteria.

---

## 📂 Project Structure

* `data/build_qs_mapping.py`: Clean-queries OpenAlex for correct main-campus IDs (`type:education`) and wikidata QIDs. Outputs `qs_institutions.json`.
* `data/fetch_openalex_orcid.py`: High-performance, concurrent scraper querying ORCID for the top 100 cited researchers per university. Outputs `orcid_faculty.csv`.
* `data/merge_global_data.py`: Merges and aggregates ORCID and Wikidata edge lists. Outputs `edge_lists_global_fair.csv`.
* `xrank.py`: Performs name normalization, builds the directed graph, runs PageRank, and exports web data. Outputs `output/xrank_rankings.csv` and `web/data.json`.
* `web/`: Frontend dashboard containing:
  - Interactive comparison table of XRank vs. QS Rank.
  - A premium D3.js force-directed network graph visualizing the Top 20 academic flow topology.

---

## 🚀 How to Run Locally

### 1. Prerequisites
Install required Python libraries:
```bash
pip install pandas networkx requests
```

OpenAlex does not require an API key for basic usage. If you have one, provide it via an environment variable instead of editing the scripts:
```bash
export OPENALEX_API_KEY="your-openalex-key"
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
python3 xrank.py
```

### 3. Launch Frontend Web UI
Start a local HTTP server from the project root:
```bash
python3 -m http.server 8080
```
Open your browser and navigate to **[http://localhost:8080/web/](http://localhost:8080/web/)** to explore the rankings and the interactive network visualization.
