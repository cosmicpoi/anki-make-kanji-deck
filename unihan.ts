import * as fs from 'fs'
import * as path from 'path'

import autoBind from "auto-bind";
import { k_UNIHAN_ACTIONS, k_UNIHAN_DB_PATH, k_UNIHAN_FILENAMES } from './consts'

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
        this.emplace_link(lhs_str, rhs_str);
        this.emplace_link(rhs_str, lhs_str);
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
    public getLinks(lhs_str: string): string[] | undefined {
        const lhs = getCleanChar(lhs_str);
        if (!this.map.has(lhs)) return undefined;
        return this.map.get(lhs);
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

//------------------------------------------------------------------------------
// Unihan library implementation
//------------------------------------------------------------------------------

// Class to load and interact with the Unihan db
export class Unihan {
    constructor() {
        autoBind(this);

        /// initialize maps
        this.kMandarin = new Map();
        this.kJapanese = new Map();
        this.kJapaneseKun = new Map();
        this.kJapaneseOn = new Map();

        this.kSemanticVariant = new LinkMap();
        this.kSpecializedSemanticVariant = new LinkMap();
        this.kSimplifiedVariant = new LinkMap();
        this.kTraditionalVariant = new LinkMap();

        this.unifiedLinks = new LinkMap();

        // load data from files
        this.loadData(k_UNIHAN_FILENAMES.Unihan_Readings);
        this.loadData(k_UNIHAN_FILENAMES.Unihan_Variants);
    }

    private loadData(filePath: string): void {
        const filename: string = k_UNIHAN_DB_PATH + "/" + filePath;
        const content = fs.readFileSync(filename, 'utf-8');
        const lines: string[] = content.split('\n');

        lines.forEach((line: string): void => {
            if (line.length == 0 || line.at(0) == "#") return;

            const parts = line.split('\t');
            if (parts.length == 0) return;
            const character = unicodeToChar(parts[0]);
            const action = parts[1]
            const reading = parts[2];

            if (action == k_UNIHAN_ACTIONS.kMandarin) {
                this.kMandarin.set(character, reading);
            } else if (action == k_UNIHAN_ACTIONS.kJapanese) {
                this.kJapanese.set(character, reading.split(/\s/g));
            } else if (action == k_UNIHAN_ACTIONS.kJapaneseKun) {
                this.kJapaneseKun.set(character, reading.split(/\s/g));
            } else if (action == k_UNIHAN_ACTIONS.kJapaneseOn) {
                this.kJapaneseOn.set(character, reading.split(/\s/g));
            } else if (action == k_UNIHAN_ACTIONS.kSemanticVariant) {
                this.emplace_link(this.kSemanticVariant, character, reading);
            } else if (action == k_UNIHAN_ACTIONS.kSpecializedSemanticVariant) {
                this.emplace_link(this.kSpecializedSemanticVariant, character, reading);
            } else if (action == k_UNIHAN_ACTIONS.kSimplifiedVariant) {
                this.emplace_link(this.kSimplifiedVariant, character, reading); 
            } else if (action == k_UNIHAN_ACTIONS.kTraditionalVariant) {
                this.emplace_link(this.kTraditionalVariant, character, reading);
            }
        });
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

    public getTradChineseVariant(mychar: string): string | undefined {
        return this.kTraditionalVariant.getSingleLink(mychar);
    }

    // As a rule, these are indexed by character ('中') rather than code point (U+XXXX)

    // Readings
    private kMandarin: Map<string, string>;
    private kJapanese: Map<string, string[]>;
    private kJapaneseKun: Map<string, string[]>;
    private kJapaneseOn: Map<string, string[]>;

    // Variants
    private kSemanticVariant: LinkMap;
    private kSpecializedSemanticVariant: LinkMap;
    private kSimplifiedVariant: LinkMap;
    private kTraditionalVariant: LinkMap;

    // Unified link map
    private unifiedLinks: LinkMap;

    // Helper to build up unified link map while building other maps
    private emplace_link(lm: LinkMap, lhs: string, rhs: string)
    {
        this.unifiedLinks.emplace_bilink(lhs, rhs);
        lm.emplace_link(lhs, rhs);
    }
}