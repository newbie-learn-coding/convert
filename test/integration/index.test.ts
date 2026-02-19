/**
 * Integration Test Suite Index
 *
 * This file serves as the main entry point for running all integration tests.
 * Import this to run the full test suite.
 */

// Import all integration test modules
import "./conversion-flows.test.ts";
import "./error-handling.test.ts";
import "./ui-interactions.test.ts";
import "./accessibility.test.ts";
import "./large-files.test.ts";
import "./browser-compatibility.test.ts";

// This file doesn't export anything; it's used to register all tests
console.log("Integration test suite loaded");
