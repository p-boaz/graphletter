#!/usr/bin/env ts-node

import { readFileSync } from "fs";
import { join } from "path";
import { SCFParser } from "../lib/scf-parser";

async function testSCFParser() {
  console.log("🧪 Testing Enhanced SCF Parser...\n");

  try {
    // Test Principles CSV
    console.log("📋 Testing Domains and Principles CSV...");
    const principlesPath = join(__dirname, "../data/Domains and Principles.csv");
    const principlesCSV = readFileSync(principlesPath, "utf8");

    const { principles, domains } = SCFParser.parsePrinciplesCSV(principlesCSV);

    console.log(`✅ Parsed ${principles.length} principles`);
    console.log(`✅ Parsed ${domains.length} domains`);

    if (principles.length > 0) {
      console.log("\n📝 Sample Principle:");
      console.log(JSON.stringify(principles[0], null, 2));
    }

    if (domains.length > 0) {
      console.log("\n🏗️ Sample Domain:");
      console.log(JSON.stringify(domains[0], null, 2));
    }

    // Test Authoritative Sources CSV
    console.log("\n🌍 Testing Authoritative Sources CSV...");
    const authSourcesPath = join(__dirname, "../data/Authoritative Sources.csv");
    const authSourcesCSV = readFileSync(authSourcesPath, "utf8");

    const authSources = SCFParser.parseAuthoritativeSourcesCSV(authSourcesCSV);

    console.log(`✅ Parsed ${authSources.length} authoritative sources`);

    if (authSources.length > 0) {
      console.log("\n🔗 Sample Authoritative Source:");
      console.log(JSON.stringify(authSources[0], null, 2));
    }

    // Test combined parsing
    console.log("\n🔄 Testing Combined Parsing...");
    const combinedResult = SCFParser.parseAllSCFData(principlesCSV, authSourcesCSV);

    console.log("✅ Combined Result Summary:");
    console.log(JSON.stringify(combinedResult.summary, null, 2));

    if (combinedResult.errors.length > 0) {
      console.log("\n❌ Errors:");
      combinedResult.errors.forEach((error) => console.log(`  - ${error}`));
    }

    if (combinedResult.warnings.length > 0) {
      console.log("\n⚠️  Warnings:");
      combinedResult.warnings.slice(0, 5).forEach((warning) => console.log(`  - ${warning}`));
      if (combinedResult.warnings.length > 5) {
        console.log(`  ... and ${combinedResult.warnings.length - 5} more warnings`);
      }
    }

    console.log("\n🎉 All tests completed successfully!");
  } catch (error) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

// Run the test
testSCFParser().catch(console.error);
