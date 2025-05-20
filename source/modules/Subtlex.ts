import * as fs from 'fs'
import * as readline from 'readline';

import autoBind from "auto-bind";
import { log_v } from '../utils/logging';


export class Subtlex {
    constructor() {
        autoBind(this);
    }

    static async create(filePath: string, props?: { maxLines?: number, verbose?: boolean }): Promise<Subtlex> {
        log_v(!!props?.verbose, "Initializing Subltex");

        const subtlex = new Subtlex();
        // Create filestream
        const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });


        let count = 0;

        for await (const line of rl) {
            if (count <= 2) {
                count++;
                continue;
            }
            const vals = line.split(',');
            const freq = parseInt(vals[1]);

            subtlex.m_entries.set(vals[0], { freq, rank: count - 2 });
            if (freq > subtlex.m_maxFrequency) {
                subtlex.m_maxFrequency = freq;
            }
            subtlex.m_freqRankToWord.set(count - 2, vals[0]);

            if (props?.maxLines) {
                count++;
                if (count >= props.maxLines) break;
            }
        }

        return subtlex;
    }

    public getFrequency(word: string): number {
        return this.m_entries.get(word)?.freq || 0;
    }

    public getFrequencyRank(word: string): number {
        return this.m_entries.get(word)?.rank || 0;
    }

    public getNMostFrequentWords(n: number): string[] {
        if (n > this.m_entries.size) {
            console.error("N too large, max is ", this.m_entries.size);
            return [];
        }
        return Array(n).fill(0)
            .map((_, i) => this.m_freqRankToWord.get(i + 1) || '')
            .filter(s => s != '');
    }

    public getMaxFrequency(): number {
        return this.m_maxFrequency;
    }


    // Map lemma to entry
    private m_freqRankToWord: Map<number, string> = new Map();
    private m_maxFrequency: number = 0;
    private m_entries: Map<string, { freq: number, rank: number }> = new Map();
}