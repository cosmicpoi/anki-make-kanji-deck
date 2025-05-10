import * as fs from 'fs'
import autoBind from "auto-bind";
import { k_KANJIDIC_FILE_PATH } from "./consts";

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

export class Kanjidic {
    constructor() {
        autoBind(this);
        this.loadData(k_KANJIDIC_FILE_PATH);
    }
    private loadData(filePath: string): void {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines: string[] = content.split('\n');
        lines.forEach((line) => {
            const match = line.match(/<literal>(.)<\/literal>/);
            if (match) {
                this.chars.add(match[0].split('>')[1].split('<')[0]);
            }
        });
    }

    public isKanji(mychar: string): boolean {
        return this.chars.has(mychar);
    }

    private chars: Set<string> = new Set();
}