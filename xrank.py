import pandas as pd
import networkx as nx
import os
import re

def clean_name(name):
    """Normalize university names for matching."""
    name = str(name).lower()
    name = re.sub(r'\(.*?\)', '', name) # remove text in parentheses
    name = name.replace('university of', '').replace('university', '')
    name = name.replace('institute of technology', 'tech')
    name = name.replace('institutes of technology', 'tech')
    name = name.replace('college', '')
    name = name.replace(',', '')
    name = name.replace('-', ' ')
    name = name.replace('.', '')
    name = name.strip()
    if name.startswith('the '):
        name = name[4:]
    name = re.sub(r'\s+', ' ', name)
    return name.strip()

def get_canonical_name(name, canonical_list):
    """Map name variations to their canonical QS Top 100 names to avoid graph fragmentation."""
    if pd.isna(name):
        return name
    name_str = str(name).strip()
    
    manual_overrides = {
        'mit': 'Massachusetts Institute of Technology (MIT)',
        'caltech': 'California Institute of Technology (Caltech)',
        'uc berkeley': 'University of California Berkeley (UCB)',
        'ucla': 'University of California Los Angeles (UCLA)',
        'ucsd': 'University of California San Diego (UCSD)',
        'upenn': 'University of Pennsylvania',
        'nyu': 'New York University (NYU)',
        'ut austin': 'University of Texas at Austin',
        'uw': 'University of Washington',
        'georgia tech': 'Georgia Institute of Technology',
        'epfl': 'École Polytechnique Fédérale de Lausanne (EPFL)',
        'lse': 'London School of Economics and Political Science (LSE)',
        'hku': 'The University of Hong Kong (HKU)',
        'cuhk': 'The Chinese University of Hong Kong (CUHK)',
        'ust': 'The Hong Kong University of Science and Technology (HKUST)',
        'hkust': 'The Hong Kong University of Science and Technology (HKUST)',
        'polytechnique': 'Institut Polytechnique de Paris',
        'ecole polytechnique': 'Institut Polytechnique de Paris',
        
        # Manual overrides for global API mapping
        'michigan': 'University of Michigan-Ann Arbor',
        'tokyo': 'The University of Tokyo',
        'adelaide': 'The University of Adelaide',
        'queensland': 'The University of Queensland',
        'sydney': 'University of Sydney',
        'warwick': 'The University of Warwick',
        'auckland': 'The University of Auckland',
        'western australia': 'The University of Western Australia',
        'melbourne': 'University of Melbourne',
        'hong kong': 'The University of Hong Kong (HKU)',
        'chinese university of hong kong': 'The Chinese University of Hong Kong (CUHK)',
        'birmingham': 'University of Birmingham',
        'southampton': 'University of Southampton',
        'leeds': 'University of Leeds',
        'bristol': 'University of Bristol',
        'glasgow': 'University of Glasgow',
    }
    
    cleaned_input = clean_name(name_str)
    
    # Check overrides first
    if cleaned_input in manual_overrides:
        return manual_overrides[cleaned_input]
        
    # Check exact clean matches
    for c_name in canonical_list:
        if cleaned_input == clean_name(c_name):
            return c_name
            
    # Check substring matches (c_name is a substring of name)
    for c_name in canonical_list:
        cleaned_c = clean_name(c_name)
        if len(cleaned_c) > 3:
            if cleaned_c in cleaned_input:
                return c_name
                
    return name_str

def build_xrank_graph(edge_df, remove_self_loops=True):
    """Build directed graph for PageRank."""
    G = nx.DiGraph()
    
    for _, row in edge_df.iterrows():
        # Using Academia level for overall prestige
        if row['TaxonomyLevel'] != 'Academia':
            continue
            
        hirer = row['InstitutionName']
        degree = row['DegreeInstitutionName']
        weight = row['Total']
        
        if remove_self_loops and hirer == degree:
            continue
            
        if weight > 0:
            # An edge from Hirer -> Degree means Hirer "endorses" Degree
            # so prestige flows from Hirer to Degree
            if G.has_edge(hirer, degree):
                G[hirer][degree]['weight'] += weight
            else:
                G.add_edge(hirer, degree, weight=weight)
                
    return G

def calculate_xrank(G):
    """Calculate PageRank scores."""
    # alpha=0.85 is standard PageRank damping factor
    # max_iter=1000 to ensure convergence
    return nx.pagerank(G, alpha=0.85, weight='weight', max_iter=1000)

def calculate_net_flow(edge_df, target_universities):
    """Calculate net flow matrix between specific universities."""
    # Filter for academia only
    df = edge_df[edge_df['TaxonomyLevel'] == 'Academia']
    
    matrix = pd.DataFrame(0, index=target_universities, columns=target_universities)
    
    for _, row in df.iterrows():
        h = row['InstitutionName']
        d = row['DegreeInstitutionName']
        w = row['Total']
        
        if h in target_universities and d in target_universities:
            # Net flow from A to B = (A->B) - (B->A)
            # A produces PhD (d), B hires (h) -> A sends to B
            matrix.loc[d, h] += w
            matrix.loc[h, d] -= w
            
    return matrix

def main():
    print("Loading data...")
    # Load fair global data
    edge_file = 'data/edge_lists_global_fair.csv'
    if not os.path.exists(edge_file):
        print(f"Edge lists not found: {edge_file}")
        return
        
    edges = pd.read_csv(edge_file)
    
    # Load QS data
    qs_file = 'data/qs_top100.csv'
    qs_df = pd.read_csv(qs_file)
    canonical_names = qs_df['University'].tolist()
    
    # Apply name normalization to avoid fragmentation before building graph
    print("Normalizing names in edge lists...")
    edges['InstitutionName'] = edges['InstitutionName'].apply(lambda x: get_canonical_name(x, canonical_names))
    edges['DegreeInstitutionName'] = edges['DegreeInstitutionName'].apply(lambda x: get_canonical_name(x, canonical_names))
    
    # Build Graph
    print("Building hiring network graph...")
    G = build_xrank_graph(edges, remove_self_loops=True)
    
    # Calculate PageRank
    print("Calculating XRank scores...")
    pagerank_scores = calculate_xrank(G)
    
    # Calculate Total Placed (out-degree) for each university in the network
    print("Calculating Total Placed for normalization...")
    acad_edges = edges[edges['TaxonomyLevel'] == 'Academia']
    acad_edges_no_self = acad_edges[acad_edges['InstitutionName'] != acad_edges['DegreeInstitutionName']]
    total_placed = acad_edges_no_self.groupby('DegreeInstitutionName')['Total'].sum().to_dict()
    
    qs_df['XRank_Score'] = 0.0
    qs_df['Total_Placed'] = 0.0
    qs_df['Larremore_Name'] = None
    qs_df['Data_Available'] = False
    
    print("Matching universities and applying scores...")
    for idx, row in qs_df.iterrows():
        qs_name = row['University']
        
        # Since names are already normalized, we can match exactly using the canonical name
        if qs_name in pagerank_scores:
            qs_df.at[idx, 'XRank_Score'] = pagerank_scores[qs_name]
            qs_df.at[idx, 'Total_Placed'] = total_placed.get(qs_name, 1.0)
            qs_df.at[idx, 'Larremore_Name'] = qs_name
            qs_df.at[idx, 'Data_Available'] = True

    # Normalize score for easier reading (multiply by 1000)
    qs_df['XRank_Score'] = qs_df['XRank_Score'] * 1000
    
    # Sort by XRank
    xrank_df = qs_df.sort_values(by='XRank_Score', ascending=False)
    # Rank only universities that have data
    valid_mask = xrank_df['Data_Available'] == True
    xrank_df.loc[valid_mask, 'XRank'] = xrank_df.loc[valid_mask, 'XRank_Score'].rank(ascending=False, method='min')
    
    # Output to CSV
    os.makedirs('output', exist_ok=True)
    xrank_file = 'output/xrank_rankings.csv'
    xrank_df.to_csv(xrank_file, index=False)
    print(f"Saved rankings to {xrank_file}")
    
    # Print top 10 universities with data
    print("\nTop 10 Global Universities by XRank (QS Top 100):")
    ranked_unis = xrank_df[xrank_df['Data_Available'] == True]
    top_unis = ranked_unis.head(10)
    for idx, row in top_unis.iterrows():
        print(f"XRank: {int(row['XRank'])} | {row['University']} (QS: {row['Rank']}) - Score: {row['XRank_Score']:.4f}")
        
    # Generate net flow matrix for the top 20 universities with data
    top20_names = ranked_unis.head(20)['Larremore_Name'].tolist()
    flow_matrix = calculate_net_flow(edges, top20_names)
    flow_file = 'output/net_flow_matrix.csv'
    flow_matrix.to_csv(flow_file)
    print(f"\nSaved net flow matrix to {flow_file}")

    # ---- Export JSON for Web Visualization ----
    import json

    # Get all matched universities (with data)
    matched = xrank_df[xrank_df['Data_Available'] == True].copy()
    matched = matched.sort_values('XRank_Score', ascending=False)

    # Prepare rankings JSON
    rankings_json = []
    for _, row in matched.iterrows():
        rankings_json.append({
            'xrank': int(row['XRank']),
            'qs_rank': int(row['Rank']),
            'university': row['University'],
            'country': row['Country'],
            'score': round(row['XRank_Score'], 4),
            'total_placed': int(row['Total_Placed']),
            'larremore_name': row['Larremore_Name']
        })

    # Prepare network edges JSON (only top 20 universities for visualization)
    top_names = [r['larremore_name'] for r in rankings_json[:20]]
    acad_edges = edges[edges['TaxonomyLevel'] == 'Academia']
    network_edges = []
    for _, row in acad_edges.iterrows():
        h = row['InstitutionName']
        d = row['DegreeInstitutionName']
        w = row['Total']
        if pd.isna(w) or w <= 0:
            continue
        w = int(w)
        if h in top_names and d in top_names and h != d:
            network_edges.append({
                'source': h,
                'target': d,
                'weight': w
            })

    web_data = {
        'rankings': rankings_json,
        'network': {
            'nodes': [{'id': n} for n in top_names],
            'links': network_edges
        }
    }

    web_json_file = 'web/data.json'
    with open(web_json_file, 'w') as f:
        json.dump(web_data, f, indent=2)
    print(f"Saved web visualization data to {web_json_file}")

if __name__ == "__main__":
    main()
