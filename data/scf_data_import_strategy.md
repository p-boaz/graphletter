# SCF Database Extension Import Strategy

This document outlines the strategy for importing data into the newly created database tables for the SCF extension.

## New Database Tables

1. `scf_risks` - Stores risk catalog data
2. `scf_threats` - Stores threat catalog data
3. `scf_maturity_levels` - Stores C|P-CMM maturity level descriptions for each control
4. `scf_control_risk_mappings` - Maps SCF controls to risks
5. `scf_control_threat_mappings` - Maps SCF controls to threats

## Data Import Strategy

### 1. Import Risk Catalog Data

Source: `data/risks.csv`

Process:

1. Parse the CSV file to extract risk IDs, groupings, titles, descriptions, and NIST CSF functions
2. Insert into the `scf_risks` table
3. Example data structure shown in the `import_risks_from_csv()` function

### 2. Import Threat Catalog Data

Source: `data/threats.csv`

Process:

1. Parse the CSV file to extract threat IDs, groupings, titles, and descriptions
2. Insert into the `scf_threats` table
3. Example data structure shown in the `import_threats_from_csv()` function

### 3. Import Maturity Levels Descriptions

Source: `data/full_scf.csv`

Process:

1. Parse the CSV file to extract control IDs and maturity level descriptions (C|P-CMM levels 0-5)
2. Insert into the `scf_maturity_levels` table with references to the corresponding SCF controls

### 4. Map SCF Controls to Risks

Source: `data/full_scf.csv` or `data/controls.csv`

Process:

1. Parse the CSV file to extract control IDs and associated risk IDs
2. For each control-risk pair, insert a record into the `scf_control_risk_mappings` table
3. Optional: Calculate and store a relevance score based on analysis of the relationship

### 5. Map SCF Controls to Threats

Source: `data/full_scf.csv` or `data/controls.csv`

Process:

1. Parse the CSV file to extract control IDs and associated threat IDs
2. For each control-threat pair, insert a record into the `scf_control_threat_mappings` table
3. Optional: Calculate and store an impact score based on analysis of the relationship

### 6. Update SCF Controls with Maturity Information

Process:

1. Parse the CSV file to extract control IDs and current/target maturity levels
2. Update the `current_maturity_level` and `target_maturity_level` columns in the `scf_controls` table

## Implementation Notes

1. Use PostgreSQL's COPY command or a batch insert approach for efficient data import
2. Consider using a temporary staging table for complex data transformations
3. Perform data validation before importing to ensure referential integrity
4. Add appropriate indexes to junction tables for query performance
5. Consider implementing a periodic refresh strategy for keeping the data current

## Available Views

The following views have been created to simplify querying the extended SCF data:

1. `control_risks_view` - Shows controls with their associated risks
2. `control_threats_view` - Shows controls with their associated threats
3. `control_maturity_view` - Shows controls with their maturity level descriptions
4. `comprehensive_control_view` - Shows controls with all related data (risks, threats, maturity levels)

## Next Steps

1. Implement a complete data import script using the sample functions as templates
2. Develop a data refresh strategy
3. Create application-level interfaces for working with the new data
4. Update the assessment procedures to incorporate maturity level evaluations
5. Consider adding materialized views for frequently accessed query patterns
