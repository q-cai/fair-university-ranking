import pandas as pd

df = pd.read_csv('data/edge_lists_global_fair.csv')

harvard = 'Harvard University'

# Harvard PhDs getting hired
phds_harvard = df[df['DegreeInstitutionName'] == harvard]
print(f"Harvard total endorsements: {phds_harvard['Total'].sum()}")

stanford = 'Stanford University'
phds_stanford = df[df['DegreeInstitutionName'] == stanford]
print(f"Stanford total endorsements: {phds_stanford['Total'].sum()}")

# Print top 5 universities by total endorsements in the fair dataset
top = df.groupby('DegreeInstitutionName')['Total'].sum().sort_values(ascending=False).head(10)
print("\nTop 10 by raw placements in fair data:")
print(top)
