// Manages a transliteration map of Japanese, Simplified Chinese, and Traditional Chinese variants of each character
// Maintains readings, since reading similarity is used to merge characters
// Derived using unihan data
// 
// The spec of VariantMap should be thought of as "the minimal amount of maximum information" for the given chars -
// i.e. the user gives a list of chars that they want to describe, and the system tries to identify clusters within them
// and also pull in additional variants for each identified cluster

import * as fs from 'fs'
import autoBind from "auto-bind";
import { areRadicalStrokesClose, Unihan } from "./unihan";
import { apply_getter_to_arr, apply_multi_getter, CharacterType, combine_without_duplicates, common_elements, isSameArray, pairsOf, tuplesOf } from "./types";
import { log_v } from "./logging";
import * as OpenCC from 'opencc-js';

export type CharVariantEntry = {
    japaneseChar: string[];
    simpChineseChar: string[];
    tradChineseChar: string[];

    pinyin: string[];
    onyomi: string[];
    kunyomi: string[];
}

type VariantMapEntry = CharVariantEntry & {
    id: number;
};

const k_INVALID_ID = -1;
const defaultVariantMapEntry = (id: number): VariantMapEntry => ({
    id,
    japaneseChar: [],
    simpChineseChar: [],
    tradChineseChar: [],
    pinyin: [],
    onyomi: [],
    kunyomi: [],
});

export const getAllChars = (entry: CharVariantEntry): string[] =>
    combine_without_duplicates(entry.japaneseChar, entry.simpChineseChar, entry.tradChineseChar);

const missingChar = (entry: VariantMapEntry): boolean =>
    entry.japaneseChar.length == 0 || entry.simpChineseChar.length == 0 || entry.tradChineseChar.length == 0;

const checkAllVariants = (
    isVariant: (l: string, r: string) => boolean,
    lhs: string[],
    rhs: string[]
): boolean => {
    for (const c1 of lhs) {
        for (const c2 of rhs) {
            if (isVariant(c1, c2)) {
                return true;
            }
        }
    }
    return false;
}

export class VariantMap {
    constructor(unihan: Unihan, jpChars: Iterable<string>, simpChars: Iterable<string>, verbose: boolean = false) {
        autoBind(this);
        this.unihan = unihan;
        this.t2s = OpenCC.Converter({ from: 'hk', to: 'cn' });
        this.s2t = OpenCC.Converter({ from: 'cn', to: 'hk' });

        this.populateClusters(jpChars, simpChars, verbose);

        // log_v(verbose, "Populating readings");
        // this.forEachEntry((e) => this.populateReadings(e));

        // log_v(verbose, "Merging simliar readings");
        // const readMerged = this.mergeDuplicatesForPred(this.isReadingsSimilar);
        // log_v(verbose, `Merged ${readMerged} entries. Down to`, this.m_entries.size);
    }

    private populateClusters(jpChars: Iterable<string>, simpChars: Iterable<string>, verbose: boolean) {
        for (const c of jpChars)
            this.emplaceNewCharacter(c, CharacterType.Japanese);
        for (const c of simpChars)
            this.emplaceNewCharacter(c, CharacterType.SimplifiedChinese);
        log_v(verbose, "Initialized VariantMap with entries: ", this.m_entries.size);

        const charToCluster: Record<string, number> = {};
        const clusters: Record<number, string[]> = {};
        const no_id: string[] = [];
        const allChars: Set<string> = new Set([...jpChars, ...simpChars]);
        for (const char of allChars) {
            const cid = this.unihan.getClusterId(char);
            if (cid == 0) {
                no_id.push(char);
                continue;
            }

            if (clusters[cid] == undefined) {
                clusters[cid] = [];
            }
            if (!clusters[cid].includes(char))
                clusters[cid].push(char);
            charToCluster[char] = cid;
        }

        const isSameCluster = (e1: VariantMapEntry, e2: VariantMapEntry): boolean => {
            const chars1 = getAllChars(e1);
            const chars2 = getAllChars(e2);
            const pairs = pairsOf(chars1, chars2);

            return pairs.every((t) => charToCluster[t[0]] == charToCluster[t[1]] && charToCluster[t[0]] != 0);
        }

        // Merge cards in same cluster
        log_v(verbose, "Merging clusters");
        const cMerged = this.mergeDuplicatesForPred(isSameCluster);
        log_v(verbose, `Merged ${cMerged} entries. Down to`, this.m_entries.size);

        this.forEachEntry((e) => {
            e.tradChineseChar = [...new Set(e.simpChineseChar.map(c => this.s2t(c)))]
        });

        // Fill in empty chinese variants only
        this.forEachEntry((e => {
            if (e.simpChineseChar.length == 0 && e.japaneseChar.length != 0) {
                const jpChar = e.japaneseChar[0];
                const cid = charToCluster[jpChar];
                const clusterChars = this.unihan.getClusterById(cid);

                e.simpChineseChar = clusterChars.filter(c => this.unihan.isSimplified(c));
                e.tradChineseChar = [...new Set(e.simpChineseChar.map(c => this.s2t(c)))];
            }
        }))

        // Create a card for each cluster
        // for (const cid in clusters) {
        //     const clusterChars = clusters[cid];
        //     const id = this.getId();
        //     const entry = defaultVariantMapEntry(id);
        //     entry.japaneseChar = clusterChars.filter(c => this.unihan.isJapanese(c));
        //     entry.simpChineseChar = clusterChars.filter(c => this.unihan.isSimplified(c));
        //     entry.tradChineseChar = [...new Set(entry.simpChineseChar.map(c => this.s2t(c)))];

        //     this.emplaceEntry(entry);
        // }

        const jp_only = this.getEmpty().filter(e => e.simpChineseChar.length == 0).map(e => e.japaneseChar)
        const cn_only = this.getEmpty().filter(e => e.japaneseChar.length == 0).map(e => [e.simpChineseChar, e.tradChineseChar]);
        log_v(verbose, "Entries left with only japanese characters: ", jp_only);
        log_v(verbose, "Entries left with only chinese characters: ", cn_only);

    }

    private tryPopulateAll(jpChars: Iterable<string>, simpChars: Iterable<string>, verbose: boolean) {
        for (const c of jpChars)
            this.emplaceNewCharacter(c, CharacterType.Japanese);
        for (const c of simpChars)
            this.emplaceNewCharacter(c, CharacterType.SimplifiedChinese);
        log_v(verbose, "Initialized VariantMap with entries: ", this.m_entries.size);

        log_v(verbose, 'Populating simplified and traditional variants');
        this.forEachEntry((e) => this.populateSimpTradFromJpVariants(e));
        this.forEachEntry((e) => this.populateSimpFromTrad(e));
        this.forEachEntry((e) => this.populateTradFromSimp(e));

        log_v(verbose, "Entries left with empty characters: ", this.getEmpty().length);

        log_v(verbose, "Merging identical direct variants");
        const idMerged = this.mergeDuplicatesForPred(this.isIdenticalChar);
        log_v(verbose, `Merged ${idMerged} entries. Down to`, this.m_entries.size);

        log_v(verbose, "Populating readings");
        this.forEachEntry((e) => this.populateReadings(e));

        log_v(verbose, 'Populating japanese semantic variants');
        this.forEachEntry((e) => this.populateJapSemantic(e));
        log_v(verbose, "Entries left with empty characters: ", this.getEmpty().length);

        log_v(verbose, "Merging japanese and simplified direct variants");
        const jpSimpMerged = this.mergeDuplicatesForPred(this.isJpSimpDirectVariant);
        log_v(verbose, `Merged ${jpSimpMerged} entries. Down to`, this.m_entries.size);

        log_v(verbose, "Merging japanese and traditional direct variants");
        const jpTradMerged = this.mergeDuplicatesForPred(this.isJpTradDirectVariant);
        log_v(verbose, `Merged ${jpTradMerged} entries. Down to`, this.m_entries.size);

        log_v(verbose, "Populating readings");
        this.forEachEntry((e) => this.populateReadings(e));

        log_v(verbose, "Merging simliar readings");
        const readMerged = this.mergeDuplicatesForPred(this.isReadingsSimilar);
        log_v(verbose, `Merged ${readMerged} entries. Down to`, this.m_entries.size);

        log_v(verbose, "Merging identical direct variants");
        const idMerged1 = this.mergeDuplicatesForPred(this.isIdenticalChar);
        log_v(verbose, `Merged ${idMerged1} entries. Down to`, this.m_entries.size);

        log_v(verbose, 'Populating simplified and traditional variants');
        this.forEachEntry((e) => this.populateSimpTradFromJpVariants(e));
        this.forEachEntry((e) => this.populateSimpFromTrad(e));
        this.forEachEntry((e) => this.populateTradFromSimp(e));

        log_v(verbose, 'Guessing Japanese chars');
        this.forEachEntry((e) => this.populateGuessJapFromSimpTrad(e));
        log_v(verbose, "Entries left with empty characters: ", this.getEmpty().length);

        log_v(verbose, 'Guessing Chinese chars');
        this.forEachEntry((e) => this.populateGuessSimpTradFromJap(e));
        log_v(verbose, "Entries left with empty characters: ", this.getEmpty().length);

        const clustered = this.getMatchPred(e => e.japaneseChar.length > 1 && e.simpChineseChar.length > 1 && e.tradChineseChar.length > 1);
        const clusteredChars = clustered.map(e => [e.japaneseChar, e.simpChineseChar, e.tradChineseChar]);
        log_v(verbose, "These entries look suspiciously clustered", clusteredChars);

        log_v(verbose, "Could not verify these entries:");
        const overClustered = clustered.map((e) => this.getClusters(e))
            .filter(([_e, c]) => c.length > 1);
        for (const e of overClustered) log_v(verbose, e[1]);

        log_v(verbose, "Declustering clusters");
        overClustered.forEach(this.declusterEntry);

        log_v(verbose, "Repopulating readings");
        this.forEachEntry((e) => this.populateReadings(e));

        const jp_only = this.getEmpty().filter(e => e.simpChineseChar.length == 0).map(e => e.japaneseChar)
        const cn_only = this.getEmpty().filter(e => e.japaneseChar.length == 0).map(e => [e.simpChineseChar, e.tradChineseChar]);
        log_v(verbose, "Entries left with only japanese characters: ", jp_only);
        log_v(verbose, "Entries left with only chinese characters: ", cn_only);


    }

    private getMatchPred(pred: (e: VariantMapEntry) => boolean): VariantMapEntry[] {
        const empty: VariantMapEntry[] = [];
        this.forEachEntry(e => {
            if (pred(e)) empty.push(e);
        })
        return empty;
    }

    private getEmpty(): VariantMapEntry[] {
        return this.getMatchPred(missingChar);
    }

    // Check that every pair of characters is linked
    private getClusters(entry: VariantMapEntry): [VariantMapEntry, string[][]] {
        const chars = [...new Set(getAllChars(entry))];
        const graph: Record<string, boolean> = {};

        const pairs = tuplesOf(chars);
        for (const pair of pairs) {
            if (this.unihan.hasLink(pair[0], pair[1])) {
                graph[pair.join('')] = true;
                graph[[pair[1], pair[0]].join('')] = true;
            }
        }

        let visited: string[] = [];
        const toVisit: Set<string> = new Set(chars);
        const dfs = (node: string): void => {
            toVisit.delete(node);
            visited.push(node);
            const neighbors = chars.filter(c => graph[[node, c].join('')]);
            for (const neighbor of neighbors) {
                if (toVisit.has(neighbor)) {
                    dfs(neighbor);
                }
            }
        }

        const clusters: string[][] = [];
        while (toVisit.size != 0) {
            visited = [];
            dfs([...toVisit][0]);
            clusters.push(visited);
        }


        return [entry, clusters];
    }

    /* Population functions */
    public populateReadings(entry: CharVariantEntry) {
        const sources: string[][] = [entry.simpChineseChar, entry.tradChineseChar, entry.japaneseChar];

        const pinyin = apply_multi_getter(this.unihan.getMandarinPinyin, sources);
        const onyomi = apply_multi_getter(this.unihan.getJapaneseOn, sources);
        const kunyomi = apply_multi_getter(this.unihan.getJapaneseKun, sources);

        entry.pinyin = Array.from(new Set(pinyin));
        entry.onyomi = Array.from(new Set(onyomi));
        entry.kunyomi = Array.from(new Set(kunyomi));
    }

    public populateEmptyCharsFromClusterId(entry: CharVariantEntry): void {
        const allChars = getAllChars(entry);
        const clusterIds = allChars.map(c => this.unihan.getClusterId(c)).filter(cid => cid != 0);

        const chars: string[] = [...new Set(clusterIds.map(cid => this.unihan.getClusterById(cid)).flat())];

        if (entry.japaneseChar.length == 0) {
            entry.japaneseChar = chars.filter(c => this.unihan.isJapanese(c));
        }
        if (entry.simpChineseChar.length == 0) {
            entry.simpChineseChar = chars.filter(c => this.unihan.isSimplified(c));
            entry.tradChineseChar = [...new Set(entry.simpChineseChar.map(c => this.s2t(c)))];
        }
    }


    private populateSimpTradFromJpVariants(entry: VariantMapEntry) {
        // If trad character is empty, guess it from japanese
        if (entry.tradChineseChar.length == 0 && entry.japaneseChar.length != 0) {
            entry.tradChineseChar = apply_getter_to_arr(this.unihan.getTradChineseVariants, entry.japaneseChar);
        }
        // If simp character is empty, guess it from japanese
        if (entry.simpChineseChar.length == 0 && entry.japaneseChar.length != 0) {
            entry.simpChineseChar = apply_getter_to_arr(this.unihan.getSimpChineseVariants, entry.japaneseChar);
        }
    }

    private populateSimpFromTrad(entry: VariantMapEntry) {
        entry.simpChineseChar = combine_without_duplicates(
            entry.simpChineseChar,
            entry.tradChineseChar.map(c => this.t2s(c))
        );
    }

    private populateTradFromSimp(entry: VariantMapEntry) {
        entry.tradChineseChar = combine_without_duplicates(
            entry.tradChineseChar,
            entry.simpChineseChar.map(c => this.s2t(c))
        );
    }

    private populateJapSemantic(entry: VariantMapEntry) {
        if (entry.japaneseChar.length == 0 && (entry.simpChineseChar.length != 0 || entry.tradChineseChar.length != 0)) {
            const guess_sources = combine_without_duplicates(entry.simpChineseChar, entry.tradChineseChar);
            let candidates: string[] = apply_getter_to_arr(this.unihan.getGetSemanticOrSpecializedVariants, guess_sources);
            candidates = candidates.filter(c => this.unihan.isJapanese(c));

            entry.japaneseChar = candidates;
        }
    }

    private populateGuessJapFromSimpTrad(entry: VariantMapEntry) {
        if (entry.japaneseChar.length == 0 && (entry.simpChineseChar.length != 0 || entry.tradChineseChar.length != 0)) {
            let candidates = combine_without_duplicates(entry.simpChineseChar, entry.tradChineseChar);
            candidates = candidates.filter(e => this.unihan.isJapanese(e));

            entry.japaneseChar = candidates;
        }
    }

    private populateGuessSimpTradFromJap(entry: VariantMapEntry) {
        if (entry.japaneseChar.length != 0) {
            if (entry.simpChineseChar.length == 0) {
                entry.simpChineseChar = entry.japaneseChar.filter(c => this.unihan.isSimplified(c));
            }
            if (entry.tradChineseChar.length == 0) {
                entry.tradChineseChar = entry.japaneseChar.filter(c => this.unihan.isTraditional(c));
            }
        }
        this.populateTradFromSimp(entry);
        this.populateSimpFromTrad(entry);
    }

    private depopulateNonMembers(entry: VariantMapEntry, jpMembers: Set<string>, simpCnMembers: Set<string>) {
        // return;
        if (entry.japaneseChar.length > 0) {
            const trimmed = entry.japaneseChar.filter(e => jpMembers.has(e) || simpCnMembers.has(e));
            // if (trimmed.length != 0) 
            entry.japaneseChar = trimmed;
        }
        if (entry.simpChineseChar.length > 0) {
            const trimmed = entry.simpChineseChar.filter(e => simpCnMembers.has(e) || jpMembers.has(e));
            if (trimmed.length != 0)
                entry.simpChineseChar = trimmed;
        }

        entry.tradChineseChar = entry.simpChineseChar.map(e => this.s2t(e));
    }

    /* Predicates */
    private isJpToSimp(entry1: VariantMapEntry, entry2: VariantMapEntry): boolean {
        const isVariant = checkAllVariants(this.unihan.isSimplifiedVariant, entry1.japaneseChar, entry2.simpChineseChar);
        return isVariant && isSameArray(entry1.pinyin, entry2.pinyin);
    }

    private isSimpToJp(entry1: VariantMapEntry, entry2: VariantMapEntry): boolean {
        const isVariant = checkAllVariants(this.unihan.isSemanticOrSpecializedVariant, entry1.simpChineseChar, entry2.japaneseChar);
        return isVariant && isSameArray(entry1.pinyin, entry2.pinyin);
    }

    private isJpSimpDirectVariant(entry1: VariantMapEntry, entry2: VariantMapEntry): boolean {
        return this.isJpToSimp(entry1, entry2) || this.isSimpToJp(entry1, entry2);
    }


    private isJpToTrad(entry1: VariantMapEntry, entry2: VariantMapEntry): boolean {
        const isVariant = checkAllVariants(this.unihan.isTraditionalVariant, entry1.japaneseChar, entry2.tradChineseChar);
        return isVariant && isSameArray(entry1.pinyin, entry2.pinyin);
    }

    private isTradToJp(entry1: VariantMapEntry, entry2: VariantMapEntry): boolean {
        const isVariant = checkAllVariants(this.unihan.isSemanticOrSpecializedVariant, entry1.tradChineseChar, entry2.japaneseChar);
        return isVariant && isSameArray(entry1.pinyin, entry2.pinyin);
    }

    private isJpTradDirectVariant(entry1: VariantMapEntry, entry2: VariantMapEntry): boolean {
        return this.isJpToTrad(entry1, entry2) || this.isTradToJp(entry1, entry2);
    }

    private isIdenticalChar(entry1: VariantMapEntry, entry2: VariantMapEntry): boolean {
        return common_elements(entry1.japaneseChar, entry2.simpChineseChar).length != 0
            || common_elements(entry1.japaneseChar, entry2.tradChineseChar).length != 0;
    }

    private isReadingsSimilar(entry1: VariantMapEntry, entry2: VariantMapEntry): boolean {
        if (!isSameArray(entry1.pinyin, entry2.pinyin))
            return false;

        const getJpReadings = (c: VariantMapEntry): Set<string> => new Set([...c.kunyomi, ...c.onyomi]);
        const r1: Set<string> = getJpReadings(entry1);
        const r2: Set<string> = getJpReadings(entry2);
        const common = common_elements([...r1], [...r2]);

        const match = common.length; // # of jp readings
        const max = Math.min(r1.size, r2.size);
        const pct = match / max; // # proportion matched


        // check character mismatch - if any set is disjoint and nonempty, it can't be merged
        const char_disjoint = (a: string[], b: string[]): boolean =>
            common_elements(a, b).length == 0 && a.length != 0 && b.length != 0;
        const m_sp = char_disjoint(entry1.simpChineseChar, entry2.simpChineseChar);
        const m_td = char_disjoint(entry1.tradChineseChar, entry2.tradChineseChar);
        const m_jp = char_disjoint(entry1.japaneseChar, entry2.japaneseChar);

        // if (m_sp || m_td || m_jp) return false;


        // If it matches a bit, and the radical indices are close
        if (match >= 1) {
            const ac1 = getAllChars(entry1);
            const ac2 = getAllChars(entry2);

            const pairs = pairsOf(ac1, ac2);
            for (const pair of pairs) {
                const [a, b] = pair;
                const rs_a = this.unihan.getRadicalStrokeIdx(a);
                const rs_b = this.unihan.getRadicalStrokeIdx(b);
                if (match >= 3 && pct >= 0.8) {
                    if (areRadicalStrokesClose(rs_a, rs_b, 2)) {
                        console.log(pair);
                        return true;
                    }
                }
                // else {
                //     if (areRadicalStrokesClose(rs_a, rs_b, 0)) {
                //         return true;
                //     }
                // }
            }
        }
        return false;

        // return false;
    }

    /* Merge utilties */

    private mergeSet(s: Set<[number, number]>): number {
        let count = 0;
        for (const dup of s) {
            if (this.tryMergeEntries(dup[0], dup[1])) count++;
        }

        return count;
    }

    private getDuplicatesForPred(pred: (e1: VariantMapEntry, e2: VariantMapEntry) => boolean): Set<[number, number]> {
        const duplicates: Set<[number, number]> = new Set();
        const entriesArray = Array.from(this.m_entries.entries());

        for (let i = 0; i < entriesArray.length; i++) {
            for (let j = i + 1; j < entriesArray.length; j++) {
                const [id1, entry1] = entriesArray[i];
                const [id2, entry2] = entriesArray[j];

                // Do something with (key1, value1) and (key2, value2)
                if (pred(entry1, entry2))
                    duplicates.add([id1, id2]);
            }
        }

        return duplicates
    }

    private mergeDuplicatesForPred(pred: (e1: VariantMapEntry, e2: VariantMapEntry) => boolean): number {
        const duplicates = this.getDuplicatesForPred(pred);
        return this.mergeSet(duplicates);
    }

    private declusterEntry(clusteredEntry: [VariantMapEntry, string[][]]) {
        const [entry, clusters] = clusteredEntry;
        this.m_entries.delete(entry.id);
        for (const cluster of clusters) {
            const id = this.getId();
            const japaneseChar: string[] = cluster.filter(c => this.unihan.isJapanese(c));
            const simpChineseChar: string[] = cluster.filter(c => this.unihan.isSimplified(c));
            const tradChineseChar: string[] = [... new Set(simpChineseChar.map(c => this.s2t(c)))];

            const newEntry: VariantMapEntry = {
                ...defaultVariantMapEntry(id),
                japaneseChar,
                simpChineseChar,
                tradChineseChar
            };
            this.m_entries.set(id, newEntry);
        }
    }

    // Returns if merge was successful or not
    private tryMergeEntries(id1: number, id2: number): boolean {
        const old1 = this.m_entries.get(id1);
        const old2 = this.m_entries.get(id2);
        if (!old1 || !old2) {
            return false;
        }

        // // Final check: don't allow entries to be merged if pinyin isn't exactly the same
        // if (!isSameArray(old1.pinyin, old2.pinyin)) return false;

        const id = this.getId();
        const newEntry = defaultVariantMapEntry(id);

        let key: keyof VariantMapEntry;
        for (key in newEntry) {
            if (key == 'id') continue;
            newEntry[key] = combine_without_duplicates(old1[key], old2[key]);
        }

        this.m_entries.delete(id1);
        this.m_entries.delete(id2);

        if (this.m_entries.has(id)) {
            console.error("Entry should not be defined");
            return false;
        }
        this.m_entries.set(id, newEntry);

        return true;
    }

    // Getters and iterators
    public forEachEntry(handler: (entry: VariantMapEntry) => void): void {
        this.m_entries.forEach(handler);
    }
    // Export
    public writeToFile(path: string): void {
        const writeStream = fs.createWriteStream(path, { flags: 'w', encoding: 'utf8' });
        writeStream.on('drain', () => console.log('Drain event triggered'));

        this.forEachEntry(e => {
            const vals: string[] = [];
            vals.push(e.japaneseChar.join(','));
            vals.push(e.simpChineseChar.join(','));
            vals.push(e.tradChineseChar.join(','));
            vals.push(e.pinyin.join(','));
            vals.push(e.kunyomi.join(','));
            vals.push(e.onyomi.join(','));
            writeStream.write(vals.join('\t') + "\n");
        });
        writeStream.end(() => { console.log('Finished writing file.'); });
    }
    // Basic Map logic
    private emplaceNewCharacter(char: string, charType: CharacterType) {
        const id = this.getId();
        const entry = defaultVariantMapEntry(id);

        if (charType == CharacterType.Japanese) {
            entry.japaneseChar.push(char);
        } else if (charType == CharacterType.SimplifiedChinese) {
            entry.simpChineseChar.push(char);
        }

        this.emplaceEntry(entry);
    }
    private emplaceEntry(entry: VariantMapEntry) {
        this.m_entries.set(entry.id, entry);
    }

    private getId(): number {
        return this.m_id++;
    }

    private unihan: Unihan;
    private t2s: OpenCC.ConvertText;
    private s2t: OpenCC.ConvertText;

    private m_id: number = 0;
    private m_entries: Map<number, VariantMapEntry> = new Map();
}