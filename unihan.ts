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

class VariantMap {
    private map: Map<string, string[]>;
    constructor() {
        autoBind(this);
        this.map = new Map();
    }

    public emplace_link(lhs_str: string, rhs_str: string): void {
        const lhs = getCleanChar(lhs_str);
        const rhs = getCleanChar(rhs_str);
        if (!this.map.has(lhs)) {
            this.map.set(lhs, []);
        }
        if (!this.map.has(rhs)) {
            this.map.set(rhs, []);
        }

        let lhs_links = this.map.get(lhs);
        if (lhs_links && !lhs_links.includes(rhs)) {
            lhs_links.push(rhs);
        }

        let rhs_links = this.map.get(rhs);
        if (rhs_links && !rhs_links.includes(lhs)) {
            rhs_links.push(lhs);
        }
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
        this.kSemanticVariant = new VariantMap();
        this.kSpecializedSemanticVariant = new VariantMap();
        this.kSimplifiedVariant = new VariantMap();
        this.kTraditionalVariant = new VariantMap();

        this.kMandarin = new Map();
        this.kJapanese = new Map();
        this.kJapaneseKun = new Map();
        this.kJapaneseOn = new Map();

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
                this.kSemanticVariant.emplace_link(character, reading);
            } else if (action == k_UNIHAN_ACTIONS.kSpecializedSemanticVariant) {
                this.kSpecializedSemanticVariant.emplace_link(character, reading);
            } else if (action == k_UNIHAN_ACTIONS.kSimplifiedVariant) {
                this.kSimplifiedVariant.emplace_link(character, reading);
            } else if (action == k_UNIHAN_ACTIONS.kTraditionalVariant) {
                this.kTraditionalVariant.emplace_link(character, reading);
            }


        });
    }

    // As a rule, these are indexed by character ('中') rather than code point (U+XXXX)

    // Readings
    private kMandarin: Map<string, string>;
    private kJapanese: Map<string, string[]>;
    private kJapaneseKun: Map<string, string[]>;
    private kJapaneseOn: Map<string, string[]>;

    // Variants
    private kSemanticVariant: VariantMap;
    private kSpecializedSemanticVariant: VariantMap;
    private kSimplifiedVariant: VariantMap;
    private kTraditionalVariant: VariantMap;
}