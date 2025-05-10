import * as fs from 'fs'
import * as wanakana from 'wanakana';

import autoBind from "auto-bind";
import { k_UNIHAN_ACTIONS, k_UNIHAN_DB_PATH, k_UNIHAN_FILENAMES } from './consts'
import { combine_without_duplicates } from './types';

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

// Represents a directional graph of connections between unicode chars.
// Provides mixed codepoint/char api.
// No loops
class LinkMap {
    private map: Map<string, string[]>;
    constructor() {
        autoBind(this);
        this.map = new Map();
    }

    // Add link from lhs to rhs
    public emplace_link(lhs_str: string, rhs_str: string): void {
        const lhs = getCleanChar(lhs_str);
        const rhs = getCleanChar(rhs_str);
        if (lhs == rhs) return;

        if (!this.map.has(lhs)) {
            this.map.set(lhs, []);
        }


        const lhs_links = this.map.get(lhs);
        if (lhs_links && !lhs_links.includes(rhs)) {
            lhs_links.push(rhs);
        }
    }

    // Add link from lhs to rhs and rhs to lhs
    public emplace_bilink(lhs_str: string, rhs_str: string): void {
        const lhs = getCleanChar(lhs_str);
        const rhs = getCleanChar(rhs_str);
        if (lhs == rhs) return;

        this.emplace_link(lhs, rhs);
        this.emplace_link(rhs, lhs);
    }

    // Check if a link from lhs to rhs exists
    public has_link(lhs_str: string, rhs_str: string): boolean {
        const lhs = getCleanChar(lhs_str);
        const rhs = getCleanChar(rhs_str);

        if (!this.map.has(lhs)) return false;

        const lhs_links = this.map.get(lhs);
        return !!(lhs_links?.includes(rhs));
    }

    // Get variants of a given character
    public getLinks(lhs_str: string): string[] {
        const lhs = getCleanChar(lhs_str);
        if (!this.map.has(lhs)) return [];
        return this.map.get(lhs) || [];
    }

    // Get a single variant of the given character. Warn if more than one entry is found.
    public getSingleLink(lhs_str: string): string | undefined {
        const links = this.getLinks(lhs_str);
        if (links == undefined) return undefined;

        if (links.length > 1) {
            console.error("More than one variant found");
            return undefined;
        }

        return links[0];
    }
}

class ReadingMap {
    private map: Map<string, string[]> = new Map();
    constructor() {
        autoBind(this);
    }

    private ratify(mychar: string): void {
        if (!this.map.has(mychar)) {
            this.map.set(mychar, []);
        }
    }

    public getKeys(): string[] {
        return [...this.map.keys()];
    }

    // get values
    public get(mychar: string): string[] {
        return this.map.get(mychar) || [];
    }

    // get and create if it does not exist
    private at(mychar: string): string[] {
        this.ratify(mychar);
        return this.get(mychar);
    }

    public emplace_readings(mychar: string, entries: string[]) {
        const res = this.at(mychar);
        this.map.set(mychar, combine_without_duplicates(res, entries));
    }

    public emplace_reading(mychar: string, entry: string) {
        this.emplace_readings(mychar, [entry]);
    }
}

//------------------------------------------------------------------------------
// Unihan library implementation
//------------------------------------------------------------------------------

// Class to load and interact with the Unihan db
export class Unihan {
    constructor() {
        autoBind(this);

        // load data from files
        this.loadData(k_UNIHAN_FILENAMES.Unihan_Readings);
        this.loadData(k_UNIHAN_FILENAMES.Unihan_Variants);

        this.createCachedYomi();
    }

    private loadData(filePath: string): void {
        const filename: string = k_UNIHAN_DB_PATH + "/" + filePath;
        const content = fs.readFileSync(filename, 'utf-8');
        const lines: string[] = content.split('\n');

        lines.forEach((line: string): void => {
            if (line.length == 0 || line.at(0) == "#") return;

            const parts = line.split('\t');
            if (parts.length == 0) return;
            const character: string = unicodeToChar(parts[0]);
            const action: string = parts[1]
            const reading: string[] = parts[2].split(/\s/g);

            if (action == k_UNIHAN_ACTIONS.kMandarin) {
                this.kMandarin.emplace_readings(character, reading);
            } else if (action == k_UNIHAN_ACTIONS.kJapanese) {
                this.kJapanese.emplace_readings(character, reading);
            } else if (action == k_UNIHAN_ACTIONS.kJapaneseKun) {
                this.kJapaneseKun.emplace_readings(character, reading);
            } else if (action == k_UNIHAN_ACTIONS.kJapaneseOn) {
                this.kJapaneseOn.emplace_readings(character, reading);
            } else if (action == k_UNIHAN_ACTIONS.kSemanticVariant) {
                this.emplace_links(this.kSemanticVariant, character, reading);
            } else if (action == k_UNIHAN_ACTIONS.kSpecializedSemanticVariant) {
                this.emplace_links(this.kSpecializedSemanticVariant, character, reading);
            } else if (action == k_UNIHAN_ACTIONS.kSimplifiedVariant) {
                this.emplace_links(this.kSimplifiedVariant, character, reading);
            } else if (action == k_UNIHAN_ACTIONS.kTraditionalVariant) {
                this.emplace_links(this.kTraditionalVariant, character, reading);
            }
        });
    }

    // Generate cached on/kunyomi maps from loaded japanese reading maps
    private createCachedYomi() {
        for (const char of this.kJapaneseKun.getKeys()) {
            const entries: string[] = this.kJapaneseKun.get(char);
            const asKana: string[] = entries.map((entry) => wanakana.toHiragana(entry));
            this.cachedJapaneseKun.emplace_readings(char, asKana);
        }

        for (const char of this.kJapaneseOn.getKeys()) {
            const entries: string[] = this.kJapaneseOn.get(char);
            const asKana: string[] = entries.map((entry) => wanakana.toKatakana(entry));
            this.cachedJapaneseOn.emplace_readings(char, asKana);
        }

        for (const char of this.kJapanese.getKeys()) {
            const entries: string[] = this.kJapaneseOn.get(char);
            entries.forEach((entry) => {
                if (wanakana.isHiragana(entry)) {
                    this.cachedJapaneseKun.emplace_reading(char, wanakana.toHiragana(entry));
                }
                else if (wanakana.isKatakana(entry)) {
                    this.cachedJapaneseOn.emplace_reading(char, wanakana.toKatakana(entry));
                }
            });
        }
    }

    // Getters
    public hasLink(lhs: string, rhs: string): boolean {
        return this.unifiedLinks.has_link(lhs, rhs);
        // const linkMaps: LinkMap[] = [
        //     this.kSemanticVariant,
        //     this.kSpecializedSemanticVariant,
        //     this.kSimplifiedVariant,
        //     this.kTraditionalVariant
        // ];

        // return linkMaps.map((vm) => vm.has_link(lhs, rhs) || vm.has_link(rhs, lhs)).reduce((a, b) => a || b);
    }

    public getMandarinPinyin(mychar: string): string[] {
        return this.kMandarin.get(mychar);
    }

    public getJapaneseKun(mychar: string): string[] {
        return this.cachedJapaneseKun.get(mychar);
    }
    public getJapaneseOn(mychar: string): string[] {
        return this.cachedJapaneseOn.get(mychar);
    }

    public getSimpChineseVariants(mychar: string): string[] {
        return this.kSimplifiedVariant.getLinks(mychar);
    }

    public getTradChineseVariants(mychar: string): string[] {
        return this.kTraditionalVariant.getLinks(mychar);
    }

    public getGetSemanticOrSpecializedVariants(mychar: string): string[] {
        const semantic = this.kSemanticVariant.getLinks(mychar);
        const specialized = this.kSpecializedSemanticVariant.getLinks(mychar);
        return combine_without_duplicates(semantic, specialized);
    }

    // As a rule, these are indexed by character ('中') rather than code point (U+XXXX)

    // Readings
    private kMandarin: ReadingMap = new ReadingMap();
    private kJapanese: ReadingMap = new ReadingMap();
    private kJapaneseKun: ReadingMap = new ReadingMap();
    private kJapaneseOn: ReadingMap = new ReadingMap();

    private cachedJapaneseKun: ReadingMap = new ReadingMap();
    private cachedJapaneseOn: ReadingMap = new ReadingMap();

    // Variants
    private kSemanticVariant: LinkMap = new LinkMap();
    private kSpecializedSemanticVariant: LinkMap = new LinkMap();
    private kSimplifiedVariant: LinkMap = new LinkMap();
    private kTraditionalVariant: LinkMap = new LinkMap();

    // Unified link map
    private unifiedLinks: LinkMap = new LinkMap();

    private emplace_links(lm: LinkMap, lhs: string, rhs: string[]) {
        rhs.forEach((item) => this.emplace_link(lm, lhs, item));
    }
    // Helper to build up unified link map while building other maps
    private emplace_link(lm: LinkMap, lhs: string, rhs: string) {
        this.unifiedLinks.emplace_bilink(lhs, rhs);
        lm.emplace_link(lhs, rhs);
    }
}