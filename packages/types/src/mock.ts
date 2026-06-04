/**
 * @paramhub/types/mock
 *
 * Runtime-safe mock provider export.
 * Does NOT import vitest — safe to use in the actual application
 * for development/testing without the test runner.
 */

export { MockProvider, MockProviderFactory } from './testing/mock-provider.js';
