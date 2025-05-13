import * as fs from 'fs'
import * as readline from 'readline';

import autoBind from "auto-bind";
import { log_v } from './logging';


export type HanzidbEntry = {
    frequency_rank: number;
    character: string;
    pinyin: string;
    definition: string;
    radical: string;
    radical_code: string;
    stroke_count: number;
    hsk_level?: number;
    general_standard_num?: number;
};



export class Hanzidb {
    constructor() {
        autoBind(this);
    }

    static async create(filePath: string, props?: { maxLines?: number, verbose?: boolean }): Promise<Hanzidb> {
        log_v(!!props?.verbose, "Initializing bccwj");

        const hanzidb = new Hanzidb();
        // Create filestream
        const fileStream = fs.createReadStream(filePath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity, // Recognize all instances of CR LF ('\r\n') as a single line break
        });


        let count = 0;
        let _fields: string[] | undefined = undefined;

        for await (let line of rl) {
            let definition = ''
            line = line.replace(/".+"/, (match) => {
                definition = match;
                return '';
            });
            const vals = line.split(',');
            if (!_fields) {
                _fields = vals;
                continue;
            }

            // fields
            const entry: HanzidbEntry = {
                frequency_rank: parseInt(vals[0]),
                character: vals[1],
                pinyin: vals[2],
                definition,
                radical: vals[4],
                radical_code: vals[5],
                stroke_count: parseInt(vals[6]),
                hsk_level: vals[7] != '' ? parseInt(vals[7]) : undefined,
                general_standard_num: vals[8] != '' ? parseInt(vals[8]) : undefined,
            };
            hanzidb.emplaceEntry(entry);

            if (props?.maxLines) {
                count++;
                if (count >= props.maxLines) break;
            }
        }


        return hanzidb;
    }

    public getEntry(char: string): HanzidbEntry | undefined {
        return this.m_entries.get(char);
    }

    public getHSKChars(): string[] {
        const values: string[][] = [...this.m_hskToChar.values()];
        return values.reduce((a1, a2) => [...a1, ...a2]);
    }

    public getHSK(char: string): number {
        return this.m_charToHsk.get(char) || 0;
    }

    public getNMostFrequent(n: number): string[] {
        if (n > this.m_entries.size) {
            console.error("N too large, max is ", this.m_entries.size);
            return [];
        }
        return Array(n).fill(0)
            .map((_, i) => this.m_rankToChar.get(i + 1) || '')
            .filter(s => s != '');
    }

    public getFrequencyRank(char: string): number {
        return this.m_entries.get(char)?.frequency_rank || 0;
    }

    public forEachEntry(handler: (entry: HanzidbEntry) => void): void {
        this.m_entries.forEach(handler);
    }

    private emplaceEntry(entry: HanzidbEntry): void {
        this.m_entries.set(entry.character, entry);
        this.m_rankToChar.set(entry.frequency_rank, entry.character);
        if (entry.hsk_level != undefined) {
            const res = this.m_hskToChar.get(entry.hsk_level);
            if (!res) this.m_hskToChar.set(entry.hsk_level, [entry.character]);
            else res.push(entry.character);

            this.m_charToHsk.set(entry.character, entry.hsk_level);
        }
    }

    // Map lemma to entry
    private m_rankToChar: Map<number, string> = new Map();
    private m_hskToChar: Map<number, string[]> = new Map();
    private m_charToHsk: Map<string, number> = new Map();
    private m_entries: Map<string, HanzidbEntry> = new Map();
}