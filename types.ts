import { k_GUESS_STRING } from "./consts";

export enum CharacterType {
    TraditionalChinese = "TraditionalChinese",
    SimplifiedChinese = "SimplifiedChinese",
    Japanese = "Japanese",
};

// Basic type for KanjiCard. An array with a bool flag to mark if it's a guess,
// i.e. we're uncertain about the result and it should be manually checked.
export type FuzzyArray = {
    v: string[],
    guess?: boolean,
};

export const combine_without_duplicates = (...arrays: string[][]): string[] =>
    [...new Set(arrays.flat())];

// Make a fuzzy array from a string
export const $fa = (a: string): FuzzyArray => ({
    v: [a]
});

// check if a FuzzyArray is empty
export const fuzzy_empty = (a: FuzzyArray): boolean => a.v.length == 0;

// get the first element of a (non-empty) FuzzyArray
export const fuzzy_first = (a: FuzzyArray): string => a.v[0];

export const defaultFuzzyArray = (): FuzzyArray => ({ v: [] });

// Add a value to a fuzzy array if it does not already exist
export function try_emplace_fuzzy(arr: FuzzyArray, val: string): void {
    if (!arr.v.includes(val)) {
        arr.v.push(val);
    }
}

export function fuzzy_to_string(arr: FuzzyArray) {
    const prefix = arr.guess ? "guess:" : "";
    return JSON.stringify(prefix + arr.v);
}

// Concat without duplicates and logical OR on guesses
export function concatFuzzyArray(...arrays: FuzzyArray[]) {
    let newVal: FuzzyArray = {
        v: combine_without_duplicates(...arrays.map(a => a.v)),
    }
    const guess = arrays.map(a => !!a.guess).reduce((a, b) => a || b);
    if (guess) {
        newVal.guess = true;
    }

    return newVal;
}

export function fuzzy_join(arr: FuzzyArray, delimiter: string): string {
    let prefix = arr.guess ? k_GUESS_STRING : "";
    return prefix + arr.v.join(delimiter);
}

export type KanjiCard_Fuzzy = {
    // characters
    japaneseChar: FuzzyArray;
    simpChineseChar: FuzzyArray;
    tradChineseChar: FuzzyArray;

    // readings
    pinyin: FuzzyArray;
    onyomi: FuzzyArray;
    kunyomi: FuzzyArray;

    // meaning
    englishMeaning: FuzzyArray;

    // example sentences
    japaneseKunVocab: FuzzyArray;
    japaneseOnVocab: FuzzyArray;
    simpChineseVocab: FuzzyArray;
    tradChineseVocab: FuzzyArray;

    // example sentences
    japaneseExampleSentences: FuzzyArray;
    simpChineseExampleSentences: FuzzyArray;
    tradChineseExampleSentences: FuzzyArray;

    // stroke order URIs
    japaneseStrokeOrder: FuzzyArray;
    simpChineseStrokeOrder: FuzzyArray;
    tradChineseStrokeOrder: FuzzyArray;

    // difficulty and stroke count
    strokeCount?: number;
    japaneseDifficulty?: number;
    simpChineseDifficulty?: number;

    // tags 
    tags: FuzzyArray; // never actually fuzzy, just for type convenience
};

export const get_default_kanji_card = (): KanjiCard_Fuzzy => ({
    // characters
    japaneseChar: defaultFuzzyArray(),
    simpChineseChar: defaultFuzzyArray(),
    tradChineseChar: defaultFuzzyArray(),

    // readings
    pinyin: defaultFuzzyArray(),
    onyomi: defaultFuzzyArray(),
    kunyomi: defaultFuzzyArray(),

    // meaning
    englishMeaning: defaultFuzzyArray(),

    japaneseKunVocab: defaultFuzzyArray(),
    japaneseOnVocab: defaultFuzzyArray(),
    simpChineseVocab: defaultFuzzyArray(),
    tradChineseVocab: defaultFuzzyArray(),

    // example sentences
    japaneseExampleSentences: defaultFuzzyArray(),
    simpChineseExampleSentences: defaultFuzzyArray(),
    tradChineseExampleSentences: defaultFuzzyArray(),

    // stroke order URIs
    japaneseStrokeOrder: defaultFuzzyArray(),
    simpChineseStrokeOrder: defaultFuzzyArray(),
    tradChineseStrokeOrder: defaultFuzzyArray(),

    // tags
    tags: defaultFuzzyArray()
});

export function concatKanjiCards(c1: KanjiCard_Fuzzy, c2: KanjiCard_Fuzzy): KanjiCard_Fuzzy {
    const res = get_default_kanji_card();
    let key: keyof KanjiCard_Fuzzy;
    for (key in res) {
        if (key != 'strokeCount' && key != 'simpChineseDifficulty' && key != 'japaneseDifficulty') {
            res[key] = concatFuzzyArray(c1[key], c2[key]);
        }
        else {
            if (c1[key] == undefined && c2[key] != undefined) {
                res[key] = c2[key];
            }
            else if (c1[key] != undefined && c1[key] == undefined) {
                res[key] = c1[key];
            }
            else if (c1[key] != undefined && c2[key] != undefined) {
                res[key] = Math.max(c1[key] || 0, c2[key] || 0);
            }
        }
    }
    return res;
}

export const logCard = (prefix: string, card: KanjiCard_Fuzzy) =>
    console.log(prefix, card.japaneseChar, card.simpChineseChar, card.tradChineseChar, card.pinyin, card.kunyomi, card.onyomi);

export const card_is_character = (card: KanjiCard_Fuzzy, mychar: string): boolean =>
    card.japaneseChar.v.includes(mychar) || card.simpChineseChar.v.includes(mychar) || card.tradChineseChar.v.includes(mychar);

export const common_elements = (a1: string[], a2: string[]) =>
    [...a1].filter(item => a2.includes(item));

// Everything in a1 not in a2
export const array_difference = <T>(a1: T[], a2: T[]): T[] =>
    [...a1].filter(item => !a2.includes(item));

export const isSameArray = (a1: string[], a2: string[]) =>
    array_difference(a1, a2).length == 0 && a1.length == a2.length;
// Get similarity between two cards based on pinyin and yomi. return [match, pct]
// - if at least one pinyin doesn't match, return 0
// - `match` - the number of common jp readings between the two as a uint
// - `pct` - `match` divided by max(# of jp readings)
export function reading_similarity(c1: KanjiCard_Fuzzy, c2: KanjiCard_Fuzzy): [number, number] {
    // check pinyin match
    const common_pinyin: string[] = common_elements(c1.pinyin.v, c2.pinyin.v);
    if (common_pinyin.length == 0) {
        return [0, 0];
    }

    const getReadings = (c: KanjiCard_Fuzzy): Set<string> => new Set([...c.kunyomi.v, ...c.onyomi.v]);
    const r1: Set<string> = getReadings(c1);
    const r2: Set<string> = getReadings(c2);
    const common = common_elements([...r1], [...r2]);
    const match = common.length;
    const max = Math.min(r1.size, r2.size);

    return [match, match / max];
}

// combine lookups across `arr`
export function apply_getter_to_arr_fuzzy(getter: (c: string) => string[], arr: FuzzyArray): FuzzyArray {
    let all_guesses: string[] = [];
    arr.v.forEach((baseChar: string) => {
        const guesses: string[] = getter(baseChar);
        all_guesses.push(...guesses);
    });

    let res: FuzzyArray = { v: [...new Set(all_guesses)] };
    if (arr.guess && res.v.length != 0) {
        res.guess = true;
    }
    return res;
}

export function apply_getter_to_arr(getter: (c: string) => string[], arr: string[]): string[] {
    let all_guesses: string[] = [];
    arr.forEach((baseChar: string) => {
        const guesses: string[] = getter(baseChar);
        all_guesses.push(...guesses);
    });

    return [...new Set(all_guesses)];
}

// Apply `apply_getter_to_arr` over multiple arrays
export function apply_multi_getter(getter: (c: string) => string[], arrs: string[][]): string[] {
    let all_guesses: string[] = [];
    arrs.forEach((baseArr: string[]) => {
        const guesses: string[] = apply_getter_to_arr(getter, baseArr);
        all_guesses.push(...guesses);
    });

    return all_guesses;
}

// combine the above lookup across multiple arrays
export function apply_multi_getter_fuzzy(getter: (c: string) => string[], arrs: FuzzyArray[]): FuzzyArray {
    let all_guesses: string[] = [];
    let isGuess: boolean = false;
    arrs.forEach((baseArr: FuzzyArray) => {
        const guesses: FuzzyArray = apply_getter_to_arr_fuzzy(getter, baseArr);
        all_guesses.push(...guesses.v);
        isGuess = isGuess || !!(baseArr.guess);
    });

    let res: FuzzyArray = { v: [...new Set(all_guesses)] };
    if (isGuess && res.v.length != 0) {
        res.guess = true;
    }
    return res;
}


export type CountHandler = {
    increment: () => void;
    get: () => number;
};

export const make_count_handler = (): CountHandler => {
    let count = 0;
    const increment = (): number => count++;
    const get = (): number => count;

    return { increment, get };
};

export function isHanCharacter(char: string): boolean {
    const code = char.charCodeAt(0);
    // CJK Unified Ideographs Extension A (U+3400 through U+4DBF)
    if (code >= 0x3400 && code <= 0x4DBF) return true;

    // CJK Unified Ideographs (U+4E00 through U+9FFF)
    if (code >= 0x4E00 && code <= 0x9FFF) return true;

    // CJK Compatibility Ideographs (U+F900 through U+FAD9)
    if (code >= 0xF900 && code <= 0xFAD9) return true;

    // CJK Unified Ideographs Extension B (U+20000 through U+2A6DF)
    // CJK Unified Ideographs Extension C (U+2A700 through U+2B739)
    // CJK Unified Ideographs Extension D (U+2B740 through U+2B81D)
    // CJK Unified Ideographs Extension E (U+2B820 through U+2CEA1)
    // CJK Unified Ideographs Extension F (U+2CEB0 through U+2EBE0)
    // CJK Unified Ideographs Extension I (U+2EBF0 through U+2EE5D)
    if (code >= 0x20000 && code <= 0x2A6DF) return true;

    // CJK Compatibility Ideographs Supplement (U+2F800 through U+2FA1D)
    if (code >= 0x2F800 && code <= 0x2FA1D) return true;

    // CJK Unified Ideographs Extension G (U+30000 through U+3134A)
    // CJK Unified Ideographs Extension H (U+31350 through U+323AF)
    if (code >= 0x30000 && code <= 0x323AF) return true;

    return false;
}

// // Meant to be used with isHanCharacter check
// export function isRenderable(char: string): boolean {
//     const code = char.charCodeAt(0);
//     // CJK Unified Ideographs Extension A (U+3400 through U+4DBF)
//     if (code >= 0x3400 && code <= 0x4DBF) return true;

//     // CJK Unified Ideographs (U+4E00 through U+9FFF)
//     if (code >= 0x4E00 && code <= 0x9FFF) return true;

//     // CJK Compatibility Ideographs (U+F900 through U+FAD9)
//     if (code >= 0xF900 && code <= 0xFAD9) return true;


//     // CJK Unified Ideographs Extension B (U+20000 through U+2A6DF)
//     // CJK Unified Ideographs Extension C (U+2A700 through U+2B739)
//     // CJK Unified Ideographs Extension D (U+2B740 through U+2B81D)
//     // CJK Unified Ideographs Extension E (U+2B820 through U+2CEA1)
//     // CJK Unified Ideographs Extension F (U+2CEB0 through U+2EBE0)
//     // CJK Unified Ideographs Extension I (U+2EBF0 through U+2EE5D)
//     if (code >= 0x20000 && code <= 0x2EE5D) return true;

//     // CJK Compatibility Ideographs Supplement (U+2F800 through U+2FA1D)
//     if (code >= 0x2F800 && code <= 0x2FA1D) return true;

//     // CJK Unified Ideographs Extension G (U+30000 through U+3134A)
//     // CJK Unified Ideographs Extension H (U+31350 through U+323AF)
//     if (code >= 0x30000 && code <= 0x323AF) return true;

//     return false;
// }

export function isHiragana(char: string) {
    const code = char.charCodeAt(0);
    return code >= 0x3040 && code <= 0x309F;
}

export function isKatakana(char: string) {
    const code = char.charCodeAt(0);
    return (code >= 0x30A0 && code <= 0x30FF) || (code >= 0x31F0 && code <= 0x31FF);
}

export function katakanaToHiragana(input: string): string {
    return input.replace(/[\u30A1-\u30F6]/g, function (char) {
        return String.fromCharCode(char.charCodeAt(0) - 0x60);
    });
}

export function pairsOf<T, S>(a1: Iterable<T>, a2: Iterable<S>): [T, S][] {
    const pairs: [T, S][] = [];
    for (const i1 of a1) {
        for (const i2 of a2) {
            pairs.push([i1, i2]);
        }
    }

    return pairs;
}

export function tuplesOf<T>(a: T[]): [T, T][] {
    const pairs: [T, T][] = [];
    for (let i = 0; i < a.length; i++) {
        for (let j = i + 1; j < a.length; j++) {
            pairs.push([a[i], a[j]]);
        }
    }

    return pairs;
}

export function orderedTuplesOf<T>(a: T[]): [T, T][] {
    const pairs: [T, T][] = [];
    for (let i = 0; i < a.length; i++) {
        for (let j = 0; j < a.length; j++) {
            pairs.push([a[i], a[j]]);
        }
    }

    return pairs;
}

export function jlptTag(n: number) {
    let tag = "JLPT";
    for (let i = 1; i <= n; i++) {
        tag = tag + "::n" + i;
    }
    return tag;
}

export function hskTag(n: number) {
    let tag = "HSK";
    for (let i = 6; i >= n; i--) {
        tag = tag + "::" + i;
    }
    return tag;
}