import * as fs from 'fs'
import * as readline from 'readline';

import autoBind from "auto-bind";
import { log_v } from './logging';



export class Bclu {
    constructor() {
        autoBind(this);
    }

    static async create(filePath: string, props?: { maxLines?: number, verbose?: boolean }): Promise<Bclu> {
        log_v(!!props?.verbose, "Initializing BCLU");

        const bclu = new Bclu();
        // Create filestream
        const fileStream = fs.createReadStream(filePath, { encoding: 'utf-8' });
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });


        let count = 0;

        for await (const line of rl) {
            const vals = line.split('\t');
            const freq = parseInt(vals[1]);

            bclu.m_entries.set(vals[0], freq);
            if (freq > bclu.m_maxFrequency) {
                bclu.m_maxFrequency = freq;
            }

            if (props?.maxLines) {
                count++;
                if (count >= props.maxLines) break;
            }
        }

        return bclu;
    }

    public getFrequency(word: string): number {
        return this.m_entries.get(word) || 0;
    }

    public getMaxFrequency(): number {
        return this.m_maxFrequency;
    }


    // Map lemma to entry
    private m_maxFrequency: number = 0;
    private m_entries: Map<string, number> = new Map();
}