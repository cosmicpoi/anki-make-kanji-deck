import * as fs from 'fs'
import * as wanakana from 'wanakana';

import autoBind from "auto-bind";
import { combine_without_duplicates } from './types';

const k_UNIHAN_FILENAMES = {
    Unihan_Readings: "Unihan_Readings.txt",
    Unihan_Variants: "Unihan_Variants.txt",
    Unihan_IRGSources: "Unihan_IRGSources.txt",
};

//------------------------------------------------------------------------------
// Helper functions
//------------------------------------------------------------------------------

export function charToUnicode(char: string): string {
    const codePoint = char.codePointAt(0);
    if (codePoint == undefined) {
        console.error("Code point undefined for " + char);
        return "";
    }
    return 'U+' + codePoint.toString(16).toUpperCase().padStart(4, '0');
}

export function unicodeToChar(unicode: string): string {
    const hex = unicode.replace(/^U\+/, '');
    return String.fromCodePoint(parseInt(hex, 16));
}

// Convert a unicode DB entry to a clean char - i.e. convert U+893B<kLau,kMatthews to 䙝
function getCleanChar(dbEntry: string): string {
    if (dbEntry.at(0) == "U") {
        return unicodeToChar(dbEntry.split('<')[0]);
    }
    else return dbEntry;
}

//------------------------------------------------------------------------------
// Unihan library implementation
//------------------------------------------------------------------------------

type UnihanEntry = {
    /* Raw data */
    // IRGs
    kIRG_GSource?: string;
    kIRG_HSource?: string;
    kIRG_JSource?: string;
    kTotalStrokes?: number;
    // readings
    kMandarin?: string[];
    kJapanese?: string[];
    kJapaneseKun?: string[];
    kJapaneseOn?: string[];
    kDefinition?: string[];
    // variants
    kSemanticVariant?: string[];
    kSpecializedSemanticVariant?: string[];
    kSimplifiedVariant?: string[];
    kTraditionalVariant?: string[];

    /* Cached data */
    cachedJapaneseKun?: string[];
    cachedJapaneseOn?: string[];
};

type UnihanIRG = 'kIRG_JSource' | 'kIRG_HSource' | 'kIRG_GSource' | 'kTotalStrokes';
type UnihanReading = 'kMandarin' | 'kJapanese' | 'kJapaneseKun' | 'kJapaneseOn' | 'kDefinition';
type UnihanVariant = 'kSemanticVariant' | 'kSpecializedSemanticVariant' | 'kSimplifiedVariant' | 'kTraditionalVariant';

// Class to load and interact with the Unihan db
export class Unihan {
    constructor() {
        autoBind(this);
    }

    static async create(unihanDir: string) {
        const unihan = new Unihan();

        // load data from files
        unihan.loadData(unihanDir, k_UNIHAN_FILENAMES.Unihan_Readings);
        unihan.loadData(unihanDir, k_UNIHAN_FILENAMES.Unihan_Variants);

        unihan.createCachedYomi();

        return unihan;
    }

    private async loadData(unihanDir: string, filePath: string): Promise<void> {
        const filename: string = unihanDir + "/" + filePath;
        const content = fs.readFileSync(filename, 'utf-8');
        const lines: string[] = content.split('\n');

        lines.forEach((line: string): void => {
            if (line.length == 0 || line.at(0) == "#") return;

            const parts = line.split('\t');
            if (parts.length == 0) return;
            const character: string = unicodeToChar(parts[0]);
            const action_str: string = parts[1]
            const reading_line = parts[2];
            const reading: string[] = parts[2].split(/\s/g);

            const emplace_variants = (key: UnihanVariant, lhs: string, rhs: string[]) => {
                const clean_chars = reading.map(r => getCleanChar(r));
                this.emplace_variants(key, getCleanChar(lhs), clean_chars);
            }

            const action = action_str as keyof UnihanEntry;
            if (action == 'kIRG_GSource') {
                this.emplace_irg('kIRG_GSource', character, reading_line);
            }
            else if (action == 'kIRG_HSource') {
                this.emplace_irg('kIRG_HSource', character, reading_line);
            }
            else if (action == 'kIRG_JSource') {
                this.emplace_irg('kIRG_JSource', character, reading_line);
            }
            else if (action == 'kTotalStrokes') {
                this.emplace_irg('kTotalStrokes', character, reading_line);
            }
            else if (action == 'kMandarin') {
                this.emplace_readings('kMandarin', character, reading);
            }
            else if (action == 'kJapanese') {
                this.emplace_readings('kJapanese', character, reading);
            }
            else if (action == 'kJapaneseKun') {
                this.emplace_readings('kJapaneseKun', character, reading);
            }
            else if (action == 'kJapaneseOn') {
                this.emplace_readings('kJapaneseOn', character, reading);
            }
            else if (action == 'kDefinition') {
                this.emplace_readings('kDefinition', character, [reading_line]);
            }
            else if (action == 'kSemanticVariant') {
                emplace_variants('kSemanticVariant', character, reading);
            }
            else if (action == 'kSpecializedSemanticVariant') {
                emplace_variants('kSpecializedSemanticVariant', character, reading);
            }
            else if (action == 'kSimplifiedVariant') {
                emplace_variants('kSimplifiedVariant', character, reading);
            }
            else if (action == 'kTraditionalVariant') {
                emplace_variants('kTraditionalVariant', character, reading);
            }
        });
    }

    // Generate cached on/kunyomi maps from loaded japanese reading maps
    private createCachedYomi() {
        this.m_entries.forEach(entry => {
            const allKun = new Set<string>();
            const allOn = new Set<string>();
            if (entry.kJapaneseKun)
                entry.kJapaneseKun.forEach(r => allKun.add(wanakana.toHiragana(r)));
            if (entry.kJapaneseOn)
                entry.kJapaneseOn.forEach(r => allOn.add(wanakana.toKatakana(r)));
            if (entry.kJapanese) entry.kJapanese.forEach(r => {
                if (wanakana.isHiragana(r)) {
                    allKun.add(r);
                }
                else if (wanakana.isKatakana(r)) {
                    allOn.add(r);
                }
            })

            entry.cachedJapaneseKun = [...allKun];
            entry.cachedJapaneseOn = [...allOn];
        });
    }

    // Getters
    public isCharacter(mychar: string): boolean {
        return this.m_entries.has(mychar);
    }

    public hasLink(lhs: string, rhs: string): boolean {
        return this.hasLinkOneWay(lhs, rhs) || this.hasLinkOneWay(rhs, lhs);
    }

    private hasLinkOneWay(lhs: string, rhs: string): boolean {
        const res = this.m_entries.get(lhs);
        if (!res) return false;
        const hasSimplified = res.kSimplifiedVariant?.includes(rhs) || false
        const hasTraditional = res.kTraditionalVariant?.includes(rhs) || false

        const hasSemantic = res.kSemanticVariant?.includes(rhs) || false
        const hasSpecializedSemantic = res.kSpecializedSemanticVariant?.includes(rhs) || false

        return hasSimplified || hasTraditional || hasSemantic || hasSpecializedSemantic;
    }

    // IRG getters
    public isJapanese(mychar: string): boolean {
        return !!(this.m_entries.get(mychar)?.kIRG_JSource)
    }

    public isSimplified(mychar: string): boolean {
        return !!(this.m_entries.get(mychar)?.kIRG_GSource)
    }

    public isTraditional(mychar: string): boolean {
        return !!(this.m_entries.get(mychar)?.kIRG_HSource)
    }

    // reading getters
    public getMandarinPinyin(mychar: string): string[] {
        return this.m_entries.get(mychar)?.kMandarin || [];
    }

    public getJapaneseKun(mychar: string): string[] {
        return this.m_entries.get(mychar)?.cachedJapaneseKun || [];
    }
    public getJapaneseOn(mychar: string): string[] {
        return this.m_entries.get(mychar)?.cachedJapaneseOn || [];
    }

    // variant getters
    public getSimpChineseVariants(mychar: string): string[] {
        return this.m_entries.get(mychar)?.kSimplifiedVariant || [];
    }

    public getEnglishDefinition(mychar: string): string[] {
        return this.m_entries.get(mychar)?.kDefinition || [];
    }

    public getTradChineseVariants(mychar: string): string[] {
        return this.m_entries.get(mychar)?.kTraditionalVariant || [];
    }

    public getGetSemanticOrSpecializedVariants(mychar: string): string[] {
        const semantic = this.m_entries.get(mychar)?.kSemanticVariant || [];
        const specialized = this.m_entries.get(mychar)?.kSpecializedSemanticVariant || [];
        return combine_without_duplicates(semantic, specialized);
    }

    // Internal emplace helpers
    private emplace_irg(key: UnihanIRG, lhs: string, rhs: string) {
        const entry = this.at(lhs);
        if (key == 'kTotalStrokes') {
            entry[key] = parseInt(rhs);
        } else {
            entry[key] = rhs;
        }
    }

    private emplace_variants(key: UnihanVariant, lhs: string, rhs: string[]) {
        const entry = this.at(lhs);
        if (!entry[key]) entry[key] = [];
        entry[key] = entry[key].concat(rhs);
    }

    private emplace_readings(key: UnihanReading, lhs: string, rhs: string[]) {
        const entry = this.at(lhs);
        if (!entry[key]) entry[key] = [];
        entry[key] = entry[key].concat(rhs);
    }

    public getEntry(k: string): UnihanEntry | undefined {
        return this.m_entries.get(k);
    }

    private at(k: string): UnihanEntry {
        const res = this.m_entries.get(k);
        if (!res) {
            const newEntry = {};
            this.m_entries.set(k, newEntry)
            return newEntry;
        }
        return res;
    }

    // Entries indexed by character (rather than code point)
    private m_entries: Map<string, UnihanEntry> = new Map();
}