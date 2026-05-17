/**
 * Custom tab types for provider-contributed UI tabs.
 */

/**
 * A custom tab that a provider can contribute to the TUI.
 *
 * The `render` function returns a component tree (typed as `unknown`
 * to avoid a React dependency in the types package — consumers
 * should cast to their framework's element type).
 */
export interface CustomTab {
  /** Unique tab identifier. */
  id: string;
  /** Tab label displayed in the top bar. */
  label: string;
  /** Render function returning a UI element. */
  render: () => unknown;
}
