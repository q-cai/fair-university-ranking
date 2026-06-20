import pandas as pd
import requests
import json
import time
import re
import os

API_KEY = ""
script_dir = os.path.dirname(os.path.abspath(__file__))
QS_FILE = os.path.join(script_dir, "qs_top100.csv")
OUTPUT_FILE = os.path.join(script_dir, "qs_institutions.json")

def clean_search_name(name):
    # remove parenthetical text to avoid search relevance distortion
    name = re.sub(r'\(.*?\)', '', name)
    return name.strip()

def get_institution_info(name):
    clean_name = clean_search_name(name)
    url = "https://api.openalex.org/institutions"
    params = {
        "search": clean_name,
        "filter": "type:education",
        "api_key": API_KEY
    }
    try:
        response = requests.get(url, params=params)
        response.raise_for_status()
        data = response.json()
        if data.get('results') and len(data['results']) > 0:
            top_result = data['results'][0]
            openalex_id = top_result['id'].split('/')[-1]
            wikidata_id = None
            if top_result.get('ids') and top_result['ids'].get('wikidata'):
                wikidata_id = top_result['ids']['wikidata'].split('/')[-1]
            
            return {
                "openalex_id": openalex_id,
                "wikidata_id": wikidata_id,
                "name": top_result['display_name']
            }
    except Exception as e:
        print(f"Error fetching {name}: {e}")
    return None

def main():
    print(f"Loading {QS_FILE}...")
    qs_df = pd.read_csv(QS_FILE)
    
    institutions = {}
    
    for idx, row in qs_df.iterrows():
        qs_name = row['University']
        print(f"Fetching mapping for: {qs_name}")
        info = get_institution_info(qs_name)
        if info:
            institutions[qs_name] = info
            print(f"  -> Matched display_name: {info['name']} (ID: {info['openalex_id']})")
        else:
            print(f"  -> Could not find info for {qs_name}")
            institutions[qs_name] = {"openalex_id": None, "wikidata_id": None, "name": qs_name}
        time.sleep(0.05) # Be polite but fast
        
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(institutions, f, indent=2)
    print(f"Saved mappings to {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
