/**
 * @paramhub/types/testing
 *
 * Testing utilities for paramhub providers.
 * Exports the mock provider and conformance test suite.
 *
 * NOTE: The conformance suite imports vitest and should only be used
 * inside test files. For runtime usage (e.g., dev mode), import from
 * '@paramhub/types/mock' instead.
 */

export { MockProvider, MockProviderFactory } from './mock-provider.js';
export { runProviderConformanceTests } from './conformance.js';
