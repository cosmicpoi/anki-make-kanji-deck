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
    simpChineseVocab: string[];
    tradChineseVocab: string[];

    // example sentences
    japaneseExampleSentences: string[];
    simpChineseExampleSentences: string[];
    tradChineseExampleSentences: string[];

    // stroke order URIs
    japaneseStrokeOrder: string[];
    simpChineseStrokeOrder: string[];
    tradChineseStrokeOrder: string[];

    // difficulty and stroke count
    strokeCount?: number;
    japaneseDifficulty?: number;
    simpChineseDifficulty?: number;

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

    // example sentences
    japaneseKunVocab: [],
    japaneseOnVocab: [],
    simpChineseVocab: [],
    tradChineseVocab: [],

    // example sentences
    japaneseExampleSentences: [],
    simpChineseExampleSentences: [],
    tradChineseExampleSentences: [],

    // stroke order URIs
    japaneseStrokeOrder: [],
    simpChineseStrokeOrder: [],
    tradChineseStrokeOrder: [],

    // tags 
    tags: [],
});