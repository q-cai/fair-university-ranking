import pandas as pd

df = pd.read_csv('data/edge_lists_global_fair.csv')

monash = 'Monash University'

# Monash PhDs getting hired (Inbound edges to Monash in XRank, which gives Monash score)
phds = df[df['DegreeInstitutionName'] == monash].sort_values(by='Total', ascending=False)
print("Employers hiring Monash PhDs:")
print(phds[['InstitutionName', 'Total']])

# Monash hiring PhDs (Outbound edges from Monash in XRank)
hired = df[df['InstitutionName'] == monash].sort_values(by='Total', ascending=False)
print("\nPhDs hired by Monash:")
print(hired[['DegreeInstitutionName', 'Total']])
