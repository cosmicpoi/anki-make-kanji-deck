// Helper functions for computing a word or glyph's frequency and/or difficulty

// Character difficulty formula:
// - If it appears in an tagged list (HSK or JLPT), use that as base difficulty
//   - 0 to 1 for N5, 1 to 2 for N4, etc
//   - Add 1 past max if it appears in no such list (5+ for non-JLPT, 6+ for non-HSK)
// - Add # of strokes / 30
//   - Max number of strokes across n5-n1 is 29
//   - Some stroke count metrics:
//     level avg   max
//      n1  11.39, 29
//      n2  10.00, 20
//      n3   9.73, 20
//      n4   8.48, 18
//      n5   5.73, 14
const k_STROKE_COUNT_DEN = 30;
export function computeCharacterDifficulty(char: string): number {
    return 0;
}

// Word difficulty formula:
// - If it appears in an tagged list (HSK or JLPT), use that as base difficulty
//   - 0 to 1 for N5, 1 to 2 for N4, etc
//   - Add 1 past max if it appears in no such list (5+ for non-JLPT, 6+ for non-HSK)
// 
export function computeWordDifficulty(word: string): number {
    return 0;
}