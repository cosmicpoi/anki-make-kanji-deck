import * as fs from 'fs'
import { Unihan } from './unihan';
import { FileListEntry, KanjiCard, get_default_kanji_card } from './types'
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
    kanji.merge(c1, c2, false);
});

console.log(`Merged from ${sumEntries} to ${kanji.getChars().length}`);
kanji.toFile('kanji_list.json');

// Iterate through all kanji, and populate missing forms

// Fill in japanese, simplified, traditional fields for the targeted entry
kanji.getChars().forEach(char => {
    const card: KanjiCard = kanji.at(char, true);
    
});

console.log(unihan.hasLink('国', '國'));

// console.log(charToUnicode('中'));