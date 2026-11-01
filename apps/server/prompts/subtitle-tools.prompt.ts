export const badTakesPrompt = (numberedLines: string) => `
These are the caption lines of a talking-head video, in order, as "index: text".

Find the bad takes: lines where the speaker stumbled, stopped half-way or said the same thing again, and a later line says it properly. Return only the indexes of the lines to cut (the failed attempts), never the good take that follows. Don't flag lines that are merely similar, repeated on purpose for emphasis, or a list.

If there are no bad takes, return an empty list.

Lines:
${numberedLines}
`;

export const captionScenesPrompt = (numberedLines: string, zooms: string[]) => `
Split this short video into scenes by topic, the way an editor would cut it for B-roll. Lines are "index [start time]: text".

For each scene give:
- firstLine: the index of the line where it starts. The first scene starts at 0. Aim for scenes of 3 to 8 seconds.
- keyword: what the scene is about, in a few words.
- brollQuery: a short stock-footage search (2 to 5 English words) that would illustrate it, e.g. "world map close up".
- zoom: the camera zoom that suits the moment, one of: ${zooms.join(", ")}; or null for scenes that should stay still. Use punchy zooms (crash-zoom, fast-snap, camera-shake) for surprising or emphatic moments and smooth or steady ones elsewhere. Leave about one scene in four without a zoom.

Lines:
${numberedLines}
`;
