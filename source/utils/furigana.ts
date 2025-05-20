import { isHanCharacter, isKana } from 'types';

function isStrKatakana(input: string): boolean {
    return input.split('').every(isKana);
}

function katakanaToHiragana(input: string): string {
    return input.replace(/[\u30A1-\u30F6]/g, (char: string) => {
        const code = char.charCodeAt(0);
        return String.fromCharCode(code - 0x60);
    });
}

const isSmallChar = (c: string): boolean => ['ゃ', 'ゅ', 'ょ'].includes(c);

const isKanjiLike = (c: string): boolean => isHanCharacter(c) || c == '々' || c == 'ヶ';
function isStrKanjiOrKana(s: string): boolean {
    if (s.length == 0) console.error("WARNING: Got an empty string in isStrKanjiOrKana, vacuously true");
    return s.split('').every(c => isKanjiLike(c) || isKana(c));
}

// Take in a kanji-rendered string like and hiragana and generate bracketed furigana.
// 頑張る, がんばる -> 頑張[ばんば]る
export function generateFurigana(kanjiReading: string, hiragana: string, padKana: boolean = true): string {
    // console.log(kanjiReading, hiragana);
    // Recursively generate tuple of aligned tokens
    function _generateFurigana(kanjiChars: string[], hiraganaChars: string[]): [string, string][] {
        // console.log(kanjiChars, hiraganaChars);
        // Are the kanji idx and kana idx the same kana (either katakana or hiragana)
        const areAligned = (kanji: number, kana: number): boolean => {
            if (kana == hiraganaChars.length || kanji == kanjiChars.length) return false;
            const kanjiChar = kanjiChars[kanji]
            const kanaChar = hiraganaChars[kana];
            if (!isKana(kanjiChar)) return false;
            return katakanaToHiragana(kanjiChar) == katakanaToHiragana(kanaChar);
        }
        // Helper function for early returns which tokenizes our input with punctuation
        const earlyReturn = (): [string, string][] => {
            // If it starts with grammar, return that
            let kanjiStart = 0;
            let kanaStart = 0;
            while (kanjiStart < kanjiChars.length && !isStrKanjiOrKana(kanjiChars[kanjiStart])) {
                kanjiStart++;
            }
            while (kanaStart < hiraganaChars.length && !isStrKanjiOrKana(hiraganaChars[kanaStart])) {
                kanaStart++;
            }
            if (kanjiStart != 0 || kanaStart != 0) {
                if (kanjiStart == kanjiChars.length) {
                    kanjiStart = 0;
                }
                if (kanaStart == hiraganaChars.length) {
                    kanaStart = 0;
                }

                if (kanjiStart == 0 && kanaStart == 0)
                    return [[kanjiChars.join(''), hiraganaChars.join('')]];
                else return [
                    [kanjiChars.slice(0, kanjiStart).join(''), hiraganaChars.slice(0, kanaStart).join('')],
                    ..._generateFurigana(kanjiChars.slice(kanjiStart), hiraganaChars.slice(kanaStart))
                ];
            }
            // Otherwise, if both are zero, return the first text token
            let kanjiEnd = 0;
            let kanaEnd = 0;
            while (kanjiEnd < kanjiChars.length && isStrKanjiOrKana(kanjiChars[kanjiEnd])) {
                kanjiEnd++;
            }
            while (kanaEnd < hiraganaChars.length && isStrKanjiOrKana(hiraganaChars[kanaEnd])) {
                kanaEnd++;
            }
            return [
                [kanjiChars.slice(0, kanjiEnd).join(''), hiraganaChars.slice(0, kanaEnd).join('')],
                ..._generateFurigana(kanjiChars.slice(kanjiEnd), hiraganaChars.slice(kanaEnd))
            ];
        }

        // Base case: both arrays are empty
        if (kanjiChars.length == 0 && hiraganaChars.length == 0) return [];
        // If one or the other starts with a gramma character, strip it out
        if (!isStrKanjiOrKana(kanjiChars[0]) || !isStrKanjiOrKana(hiraganaChars[0])) {
            return earlyReturn();
        }
        // If both start with kana, find the first sequence and pop it
        if (isKana(kanjiChars[0]) && isKana(hiraganaChars[0])) {
            // console.log("Branch A");
            if (!areAligned(0, 0)) throw "Tried to render invalid furigana";

            let kanaEnd = 0;
            let kanjiEnd = 0;
            // Get the next kana sequence in the kanji reading
            while (
                kanaEnd <= hiraganaChars.length && kanjiEnd <= kanjiChars.length &&
                areAligned(kanaEnd, kanjiEnd)
            ) {
                kanjiEnd++;
                kanaEnd++;
            }

            const seq: [string, string] = [
                kanjiChars.slice(0, kanjiEnd).join(''),
                hiraganaChars.slice(0, kanaEnd).join('')
            ];
            return [
                seq,
                ..._generateFurigana(
                    kanjiChars.slice(kanjiEnd),
                    hiraganaChars.slice(kanaEnd)
                )
            ];
        }
        // If both end with kana, find the last sequence and pop it
        else if (isKana(kanjiChars[kanjiChars.length - 1]) &&
            isKana(hiraganaChars[hiraganaChars.length - 1]) &&
            areAligned(kanjiChars.length - 1, hiraganaChars.length - 1)
        ) {
            // console.log("Branch B");
            let kanaStart = hiraganaChars.length;
            let kanjiStart = kanjiChars.length;
            while (
                kanaStart >= 0 && kanjiStart >= 0 &&
                areAligned(kanjiStart - 1, kanaStart - 1)
            ) {
                kanaStart--;
                kanjiStart--;
            }

            const seq: [string, string] = [
                kanjiChars.slice(kanjiStart, kanjiChars.length).join(''),
                hiraganaChars.slice(kanaStart, hiraganaChars.length).join('')
            ];
            return [
                ..._generateFurigana(
                    kanjiChars.slice(0, kanjiStart),
                    hiraganaChars.slice(0, kanaStart)
                ),
                seq,
            ];

        }
        // Assume one starts with kana and the other doesn't
        else {
            // console.log("Branch C");
            if (!(isKanjiLike(kanjiChars[0]) && isKana(hiraganaChars[0]))) {
                if (isStrKanjiOrKana(kanjiChars[0]) || isStrKanjiOrKana(hiraganaChars[0])) {
                    console.error(kanjiChars, hiraganaChars);
                    throw "Invalid sequence alignment";
                }
            }
            // If everything is kanji, just return
            if (kanjiChars.every(isKanjiLike)) {
                return [[kanjiChars.join(''), hiraganaChars.join('')]];
            }
            // Find the next kana sequence in kanji reading
            let kanjiEnd = 0;
            while (kanjiEnd < kanjiChars.length && isKanjiLike(kanjiChars[kanjiEnd])) {
                kanjiEnd++;
            }
            let kanjiNextKanaEnd = kanjiEnd;
            while (kanjiNextKanaEnd < kanjiChars.length && isKana(kanjiChars[kanjiNextKanaEnd])) {
                kanjiNextKanaEnd++;
            }
            if (kanjiNextKanaEnd == kanjiEnd) {
                // There's nothing left to align
                return [[kanjiChars.join(''), hiraganaChars.join('')]];
            }
            const nextKanaSeq = kanjiChars.slice(kanjiEnd, kanjiNextKanaEnd).join('');
            // Find all possible indices for the next kana seq match;
            // set kanaEnd to one before the start of the next eq
            let kanaNextStartCandidates: number[] = [];
            for (let i = 1; i + nextKanaSeq.length <= hiraganaChars.length; i++) {
                if (!isKana(hiraganaChars[i])) break;
                if (hiraganaChars.slice(i, i + nextKanaSeq.length).join('') == nextKanaSeq) {
                    kanaNextStartCandidates.push(i);
                }
            }
            if (kanaNextStartCandidates.length == 0) {
                console.error("ERROR: Seems to be an incorrect reading.", kanjiReading, hiragana, kanjiChars, hiraganaChars);
                return [[kanjiChars.join(''), hiraganaChars.join('')]];
            }
            // If the sequence we're matching a non-compound, we can disqualify compounds
            if (!isSmallChar(nextKanaSeq.slice(-1))) {
                kanaNextStartCandidates = kanaNextStartCandidates.filter((idx) => {
                    return !isSmallChar(hiraganaChars[idx + nextKanaSeq.length])
                });
            }
            // If there's two candidates or more, we need to tiebreak
            if (kanaNextStartCandidates.length == 2) {
                const ogCandidates = [...kanaNextStartCandidates];
                // If we haven't reached the end of the kanji string, we can disqualify a termiating kana sequence
                kanaNextStartCandidates = kanaNextStartCandidates.filter((idx): boolean => {
                    if (idx == hiraganaChars.length - 1 && kanjiNextKanaEnd != kanjiChars.length)
                        return false;
                    return true;
                });
                // If there's exactly as many matches in the kanji as there are candidates, we can just take the first one
                const kanjiCandidates = [];
                for (let i = kanjiEnd; i + nextKanaSeq.length <= kanjiChars.length; i++) {
                    if (!isKana(hiraganaChars[i])) break;
                    if (kanjiChars.slice(i, i + nextKanaSeq.length).join('') == nextKanaSeq) {
                        kanjiCandidates.push(i);
                    }
                }
                if (kanjiCandidates.length == kanaNextStartCandidates.length) {
                    kanaNextStartCandidates = [kanaNextStartCandidates[0]];
                }
                // If that still doesn't work;
                // Try assigning one kana to each remaining kanji seq char. If there's only one candidate left we cna use that
                const maxCandidateStart = hiraganaChars.length - (kanjiChars.length - kanjiNextKanaEnd) - 1;
                const trimmed = [...ogCandidates].filter(idx => idx <= maxCandidateStart);
                if (trimmed.length == 1) {
                    kanaNextStartCandidates = trimmed;
                }

                if (kanaNextStartCandidates.length > 1) {
                    return earlyReturn();
                }
            }

            const kanaEnd = kanaNextStartCandidates[0];
            const seq: [string, string] = [kanjiChars.slice(0, kanjiEnd).join(''), hiraganaChars.slice(0, kanaEnd).join('')];
            return [
                seq,
                ..._generateFurigana(kanjiChars.slice(kanjiEnd), hiraganaChars.slice(kanaEnd))
            ];
        }
    }
    const readings: [string, string][] = _generateFurigana(kanjiReading.split(''), hiragana.split(''));
    // console.log(readings);
    return readings.map(([s1, s2]): string => {
        // If it's a grammar char, just return it as is
        if (!isStrKanjiOrKana(s1) || !isStrKanjiOrKana(s2)) {
            const isGrammar = (s: string) => s == '' || !isStrKanjiOrKana(s);
            if (!(isGrammar(s1) && isGrammar(s2))) {
                console.log(`t1:"${s1}", t2:"${s2}"`);
                throw "Invalid token";
            }

            if (s1 != '' && s2 != '' && s1 != s2) console.log("WARNING: weird reading", kanjiReading, hiragana, '|', s1, s2);
            return s1;
        }
        else { // isStrKanjiOrKana(s1) && isStrKanjiOrKana(s2)
            let isSingle: boolean = false;
            if (isStrKatakana(s1) && katakanaToHiragana(s1) == s2) {
                isSingle = true;
            }
            if (s1 == s2) {
                isSingle = true;
            }

            if (!isSingle) {
                return `${s1}[${s2}]`;
            }
            else {
                return padKana ? `${s1}[ ]` : s1;
            }
        }
    }).join('');
}

export function generateRuby(kanjiReading: string, hiragana: string): string {
    const reading = generateFurigana(kanjiReading, hiragana);
    return `<ruby>${reading.replace(/\[/g,'<rt>').replace(/\]/g,'</rt>')}</ruby>`;
}

export function generatePinyinRuby(kanji: string, pinyin: string): string {
    const pinyinParts = pinyin.split(' ');
    const content = kanji.split('').map((c, i) => `${c}<rt>${pinyinParts[i]}</rt>`).join('');
    return `<ruby>${content}</ruby>`
}

export function replaceWithRuby(source: string): string {
    return source.replace(/((\p{Script=Han}|\p{Script=Hiragana}|\p{Script=Katakana})+?)\[(.+?)\]/gu, (m: string) => {
        const parts = m.split('[');
        const chars = parts[0];
        const reading = parts[1].slice(0, -1);
        if (isKana(reading.substring(0, 1))) return generateRuby(chars, reading);
        else return generatePinyinRuby(chars, reading);
    });
}

export function replaceRubyForId(id: string): void {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = replaceWithRuby(el.innerHTML);
}