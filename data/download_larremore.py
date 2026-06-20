import os
import urllib.request
import pandas as pd

def download_file(url, filename):
    print(f"Downloading {filename}...")
    try:
        urllib.request.urlretrieve(url, filename)
        print(f"Successfully downloaded {filename}")
    except Exception as e:
        print(f"Error downloading {filename}: {e}")

def main():
    # Base URL for the Larremore Lab data
    base_url = "https://raw.githubusercontent.com/LarremoreLab/us-faculty-hiring-networks/main/data"
    
    # Files to download
    files = {
        "edge_lists.csv": f"{base_url}/edge-lists.csv",
        "institution_stats.csv": f"{base_url}/institution-stats.csv",
        "stats.csv": f"{base_url}/stats.csv"
    }
    
    # Ensure data directory exists
    os.makedirs(os.path.dirname(__file__), exist_ok=True)
    
    for filename, url in files.items():
        filepath = os.path.join(os.path.dirname(__file__), filename)
        if not os.path.exists(filepath):
            download_file(url, filepath)
        else:
            print(f"File {filename} already exists, skipping download.")

if __name__ == "__main__":
    main()
