/**
 * Generic Modal component — shared overlay mechanism.
 *
 * Used by the command palette, confirmation dialogs, region picker,
 * and any other overlay that needs to capture focus and display
 * above the main content.
 */

import { Box, Text } from 'ink';

interface ModalProps {
  /** Title displayed at the top of the modal. */
  title: string;
  /** Width of the modal (in columns). Defaults to 60. */
  width?: number;
  /** Content rendered inside the modal. */
  children: React.ReactNode;
}

export default function Modal({ title, width = 60, children }: ModalProps) {
  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor="cyan"
      width={width}
      paddingX={1}
      paddingY={0}
    >
      <Box justifyContent="center" marginBottom={0}>
        <Text bold color="cyan">
          {title}
        </Text>
      </Box>
      <Box flexDirection="column">{children}</Box>
    </Box>
  );
}
