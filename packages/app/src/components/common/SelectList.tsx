/**
 * SelectList — presentational single-select option list.
 *
 * Renders a windowed viewport of options with the shared `>` selection idiom
 * used across the app (palette, pickers, wizard). Purely visual: the parent
 * owns keyboard handling and the selected index.
 */

import { Text } from 'ink';
import { useTheme } from '../../theme/index.js';

export interface SelectOption {
  label: string;
  value: string;
  /** Dimmed suffix, e.g. "(current)". */
  hint?: string;
}

interface SelectListProps {
  options: SelectOption[];
  selectedIndex: number;
  /** Max rows rendered at once (default 8). */
  maxVisible?: number;
}

export default function SelectList({ options, selectedIndex, maxVisible = 8 }: SelectListProps) {
  const { theme } = useTheme();

  const clampedIndex = Math.max(0, Math.min(selectedIndex, options.length - 1));
  const startIndex = Math.max(
    0,
    Math.min(clampedIndex - Math.floor(maxVisible / 2), options.length - maxVisible),
  );
  const visible = options.slice(startIndex, startIndex + maxVisible);

  return (
    <>
      {visible.map((option, i) => {
        const isSelected = startIndex + i === clampedIndex;
        return (
          <Text key={option.value} color={isSelected ? theme.accent : undefined} bold={isSelected}>
            {isSelected ? '> ' : '  '}
            {option.label}
            {option.hint ? <Text dimColor> {option.hint}</Text> : ''}
          </Text>
        );
      })}
    </>
  );
}
