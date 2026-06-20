import pandas as pd
import networkx as nx

df = pd.read_csv('data/edge_lists_global_fair.csv')
df = df[df['TaxonomyLevel'] == 'Academia']

G = nx.DiGraph()
for _, row in df.iterrows():
    h = row['InstitutionName']
    d = row['DegreeInstitutionName']
    w = row['Total']
    if h != d and w > 0:
        if G.has_edge(h, d):
            G[h][d]['weight'] += w
        else:
            G.add_edge(h, d, weight=w)

pr = nx.pagerank(G, alpha=0.85, weight='weight', max_iter=1000)

top = sorted(pr.items(), key=lambda x: x[1], reverse=True)[:10]
for name, score in top:
    print(f"{name}: {score*1000:.4f}")

