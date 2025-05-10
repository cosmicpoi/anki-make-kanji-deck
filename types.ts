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

export type KanjiCard = {
    // characters
    japaneseChar: string;
    simpChineseChar: string;
    tradChineseChar: string;

    // readings
    pinyin: string;
    onyomi: string[];
    kunyomi: string[];

    // meaning
    engMeaning: string;

    // example sentences
    japaneseExampleSentences: [];
    simpChineseExampleSentences: [];
    tradChineseExampleSentences: [];

    // stroke order URIs
    japaneseStrokeOrder: string;
    simpChineseStrokeOrder: string;
    tradChineseStrokeOrder: string;

    // tags
    tags: string[];
};

export const get_default_kanji_card = (): KanjiCard => ({
    // characters
    japaneseChar: '',
    simpChineseChar: '',
    tradChineseChar: '',

    // readings
    pinyin: '',
    onyomi: [],
    kunyomi: [],

    // meaning
    engMeaning: '',

    // example sentences
    japaneseExampleSentences: [],
    simpChineseExampleSentences: [],
    tradChineseExampleSentences: [],

    // stroke order URIs
    japaneseStrokeOrder: '',
    simpChineseStrokeOrder: '',
    tradChineseStrokeOrder: '',

    // tags
    tags: []
});

export function concatKanjiCards(c1: KanjiCard, c2: KanjiCard): KanjiCard {
    const res: KanjiCard = get_default_kanji_card();

    return {
        // characters
        japaneseChar: [c1.japaneseChar, c2.japaneseChar].join(','),
        simpChineseChar: [c1.simpChineseChar, c2.simpChineseChar].join(','),
        tradChineseChar: [c1.tradChineseChar, c2.tradChineseChar].join(','),

        // readings
        pinyin: [c1.pinyin, c2.pinyin].join(','),
        onyomi: [...c1.onyomi, ...c2.onyomi],
        kunyomi: [...c1.kunyomi, ...c2.kunyomi],

        // meaning
        engMeaning: [c1.engMeaning, c2.engMeaning].join('\n'),

        // example sentences
        japaneseExampleSentences: [...c1.japaneseExampleSentences, ...c2.japaneseExampleSentences],
        simpChineseExampleSentences: [...c1.simpChineseExampleSentences, ...c2.simpChineseExampleSentences],
        tradChineseExampleSentences: [...c1.tradChineseExampleSentences, ...c2.tradChineseExampleSentences],

        // stroke order URIs
        japaneseStrokeOrder: c1.japaneseStrokeOrder,
        simpChineseStrokeOrder: c1.simpChineseStrokeOrder,
        tradChineseStrokeOrder: c1.tradChineseStrokeOrder,

        // tags
        tags: []
    }
}