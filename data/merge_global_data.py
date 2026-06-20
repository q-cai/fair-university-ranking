import pandas as pd
import os

script_dir = os.path.dirname(os.path.abspath(__file__))
WIKIDATA_FILE = os.path.join(script_dir, "wikidata_faculty.csv")
ORCID_FILE = os.path.join(script_dir, "orcid_faculty.csv")
OUTPUT_FILE = os.path.join(script_dir, "edge_lists_global_fair.csv")

def merge_datasets():
    frames = []
    
    if os.path.exists(WIKIDATA_FILE):
        print(f"Loading Wikidata data from {WIKIDATA_FILE}...")
        wiki_df = pd.read_csv(WIKIDATA_FILE)
        frames.append(wiki_df)
    else:
        print(f"Wikidata file not found: {WIKIDATA_FILE}")
        
    if os.path.exists(ORCID_FILE):
        print(f"Loading ORCID data from {ORCID_FILE}...")
        orcid_df = pd.read_csv(ORCID_FILE)
        frames.append(orcid_df)
    else:
        print(f"ORCID file not found: {ORCID_FILE}")
        
    if not frames:
        print("Error: No datasets found to concatenate!")
        return

    print("Concatenating and aggregating datasets...")
    # Concatenate all frames
    combined_df = pd.concat(frames, ignore_index=True)
    
    # Aggregate counts for duplicate edges
    grouped_df = combined_df.groupby(['TaxonomyLevel', 'InstitutionName', 'DegreeInstitutionName']).sum().reset_index()
    
    # Keep only Academia edges
    final_df = grouped_df[grouped_df['TaxonomyLevel'] == 'Academia']
    
    # Save global dataset
    final_df.to_csv(OUTPUT_FILE, index=False)
    print(f"Global dataset saved to {OUTPUT_FILE} with {len(final_df)} edges.")

if __name__ == "__main__":
    merge_datasets()
