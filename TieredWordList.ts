import * as fs from 'fs'
import autoBind from "auto-bind";

type TWEntry = {
    char: string;
    tierNumber: number;
    difficulty?: number;
};


export class TieredWordList {
    constructor(fileDir: string, orderedFileList: string[]) {
        autoBind(this);

        orderedFileList.forEach((file: string, idx: number): void => {
            // read content
            const filePath = fileDir + '/' + file;
            const content = fs.readFileSync(filePath, 'utf-8');
            // trim whitespace
            const stripped_content = content.replace(/\s+/g, "");
            let characters: string[] = stripped_content.split('').filter(c => c.length == 1);
            // iterate through characters and emplace
            characters.forEach((mychar: string): void => {
                this.emplaceCharacter(mychar, idx);
            });
        });
    }

    public getAllChars(): Iterable<string> {
        return this.m_entries.keys();
    }

    // Each character has the highest tier number in which it appears in
    private emplaceCharacter(char: string, tierNumber: number): void {
        const res = this.m_entries.get(char);
        if (!res) {
            this.m_entries.set(char, { char, tierNumber });
            return;
        }
        res.tierNumber = Math.max(res.tierNumber, tierNumber);
    }


    // Map lemma to entry
    private m_entries: Map<string, TWEntry> = new Map();
}