import pandas as pd

df = pd.read_csv('data/edge_lists_global.csv')
umich = "University of Michigan"

# Where did UMich PhDs go? (UMich is the DegreeInstitutionName, others are InstitutionName)
phd_from_umich = df[df['DegreeInstitutionName'] == umich]
top_employers = phd_from_umich.groupby('InstitutionName')['Total'].sum().sort_values(ascending=False).head(20)

print("=== Top Employers hiring UMich PhDs ===")
print(top_employers)

# Where does UMich hire from? (UMich is the InstitutionName, others are DegreeInstitutionName)
hired_by_umich = df[df['InstitutionName'] == umich]
top_sources = hired_by_umich.groupby('DegreeInstitutionName')['Total'].sum().sort_values(ascending=False).head(10)

print("\n=== Top PhD sources UMich hires from ===")
print(top_sources)

# Total out-degree (PhD placement volume)
total_phds_placed = phd_from_umich['Total'].sum()
print(f"\nTotal UMich PhDs placed as faculty: {total_phds_placed}")
