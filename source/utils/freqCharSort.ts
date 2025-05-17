import { Unihan } from "Unihan";

type FreqDb = {
    getFrequency(char: string): number;
    getMaxFrequency(): number;
}

// Max strokes in Unihan is 84, so denominator of 100 is reasonable
const k_STROKE_DEN = 100;
const getFreqIdx = (unihan: Unihan, getFreq: (c: string) => number, candidate: string): number => {
    let strokeSum = 0;
    for (const c of candidate) {
        strokeSum += unihan.getTotalStrokes(candidate);
    }
    return getFreq(candidate) - strokeSum / k_STROKE_DEN;
}

type JapaneseFreqCharSorter = {
    getJpFreqIdx: (a: string) => number;
    jpSorter: (a: string, b: string) => number;
}

type ChineseFreqCharSorter = {
    getCnFreqIdx: (a: string) => number;
    cnSorter: (a: string, b: string) => number;
};

type FreqCharSorter = JapaneseFreqCharSorter & ChineseFreqCharSorter;

export function getCnSorter(modules: { unihan: Unihan, freq: FreqDb }): ChineseFreqCharSorter {
    const { freq, unihan } = modules;

    const getCnFreqIdx = (a: string): number => getFreqIdx(unihan, freq.getFrequency, a);
    const cnSorter = (a: string, b: string) =>
        getCnFreqIdx(b) - getCnFreqIdx(a);

    return { getCnFreqIdx, cnSorter };
}

export function getJpSorter(modules: { unihan: Unihan, freq: FreqDb }): JapaneseFreqCharSorter {
    const { freq, unihan } = modules;

    const getJpFreqIdx = (a: string): number => getFreqIdx(unihan, freq.getFrequency, a);
    const jpSorter = (a: string, b: string) =>
        getJpFreqIdx(b) - getJpFreqIdx(a);

    return { getJpFreqIdx, jpSorter };
}

export function getSorter(modules: { unihan: Unihan, jpFreq: FreqDb, cnFreq: FreqDb }): FreqCharSorter {
    const { jpFreq, cnFreq, unihan } = modules;

    const cnMaxFreq = cnFreq.getMaxFrequency();
    const jpMaxFreq = jpFreq.getMaxFrequency();

    let cnFreqNorm = 2000000000 / cnMaxFreq;
    let jpFreqNorm = 2000000000 / jpMaxFreq;

    const getCnFreqIdx = (a: string): number => getFreqIdx(unihan, cnFreq.getFrequency, a) * cnFreqNorm;
    const getJpFreqIdx = (a: string): number => getFreqIdx(unihan, jpFreq.getFrequency, a) * jpFreqNorm;

    const jpSorter = (a: string, b: string) =>
        getJpFreqIdx(b) - getJpFreqIdx(a);
    const cnSorter = (a: string, b: string) =>
        getCnFreqIdx(b) - getCnFreqIdx(a);

    return { getCnFreqIdx, getJpFreqIdx, jpSorter, cnSorter };
}