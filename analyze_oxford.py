import pandas as pd

df = pd.read_csv('data/edge_lists_global_fair.csv')

oxford = 'University of Oxford'

hired_by_oxford = df[df['InstitutionName'] == oxford]
print(f"Total people Oxford hired (Oxford Out-degree): {hired_by_oxford['Total'].sum()}")
print(hired_by_oxford.sort_values(by='Total', ascending=False).head(10))
