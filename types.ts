import { k_GUESS_STRING } from "./consts";

export enum CharacterType {
    TraditionalChinese,
    SimplifiedChinese,
    Japanese
};

export type FileListEntry = {
    path: string;
    type: CharacterType;
    tags?: string[];
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

export type KanjiCard = {
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

    // tags 
    tags: FuzzyArray; // never actually fuzzy, just for type convenience
};

export const get_default_kanji_card = (): KanjiCard => ({
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

export function concatKanjiCards(c1: KanjiCard, c2: KanjiCard): KanjiCard {
    const res = get_default_kanji_card();
    let key: keyof KanjiCard;
    for (key in res) {
        res[key] = concatFuzzyArray(c1[key], c2[key]);
    }
    return res;
}

export const logCard = (prefix: string, card: KanjiCard) =>
    console.log(prefix, card.japaneseChar, card.simpChineseChar, card.tradChineseChar, card.pinyin, card.kunyomi, card.onyomi);

export const card_is_character = (card: KanjiCard, mychar: string): boolean =>
    card.japaneseChar.v.includes(mychar) || card.simpChineseChar.v.includes(mychar) || card.tradChineseChar.v.includes(mychar);

export const common_elements = (a1: string[], a2: string[]) =>
    [...a1].filter(item => a2.includes(item));
// Get similarity between two cards based on pinyin and yomi. return [match, pct]
// - if at least one pinyin doesn't match, return 0
// - `match` - the number of common jp readings between the two as a uint
// - `pct` - `match` divided by max(# of jp readings)
export function reading_similarity(c1: KanjiCard, c2: KanjiCard): [number, number] {
    // check pinyin match
    const common_pinyin: string[] = common_elements(c1.pinyin.v, c2.pinyin.v);
    if (common_pinyin.length == 0) {
        return [0, 0];
    }

    const getReadings = (c: KanjiCard): Set<string> => new Set([...c.kunyomi.v, ...c.onyomi.v]);
    const r1: Set<string> = getReadings(c1);
    const r2: Set<string> = getReadings(c2);
    const common = common_elements([...r1], [...r2]);
    const match = common.length;
    const max = Math.min(r1.size, r2.size);

    return [match, match / max];
}

// combine lookups across `arr`
export function apply_getter_to_arr(getter: (c: string) => string[], arr: FuzzyArray): FuzzyArray {
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

// combine the above lookup across multiple arrays
export function apply_multi_getter(getter: (c: string) => string[], arrs: FuzzyArray[]): FuzzyArray {
    let all_guesses: string[] = [];
    let isGuess: boolean = false;
    arrs.forEach((baseArr: FuzzyArray) => {
        const guesses: FuzzyArray = apply_getter_to_arr(getter, baseArr);
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

    return {increment, get};
};