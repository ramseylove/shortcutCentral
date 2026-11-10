// jsdom has no layout, so Range has no client rects. CodeMirror's Vim mode asks
// for them on a few motions (`$`); an empty list makes it use the logical line.
const emptyRects = () => [] as unknown as DOMRectList;
Range.prototype.getClientRects = emptyRects;
Range.prototype.getBoundingClientRect = () => new DOMRect();
