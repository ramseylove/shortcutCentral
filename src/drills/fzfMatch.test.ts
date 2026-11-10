import { describe, expect, it } from 'vitest';
import { filterFiles } from './fzfMatch';

const files = ['music/wild.mp3', 'music/fire.mp3', 'video/wildfire.mp4', 'notes/Music.md', 'mp3-list.txt'];

describe('filterFiles', () => {
  it('keeps everything for an empty query or a bare operator', () => {
    expect(filterFiles(files, '')).toEqual(files);
    expect(filterFiles(files, '^')).toEqual(files);
    expect(filterFiles(files, "'")).toEqual(files);
  });

  it('matches fuzzily by default', () => {
    expect(filterFiles(files, 'mwd')).toEqual(['music/wild.mp3']);
    expect(filterFiles(files, 'mp3')).toEqual(['music/wild.mp3', 'music/fire.mp3', 'mp3-list.txt']);
  });

  it("supports 'exact, ^prefix and suffix$", () => {
    expect(filterFiles(files, "'wild")).toEqual(['music/wild.mp3', 'video/wildfire.mp4']);
    expect(filterFiles(files, '^music')).toEqual(['music/wild.mp3', 'music/fire.mp3']);
    expect(filterFiles(files, '.mp3$')).toEqual(['music/wild.mp3', 'music/fire.mp3']);
    expect(filterFiles(files, '^mp3-list.txt$')).toEqual(['mp3-list.txt']);
  });

  it('supports negation of each kind', () => {
    expect(filterFiles(files, '!fire')).toEqual(['music/wild.mp3', 'notes/Music.md', 'mp3-list.txt']);
    expect(filterFiles(files, '!^music')).toEqual(['video/wildfire.mp4', 'notes/Music.md', 'mp3-list.txt']);
    expect(filterFiles(files, '!.mp3$')).toEqual(['video/wildfire.mp4', 'notes/Music.md', 'mp3-list.txt']);
  });

  it('requires every term to match', () => {
    expect(filterFiles(files, '^music !fire')).toEqual(['music/wild.mp3']);
    expect(filterFiles(files, "'wild .mp4$")).toEqual(['video/wildfire.mp4']);
  });

  it('is smart-case', () => {
    expect(filterFiles(files, "'music")).toEqual(['music/wild.mp3', 'music/fire.mp3', 'notes/Music.md']);
    expect(filterFiles(files, "'Music")).toEqual(['notes/Music.md']);
  });
});
