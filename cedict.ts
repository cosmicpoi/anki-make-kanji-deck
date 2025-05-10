import * as fs from 'fs'
import autoBind from "auto-bind";

type KanjidicReading = {
    pinyin: string;
    definition: string;
};

type KanjidicEntry = {
    simplified: string;
    traditional: string;
    reading: KanjidicReading[];
};

export class Cedict {
    constructor(filePath: string) {
        autoBind(this);
        this.m_loadData(filePath);
    }
    private m_loadData(filePath: string): void {
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines: string[] = content.split('\n');

        lines.forEach((line) => {
            if (line.at(0) == "#") return;

            const match = line.match(/^(.+?) (.+?) \[(.+?)\] \/(.+)\//);
            if (!match) return;
            const traditional = match[1];
            const simplified = match[2];
            const pinyin = match[3];
            const definition = match[4];

            this.m_emplaceEntry(traditional, simplified, { pinyin, definition });
        });
    }

    private m_emplaceEntry(traditional: string, simplified: string, reading: KanjidicReading): void {
        if (!this.m_simpToTrad.has(simplified)) {
            this.m_simpToTrad.set(simplified, traditional);
        }

        if (!this.m_entries.has(traditional)) {
            this.m_entries.set(traditional, { simplified, traditional, reading: [reading] });
        }
        else {
            const res = this.m_entries.get(traditional);
            if (!res) return;
            res.reading.push(reading);
        }
    }

    public isChinese(mychar: string): boolean {
        return this.m_simpToTrad.has(mychar) || this.m_entries.has(mychar);
    }

    public isSimplified(mychar: string): boolean {
        return this.m_simpToTrad.has(mychar)
    }

    public isTraditional(mychar: string): boolean {
        return this.m_entries.has(mychar)
    }

    // Map simplified to traditional
    private m_simpToTrad: Map<string, string> = new Map();
    // Dictionary entries indexed by traditional chinese
    private m_entries: Map<string, KanjidicEntry> = new Map();
}