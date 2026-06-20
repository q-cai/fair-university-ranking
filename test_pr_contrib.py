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

monash = 'Monash University'
print(f"Monash PR: {pr.get(monash, 0)}")

for u, v, data in G.in_edges(monash, data=True):
    w = data['weight']
    out_weight = G.out_degree(u, weight='weight')
    contrib = 0.85 * pr[u] * (w / out_weight)
    print(f"From {u}: w={w}, out_weight={out_weight}, pr={pr[u]:.6f} => contrib={contrib:.6f}")

