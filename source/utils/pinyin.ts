const vowelTable = {
    'a': ['ā', 'á', 'ǎ', 'à', 'a'],
    'o': ['ō', 'ó', 'ǒ', 'ò', 'o'],
    'e': ['ē', 'é', 'ě', 'è', 'e'],
    'i': ['ī', 'í', 'ǐ', 'ì', 'i'],
    'u': ['ū', 'ú', 'ǔ', 'ù', 'u'],
    'ü': ['ǖ', 'ǘ', 'ǚ', 'ǜ', 'ü'],
};

export function generateAccentPinyin(input: string): string {
    const isUu: boolean = !!input.match(':');
    const toneNumber: number = parseInt(input.slice(0, -1));
    const endIdx = isUu ? input.length - 2 : input.length - 1;
    const rest: string = input.substring(0, endIdx);

}