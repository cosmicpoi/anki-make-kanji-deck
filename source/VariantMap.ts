// Manages a transliteration map of Japanese, Simplified Chinese, and Traditional Chinese variants of each character
// Maintains readings, since reading similarity is used to merge characters
// Derived using unihan data
// 
// The spec of VariantMap should be thought of as "the minimal amount of maximum information" for the given chars -
// i.e. the user gives a list of chars that they want to describe, and the system tries to identify clusters within them
// and also pull in additional variants for each identified cluster

import autoBind from "auto-bind";
import { Unihan } from "Unihan";
import { apply_multi_getter, areMeaningsSimilar, CharacterType, combine_without_duplicates, common_elements, getMatchAndPct, isSameArray, pairsOf } from "./types";
import { log_v } from "../logging";
import * as OpenCC from 'opencc-js';
import { Cedict } from './consts/Cedict';
import { Kanjidic } from './modules/Kanjidic';

export type CharVariantEntry = {
    japaneseChar: string[];
    simpChineseChar: string[];
    tradChineseChar: string[];

    pinyin: string[];
    onyomi: string[];
    kunyomi: string[];

    englishMeaning: string[],
}

type VariantMapEntry = CharVariantEntry & {
    id: number;
};

const k_INVALID_ID = 0;
const defaultVariantMapEntry = (id: number): VariantMapEntry => ({
    id,
    japaneseChar: [],
    simpChineseChar: [],
    tradChineseChar: [],
    pinyin: [],
    onyomi: [],
    kunyomi: [],
    englishMeaning: [],
});

export const getAllChars = (entry: CharVariantEntry): string[] =>
    combine_without_duplicates(entry.japaneseChar, entry.simpChineseChar, entry.tradChineseChar);

const missingChar = (entry: VariantMapEntry): boolean =>
    entry.japaneseChar.length == 0 || entry.simpChineseChar.length == 0 || entry.tradChineseChar.length == 0;

const isDisjoint = (entry1: VariantMapEntry, entry2: VariantMapEntry) => {
    const disjointjp = [entry1.japaneseChar, entry2.japaneseChar].filter(a => a.length != 0).length == 1
    const disjointcn = [entry1.simpChineseChar, entry2.simpChineseChar].filter(a => a.length != 0).length == 1
    const disjoint = disjointjp && disjointcn;
    return disjoint
}

type BinaryPred = (e1: VariantMapEntry, e2: VariantMapEntry) => boolean;
const andDisjoint = (pred: BinaryPred): BinaryPred =>
    (e1: VariantMapEntry, e2: VariantMapEntry) => isDisjoint(e1, e2) && pred(e1, e2);

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
    constructor(
        jpChars: Iterable<string>,
        simpChars: Iterable<string>,
        modules: {
            unihan: Unihan,
            kanjidic: Kanjidic,
            cedict: Cedict
        },
        verbose: boolean = false
    ) {
        const { unihan, kanjidic, cedict } = modules;
        autoBind(this);
        this.unihan = unihan;
        this.kanjidic = kanjidic;
        this.cedict = cedict;
        this.s2t = OpenCC.Converter({ from: 'cn', to: 'hk' });

        this.populateClusters(jpChars, simpChars, verbose);

        this.buildCharIndex();
    }

    private buildCharIndex(): void {
        this.m_charToId.clear();
        this.m_entries.forEach((entry, id) => {
            const chars = getAllChars(entry);
            chars.forEach((c) => this.m_charToId.set(c, id));
        });
    }

    private populateClusters(jpChars: Iterable<string>, simpChars: Iterable<string>, verbose: boolean) {
        for (const c of jpChars)
            this.emplaceNewCharacter(c, CharacterType.Japanese);
        for (const c of simpChars)
            this.emplaceNewCharacter(c, CharacterType.SimplifiedChinese);
        log_v(verbose, "Initialized VariantMap with entries: ", this.m_entries.size);

        // There is another technique where we create a card for each cluster like so:
        //      for (const cid in clusters) {
        //          const clusterChars = clusters[cid];
        //          const id = this.getId();
        //          const entry = defaultVariantMapEntry(id);
        //          entry.japaneseChar = clusterChars.filter(c => this.unihan.isJapanese(c));
        //          entry.simpChineseChar = clusterChars.filter(c => this.unihan.isSimplified(c));
        //          entry.tradChineseChar = [...new Set(entry.simpChineseChar.map(c => this.s2t(c)))];
        //          this.emplaceEntry(entry);
        //      }
        // However this is not a good solution in practice because a lot of primarily-japanese characters are still 
        // registered in Chinese databases as a low-frequency character and vice versa. What ends up happening is that 
        // we get different entries for 楽/楽/楽, 樂/乐/樂 because they are technically in other's lexicons.
        // A better approach is to assume the user only wants to learn about the given characters, and seek to merge data
        // without populating characters from outside sources (except to find traditional variants).


        // Generate a subgraph of the unihan cluster graph. The unihan data is sometimes a little too detailed and links
        // characters that only has historical or academic relationships like 奶 and 你, which derive from the same 
        // character historically but have no relationship in modern use.
        const tradChars = [...simpChars].map(c => this.s2t(c));

        const charToCluster: Record<string, number> = {};
        const clusters: Record<number, string[]> = {};
        const no_id: string[] = [];
        const allChars: Set<string> = new Set([...jpChars, ...simpChars, ...tradChars]);
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

        // Now, merge cards based on subgraph cluster. First we populate traditional characters. Then we check if each 
        // jp vs simp/trad pair is in the same subgraph or not.
        const mapTradToSimp = (e: VariantMapEntry) => { e.tradChineseChar = [...new Set(e.simpChineseChar.map(c => this.s2t(c)))] }
        this.forEachEntry(mapTradToSimp);

        const getCharList = (e: VariantMapEntry): [string, string, string] =>
            [e.japaneseChar.join(','), e.simpChineseChar.join(','), e.tradChineseChar.join(',')];

        // Merge cards in same cluster
        const isSameCluster = (e1: VariantMapEntry, e2: VariantMapEntry): boolean => {
            const chars1 = getAllChars(e1);
            const chars2 = getAllChars(e2);
            const pairs = pairsOf(chars1, chars2);
            // Check it's not the invalid cluster 0
            return pairs.every((t) => charToCluster[t[0]] == charToCluster[t[1]] && charToCluster[t[0]] != 0);
        }

        log_v(verbose, "Merging clusters");
        const cMerged = this.mergeDuplicatesForPred(andDisjoint(isSameCluster));
        cMerged.forEach(([o1, o2, n]) => {
            // console.log(getCharList(o1), getCharList(o2), getCharList(n));
        });
        log_v(verbose, `Merged ${cMerged.length} entries. Down to`, this.m_entries.size);

        // Remap trad chars based on new data
        this.forEachEntry(mapTradToSimp);

        // Now try to find duplicates via character checking

        log_v(verbose, "Merging identical direct variants");
        const idMerged = this.mergeDuplicatesForPred(andDisjoint(this.isIdenticalChar));
        log_v(verbose, `Merged ${idMerged.length} entries. Down to`, this.m_entries.size);

        log_v(verbose, "Populating readings");
        this.forEachEntry((e) => this.populateReadings(e));

        log_v(verbose, "Merging simliar readings");
        const readMerged = this.mergeDuplicatesForPred(andDisjoint((e1, e2) => this.isReadingsSimilar(e1, e2)));
        readMerged.forEach(([o1, o2, n]) => {
            console.log(getCharList(o1), getCharList(o2), getCharList(n));
        });
        log_v(verbose, `Merged ${readMerged.length} entries. Down to`, this.m_entries.size);


        // log_v(verbose, "Merging identical direct variants");
        // const idMerge2 = this.mergeDuplicatesForPred(this.isIdenticalChar);
        // log_v(verbose, `Merged ${idMerge2.length} entries. Down to`, this.m_entries.size);

        log_v(verbose, "Repopulating readings");
        this.forEachEntry((e) => this.populateReadings(e));

        // const jp_only = this.getEmpty().filter(e => e.simpChineseChar.length == 0).map(e => e.japaneseChar)
        // const cn_only = this.getEmpty().filter(e => e.japaneseChar.length == 0).map(e => [e.simpChineseChar, e.tradChineseChar]);
        // log_v(verbose, "Entries left with only japanese characters: ", jp_only);
        // log_v(verbose, "Entries left with only chinese characters: ", cn_only);
    }

    /* Population functions */

    // Tries to populate readings for the semantic unit as a whole. May not necessarily provide
    // useful data for actual cards. Should repopulate outside when you generate cards
    public populateReadings(e: CharVariantEntry) {
        // TODO: integrate sorting
        const sources: string[][] = [e.simpChineseChar, e.tradChineseChar, e.japaneseChar];

        const pinyin = apply_multi_getter(this.unihan.getMandarinPinyin, sources);
        const onyomi = apply_multi_getter(this.unihan.getJapaneseOn, sources);
        const kunyomi = apply_multi_getter(this.unihan.getJapaneseKun, sources);

        e.pinyin = Array.from(new Set(pinyin));
        e.onyomi = Array.from(new Set(onyomi));
        e.kunyomi = Array.from(new Set(kunyomi));

        const unihanDefsJp: string[] = this.unihan.getEnglishDefinition(e.japaneseChar[0]);
        const unihanDefsCn: string[] = this.unihan.getEnglishDefinition(e.simpChineseChar[0]);
        const kanjidicDefs: string[] = this.kanjidic.getMeaning(e.japaneseChar[0]);
        const cedictDefs: string[] = this.cedict.getDefinitions(e.simpChineseChar[0]);

        let englishMeaning = unihanDefsJp;
        // prefer unihan => kanjidict => cedict in this order
        if (englishMeaning.length == 0) {
            englishMeaning = unihanDefsCn;
        }
        if (englishMeaning.length == 0) {
            englishMeaning = kanjidicDefs;
        }
        if (englishMeaning.length == 0) {
            englishMeaning = cedictDefs;
        }

        e.englishMeaning = englishMeaning;
    }

    /* Predicates */

    private isIdenticalChar(entry1: VariantMapEntry, entry2: VariantMapEntry): boolean {
        return common_elements(entry1.japaneseChar, entry2.simpChineseChar).length != 0
            || common_elements(entry1.japaneseChar, entry2.tradChineseChar).length != 0;
    }

    private isReadingsSimilar(entry1: VariantMapEntry, entry2: VariantMapEntry, verbose?: boolean): boolean {
        if (!isSameArray(entry1.pinyin, entry2.pinyin))
            return false;

        const getJpReadings = (c: VariantMapEntry): string[] => [...c.kunyomi, ...c.onyomi];
        const r1 = getJpReadings(entry1);
        const r2 = getJpReadings(entry2);
        // const [match, pct] = getMatchAndPct(r1, r2);

        // Check english meaning similarity
        if (areMeaningsSimilar(entry1.englishMeaning[0], entry2.englishMeaning[0], { logSuccess: verbose })) {
            return true;
        }

        return false;
    }

    /* Merge utilties */

    private mergeSet(s: Set<[number, number]>): [VariantMapEntry, VariantMapEntry, VariantMapEntry][] {
        const merged: [VariantMapEntry, VariantMapEntry, VariantMapEntry][] = [];
        for (const dup of s) {
            const res = this.tryMergeEntries(dup[0], dup[1]);
            if (res) merged.push(res);
        }

        return merged;
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

    private mergeDuplicatesForPred(pred: (e1: VariantMapEntry, e2: VariantMapEntry) => boolean, logging?: boolean): [VariantMapEntry, VariantMapEntry, VariantMapEntry][] {
        const duplicates = this.getDuplicatesForPred(pred);
        return this.mergeSet(duplicates);
    }

    // Returns old entries and new entry if merge was successful
    private tryMergeEntries(id1: number, id2: number): [VariantMapEntry, VariantMapEntry, VariantMapEntry] | undefined {
        const old1 = this.m_entries.get(id1);
        const old2 = this.m_entries.get(id2);
        if (!old1 || !old2) {
            return undefined;
        }

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
            return undefined;
        }
        this.m_entries.set(id, newEntry);

        return [old1, old2, newEntry];
    }

    // Getters and iterators
    public forEachEntry(handler: (entry: VariantMapEntry) => void): void {
        this.m_entries.forEach(handler);
    }

    public getEntryByChar(char: string): VariantMapEntry | undefined {
        const id = this.m_charToId.get(char);
        if (!id) return undefined;
        return this.m_entries.get(id);
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
    private kanjidic: Kanjidic;
    private cedict: Cedict;
    private s2t: OpenCC.ConvertText;

    private m_id: number = 1;
    private m_charToId: Map<string, number> = new Map();
    private m_entries: Map<number, VariantMapEntry> = new Map();
}