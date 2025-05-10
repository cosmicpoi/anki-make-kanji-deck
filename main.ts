import * as fs from 'fs'
import { Unihan } from './unihan';
import { FileListEntry, FuzzyArray, KanjiCard, apply_multi_getter, card_is_character, combine_without_duplicates, fuzzy_empty, fuzzy_first, get_default_kanji_card } from './types'
import { KanjiMap } from './KanjiMap';
import { k_SOURCE_FILE_LIST } from './file_list';

//------------------------------------------------------------------------------
// Helper function
//------------------------------------------------------------------------------


//------------------------------------------------------------------------------
// Script
//------------------------------------------------------------------------------

// Initialize Unihan DB and Kanji Map
const unihan = new Unihan();
let kanji: KanjiMap = new KanjiMap();

// Iterate through files and build up list of tags
let tags: Set<String> = new Set(); // list of all tags
let sumEntries = 0;
k_SOURCE_FILE_LIST.forEach((file: FileListEntry): void => {
    // Add tags to list
    file.tags?.forEach(tag => tags.add(tag));
    // read content
    const content = fs.readFileSync(file.path, 'utf-8');
    // trim whitespace
    const stripped_content = content.replace(/\s+/g, "");
    let characters: string[] = stripped_content.split('');
    // iterate through characters and emplace tags
    characters.forEach((mychar: string): void => {
        kanji.emplace_character(mychar, file.type);
        kanji.emplace_tags(mychar, file.tags);
    });
    console.log(`Loaded file ${file.path} with tags ${file.tags} with ${characters.length} characters`);
    sumEntries += characters.length;
});

// Merge duplicate entries
console.log("Merging duplicates");
const duplicates: Set<[string, string]> = new Set();
const allChars: string[] = kanji.getChars();
for (let i = 0; i < allChars.length; i++) {
    for (let j = i + 1; j < allChars.length; j++) {
        const char1 = allChars[i];
        const char2 = allChars[j];
        if (unihan.hasLink(char1, char2)) {
            const ord = [char1, char2];
            ord.sort();
            duplicates.add([ord[0], ord[1]]);
        }
    }
}

duplicates.forEach(dup => {
    const [c1, c2] = dup;
    kanji.merge(c1, c2, { warn: false });
});

console.log(`Merged from ${sumEntries} to ${kanji.getChars().length}`);

// Iterate through all kanji, and populate missing forms

// Fill in japanese, simplified, traditional fields for the targeted entry
// - First fill in pronunciation (mandarin + japanese)
// - Then fill in simplified/traditional/japanese transliteration
// - If we can't find one, use pronunciation info to guess. i.e. if pinyin exists for a jp-only character, assume it's also valid in Chinese
// - Then fill in pronunciation again using new info

function populateReadings(card: KanjiCard) {
    const newCard = { ...card };

    // fill in pinyin
    const sources = [card.simpChineseChar.v, card.tradChineseChar.v, card.japaneseChar.v];

    card.pinyin.v = apply_multi_getter(unihan.getMandarinPinyin, sources);
    card.onyomi.v = apply_multi_getter(unihan.getJapaneseOn, sources);
    card.kunyomi.v = apply_multi_getter(unihan.getJapaneseKun, sources);
}

function populateCharacters(card: KanjiCard) {
    const newCard = { ...card };

    const is_le: boolean = card_is_character(card, '乐');
    // If we can't find a trad chinese character, fill it in
    if (fuzzy_empty(card.tradChineseChar)) {
        const guess_sources = [card.simpChineseChar.v, card.japaneseChar.v];
        newCard.tradChineseChar.v = apply_multi_getter(unihan.getTradChineseVariants, guess_sources);
        if (is_le) console.log(newCard.tradChineseChar.v);

        // If it's STILL empty, just guess as the simplified chinese version 
        if (fuzzy_empty(newCard.tradChineseChar) && !fuzzy_empty(card.simpChineseChar)) {
            newCard.tradChineseChar.v = card.simpChineseChar.v;
            newCard.tradChineseChar.guess = true;
        }
        // If it's empty even after that, use the japanese version, only if pinyin exists for it
        if (fuzzy_empty(newCard.tradChineseChar) && !fuzzy_empty(card.japaneseChar)) {
            if (!fuzzy_empty(newCard.pinyin)) {
                newCard.tradChineseChar.v = card.japaneseChar.v;
                newCard.tradChineseChar.guess = true;
            }
        }
    }
    // If we can't find a simp chinese character, fill it in
    if (fuzzy_empty(card.simpChineseChar)) {
        const guess_sources = [card.tradChineseChar.v, card.japaneseChar.v];
        newCard.simpChineseChar.v = apply_multi_getter(unihan.getSimpChineseVariants, guess_sources);

        // If it's STILL empty, just guess as the trad chinese version 
        if (fuzzy_empty(newCard.simpChineseChar) && !fuzzy_empty(card.tradChineseChar)) {
            newCard.simpChineseChar.v = card.tradChineseChar.v;
            newCard.simpChineseChar.guess = true;
        }
        // If it's empty even after that, use the japanese version, only if pinyin exists for it
        if (fuzzy_empty(newCard.simpChineseChar) && !fuzzy_empty(card.japaneseChar)) {
            if (!fuzzy_empty(newCard.pinyin)) {
                newCard.simpChineseChar.v = card.japaneseChar.v;
                newCard.simpChineseChar.guess = true;
            }
        }

    }
    // If the japanese does not exist, try to derive it from (post-guess) simp/trad
    if (fuzzy_empty(card.japaneseChar)) {
        // const simp_guesses = apply_getter_to_arr(newCard.simpChineseChar.v, unihan.getGetSemanticVariants);
        // const trad_guesses = apply_getter_to_arr(newCard.tradChineseChar.v, unihan.getGetSemanticVariants);

        // console.log("Guessing Japanese for card:", newCard.simpChineseChar, newCard.tradChineseChar, newCard.japaneseChar);

    }

    card.simpChineseChar = newCard.simpChineseChar;
    card.tradChineseChar = newCard.tradChineseChar;
    card.japaneseChar = newCard.japaneseChar;
}

const logCard = (prefix: string, card: KanjiCard) =>
    console.log(prefix, card.simpChineseChar, card.tradChineseChar, card.japaneseChar, card.pinyin, card.kunyomi, card.onyomi);

kanji.getChars().forEach(char => {
    const card: KanjiCard = kanji.at(char, true);
    // logCard("Populating card:", card);
    populateReadings(card);
    populateCharacters(card);
    // populateReadings(card);
    // logCard("Populated card:", card);
});

console.log(kanji.at('楽'));
// console.log(charToUnicode('中'));