
export enum CharacterType {
    TraditionalChinese = "TraditionalChinese",
    SimplifiedChinese = "SimplifiedChinese",
    Japanese = "Japanese",
};

export const combine_without_duplicates = <T>(...arrays: T[][]): T[] =>
    [...new Set(arrays.flat())];

export const common_elements = (a1: string[], a2: string[]) =>
    [...a1].filter(item => a2.includes(item));

// Everything in a1 not in a2
export const array_difference = <T>(a1: T[], a2: T[]): T[] =>
    [...a1].filter(item => !a2.includes(item));

export const isSameArray = (a1: string[], a2: string[]) =>
    array_difference(a1, a2).length == 0 && a1.length == a2.length;
// Get similarity between two cards based on pinyin and yomi. return [match, pct]
// - if at least one pinyin doesn't match, return 0
// - `match` - the number of common jp readings between the two as a uint
// - `pct` - `match` divided by max(# of jp readings)

export function apply_getter_to_arr(getter: (c: string) => string[], arr: string[]): string[] {
    let all_guesses: string[] = [];
    arr.forEach((baseChar: string) => {
        const guesses: string[] = getter(baseChar);
        all_guesses.push(...guesses);
    });

    return [...new Set(all_guesses)];
}

// Apply `apply_getter_to_arr` over multiple arrays
export function apply_multi_getter(getter: (c: string) => string[], arrs: string[][]): string[] {
    let all_guesses: string[] = [];
    arrs.forEach((baseArr: string[]) => {
        const guesses: string[] = apply_getter_to_arr(getter, baseArr);
        all_guesses.push(...guesses);
    });

    return all_guesses;
}


export type CountHandler = {
    increment: () => void;
    get: () => number;
};

export const make_count_handler = (): CountHandler => {
    let count = 0;
    const increment = (): number => count++;
    const get = (): number => count;

    return { increment, get };
};

export const k_UNICODE_HAN_BOUNDS: [number, number][] = [
    // CJK Unified Ideographs Extension A (U+3400 through U+4DBF)
    [0x3400, 0x4DBF],

    // CJK Unified Ideographs (U+4E00 through U+9FFF)
    [0x4E00, 0x9FFF],

    // CJK Compatibility Ideographs (U+F900 through U+FAD9)
    [0xF900, 0xFAD9],

    // CJK Unified Ideographs Extension B (U+20000 through U+2A6DF)
    // CJK Unified Ideographs Extension C (U+2A700 through U+2B739)
    // CJK Unified Ideographs Extension D (U+2B740 through U+2B81D)
    // CJK Unified Ideographs Extension E (U+2B820 through U+2CEA1)
    // CJK Unified Ideographs Extension F (U+2CEB0 through U+2EBE0)
    // CJK Unified Ideographs Extension I (U+2EBF0 through U+2EE5D)
    [0x20000, 0x2A6DF],

    // CJK Compatibility Ideographs Supplement (U+2F800 through U+2FA1D)
    [0x2F800, 0x2FA1D],

    // CJK Unified Ideographs Extension G (U+30000 through U+3134A)
    // CJK Unified Ideographs Extension H (U+31350 through U+323AF)
    [0x30000, 0x323AF],
];

export function isHanCharacter(char: string): boolean {
    const code = char.charCodeAt(0);
    for (const tup of k_UNICODE_HAN_BOUNDS) {
        if (code >= tup[0] && code < tup[1]) return true;
    }

    return false;
}

export function isHiragana(char: string): boolean {
    const code = char.codePointAt(0);
    return code !== undefined && code >= 0x3040 && code <= 0x309F;
}

export function isKatakana(char: string): boolean {
    const code = char.codePointAt(0);
    // Standard Katakana and Katakana Phonetic Extensions
    return code !== undefined && (
        (code >= 0x30A0 && code <= 0x30FF) || // Katakana block
        (code >= 0x31F0 && code <= 0x31FF)    // Katakana Phonetic Extensions
    );
}

export function isKana(char: string): boolean {
    // Exclude exotic or rare kana
    // Do not exclude 'ー'
    const exclusions = ['・', 'ヽ', 'ヾ', 'ヿ', '゙', '゚', '゛', '゜', 'ゝ', 'ゞ', 'ゟ'];
    return (isHiragana(char) || isKatakana(char)) && !exclusions.includes(char);
}

export function isHanCharacters(s: string): boolean {
    return s.split('').every(isHanCharacter);
}

export function strIsKana(s: string): boolean {
    return s.split('').every(isKana);
}

export function pairsOf<T, S>(a1: Iterable<T>, a2: Iterable<S>): [T, S][] {
    const pairs: [T, S][] = [];
    for (const i1 of a1) {
        for (const i2 of a2) {
            pairs.push([i1, i2]);
        }
    }

    return pairs;
}

export function tuplesOf<T>(a: T[]): [T, T][] {
    const pairs: [T, T][] = [];
    for (let i = 0; i < a.length; i++) {
        for (let j = i + 1; j < a.length; j++) {
            pairs.push([a[i], a[j]]);
        }
    }

    return pairs;
}

export function orderedTuplesOf<T>(a: T[]): [T, T][] {
    const pairs: [T, T][] = [];
    for (let i = 0; i < a.length; i++) {
        for (let j = 0; j < a.length; j++) {
            pairs.push([a[i], a[j]]);
        }
    }

    return pairs;
}

export function jlptTag(n: number) {
    let tag = "JLPT";
    for (let i = 1; i <= n; i++) {
        tag = tag + "::n" + i;
    }
    return tag;
}

export function hskTag(n: number) {
    let tag = "HSK";
    for (let i = 6; i >= n; i--) {
        tag = tag + "::" + i;
    }
    return tag;
}

export function getMatchAndPct(l1: string[], l2: string[]): [number, number] {
    const r1: Set<string> = new Set(l1);
    const r2: Set<string> = new Set(l2);
    const common = common_elements([...r1], [...r2]);

    const match = common.length; // # of jp readings
    const max = Math.min(r1.size, r2.size);
    const pct = match / max; // # proportion matched 

    return [match, pct];
}

export function areMeaningsSimilar(
    m1: string,
    m2: string,
    props?: {
        logFails?: boolean;
        logAll?: boolean;
        logSuccess?: boolean;
    }
): boolean {
    const getWordList = (str: string): string[] =>
        str.replace(/\(.+\)/, '')         // remove parenthesized 
            .replace(/\[.+\]\)/, '')       // remove brackets 
            .replace(/,|;/g, ' ')          // strip puncutation
            .split(/\s+/)                  // split by whitespace
            .filter(s => s != '')          // remove empty chars
            .filter(s => !['rad.', 'radical', 'Kangxi'].includes(s))      // remove annotations
            .filter(s => !s.match(/\d+/)); // don't match numbers

    const engWords1 = getWordList(m1);
    const engWords2 = getWordList(m2);
    engWords1.sort();
    engWords2.sort();


    let res = false;

    const common_eng = common_elements(engWords1, engWords2);

    // If it just matches a lot
    if (common_eng.length >= 4) {
        res = true;
    }
    // If the smaller one is a strict subset of the larger one
    else if (common_eng.length >= 1 && Math.min(engWords1.length, engWords2.length) - common_eng.length == 0) {
        res = true;
    }
    // If there's a decent number of matches and the total number of matches is a high proportion of the total string length
    else if (common_eng.length >= 3 && Math.min(engWords1.length, engWords2.length) - common_eng.length <= 1) {
        res = true;
    }

    // if (!res) 
    if (!!props?.logAll || (props?.logFails && !res) || (props?.logSuccess && res)) {
        console.log("Comparing meanings:")
        console.log(m1);
        console.log(m2);
        console.log(engWords1);
        console.log(engWords2);
        console.log(common_eng)
    }

    return res;
}