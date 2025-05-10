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
export function concatFuzzyArray(a1: FuzzyArray, a2: FuzzyArray) {
    let newVal: FuzzyArray = {
        v: combine_without_duplicates(a1.v, a2.v),
    }
    if (!!(a1?.guess) || !!(a2?.guess)) {
        newVal.guess = true;
    }

    return newVal;
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
    engMeaning: FuzzyArray;

    // example sentences
    japaneseExampleSentences: FuzzyArray;
    simpChineseExampleSentences: FuzzyArray;
    tradChineseExampleSentences: FuzzyArray;

    // stroke order URIs
    japaneseStrokeOrder: FuzzyArray;
    simpChineseStrokeOrder: FuzzyArray;
    tradChineseStrokeOrder: FuzzyArray;

    // tags - don't need FuzzyArray here
    tags: string[];
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
    engMeaning: defaultFuzzyArray(),

    // example sentences
    japaneseExampleSentences: defaultFuzzyArray(),
    simpChineseExampleSentences: defaultFuzzyArray(),
    tradChineseExampleSentences: defaultFuzzyArray(),

    // stroke order URIs
    japaneseStrokeOrder: defaultFuzzyArray(),
    simpChineseStrokeOrder: defaultFuzzyArray(),
    tradChineseStrokeOrder: defaultFuzzyArray(),

    // tags
    tags: []
});

export function concatKanjiCards(c1: KanjiCard, c2: KanjiCard): KanjiCard {
    const res = get_default_kanji_card();
    let key: keyof KanjiCard;
    for (key in res) {
        if (key == 'tags') {
            res[key] = [...new Set([...c1.tags, ...c2.tags])];
        }
        else {
            res[key] = concatFuzzyArray(c1[key], c2[key]);
        }
    }
    return res;
}

export const card_is_character = (card: KanjiCard, mychar: string): boolean =>
    card.japaneseChar.v.includes(mychar) || card.simpChineseChar.v.includes(mychar) || card.tradChineseChar.v.includes(mychar);

// combine lookups across `arr`
export function apply_getter_to_arr(getter: (c: string) => string[], arr: string[]): string[] {
    let all_guesses: string[] = [];
    arr.forEach((baseChar: string) => {
        const guesses: string[] = getter(baseChar);
        all_guesses.push(...guesses);
    });
    return [...new Set(all_guesses)];
}

// combine the above lookup across multiple arrays
export function apply_multi_getter(getter: (c: string) => string[], arrs: string[][]) {
    let all_guesses: string[] = [];
    arrs.forEach((baseArr: string[]) => {
        const guesses: string[] = apply_getter_to_arr(getter, baseArr);
        all_guesses.push(...guesses);
    });
    return [...new Set(all_guesses)];
}