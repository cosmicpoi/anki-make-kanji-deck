import * as fs from 'fs'
import autoBind from "auto-bind";
import { CharacterType, concatKanjiCards, fuzzy_to_string, get_default_kanji_card, KanjiCard, try_emplace_fuzzy } from "./types";

// Represents character 'master list' that we build up through the db info we have.

export class KanjiMap {
    constructor() {
        autoBind(this);
        this.kanji = {};
    }

    // Get a list of all currenty map keys
    public getChars(): string[] {
        return Object.keys(this.kanji);
    }

    // Save to file
    public toFile(output: string): void {
        type CleanCard = Partial<{ [k in keyof KanjiCard]: string }>;
        let cleanMap: { [k: string]: CleanCard } = {};
        this.getChars().forEach(mychar => {
            const card = this.kanji[mychar];
            let cleanCard: CleanCard = {};

            let key: keyof KanjiCard;
            for (key in card) {
                if (key != 'tags') {
                    cleanCard[key] = fuzzy_to_string(card[key]);
                }
                else {
                    cleanCard[key] = JSON.stringify(card[key]);
                }
            }

            cleanMap[mychar] = cleanCard;
        });

        fs.writeFile(output, JSON.stringify(cleanMap), (err) => {
            if (err) {
                console.error('Error writing file:', err);
            } else {
                console.log('JSON written to ', output);
            }
        });
    }

    // Merge two entries
    public merge(c1: string, c2: string, warn = true): void {
        if (!this.has(c1) || !this.has(c2)) {
            if (warn)
                console.error("Could not find an entry for merge ", c1, c2);
            return;
        }
        const card1: KanjiCard = this.at(c1, true);
        const card2: KanjiCard = this.at(c2, true);
        const newCard: KanjiCard = concatKanjiCards(card1, card2)
        // console.log(newCard);
        const ord = [c1, c2];
        ord.sort();
        const newKey = ord[0];

        this.delete(c1);
        this.delete(c2);
        this.ratify(newKey);
        this.kanji[newKey] = newCard;
    }

    // See if an entry exists
    public has(mychar: string) {
        return this.kanji[mychar] != undefined;
    }

    // Ensure an entry exists for the given value
    public ratify(mychar: string) {
        if (this.kanji[mychar] == undefined) {
            this.kanji[mychar] = get_default_kanji_card();
        }
    }

    // Get the entry corresponding to a specific character.
    // If `readonly` is false, create a default value in-place if one does not exist.
    public at(mychar: string, readonly = false): KanjiCard {
        if (!readonly) this.ratify(mychar);

        return this.kanji[mychar];
    }

    // Delete the given entry. Assumes it exists
    public delete(mychar: string): void {
        if (!this.has(mychar)) {
            console.error("Entry does not exist");
        }
        delete this.kanji[mychar];
    }

    // Try to emplace `tag` into the entry for `mychar`.
    // Assumes an entry exists already.
    public emplace_tags(mychar: string, tags: string[] | undefined): void {
        const card: KanjiCard = this.at(mychar, false);
        if (tags == undefined) return;

        tags.forEach(tag => {
            if (!card.tags.includes(mychar)) {
                card.tags.push(tag);
            }
        })
    }

    // Try to emplace `character` into the corresponding entry for `type`
    // If no entry exists, create it first
    public emplace_character(mychar: string, type: CharacterType): void {
        const card: KanjiCard = this.at(mychar);
        if (type == CharacterType.Japanese) {
            try_emplace_fuzzy(card.japaneseChar, mychar);
        }
        else if (type == CharacterType.SimplifiedChinese) {
            try_emplace_fuzzy(card.simpChineseChar, mychar);
        }
        else if (type == CharacterType.TraditionalChinese) {
            try_emplace_fuzzy(card.tradChineseChar, mychar);
        }
    }

    // It would be nice to index these specifically by jp/trad/simp etc, but there's no guarantee
    // every char has all variants so we just tiebreak on sort order. 
    private kanji: { [k: string]: KanjiCard };
}