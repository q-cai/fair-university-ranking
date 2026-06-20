import json
import requests
import time
import pandas as pd

MAPPING_FILE = "qs_institutions.json"
OUTPUT_FILE = "wikidata_faculty.csv"

# Batch size for QIDs to avoid 60s timeout
BATCH_SIZE = 15

SPARQL_URL = "https://query.wikidata.org/sparql"
HEADERS = {
    "User-Agent": "GlobalXRankBot/1.0 (mailto:test@example.com) Python/3.10",
    "Accept": "application/sparql-results+json"
}

def get_wikidata_qids():
    with open(MAPPING_FILE, 'r') as f:
        data = json.load(f)
    
    # Create mapping from QID to QS Name
    qid_to_qsname = {}
    for qs_name, info in data.items():
        if info.get('wikidata_id'):
            qid_to_qsname[info['wikidata_id']] = qs_name
            
    return qid_to_qsname

def query_wikidata(qids):
    qid_values = " ".join([f"wd:{qid}" for qid in qids])
    
    query = f"""
    SELECT ?university ?person ?almaMater ?almaMaterLabel WHERE {{
      VALUES ?university {{ {qid_values} }}
      ?person wdt:P108 ?university .
      ?person wdt:P106 ?occupation .
      VALUES ?occupation {{ wd:Q121594 wd:Q1622272 wd:Q121590 }}
      ?person wdt:P69 ?almaMater .
      SERVICE wikibase:label {{ bd:serviceParam wikibase:language "[AUTO_LANGUAGE],en". }}
    }}
    """
    
    try:
        response = requests.get(SPARQL_URL, headers=HEADERS, params={'query': query})
        response.raise_for_status()
        return response.json()['results']['bindings']
    except Exception as e:
        print(f"Error executing SPARQL query: {e}")
        return []

def main():
    print(f"Loading QIDs from {MAPPING_FILE}")
    qid_to_qsname = get_wikidata_qids()
    all_qids = list(qid_to_qsname.keys())
    
    print(f"Total QIDs to process: {len(all_qids)}")
    
    results = []
    
    # Process in batches
    for i in range(0, len(all_qids), BATCH_SIZE):
        batch = all_qids[i:i + BATCH_SIZE]
        print(f"Processing batch {i//BATCH_SIZE + 1} ({len(batch)} institutions)...")
        
        bindings = query_wikidata(batch)
        print(f"  -> Found {len(bindings)} faculty records")
        
        for item in bindings:
            university_qid = item['university']['value'].split('/')[-1]
            alma_mater_name = item['almaMaterLabel']['value']
            
            # Skip if Wikidata returned a QID instead of label
            if alma_mater_name.startswith('Q') and alma_mater_name[1:].isdigit():
                continue
                
            results.append({
                'TaxonomyLevel': 'Academia',
                'InstitutionName': qid_to_qsname.get(university_qid, university_qid),
                'DegreeInstitutionName': alma_mater_name,
                'Total': 1.0 # Each person counts as 1
            })
            
        time.sleep(2) # Respect Wikidata limits
        
    df = pd.DataFrame(results)
    if not df.empty:
        # Group by Institution and Degree Institution to get counts
        grouped = df.groupby(['TaxonomyLevel', 'InstitutionName', 'DegreeInstitutionName']).sum().reset_index()
        grouped.to_csv(OUTPUT_FILE, index=False)
        print(f"Saved {len(grouped)} aggregated edges to {OUTPUT_FILE}")
    else:
        print("No results found.")

if __name__ == "__main__":
    main()
