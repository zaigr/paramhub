import React from 'react';
import { Text, Box } from 'ink';

export default function App() {
  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="round" borderColor="cyan" paddingX={2}>
        <Text bold color="cyan">
          paramhub
        </Text>
        <Text> — Cloud Parameter Store TUI</Text>
      </Box>
      <Box marginTop={1}>
        <Text color="green">Hello from paramhub!</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press Ctrl+Q to quit</Text>
      </Box>
    </Box>
  );
}
