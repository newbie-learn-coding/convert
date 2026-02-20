/**
 * Test Configuration
 * Shared configuration for all tests
 */

export const TEST_CONFIG = {
  // Base ports for different test types
  ports: {
    unit: 9000,
    browser: 8080,
    integration: {
      flows: 8081,
      errors: 8082,
      perf: 8083,
      logging: 8084,
      ui: 8085,
      a11y: 8086,
      large: 8087,
      compat: 8088,
    },
  },

  // Timeouts
  timeouts: {
    unit: 5000,
    browser: 60000,
    integration: 60000,
  },

  // Paths
  paths: {
    dist: "./dist",
    testResources: "./test/resources",
  },
} as const;

/**
 * Get an available port starting from the base port
 */
export async function getAvailablePort(basePort: number): Promise<number> {
  // Simple implementation - just return base port
  // In a real scenario, you might check if the port is available
  return basePort;
}
