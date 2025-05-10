// use unicode block checking to guess if this character is a commonly-used Kanji.
// will return true on any common Kanji in any language (i.e. cannot separate Japanese vs Chinese)
export function isKanji(char: string): boolean {
    if (!char || char.length !== 1) return false;

    const code = char.charCodeAt(0);

    return (
        (code >= 0x4E00 && code <= 0x9FFF) || // CJK Unified Ideographs
        (code >= 0x3400 && code <= 0x4DBF) || // CJK Unified Ideographs Extension A
        (code >= 0xF900 && code <= 0xFAFF)    // CJK Compatibility Ideographs
    );
}