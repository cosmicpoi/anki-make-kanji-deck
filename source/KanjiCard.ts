export type KanjiCard = {
    // characters
    japaneseChar: string[];
    tradChineseChar: string[];
    simpChineseChar: string[];

    // readings
    pinyin: string[];
    onyomi: string[];
    kunyomi: string[];

    // meaning
    englishMeaning: string[];

    // example sentences
    japaneseKunVocab: string[];
    japaneseOnVocab: string[];
    chineseVocab: string[];

    // difficulty and stroke count
    japaneseStrokeCount?: number;
    chineseStrokeCount?: number;
    japaneseFrequency?: number;
    chineseFrequency?: number;

    // tags 
    tags: string[]; // never actually fuzzy, just for type convenience
};

export const defaultKanjiCard = (): KanjiCard => ({
    // characters
    japaneseChar: [],
    tradChineseChar: [],
    simpChineseChar: [],

    // readings
    pinyin: [],
    onyomi: [],
    kunyomi: [],

    // meaning
    englishMeaning: [],

    // vocab
    japaneseKunVocab: [],
    japaneseOnVocab: [],
    chineseVocab: [],

    // tags 
    tags: [],
});