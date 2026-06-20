import json
import requests
import time
import pandas as pd
import sys
import os
import concurrent.futures

sys.stdout.reconfigure(line_buffering=True)

API_KEY = ""
script_dir = os.path.dirname(os.path.abspath(__file__))
MAPPING_FILE = os.path.join(script_dir, "qs_institutions.json")
OUTPUT_FILE = os.path.join(script_dir, "orcid_faculty.csv")

# Set to 100 for production-grade dataset
MAX_AUTHORS_PER_UNI = 100 
CONCURRENT_WORKERS = 12

def make_request_with_retry(url, headers=None, params=None, timeout=10, max_retries=5):
    backoff = 0.5
    for attempt in range(max_retries):
        try:
            response = requests.get(url, headers=headers, params=params, timeout=timeout)
            if response.status_code in [200, 404]:
                return response
            elif response.status_code == 429:
                # Rate limit hit, backoff and retry
                time.sleep(backoff)
                backoff *= 2
            else:
                # Other server error, retry
                time.sleep(backoff)
                backoff *= 2
        except Exception:
            time.sleep(backoff)
            backoff *= 2
    return None

def get_top_authors_with_orcid(openalex_id):
    url = f"https://api.openalex.org/authors"
    params = {
        "filter": f"last_known_institutions.id:{openalex_id},has_orcid:true",
        "sort": "cited_by_count:desc",
        "per_page": MAX_AUTHORS_PER_UNI,
        "api_key": API_KEY
    }
    response = make_request_with_retry(url, params=params)
    if not response or response.status_code != 200:
        return []
    
    try:
        data = response.json()
        orcids = []
        for author in data.get('results', []):
            orcid_url = author.get('orcid')
            if orcid_url:
                orcids.append(orcid_url.split('/')[-1])
        return orcids
    except Exception as e:
        print(f"\n  Error parsing OpenAlex authors for {openalex_id}: {e}", flush=True)
        return []

def get_orcid_education(orcid):
    # Be polite to ORCID API by adding a tiny delay
    time.sleep(0.05)
    
    url = f"https://pub.orcid.org/v3.0/{orcid}/educations"
    headers = {"Accept": "application/json"}
    
    response = make_request_with_retry(url, headers=headers)
    if not response or response.status_code != 200:
        return []
        
    try:
        data = response.json()
        phd_institutions = []
        
        # Navigate the deeply nested ORCID JSON
        if 'affiliation-group' in data:
            for group in data['affiliation-group']:
                for summary_obj in group.get('summaries', []):
                    summary = summary_obj.get('education-summary', {})
                    
                    # Look for PhD/Doctoral degrees
                    role = str(summary.get('role-title') or '').lower()
                    if 'phd' in role or 'dphil' in role or 'doctor' in role:
                        org = summary.get('organization', {})
                        org_name = org.get('name')
                        if org_name:
                            phd_institutions.append(org_name)
                            
        return phd_institutions
    except Exception as e:
        # Don't print stack trace to avoid flooding stdout in parallel execution
        pass
    return []

def main():
    print(f"Loading {MAPPING_FILE}...", flush=True)
    with open(MAPPING_FILE, 'r') as f:
        institutions = json.load(f)
        
    results = []
    tasks = []
    
    # 1. Query OpenAlex to find the top authors with ORCID for each university
    total_unis = len([i for i in institutions.values() if i.get('openalex_id')])
    processed = 0
    
    print("Querying OpenAlex API for top cited authors with ORCIDs...", flush=True)
    for qs_name, info in institutions.items():
        openalex_id = info.get('openalex_id')
        if not openalex_id:
            continue
            
        processed += 1
        print(f"[{processed}/{total_unis}] Querying {qs_name}...", end="", flush=True)
        
        orcids = get_top_authors_with_orcid(openalex_id)
        print(f" -> Found {len(orcids)} ORCID profiles", flush=True)
        
        for orcid in orcids:
            tasks.append((orcid, qs_name))
            
    print(f"\nTotal authors to query: {len(tasks)}", flush=True)
    print(f"Querying ORCID API for education histories in parallel (workers={CONCURRENT_WORKERS})...", flush=True)
    
    completed = 0
    total_tasks = len(tasks)
    
    def process_task(task):
        orcid, qs_name = task
        phd_orgs = get_orcid_education(orcid)
        return qs_name, phd_orgs

    with concurrent.futures.ThreadPoolExecutor(max_workers=CONCURRENT_WORKERS) as executor:
        futures = {executor.submit(process_task, t): t for t in tasks}
        
        for future in concurrent.futures.as_completed(futures):
            completed += 1
            qs_name, phd_orgs = future.result()
            
            # Print progress every 100 tasks or at the end
            if completed % 100 == 0 or completed == total_tasks:
                print(f"Progress: {completed}/{total_tasks} ({completed/total_tasks*100:.1f}%) ORCIDs processed...", flush=True)
                
            for org_name in phd_orgs:
                results.append({
                    'TaxonomyLevel': 'Academia',
                    'InstitutionName': qs_name,
                    'DegreeInstitutionName': org_name,
                    'Total': 1.0
                })
                
    df = pd.DataFrame(results)
    if not df.empty:
        grouped = df.groupby(['TaxonomyLevel', 'InstitutionName', 'DegreeInstitutionName']).sum().reset_index()
        grouped.to_csv(OUTPUT_FILE, index=False)
        print(f"\nSaved {len(grouped)} aggregated edges to {OUTPUT_FILE}", flush=True)
    else:
        print("\nNo results found.", flush=True)

if __name__ == "__main__":
    main()
