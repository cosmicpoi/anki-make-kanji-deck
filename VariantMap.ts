// Manages a transliteration map of Japanese, Simplified Chinese, and Traditional Chinese variants of each character
// Maintains readings, since reading similarity is used to merge characters
// Derived using unihan data

import * as fs from 'fs'
import autoBind from "auto-bind";
import { areRadicalStrokesClose, Unihan } from "./unihan";
import { apply_getter_to_arr, apply_multi_getter, CharacterType, combine_without_duplicates, common_elements, isSameArray, pairsOf } from "./types";
import { log_v } from "./logging";
import * as OpenCC from 'opencc-js';

type VariantMapEntry = {
    id: number;
    japaneseChar: string[];
    simpChineseChar: string[];
    tradChineseChar: string[];

    pinyin: string[];
    onyomi: string[];
    kunyomi: string[];
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

const getAllChars = (entry: VariantMapEntry): string[] =>
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

        const jp_only = this.getEmpty().filter(e => e.simpChineseChar.length == 0).map(e => e.japaneseChar)
        const cn_only = this.getEmpty().filter(e => e.japaneseChar.length == 0).map(e => [e.simpChineseChar, e.tradChineseChar]);
        log_v(verbose, "Entries left with only japanese characters: ", jp_only);
        log_v(verbose, "Entries left with only chinese characters: ", cn_only);


    }

    private getEmpty(): VariantMapEntry[] {
        const empty: VariantMapEntry[] = [];
        this.forEachEntry(e => {
            if (missingChar(e)) empty.push(e);
        })
        return empty;
    }

    /* Population functions */
    private populateReadings(entry: VariantMapEntry) {
        const sources: string[][] = [entry.simpChineseChar, entry.tradChineseChar, entry.japaneseChar];

        const pinyin = apply_multi_getter(this.unihan.getMandarinPinyin, sources);
        const onyomi = apply_multi_getter(this.unihan.getJapaneseOn, sources);
        const kunyomi = apply_multi_getter(this.unihan.getJapaneseKun, sources);

        entry.pinyin = Array.from(new Set(pinyin));
        entry.onyomi = Array.from(new Set(onyomi));
        entry.kunyomi = Array.from(new Set(kunyomi));
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
        const common_pinyin: string[] = common_elements(entry1.pinyin, entry2.pinyin);
        if (common_pinyin.length == 0) {
            return false;
        }

        const getJpReadings = (c: VariantMapEntry): Set<string> => new Set([...c.kunyomi, ...c.onyomi]);
        const r1: Set<string> = getJpReadings(entry1);
        const r2: Set<string> = getJpReadings(entry2);
        const common = common_elements([...r1], [...r2]);

        const match = common.length; // # of jp readings
        const max = Math.min(r1.size, r2.size);
        const pct = match / max; // # proportion matched

        // If it matches a bit, and the radical indices are close
        if (match >= 1) {
            const ac1 = getAllChars(entry1);
            const ac2 = getAllChars(entry2);

            const pairs = pairsOf(ac1, ac2);
            for (const pair of pairs) {
                const [a, b] = pair;
                const rs_a = this.unihan.getRadicalStrokeIdx(a);
                const rs_b = this.unihan.getRadicalStrokeIdx(b);
                if (match >= 3 && pct >= 0.7) {
                    if (areRadicalStrokesClose(rs_a, rs_b, 2)) {
                        return true;
                    }
                }
                else {
                    if (areRadicalStrokesClose(rs_a, rs_b, 1)) {
                        return true;
                    }
                }
            }
        }

        // // If it matches a bit, and it's also disjoint
        // if (match >= 1) {
        //     // check character mismatch - if any set is disjoint and nonempty, it can't be merged
        //     const char_disjoint = (a: string[], b: string[]): boolean =>
        //         common_elements(a, b).length == 0 && a.length != 0 && b.length != 0;
        //     const m_sp = char_disjoint(entry1.simpChineseChar, entry2.simpChineseChar);
        //     const m_td = char_disjoint(entry1.tradChineseChar, entry2.tradChineseChar);
        //     const m_jp = char_disjoint(entry1.japaneseChar, entry2.japaneseChar);

        //     const isDisjoint: boolean = m_sp || m_td || m_jp;
        //     return !isDisjoint;
        // }
        return false;
    }

    // function populateSimpFromTrad(card: KanjiCard) {
    //     if (fuzzy_empty(card.simpChineseChar) && !fuzzy_empty(card.tradChineseChar)) {
    //         card.simpChineseChar.v = card.tradChineseChar.v.map(c => converter_t2s(c));
    //     }
    // }

    // function populateTradFromSimp(card: KanjiCard) {
    //     if (fuzzy_empty(card.tradChineseChar) && !fuzzy_empty(card.simpChineseChar)) {
    //         card.tradChineseChar.v = card.simpChineseChar.v.map(c => converter_s2t(c));
    //     }
    // }

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

        this.m_entries.set(id, entry);
        this.m_charToId.set(char, id);
    }

    // Returns if merge was successful or not
    private tryMergeEntries(id1: number, id2: number): boolean {
        const old1 = this.m_entries.get(id1);
        const old2 = this.m_entries.get(id2);
        if (!old1 || !old2) {
            return false;
        }

        // Final check: don't allow entries to be merged if pinyin isn't exactly the same
        if (!isSameArray(old1.pinyin, old2.pinyin)) return false;

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

        getAllChars(newEntry).forEach((c) => {
            this.m_charToId.set(c, id);
        })
        return true;
    }

    private getId(): number {
        return this.m_id++;
    }

    private unihan: Unihan;
    private t2s: OpenCC.ConvertText;
    private s2t: OpenCC.ConvertText;

    private m_id: number = 0;
    private m_charToId: Map<string, number> = new Map();
    private m_entries: Map<number, VariantMapEntry> = new Map();
}