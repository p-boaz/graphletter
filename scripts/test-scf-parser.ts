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

    if (authSources.length < 200) {
      throw new Error(`Expected ≥200 authoritative sources, got ${authSources.length}`);
    }

    // Test control mappings against the real controls.csv (exercises the
    // FRAMEWORK_COLUMNS header-alignment guard on the canonical data).
    console.log("\n🗺️ Testing Control Mappings...");
    const controlsCSV = readFileSync(join(__dirname, "../data/controls.csv"), "utf8");
    const mappings = SCFParser.parseControlMappings(controlsCSV);
    console.log(`✅ Parsed ${mappings.length} control mappings`);
    if (mappings.length < 20000) {
      throw new Error(`Expected ≥20000 control mappings, got ${mappings.length}`);
    }
    const gov01Iso = mappings
      .filter((m) => m.controlId === "GOV-01" && m.frameworkName === "ISO 27001")
      .map((m) => m.frameworkControlId);
    if (!gov01Iso.includes("5.1")) {
      throw new Error(
        `GOV-01 ISO 27001 mappings look wrong: ${JSON.stringify(gov01Iso.slice(0, 5))}`
      );
    }
    if (!mappings.some((m) => m.frameworkName === "SOC 2")) {
      throw new Error("No SOC 2 mappings parsed");
    }

    // The header guard must reject a CSV whose framework columns shifted.
    console.log("\n🛡️ Testing header-alignment guard...");
    const lines = controlsCSV.split("\n");
    const tampered = ['"shifted",' + lines[0], ...lines.slice(1)].join("\n");
    let guardThrew = false;
    try {
      SCFParser.parseControlMappings(tampered);
    } catch (e) {
      guardThrew = e instanceof Error && e.message.includes("misaligned");
    }
    if (!guardThrew) {
      throw new Error("Header-alignment guard did not reject a shifted CSV");
    }
    console.log("✅ Guard rejects shifted framework columns");

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
