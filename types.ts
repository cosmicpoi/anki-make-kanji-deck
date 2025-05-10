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

// Make a fuzzy array from a string
export const $fa = (a: string): FuzzyArray => ({
    v: [a]
});

export const defaultFuzzyArray = (): FuzzyArray => ({ v: [] });

// Add a value to a fuzzy array if it does not already exist
export function try_emplace_fuzzy(arr: FuzzyArray, val: string): void {
    if (!arr.v.includes(val)) {
        arr.v.push(val);
    }
}

export function fuzzy_to_string(arr: FuzzyArray)
{
    const prefix = arr.guess ? "guess:" : "";
    return JSON.stringify(prefix + arr.v);
}

// Concat without duplicates and logical OR on guesses
export function concatFuzzyArray(a1: FuzzyArray, a2: FuzzyArray) {
    let newVal: FuzzyArray = {
        v: [...new Set([...a1.v, ...a2.v])],
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
    const res: KanjiCard = get_default_kanji_card();

    return {
        // characters
        japaneseChar: concatFuzzyArray(c1.japaneseChar, c2.japaneseChar),
        simpChineseChar: concatFuzzyArray(c1.simpChineseChar, c2.simpChineseChar),
        tradChineseChar: concatFuzzyArray(c1.tradChineseChar, c2.tradChineseChar),

        // readings
        pinyin: concatFuzzyArray(c1.pinyin, c2.pinyin),
        onyomi: concatFuzzyArray(c1.onyomi, c2.onyomi),
        kunyomi: concatFuzzyArray(c1.kunyomi, c2.kunyomi),

        // meaning
        engMeaning: concatFuzzyArray(c1.engMeaning, c2.engMeaning),

        // example sentences
        japaneseExampleSentences: concatFuzzyArray(c1.japaneseExampleSentences, c2.japaneseExampleSentences),
        simpChineseExampleSentences: concatFuzzyArray(c1.simpChineseExampleSentences, c2.simpChineseExampleSentences),
        tradChineseExampleSentences: concatFuzzyArray(c1.tradChineseExampleSentences, c2.tradChineseExampleSentences),

        // stroke order URIs
        japaneseStrokeOrder: concatFuzzyArray(c1.japaneseStrokeOrder, c2.japaneseStrokeOrder),
        simpChineseStrokeOrder: concatFuzzyArray(c1.simpChineseStrokeOrder, c2.simpChineseStrokeOrder),
        tradChineseStrokeOrder: concatFuzzyArray(c1.tradChineseStrokeOrder, c2.tradChineseStrokeOrder),

        // tags
        tags: [...new Set([...c1.tags, ...c2.tags])],
    }
}