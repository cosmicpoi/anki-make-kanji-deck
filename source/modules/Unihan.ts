import * as fs from 'fs'
import * as wanakana from 'wanakana';

import autoBind from "auto-bind";
import { areMeaningsSimilar, combine_without_duplicates, isHanCharacter, isSameArray, pairsOf } from 'types';
import { k_NUM_KANGXI_RADICALS } from 'consts/consts';
import { KNOWN_LINKS } from 'consts/knownLinks';

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

export function areRadicalStrokesClose(rsa1: string[], rsa2: string[], margin: number = 1): boolean {
    if (rsa1.length == 0 || rsa2.length == 0) return false;
    const compareRs = (rs1: string, rs2: string): boolean => {
        const [r1, s1] = rs1.split('.').map(s => parseInt(s));
        const [r2, s2] = rs2.split('.').map(s => parseInt(s));
        return r1 == r2 && Math.abs(s1 - s2) <= margin + 0.1;
    }
    const pairs = pairsOf(rsa1, rsa2);
    for (const pair of pairs) {
        if (compareRs(pair[0], pair[1])) return true;
    }

    return false;
}

//------------------------------------------------------------------------------
// Unihan library implementation
//------------------------------------------------------------------------------

type UnihanEntry = {
    /* Raw data */
    glyph: string;
    // IRGs
    kIRG_GSource?: string;
    kIRG_HSource?: string;
    kIRG_JSource?: string;
    kTotalStrokes?: number;
    kRSUnicode?: string[];
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

const k_INVALID_CLUSTER_ID = 0;

// Class to load and interact with the Unihan db
export class Unihan {
    constructor() {
        autoBind(this);
    }

    static async create(unihanDir: string, props?: { validateLinks?: boolean }) {
        const unihan = new Unihan();

        // load data from files

        let key: keyof typeof k_UNIHAN_FILENAMES;
        for (key in k_UNIHAN_FILENAMES) {
            await unihan.loadData(unihanDir, k_UNIHAN_FILENAMES[key]);
        }

        if (props?.validateLinks) {
            console.log("Verifying known links:")
            const isSimilar = ([c1, c2]: [string, string]): boolean => {
                const entry1 = unihan.getEntry(c1);
                const entry2 = unihan.getEntry(c2);
                if (!entry1 || !entry2) return false;
                // Verify pinyin is identical
                const p1 = unihan.getMandarinPinyin(c1);
                const p2 = unihan.getMandarinPinyin(c2);
                if (!isSameArray(p1, p2)) return false;

                const eng1 = unihan.getEnglishDefinition(c1);
                const eng2 = unihan.getEnglishDefinition(c2);
                if (eng1.length == 0 || eng2.length == 0) return false;
                if (!areMeaningsSimilar(eng1[0], eng2[0], { logFails: true })) return false;

                return true;
            };
            KNOWN_LINKS.forEach(([c1, c2]) => {
                if (!isSimilar([c1, c2])) {
                    console.error([c1, c2], "WARN: tuple does not match");
                }
            });
        }

        KNOWN_LINKS.forEach(tup => unihan.m_bufferedLinks.push(tup));
        unihan.flushBufferedLinks();
        unihan.createClusterIndex();

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
            else if (action == 'kRSUnicode') {
                this.emplace_rs(character, reading);
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
                // emplace_variants('kSpecializedSemanticVariant', character, reading);
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

    private createClusterIndex(): void {
        const allChars = new Set(this.m_entries.keys());
        // const chars = this.
        let visited: Set<string> = new Set();
        const toVisit: Set<string> = new Set(allChars);
        const dfs = (node: string): void => {
            toVisit.delete(node);
            visited.add(node);
            const neighbors: string[] = this.m_links.get(node) || [];
            const neighbor_links = neighbors;
            for (const neighbor of neighbor_links) {
                if (toVisit.has(neighbor)) {
                    dfs(neighbor);
                }
            }
        }

        const clusters: string[][] = [];
        while (toVisit.size != 0) {
            visited = new Set();
            for (const e of toVisit) {
                dfs(e);
                break;
            }
            clusters.push([...visited]);

        }

        let id = 1;
        for (const cluster of clusters) {
            this.m_clusters.set(id, cluster);
            for (const el of cluster) {
                this.m_charToClusterId.set(el, id);
            }
            id++;
        }
    }

    // Getters
    public isCharacter(mychar: string): boolean {
        return this.m_entries.has(mychar);
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

    public getTotalStrokes(mychar: string): number {
        return this.m_entries.get(mychar)?.kTotalStrokes || 0;
    }

    public getRadicalStrokeIdx(mychar: string): string[] {
        return this.m_entries.get(mychar)?.kRSUnicode || [];
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

    public getEnglishDefinition(mychar: string): string[] {
        return this.m_entries.get(mychar)?.kDefinition || [];
    }

    // variant getters
    public getSimpChineseVariants(mychar: string): string[] {
        return this.m_entries.get(mychar)?.kSimplifiedVariant || [];
    }

    public getTradChineseVariants(mychar: string): string[] {
        return this.m_entries.get(mychar)?.kTraditionalVariant || [];
    }

    public getGetSemanticOrSpecializedVariants(mychar: string): string[] {
        const semantic = this.m_entries.get(mychar)?.kSemanticVariant || [];
        const specialized = this.m_entries.get(mychar)?.kSpecializedSemanticVariant || [];
        return combine_without_duplicates(semantic, specialized);
    }

    public isSimplifiedVariant(lhs: string, rhs: string): boolean {
        const res = this.m_entries.get(lhs);
        if (!res) return false;
        return res.kSimplifiedVariant?.includes(rhs) || false
    }

    public isTraditionalVariant(lhs: string, rhs: string): boolean {
        const res = this.m_entries.get(lhs);
        if (!res) return false;
        return res.kTraditionalVariant?.includes(rhs) || false
    }

    public isSemanticOrSpecializedVariant(lhs: string, rhs: string): boolean {
        const res = this.m_entries.get(lhs);
        if (!res) return false;
        const semantic = res.kSemanticVariant?.includes(rhs) || false;
        const specialized = res.kSemanticVariant?.includes(rhs) || false;
        return semantic || specialized;
    }

    // Should be one-to-one with cluster graph
    public hasLink(lhs: string, rhs: string): boolean {
        return this.m_links.get(lhs)?.includes(rhs) || false;
    }


    // private hasLinkOneWay(lhs: string, rhs: string): boolean {
    //     if (!this.extraLinkConditions(lhs, rhs)) return false;
    //     return this.isSimplifiedVariant(lhs, rhs)
    //         || this.isTraditionalVariant(lhs, rhs)
    //         || this.isSemanticOrSpecializedVariant(lhs, rhs);
    // }

    // Internal emplace helpers
    private emplace_irg(key: UnihanIRG, lhs: string, rhs: string) {
        const entry = this.at(lhs);
        if (key == 'kTotalStrokes') {
            entry[key] = parseInt(rhs);
        }
        else {
            entry[key] = rhs;
        }
    }

    private emplace_rs(char: string, rs: string[]) {
        const entry = this.at(char);
        if (entry['kRSUnicode'] == undefined) entry['kRSUnicode'] = [];
        entry['kRSUnicode'] = [...entry['kRSUnicode'], ...rs];


        for (const idx of rs) {
            const arr = this.m_rsToChar.get(idx);
            if (!arr) {
                this.m_rsToChar.set(idx, [char]);
                continue;
            }
            arr.push(char);
        }
    }

    private emplace_variants(key: UnihanVariant, lhs: string, rhs: string[]) {
        const entry = this.at(lhs);
        if (!entry[key]) entry[key] = [];
        entry[key] = entry[key].concat(rhs);

        for (const rr of rhs) {
            for (const tup of [[lhs, rr], [rr, lhs]]) {
                const [l, r] = tup
                this.m_bufferedLinks.push([l, r]);
                this.m_bufferedLinks.push([r, l]);
            }
        }
    }

    private extraLinkConditions(l: string, r: string): boolean {
        const l_pinyin = this.getMandarinPinyin(l);
        const r_pinyin = this.getMandarinPinyin(r);
        if (l_pinyin.length == 0 || r_pinyin.length == 0) return false;
        if (!isSameArray(l_pinyin, r_pinyin)) return false;
        return true;
    }

    private flushBufferedLinks() {
        const emplaceLink = (l: string, r: string) => {
            // Emplace link
            const neighbors = this.m_links.get(l);
            if (neighbors == undefined) {
                this.m_links.set(l, [r]);
            }
            else if (!neighbors.includes(r)) neighbors.push(r);
        }

        for (const link of this.m_bufferedLinks) {
            const [l, r] = link
            // Skip certain conditions
            if (!this.extraLinkConditions(l, r)) continue;

            // Emplace link
            emplaceLink(l, r);
            emplaceLink(r, l);
        }

        this.m_bufferedLinks = [];
    }

    private emplace_readings(key: UnihanReading, lhs: string, rhs: string[]) {
        const entry = this.at(lhs);
        if (!entry[key]) entry[key] = [];
        entry[key] = entry[key].concat(rhs);
    }

    public getEntry(k: string): UnihanEntry | undefined {
        return this.m_entries.get(k);
    }

    public getByRs(rs: string): UnihanEntry[] {
        const chars = this.m_rsToChar.get(rs);
        if (chars == undefined) return [];

        return chars.map(c => this.m_entries.get(c)).filter(e => !!e)
    }

    // 0 means there is no cluster
    public getClusterId(char: string): number {
        return this.m_charToClusterId.get(char) || k_INVALID_CLUSTER_ID;
    }

    public getClusterById(id: number): string[] {
        if (id == k_INVALID_CLUSTER_ID) return [];
        return this.m_clusters.get(id) || [];
    }

    public getKangxiRadicals(radicalNum: number): UnihanEntry[] {
        if (radicalNum < 1 || radicalNum > k_NUM_KANGXI_RADICALS) {
            console.error("invalid radical number");
            return [];
        }
        const asStr = radicalNum.toString();
        const radVariants = [asStr + '.0', asStr + "'.0", asStr + "''.0", asStr + "'''.0"];
        const candidates = radVariants.map(c => this.getByRs(c)).filter(s => !!s);
        return [...new Set(candidates.flat())];
    }

    // Returns list of radicals as an array of 214 string arrays (entry i being the ith radical and variants)
    public getAllKangxiRadicals(): string[][] {
        const rads: string[][] = [[]];
        for (let i = 1; i <= k_NUM_KANGXI_RADICALS; i++) {
            const rad = this.getKangxiRadicals(i).map(c => c.glyph)
                .filter(c => isHanCharacter(c) && (this.isJapanese(c) || this.isSimplified(c) || this.isTraditional(c)));
            rads.push(rad);
        }

        return rads;
    }

    private at(k: string): UnihanEntry {
        const res = this.m_entries.get(k);
        if (!res) {
            const newEntry = { glyph: k };
            this.m_entries.set(k, newEntry)
            return newEntry;
        }
        return res;
    }

    // Cluster index
    private m_charToClusterId: Map<string, number> = new Map();
    private m_clusters: Map<number, string[]> = new Map();
    // Connectivity index
    private m_bufferedLinks: [string, string][] = [];
    private m_links: Map<string, string[]> = new Map();
    // Characters indexed by RS index
    private m_rsToChar: Map<string, string[]> = new Map();
    // Entries indexed by character (rather than code point)
    private m_entries: Map<string, UnihanEntry> = new Map();
}