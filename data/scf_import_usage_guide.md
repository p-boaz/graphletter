# SCF Data Import Usage Guide

This guide provides instructions on how to use the database functions created to import SCF extension data.

## Overview

The import system consists of several functions that handle different aspects of the data import process:

1. **Helper functions** for parsing and transforming CSV data
2. **Individual import functions** for different data types (risks, threats, maturity levels, etc.)
3. **A wrapper function** that orchestrates all imports

## Prerequisites

Before running any imports, ensure:

1. All required CSV files are available:
   - `/data/risks.csv` - Contains risk catalog data
   - `/data/threats.csv` - Contains threat catalog data
   - `/data/full_scf.csv` - Contains SCF controls, maturity levels, and mappings

2. Database extensions are installed:
   - All the tables created in the previous setup are available
   - RLS policies are enabled and properly configured

## Import Functions

### 1. Helper Functions

These functions help with parsing and cleaning CSV data:

- `clean_csv_text(input_text TEXT)` - Cleans text from CSV
- `extract_ids_from_text(input_text TEXT)` - Extracts IDs from comma-separated lists
- `split_csv_line(line_text TEXT)` - Splits CSV line into fields, handling quoted fields correctly
- `is_valid_id(id_text TEXT, pattern TEXT)` - Validates ID format against a regex pattern

### 2. Individual Import Functions

#### Risk Catalog Import

```sql
-- Import risks from a file
SELECT import_risks_from_file('data/risks.csv');

-- Import risks from CSV content directly
SELECT import_risks_from_csv_lines(csv_lines);
```

#### Threat Catalog Import

```sql
-- Import threats from a file
SELECT import_threats_from_file('data/threats.csv');

-- Import threats from CSV content directly
SELECT import_threats_from_csv_lines(csv_lines);
```

#### Maturity Levels Import

```sql
-- Import maturity levels from a file
SELECT import_maturity_levels_from_file('data/full_scf.csv');

-- Import maturity levels from CSV content directly
SELECT import_maturity_levels_from_csv_lines(csv_lines);
```

#### Control-Risk Mappings Import

```sql
-- Import control-risk mappings from a file
SELECT import_control_risk_mappings_from_file('data/full_scf.csv');

-- Import control-risk mappings from CSV content directly
SELECT import_control_risk_mappings_from_csv_lines(csv_lines);
```

#### Control-Threat Mappings Import

```sql
-- Import control-threat mappings from a file
SELECT import_control_threat_mappings_from_file('data/full_scf.csv');

-- Import control-threat mappings from CSV content directly
SELECT import_control_threat_mappings_from_csv_lines(csv_lines);
```

### 3. Wrapper Functions

#### Import All Data

```sql
-- Import all data types using default file paths
SELECT import_all_scf_extension_data();

-- Import all data types with custom file paths
SELECT import_all_scf_extension_data(
  'custom/path/to/risks.csv',
  'custom/path/to/threats.csv',
  'custom/path/to/full_scf.csv'
);
```

#### Selective Import

```sql
-- Run specific import types
SELECT run_scf_data_import('risks');
SELECT run_scf_data_import('threats');
SELECT run_scf_data_import('maturity_levels');
SELECT run_scf_data_import('risk_mappings');
SELECT run_scf_data_import('threat_mappings');
SELECT run_scf_data_import('all');  -- Same as import_all_scf_extension_data()
```

## Implementation Notes

### CSV Column Mapping

The import functions rely on specific columns in the CSV files:

1. In `full_scf.csv`:
   - Column 3: SCF control ID
   - Columns ~599-622: Maturity level descriptions
   - Column 400 (approx): Risk IDs (comma-separated)
   - Column 401 (approx): Threat IDs (comma-separated)

These column indices may need adjustment based on the actual structure of your CSV files.

### Running Imports From Application Code

Since these functions rely on PostgreSQL features, the most reliable way to run them is through:

1. **Edge Functions** - Create a Supabase Edge Function that calls these import functions
2. **Database Migrations** - Run imports as part of a migration script
3. **SQL Client** - Execute the functions from a SQL client with appropriate permissions

Example Edge Function:

```typescript
// Import all SCF extension data
export async function importAllScfData() {
  const { data, error } = await supabase.rpc('run_scf_data_import', {
    import_type: 'all'
  });
  
  if (error) throw error;
  return data;
}
```

## Troubleshooting

If you encounter issues during import:

1. **Incorrect Column Indices**: The most likely issue is that column indices in the import functions don't match your CSV structure. Adjust the indices in the following functions:
   - `extract_maturity_level` function indices
   - `extract_risk_ids_from_control` function
   - `extract_threat_ids_from_control` function

2. **CSV Format Issues**: Ensure your CSV files follow the expected format:
   - Properly quoted text fields
   - Correct delimiters
   - Consistent structure

3. **Missing References**: Check that all referenced control IDs, risk IDs, and threat IDs actually exist in their respective tables

## Maintenance

To update or refresh data:

1. **Full Refresh**: Simply run the import functions again - they are designed to replace existing data
2. **Partial Updates**: Use the selective import functions to update specific data types
3. **Custom Import**: Modify the import functions if your data structure changes

## Next Steps

After importing data, you should:

1. Validate the imported data using the provided views:
   - `control_risks_view`
   - `control_threats_view`
   - `control_maturity_view`
   - `comprehensive_control_view`

2. Create an application layer to interact with this data structure

3. Set up a regular refresh schedule for keeping the data current
