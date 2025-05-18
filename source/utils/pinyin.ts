const vowelTable: Record<string, string[]> = {
    'a': ['ā', 'á', 'ǎ', 'à', 'a'],
    'o': ['ō', 'ó', 'ǒ', 'ò', 'o'],
    'e': ['ē', 'é', 'ě', 'è', 'e'],
    'i': ['ī', 'í', 'ǐ', 'ì', 'i'],
    'u': ['ū', 'ú', 'ǔ', 'ù', 'u'],
    'ü': ['ǖ', 'ǘ', 'ǚ', 'ǜ', 'ü'],
};

export function generateAccentPinyin(input: string): string {
    const replaceU = input.replace(/u:/g, 'ü');
    const toneNumber: number = parseInt(replaceU.slice(-1));
    const rest: string = replaceU.slice(0, -1);
    const chars = rest.split('');
    let vowelIndex: number = -1;

    if (rest.slice(-2) == 'iu' || rest.slice(-2) == 'iü') {
        vowelIndex = rest.length - 1;
    }
    else {
        const vowelOrder = ['a', 'o', 'e', 'i', 'u', 'ü'];
        const orderOfVowel = (char: string): number => {
            for (let i = 0; i < vowelOrder.length; i++) {
                if (vowelOrder[i] == char) return i;
            }
            return -1;
        }

        let bestVowelOrder = vowelOrder.length + 100;
        let bestCharIndex = -1;
        for (let i = 0; i < chars.length; i++) {
            const order = orderOfVowel(chars[i]);
            if (order != -1 && order < bestVowelOrder) {
                if (order < bestVowelOrder) {
                    bestVowelOrder = order;
                    bestCharIndex = i;
                }
            }
        }
        if (bestCharIndex == -1 || bestVowelOrder == -1) return input;
        vowelIndex = bestCharIndex;
    }

    if (vowelIndex == -1) return input;
    chars[vowelIndex] = vowelTable[chars[vowelIndex]][toneNumber - 1];
    return chars.join('');
}

export function generateAccentPinyinDelim(input: string, delim: string = ' '): string {
    return input.split(delim).map(w => generateAccentPinyin(w)).join(delim);
}