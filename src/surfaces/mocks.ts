import type { ComponentType } from 'react';
import type { MOCK_NAMES } from '../packs/schema';
import { EditorMock, type MockProps } from './EditorMock';
import { GitsignsBufferMock } from './GitsignsBuffer';
import { TelescopePickerMock } from './TelescopePicker';

/** One component per mock name in the pack schema. */
export const MOCKS: Record<(typeof MOCK_NAMES)[number], ComponentType<MockProps>> = {
  editor: EditorMock,
  'telescope-picker': TelescopePickerMock,
  'gitsigns-buffer': GitsignsBufferMock,
};
