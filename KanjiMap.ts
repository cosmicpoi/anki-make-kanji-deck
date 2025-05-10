import autoBind from "auto-bind";
import { CharacterType, concatKanjiCards, get_default_kanji_card, KanjiCard } from "./types";
import { Unihan } from "./unihan";

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

    // Fill in japanese, simplified, traditional fields for the targeted entry
    // Assumes an entry exists already.
    public populateCharacters(unihan: Unihan, mychar: string): void {
        if (!this.kanji[mychar]) {
            console.error("Character alrady exists");
        }


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
            card.japaneseChar = mychar;
        }
        else if (type == CharacterType.SimplifiedChinese) {
            card.simpChineseChar = mychar;
        }
        else if (type == CharacterType.TraditionalChinese) {
            card.tradChineseChar = mychar;
        }
    }

    // It would be nice to index these specifically by jp/trad/simp etc, but there's no guarantee
    // every char has all variants so we just tiebreak on sort order. 
    private kanji: { [k: string]: KanjiCard };
}