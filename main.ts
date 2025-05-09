import * as fs from 'fs'
import * as path from 'path'

//------------------------------------------------------------------------------
// Consts
//------------------------------------------------------------------------------

const k_CHARACTER_LIST_PATH: string = 'lists';

//------------------------------------------------------------------------------
// Types
//------------------------------------------------------------------------------

type KanjiCard = {
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

const get_default_kanji_card = (): KanjiCard => ({
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

//------------------------------------------------------------------------------
// Script
//------------------------------------------------------------------------------

// Iterate through files and build up list of tags

let tags: Set< String > = new Set(); // list of all tags
// 'master list' that we will build up through this script
let kanji: { [ k: string ]: KanjiCard } = {};

try {
    const files: string[] = fs.readdirSync(k_CHARACTER_LIST_PATH);
    files.forEach((file: string): void => {
        // strip trailing file extesion and replace __ with ::
        const stripped = file.split('.').slice(0, -1).join('.');
        const tag = stripped.replace("__", "::");
        tags.add(tag);
       
        // read content
        const file_path = k_CHARACTER_LIST_PATH + "/" + file;
        let content = fs.readFileSync(file_path, 'utf-8');
        // trim whitespace
        content = content.replace(/\s+/g, "");
        let characters: string[] = content.split('');
        // iterate through characters and emplace tags
        characters.forEach((char: string): void => {
            if (kanji[char] == undefined)
                { kanji[char] = get_default_kanji_card(); }
            if (!kanji[char].tags.includes(char)) {
                kanji[char].tags.push(tag);
            }
        });
        console.log(`Loaded file for tag ${tag} with ${characters.length} characters`);
        // console.log(characters);
    });
} catch (err: unknown) {
    console.error('Error reading directory:', err);
}

// Iterate through all kanji, determine simplified/trad/jap forms, merge duplicates
console.log(kanji['中']);