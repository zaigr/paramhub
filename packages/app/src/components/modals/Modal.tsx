/**
 * Generic Modal — floating panel rendered by `FloatingLayer` on top of the
 * still-visible base view.
 *
 * It must mask the base behind it but keep the main screen's (default terminal)
 * background, so instead of a coloured card an absolutely-positioned frame of
 * `<Text>` rows (border + interior spaces) is drawn behind the content: the
 * plain spaces overwrite the base text, leaving blank default-bg cells. The
 * border is hand-drawn (not `borderStyle`) so its right-hand glyph anchors each
 * row against Ink's per-row `trimEnd`, which would otherwise strip the interior
 * spaces and let base text bleed through.
 */

import React, { useEffect, useRef, useState } from 'react';
import { Box, Text, measureElement, type DOMElement } from 'ink';

interface ModalProps {
  title: string;
  /** Width of the modal in columns. */
  width?: number;
  children: React.ReactNode;
}

export default function Modal({ title, width = 60, children }: ModalProps) {
  const contentRef = useRef<DOMElement>(null);
  const [contentHeight, setContentHeight] = useState(0);

  // Frame is sized to the measured content; guard against a re-render loop.
  useEffect(() => {
    if (contentRef.current) {
      const { height } = measureElement(contentRef.current);
      setContentHeight((prev) => (prev === height ? prev : height));
    }
  });

  const innerW = width - 2;

  const topBorder = `┌${'─'.repeat(innerW)}┐`;
  const fillRow = `│${' '.repeat(innerW)}│`;
  const bottomBorder = `└${'─'.repeat(innerW)}┘`;

  return (
    <Box flexDirection="column" width={width} position="relative">
      {contentHeight > 0 && (
        <Box position="absolute" flexDirection="column">
          <Text color="cyan">{topBorder}</Text>
          {Array.from({ length: contentHeight }).map((_, i) => (
            <Text key={i} color="cyan">
              {fillRow}
            </Text>
          ))}
          <Text color="cyan">{bottomBorder}</Text>
        </Box>
      )}

      {/* Offset 1 row/col so content sits inside the frame border. */}
      <Box
        ref={contentRef}
        flexDirection="column"
        width={width}
        marginTop={1}
        marginBottom={1}
        paddingLeft={1}
        paddingRight={1}
      >
        <Box justifyContent="center">
          <Text bold color="cyan">
            {title}
          </Text>
        </Box>
        <Box flexDirection="column">{children}</Box>
      </Box>
    </Box>
  );
}
