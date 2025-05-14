import { Bccwj } from "./bccwj";
import { Bclu } from "./Bclu";
import { Unihan } from "./unihan";

// Max strokes in Unihan is 84, so denominator of 100 is reasonable
const k_STROKE_DEN = 100;
const getFreqIdx = (unihan: Unihan, getFreq: (c: string) => number, candidate: string): number => {
    let strokeSum = 0;
    for (const c of candidate) {
        const strokeCountInv = (k_STROKE_DEN - unihan.getTotalStrokes(candidate));
        strokeSum += strokeCountInv;
    }
    return getFreq(candidate) + strokeSum / k_STROKE_DEN;
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

export function getCnSorter(modules: { unihan: Unihan, bclu: Bclu }): ChineseFreqCharSorter {
    const { bclu, unihan } = modules;

    const getCnFreqIdx = (a: string): number => getFreqIdx(unihan, bclu.getFrequency, a);
    const cnSorter = (a: string, b: string) =>
        getCnFreqIdx(b) - getCnFreqIdx(a);

    return { getCnFreqIdx, cnSorter };
}

export function getJpSorter(modules: { unihan: Unihan, bccwj: Bccwj }): JapaneseFreqCharSorter {
    const { bccwj, unihan } = modules;

    const getJpFreqIdx = (a: string): number => getFreqIdx(unihan, bccwj.getFrequency, a);
    const jpSorter = (a: string, b: string) =>
        getJpFreqIdx(b) - getJpFreqIdx(a);

    return { getJpFreqIdx, jpSorter };
}

export function getSorter(modules: { unihan: Unihan, bccwj: Bccwj, bclu: Bclu }): FreqCharSorter {
    const { bclu, bccwj, unihan } = modules;

    const cnMaxFreq = bclu.getMaxFrequency();
    const jpMaxFreq = bccwj.getMaxFrequency();

    let cnFreqNorm = 2000000000 / cnMaxFreq;
    let jpFreqNorm = 2000000000 / jpMaxFreq;

    const getCnFreqIdx = (a: string): number => getFreqIdx(unihan, bclu.getFrequency, a) * cnFreqNorm;
    const getJpFreqIdx = (a: string): number => getFreqIdx(unihan, bccwj.getFrequency, a) * jpFreqNorm;

    const jpSorter = (a: string, b: string) =>
        getJpFreqIdx(b) - getJpFreqIdx(a);
    const cnSorter = (a: string, b: string) =>
        getCnFreqIdx(b) - getCnFreqIdx(a);

    return { getCnFreqIdx, getJpFreqIdx, jpSorter, cnSorter };
}