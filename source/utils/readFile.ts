import * as fs from 'fs';

export function readFileLines(filePath: string): string[] {
    const invisibleChars = /[\u200B\u200C\u200D\u2060\uFEFF]/g;
    const content = fs.readFileSync(filePath, 'utf-8');
    return content.replace(invisibleChars, '').split('\n').filter(c => c != '');
}