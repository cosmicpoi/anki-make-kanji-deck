import * as fs from 'fs'
import autoBind from "auto-bind";
import { k_KANJIDIC_FILE_PATH } from "./consts";

export class Kanjidic {
    constructor() {
        autoBind(this);
        this.loadData(k_KANJIDIC_FILE_PATH);
    }
    private loadData(filePath: string): void {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines: string[] = content.split('\n');
        lines.forEach((line) => {
            const match = line.match(/<literal>(.)<\/literal>/);
            if (match) {
                this.chars.add(match[0].split('>')[1].split('<')[0]);
            }
        });
    }

    public isKanji(mychar: string): boolean {
        return this.chars.has(mychar);
    }

    private chars: Set<string> = new Set();
}