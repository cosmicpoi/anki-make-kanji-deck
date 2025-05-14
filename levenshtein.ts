import * as levenshtein from 'fast-levenshtein';

export function minSubstrLevenshtein(query: string, target: string): number {
    if (query.length > target.length) {
        return levenshtein.get(query, target);
    }

    let minDist = Infinity;
    for (let i = 0; i <= target.length - query.length; i++) {
        const sub = target.substring(i, i + query.length);
        const dist = levenshtein.get(query, sub);
        if (dist < minDist) {
            minDist = dist;
        }
    }

    return minDist;
}